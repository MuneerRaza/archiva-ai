"""Processing pipeline — orchestrates extraction, transcription, and LLM steps for a file."""

import uuid
from dataclasses import dataclass, field
from pathlib import Path

import asyncpg

from app.logging import get_logger
from app.models.file import FileStatus
from app.models.processing import ProcessingStatus, ProcessingStep
from app.models.workspace import (
    FileCategory,
    IngestionSettings,
    WorkspaceSettingsModel,
)
from app.repositories.ai_model import AIModelRepository
from app.repositories.processing import ProcessingRepository
from app.services.processing.category import resolve_file_category
from app.services.processing.events import (
    ProcessingCompleted,
    ProcessingFailed,
    ProcessingStarted,
    event_bus,
)
from app.services.processing.extractors.base import ExtractionResult
from app.services.processing.extractors.factory import get_extractor

logger = get_logger(__name__)

_AUDIO_VIDEO_CATEGORIES = {FileCategory.AUDIO, FileCategory.VIDEO}


@dataclass
class PipelineDecisions:
    want_extraction: bool = True
    want_transcription: bool = False
    want_summary: bool = False
    want_structure: bool = False
    want_overview: bool = False


class ProcessingPipeline:

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._repo = ProcessingRepository(conn)
        self._conn = conn

    async def process_file(
        self,
        file_id: uuid.UUID,
        workspace_id: uuid.UUID,
        storage_key: str,
        mime_type: str,
        workspace_settings: WorkspaceSettingsModel | None = None,
        step_overrides: list[str] | None = None,
    ) -> None:
        """Run the full processing pipeline for a file."""
        filename = storage_key.rsplit("/", 1)[-1] if "/" in storage_key else storage_key
        logger.info(
            "pipeline_start",
            file_id=str(file_id),
            mime_type=mime_type,
            step_overrides=step_overrides,
        )

        job_row = await self._repo.create_job(file_id, workspace_id)
        job_id: uuid.UUID = job_row["id"]

        await self._repo.update_file_status(file_id, FileStatus.PROCESSING)
        await self._repo.update_job_status(job_id, ProcessingStatus.RUNNING, progress=0)
        await event_bus.emit(ProcessingStarted(file_id=file_id, workspace_id=workspace_id))

        steps_result: dict[str, str] = {}

        ingestion = (workspace_settings or WorkspaceSettingsModel()).ingestion

        category = resolve_file_category(mime_type, filename)
        decisions = self._resolve_steps(ingestion, category, step_overrides)

        try:
            # Track available text content through the pipeline
            raw_text: str | None = None
            summary_text: str | None = None

            # --- Step 1: Extraction (text-based files) ---
            if decisions.want_extraction:
                extraction = await self._run_extraction(
                    file_id, job_id, storage_key, mime_type, steps_result,
                )
                if extraction is not None:
                    raw_text = extraction.raw_text

                    if decisions.want_structure:
                        steps_result[ProcessingStep.STRUCTURE] = "completed"

            # --- Step 2: Transcription (audio/video only) ---
            if decisions.want_transcription:
                transcript = await self._run_transcription(
                    file_id, storage_key, ingestion, steps_result,
                )
                if transcript:
                    raw_text = transcript
                await self._repo.update_job_status(
                    job_id, ProcessingStatus.RUNNING, progress=50, steps=steps_result,
                )

            # If no content-producing step ran (or produced nothing),
            # load existing content from DB for downstream steps
            needs_content = decisions.want_summary or decisions.want_overview
            if raw_text is None and needs_content:
                content_row = await self._repo.get_file_content(file_id)
                if content_row:
                    raw_text = content_row["raw_text"]
                    summary_text = content_row["summary"]

            # --- Step 3: Summary (uses raw_text — which may be transcript) ---
            if decisions.want_summary:
                if raw_text:
                    summary_text = await self._run_llm_summary(
                        file_id, raw_text, ingestion, steps_result,
                    )
                else:
                    steps_result[ProcessingStep.SUMMARY] = "skipped"
                await self._repo.update_job_status(
                    job_id, ProcessingStatus.RUNNING, progress=75, steps=steps_result,
                )

            # --- Step 4: Overview (uses best available content) ---
            if decisions.want_overview:
                await self._run_llm_overview(
                    file_id, raw_text, summary_text, ingestion, steps_result,
                )

            # Mark complete
            await self._repo.update_file_status(file_id, FileStatus.READY)
            await self._repo.update_job_status(
                job_id, ProcessingStatus.COMPLETED, progress=100, steps=steps_result,
            )
            await event_bus.emit(ProcessingCompleted(file_id=file_id, workspace_id=workspace_id))
            logger.info("pipeline_complete", file_id=str(file_id))

        except Exception as e:
            logger.exception("pipeline_error", file_id=str(file_id))
            await self._repo.update_file_status(file_id, FileStatus.FAILED)
            await self._repo.update_job_status(
                job_id, ProcessingStatus.FAILED,
                error_message=_short_error(e), steps=steps_result,
            )
            await event_bus.emit(ProcessingFailed(
                file_id=file_id, workspace_id=workspace_id, error=str(e),
            ))

    @staticmethod
    def _resolve_steps(
        ingestion: IngestionSettings,
        category: FileCategory | None,
        step_overrides: list[str] | None,
    ) -> PipelineDecisions:
        """Determine which pipeline steps to run from category settings."""
        if step_overrides is not None:
            return PipelineDecisions(
                want_extraction="extraction" in step_overrides,
                want_transcription="transcription" in step_overrides,
                want_summary="summary" in step_overrides,
                want_structure="structure" in step_overrides,
                want_overview="overview" in step_overrides,
            )

        if category is None:
            return PipelineDecisions(want_extraction=True)

        cat_settings = getattr(ingestion, category.value)

        is_audio_video = category in _AUDIO_VIDEO_CATEGORIES
        want_transcription = is_audio_video and getattr(cat_settings, "transcription", False)

        # Audio/video skip text extraction (nothing to extract)
        want_extraction = not is_audio_video

        want_summary = getattr(cat_settings, "summary", False)
        want_structure = getattr(cat_settings, "structure", False)

        # Overview is standalone — not tied to summary
        want_overview = ingestion.generate_overview

        # If structure is requested, extraction is required
        if want_structure and not want_extraction:
            want_extraction = True

        return PipelineDecisions(
            want_extraction=want_extraction,
            want_transcription=want_transcription,
            want_summary=want_summary,
            want_structure=want_structure,
            want_overview=want_overview,
        )

    async def _run_extraction(
        self,
        file_id: uuid.UUID,
        job_id: uuid.UUID,
        storage_key: str,
        mime_type: str,
        steps_result: dict[str, str],
    ) -> ExtractionResult | None:
        filename = storage_key.rsplit("/", 1)[-1] if "/" in storage_key else storage_key
        extractor = get_extractor(mime_type, filename)

        if extractor is None:
            steps_result[ProcessingStep.EXTRACTION] = "skipped"
            logger.info("no_extractor", file_id=str(file_id), mime_type=mime_type)
            return None

        from app.config import settings
        file_path = Path(settings.app.local_storage_path) / storage_key

        result = await extractor.extract(file_path, mime_type)
        steps_result[ProcessingStep.EXTRACTION] = "completed"

        await self._repo.upsert_file_content(
            file_id=file_id,
            raw_text=result.raw_text,
            page_count=result.page_count,
            word_count=result.word_count,
            language=result.language,
            structure=result.structure,
        )

        if result.tables:
            await self._repo.delete_file_tables(file_id)
            for idx, table in enumerate(result.tables):
                await self._repo.insert_file_table(
                    file_id=file_id,
                    table_index=idx,
                    headers=table.headers,
                    rows=table.rows,
                    page_number=table.page_number,
                    sheet_name=table.sheet_name,
                )

        await self._repo.update_job_status(
            job_id, ProcessingStatus.RUNNING, progress=25, steps=steps_result,
        )
        return result

    async def _run_transcription(
        self,
        file_id: uuid.UUID,
        storage_key: str,
        ingestion: IngestionSettings,
        steps_result: dict[str, str],
    ) -> str | None:
        """Transcribe an audio/video file and store the transcript as raw_text."""
        if not ingestion.transcription_model_id:
            logger.info("no_transcription_model_configured", file_id=str(file_id))
            steps_result[ProcessingStep.TRANSCRIPTION] = "skipped"
            return None

        try:
            ai_repo = AIModelRepository(self._conn)
            row = await ai_repo.get_by_id(uuid.UUID(ingestion.transcription_model_id))
            if not row:
                logger.warning(
                    "transcription_model_not_found",
                    file_id=str(file_id),
                    model_id=ingestion.transcription_model_id,
                )
                steps_result[ProcessingStep.TRANSCRIPTION] = "skipped"
                return None

            from app.services.transcription.factory import get_transcription_provider
            provider = get_transcription_provider(row)

            from app.config import settings
            file_path = Path(settings.app.local_storage_path) / storage_key

            result = await provider.transcribe(file_path)

            if not result.text:
                steps_result[ProcessingStep.TRANSCRIPTION] = "skipped"
                return None

            word_count = len(result.text.split())
            await self._repo.upsert_file_content(
                file_id=file_id,
                raw_text=result.text,
                word_count=word_count,
                language=result.language,
            )

            steps_result[ProcessingStep.TRANSCRIPTION] = "completed"
            logger.info(
                "transcription_stored",
                file_id=str(file_id),
                word_count=word_count,
                language=result.language,
            )
            return result.text

        except Exception as e:
            logger.exception("transcription_failed", file_id=str(file_id))
            steps_result[ProcessingStep.TRANSCRIPTION] = f"failed: {_short_error(e)}"
            return None

    async def _get_llm_provider(self, ingestion: IngestionSettings, file_id: uuid.UUID):
        if not ingestion.summary_model_id:
            logger.info("no_summary_model_configured", file_id=str(file_id))
            return None

        try:
            ai_repo = AIModelRepository(self._conn)
            row = await ai_repo.get_by_id(uuid.UUID(ingestion.summary_model_id))
            if not row:
                logger.warning("summary_model_not_found", file_id=str(file_id), model_id=ingestion.summary_model_id)
                return None

            from app.services.llm.factory import get_llm_provider_from_model
            return get_llm_provider_from_model(row)
        except Exception:
            logger.warning("llm_provider_unavailable", file_id=str(file_id))
            return None

    async def _get_overview_llm_provider(self, ingestion: IngestionSettings, file_id: uuid.UUID):
        if not ingestion.overview_model_id:
            logger.info("no_overview_model_configured", file_id=str(file_id))
            return None

        try:
            ai_repo = AIModelRepository(self._conn)
            row = await ai_repo.get_by_id(uuid.UUID(ingestion.overview_model_id))
            if not row:
                logger.warning("overview_model_not_found", file_id=str(file_id), model_id=ingestion.overview_model_id)
                return None

            from app.services.llm.factory import get_llm_provider_from_model
            return get_llm_provider_from_model(row)
        except Exception:
            logger.warning("overview_llm_provider_unavailable", file_id=str(file_id))
            return None

    async def _run_llm_summary(
        self,
        file_id: uuid.UUID,
        raw_text: str,
        ingestion: IngestionSettings,
        steps_result: dict[str, str],
    ) -> str | None:
        """Generate a summary from raw_text. Returns the summary text or None."""
        text = raw_text[:10000]
        if not text.strip():
            steps_result[ProcessingStep.SUMMARY] = "skipped"
            return None

        provider = await self._get_llm_provider(ingestion, file_id)
        if not provider:
            steps_result[ProcessingStep.SUMMARY] = "skipped"
            return None

        try:
            from app.services.processing.llm_steps import generate_summary
            summary = await generate_summary(
                text,
                provider,
                length=ingestion.summary_length.value,
                custom_instructions=ingestion.summary_instructions,
            )
            await self._repo.upsert_file_content(file_id=file_id, summary=summary)
            steps_result[ProcessingStep.SUMMARY] = "completed"
            return summary
        except Exception as e:
            logger.exception("summary_generation_failed", file_id=str(file_id))
            steps_result[ProcessingStep.SUMMARY] = f"failed: {_short_error(e)}"
            return None

    async def _run_llm_overview(
        self,
        file_id: uuid.UUID,
        raw_text: str | None,
        summary_text: str | None,
        ingestion: IngestionSettings,
        steps_result: dict[str, str],
    ) -> None:
        """Generate an overview from the best available content (summary > raw_text)."""
        # Prefer summary for overview input, fall back to raw_text
        content = summary_text or raw_text or ""
        text = content[:5000]
        if not text.strip():
            steps_result[ProcessingStep.OVERVIEW] = "skipped"
            return

        provider = await self._get_overview_llm_provider(ingestion, file_id)
        if not provider:
            steps_result[ProcessingStep.OVERVIEW] = "skipped"
            return

        try:
            from app.services.processing.llm_steps import generate_overview
            overview = await generate_overview(text, provider)
            await self._repo.upsert_file_content(file_id=file_id, overview=overview)
            steps_result[ProcessingStep.OVERVIEW] = "completed"
        except Exception as e:
            logger.exception("overview_generation_failed", file_id=str(file_id))
            steps_result[ProcessingStep.OVERVIEW] = f"failed: {_short_error(e)}"


def _short_error(exc: Exception) -> str:
    """Extract a short, user-readable error reason from an exception."""
    msg = str(exc)
    if len(msg) > 120:
        msg = msg[:117] + "..."
    return msg or type(exc).__name__
