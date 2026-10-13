"""Video PII detection — YOLO on sampled frames.

Frames are decoded with OpenCV (its bundled FFmpeg), so detection needs no
system ffmpeg. Each detection's location carries the frame index and timestamp.
"""

import asyncio
import tempfile
from pathlib import Path

from app.detectors.vision import VisionDetector
from app.logging import get_logger
from app.models.detection import Detection

logger = get_logger(__name__)


class VideoDetector:
    def __init__(self, vision: VisionDetector) -> None:
        self._vision = vision

    async def detect(
        self,
        video_bytes: bytes,
        classes: list[str] | None,
        sample_fps: float = 1.0,
    ) -> list[Detection]:
        """Sample frames at `sample_fps` and run YOLO on each."""
        frames = await asyncio.to_thread(_sample_frames, video_bytes, sample_fps)
        out: list[Detection] = []
        for frame_idx, ts_ms, img in frames:
            dets = await self._vision.detect(img, classes, frame=frame_idx)
            for d in dets:
                d.location["timestamp_ms"] = ts_ms
            out.extend(dets)
        logger.info("video_detected", frames=len(frames), detections=len(out))
        return out


def _sample_frames(video_bytes: bytes, sample_fps: float):
    """Return [(frame_index, timestamp_ms, ndarray), ...] sampled across the video."""
    import cv2

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "video"
        path.write_bytes(video_bytes)
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise ValueError("Could not open video")
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        step = max(1, round(fps / max(sample_fps, 0.1)))
        frames = []
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % step == 0:
                ts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                frames.append((idx, ts_ms, frame))
            idx += 1
        cap.release()
        return frames
