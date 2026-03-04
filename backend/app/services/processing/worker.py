"""Background processing worker — listens for FileUploaded events and processes files."""

import asyncio
import uuid

from app.database import get_pool
from app.logging import get_logger
from app.services.processing.events import (
    FileUploaded,
    ProcessingEvent,
    event_bus,
)
from app.services.processing.pipeline import ProcessingPipeline

logger = get_logger(__name__)

MAX_CONCURRENT = 3


class ProcessingWorker:

    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)
        self._tasks: dict[uuid.UUID, asyncio.Task[None]] = {}

    async def start(self) -> None:
        event_bus.subscribe(self._on_event)
        logger.info("processing_worker_started", max_concurrent=MAX_CONCURRENT)

    async def stop(self) -> None:
        event_bus.unsubscribe(self._on_event)
        tasks_to_cancel = []
        for file_id, task in list(self._tasks.items()):
            if not task.done():
                task.cancel()
                tasks_to_cancel.append(task)
                logger.info("cancelled_processing_task", file_id=str(file_id))
        # Wait for cancelled tasks to finish so DB connections are released
        if tasks_to_cancel:
            await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
        self._tasks.clear()
        logger.info("processing_worker_stopped")

    async def _on_event(self, event: ProcessingEvent) -> None:
        if isinstance(event, FileUploaded):
            await self._queue_processing(event)

    async def _queue_processing(self, event: FileUploaded) -> None:
        file_id = event.file_id
        logger.info("queuing_processing", file_id=str(file_id))

        # Cancel any existing task for this file
        existing = self._tasks.get(file_id)
        if existing and not existing.done():
            existing.cancel()

        task = asyncio.create_task(self._process(event))
        self._tasks[file_id] = task
        task.add_done_callback(lambda t: self._task_done(file_id, t))

    def _task_done(self, file_id: uuid.UUID, task: asyncio.Task[None]) -> None:
        self._tasks.pop(file_id, None)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.exception(
                "processing_task_failed",
                file_id=str(file_id),
                error=str(exc),
                exc_info=exc,
            )

    async def _process(self, event: FileUploaded) -> None:
        async with self._semaphore:
            pool = get_pool()
            async with pool.acquire() as conn:
                # Fetch workspace settings
                ws_row = await conn.fetchrow(
                    "SELECT settings FROM workspaces WHERE id = $1",
                    event.workspace_id,
                )
                from app.models.workspace import WorkspaceSettingsModel
                ws_settings = WorkspaceSettingsModel()
                if ws_row and ws_row["settings"]:
                    import json
                    settings_raw = ws_row["settings"]
                    if isinstance(settings_raw, str):
                        settings_raw = json.loads(settings_raw)
                    ws_settings = WorkspaceSettingsModel.model_validate(settings_raw)

                pipeline = ProcessingPipeline(conn)
                await pipeline.process_file(
                    file_id=event.file_id,
                    workspace_id=event.workspace_id,
                    storage_key=event.storage_key,
                    mime_type=event.mime_type,
                    workspace_settings=ws_settings,
                    step_overrides=event.step_overrides,
                )


# Global singleton
worker = ProcessingWorker()
