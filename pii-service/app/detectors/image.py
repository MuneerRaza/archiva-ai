"""Image PII detection: YOLO visual objects + OCR'd text PII (mapped to boxes)."""

import asyncio

from app.detectors.text import TextDetector
from app.detectors.vision import VisionDetector
from app.logging import get_logger
from app.models.detection import Detection, LocationType

logger = get_logger(__name__)


def _decode(image_bytes: bytes):
    import cv2
    import numpy as np

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


class ImageDetector:
    def __init__(self, vision: VisionDetector, text: TextDetector) -> None:
        self._vision = vision
        self._text = text

    async def detect(
        self,
        image_bytes: bytes,
        classes: list[str] | None,
        text_entities: list[str] | None,
        custom_regex: list[str],
        ocr: bool = True,
    ) -> list[Detection]:
        img = await asyncio.to_thread(_decode, image_bytes)
        detections = await self._vision.detect(img, classes)
        if ocr:
            try:
                detections += await self._detect_ocr(
                    image_bytes, text_entities, custom_regex,
                )
            except Exception as exc:
                logger.warning("ocr_failed", error=str(exc))
        return detections

    async def _detect_ocr(
        self, image_bytes: bytes, text_entities: list[str] | None, custom_regex: list[str],
    ) -> list[Detection]:
        words = await asyncio.to_thread(_ocr_words, image_bytes)
        if not words:
            return []
        # Reconstruct text with char offsets back to each word's box.
        text_parts: list[str] = []
        spans: list[tuple[int, int, dict]] = []  # (start, end, box)
        cursor = 0
        for w in words:
            token = w["text"]
            start = cursor
            end = start + len(token)
            spans.append((start, end, w["box"]))
            text_parts.append(token)
            cursor = end + 1  # +1 for the joining space
        full_text = " ".join(text_parts)

        text_dets = await self._text.detect(full_text, text_entities, custom_regex)
        out: list[Detection] = []
        for d in text_dets:
            s, e = d.location["start"], d.location["end"]
            boxes = [box for (ws, we, box) in spans if ws < e and we > s]
            if not boxes:
                continue
            x1 = min(b["x"] for b in boxes)
            y1 = min(b["y"] for b in boxes)
            x2 = max(b["x"] + b["w"] for b in boxes)
            y2 = max(b["y"] + b["h"] for b in boxes)
            out.append(
                Detection(
                    entity_type=d.entity_type,
                    value=d.value,
                    score=d.score,
                    source=d.source,
                    location_type=LocationType.BBOX,
                    location={"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1, "frame": None},
                )
            )
        return out


def _ocr_words(image_bytes: bytes) -> list[dict]:
    import cv2
    import numpy as np
    import pytesseract

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    words: list[dict] = []
    for i, txt in enumerate(data["text"]):
        if txt and txt.strip():
            words.append(
                {
                    "text": txt,
                    "box": {
                        "x": float(data["left"][i]),
                        "y": float(data["top"][i]),
                        "w": float(data["width"][i]),
                        "h": float(data["height"][i]),
                    },
                }
            )
    return words
