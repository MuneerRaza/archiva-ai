"""Visual PII detection via a single YOLO model loaded from the MLflow registry.

The live model is whatever version sits at `Production` for the configured
registry name. Promoting a new version + calling reload() swaps the model with
zero code change — the MLOps showcase.
"""

import asyncio
import tempfile
from pathlib import Path
from typing import Any

from app.config import settings
from app.logging import get_logger
from app.models.detection import (
    Detection,
    DetectionSource,
    LocationType,
)
from app.registry import latest_version_for_stage

logger = get_logger(__name__)


class VisionDetector:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._info: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    @property
    def info(self) -> dict[str, Any]:
        return self._info

    @property
    def ready(self) -> bool:
        return self._model is not None

    async def load_from_registry(self) -> None:
        async with self._lock:
            await asyncio.to_thread(self._load_sync)

    async def reload(self) -> dict[str, Any]:
        """Re-read the Production version and atomically swap the live model."""
        await self.load_from_registry()
        return self._info

    def _load_sync(self) -> None:
        name = settings.mlflow.vision_model_name
        stage = settings.mlflow.vision_model_stage
        version = latest_version_for_stage(name, stage)
        if version is None:
            raise RuntimeError(f"No '{stage}' version for registry model '{name}'")

        import mlflow
        from ultralytics import YOLO

        # Download from the version's artifact source. (Don't use run_id-based
        # download — versions registered from an artifact URI have no run_id.)
        local_dir = Path(tempfile.mkdtemp(prefix="pii-yolo-"))
        downloaded = mlflow.artifacts.download_artifacts(
            artifact_uri=version.source, dst_path=str(local_dir),
        )
        weights = next(Path(downloaded).rglob("*.pt"), None) or next(
            local_dir.rglob("*.pt"), None
        )
        if weights is None:
            raise RuntimeError("No .pt weights found in the registered model artifacts")

        self._model = YOLO(str(weights))
        self._model.to(settings.vision.device)
        self._info = {
            "name": name,
            "version": version.version,
            "stage": stage,
            "source": "registry",
            "classes": list(self._model.names.values()),
        }
        logger.info(
            "vision_model_loaded",
            name=name, version=version.version, stage=stage,
        )

    async def detect(
        self, source: object, classes: list[str] | None, frame: int | None = None,
    ) -> list[Detection]:
        """Run YOLO on any ultralytics-accepted source (path, ndarray, PIL).

        ``frame`` is stamped into the bbox location for video frames.
        """
        if self._model is None:
            raise RuntimeError("Vision model not loaded")
        return await asyncio.to_thread(self._detect_sync, source, classes, frame)

    def _detect_sync(
        self, source: object, classes: list[str] | None, frame: int | None,
    ) -> list[Detection]:
        wanted = set(classes) if classes else set(settings.vision.default_classes)
        results = self._model(  # type: ignore[misc]
            source, conf=settings.vision.conf_threshold, verbose=False,
        )
        names = self._model.names  # type: ignore[union-attr]
        out: list[Detection] = []
        for res in results:
            for box in res.boxes:
                cls_name = names[int(box.cls[0])]
                if wanted and cls_name not in wanted:
                    continue
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
                out.append(
                    Detection(
                        entity_type=cls_name,
                        value=None,
                        score=float(box.conf[0]),
                        source=DetectionSource.YOLO,
                        location_type=LocationType.BBOX,
                        location={"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1, "frame": frame},
                    )
                )
        return out
