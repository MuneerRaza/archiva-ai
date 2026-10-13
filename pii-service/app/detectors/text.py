"""Text PII detection: Presidio (regex/NLP recognizers) + GLiNER (zero-shot NER)
+ user-supplied custom regex. Findings are merged and overlapping spans deduped."""

import asyncio
import re

from app.config import settings
from app.logging import get_logger
from app.models.detection import (
    Detection,
    DetectionSource,
    LocationType,
)

logger = get_logger(__name__)

# GLiNER returns lowercase NL labels; surface them as UPPER_SNAKE entity types
# to align with Presidio's naming in the UI.
_GLINER_LABEL_TO_ENTITY = {
    "person": "PERSON",
    "email": "EMAIL_ADDRESS",
    "phone number": "PHONE_NUMBER",
    "address": "LOCATION",
    "organization": "ORGANIZATION",
    "date of birth": "DATE_TIME",
    "credit card number": "CREDIT_CARD",
    "social security number": "US_SSN",
}


class TextDetector:
    """Lazily builds the Presidio analyzer + GLiNER model on first use."""

    def __init__(self) -> None:
        self._analyzer: object | None = None
        self._gliner: object | None = None
        self._lock = asyncio.Lock()
        self._ready = False

    async def warm(self) -> None:
        await self._ensure_loaded()

    @property
    def ready(self) -> bool:
        return self._ready

    async def _ensure_loaded(self) -> None:
        if self._ready:
            return
        async with self._lock:
            if self._ready:
                return
            await asyncio.to_thread(self._load)
            self._ready = True

    def _load(self) -> None:
        from gliner import GLiNER
        from presidio_analyzer import AnalyzerEngine

        logger.info("text_detector_loading", gliner=settings.text.gliner_model_id)
        self._analyzer = AnalyzerEngine()
        self._gliner = GLiNER.from_pretrained(settings.text.gliner_model_id)
        logger.info("text_detector_ready")

    async def detect(
        self,
        content: str,
        classes: list[str] | None,
        custom_regex: list[str],
        language: str = "en",
    ) -> list[Detection]:
        await self._ensure_loaded()
        return await asyncio.to_thread(
            self._detect_sync, content, classes, custom_regex, language,
        )

    def _detect_sync(
        self,
        content: str,
        classes: list[str] | None,
        custom_regex: list[str],
        language: str,
    ) -> list[Detection]:
        found: list[Detection] = []
        wanted = {c.upper() for c in classes} if classes else None

        # 1. Presidio recognizers (regex + NLP for structured + named entities)
        presidio_entities = (
            list(wanted) if wanted else settings.text.presidio_entities
        )
        analyzer = self._analyzer
        results = analyzer.analyze(  # type: ignore[union-attr]
            text=content, entities=presidio_entities, language=language,
        )
        for r in results:
            found.append(
                Detection(
                    entity_type=r.entity_type,
                    value=content[r.start : r.end],
                    score=float(r.score),
                    source=DetectionSource.PRESIDIO,
                    location_type=LocationType.CHAR_SPAN,
                    location={"start": r.start, "end": r.end},
                )
            )

        # 2. GLiNER zero-shot NER
        gliner = self._gliner
        spans = gliner.predict_entities(  # type: ignore[union-attr]
            content, settings.text.gliner_labels,
        )
        for s in spans:
            entity = _GLINER_LABEL_TO_ENTITY.get(s["label"], s["label"].upper())
            if wanted and entity not in wanted:
                continue
            found.append(
                Detection(
                    entity_type=entity,
                    value=s["text"],
                    score=float(s.get("score", 0.0)),
                    source=DetectionSource.GLINER,
                    location_type=LocationType.CHAR_SPAN,
                    location={"start": s["start"], "end": s["end"]},
                )
            )

        # 3. User custom regex
        for pattern in custom_regex:
            try:
                compiled = re.compile(pattern)
            except re.error:
                logger.warning("invalid_custom_regex", pattern=pattern)
                continue
            for m in compiled.finditer(content):
                found.append(
                    Detection(
                        entity_type="CUSTOM",
                        value=m.group(0),
                        score=1.0,
                        source=DetectionSource.REGEX,
                        location_type=LocationType.CHAR_SPAN,
                        location={"start": m.start(), "end": m.end()},
                    )
                )

        return _dedupe(found)


def _dedupe(detections: list[Detection]) -> list[Detection]:
    """Drop a detection if another with >= score fully covers the same span
    with the same entity type. Keeps distinct entity types on overlaps."""
    detections.sort(key=lambda d: (-d.score, d.location["start"]))
    kept: list[Detection] = []
    for d in detections:
        ds, de = d.location["start"], d.location["end"]
        covered = any(
            k.entity_type == d.entity_type
            and k.location["start"] <= ds
            and k.location["end"] >= de
            for k in kept
        )
        if not covered:
            kept.append(d)
    kept.sort(key=lambda d: d.location["start"])
    return kept
