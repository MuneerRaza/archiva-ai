"""First-run model registration.

On startup, if the registry has no `Production` vision model, download the
pretrained COCO YOLO weights, log + register them, and promote to Production.
Idempotent — skips when a Production version already exists. This is what makes
the registry the single source of truth for which model is live.
"""

from app.config import settings
from app.logging import get_logger
from app.registry import latest_version_for_stage, register_and_promote

logger = get_logger(__name__)


def ensure_models_registered() -> None:
    _ensure_vision()
    _ensure_gliner_reference()


def _ensure_vision() -> None:
    name = settings.mlflow.vision_model_name
    stage = settings.mlflow.vision_model_stage
    if latest_version_for_stage(name, stage) is not None:
        logger.info("vision_model_present", name=name, stage=stage)
        return

    import mlflow
    from ultralytics import YOLO

    logger.info("vision_bootstrap_start", weights=settings.vision.pretrained_weights)
    # Triggers Ultralytics to download the weights into the cache volume.
    model = YOLO(settings.vision.pretrained_weights)
    weights_path = settings.vision.pretrained_weights

    with mlflow.start_run(run_name="bootstrap-vision"):
        mlflow.log_param("source", "ultralytics-pretrained")
        mlflow.log_param("weights", weights_path)
        mlflow.log_param("classes", list(model.names.values()))
        mlflow.log_artifact(weights_path, artifact_path="weights")
        model_uri = mlflow.get_artifact_uri("weights")

    register_and_promote(model_uri, name=name, stage=stage)
    logger.info("vision_bootstrap_done", name=name)


def _ensure_gliner_reference() -> None:
    """Register a lightweight metadata reference for the text model so the
    registry reflects it. Actual GLiNER weights stay HF-cached in Step 1."""
    name = settings.mlflow.gliner_model_name
    stage = settings.mlflow.gliner_model_stage
    if latest_version_for_stage(name, stage) is not None:
        return

    import json

    import mlflow

    logger.info("gliner_reference_bootstrap_start", name=name)
    with mlflow.start_run(run_name="bootstrap-gliner"):
        mlflow.log_param("gliner_model_id", settings.text.gliner_model_id)
        mlflow.log_param("labels", settings.text.gliner_labels)
        ref = {"gliner_model_id": settings.text.gliner_model_id, "kind": "reference"}
        mlflow.log_text(json.dumps(ref, indent=2), "model_reference.json")
        model_uri = mlflow.get_artifact_uri("model_reference.json")
    register_and_promote(model_uri, name=name, stage=stage)
    logger.info("gliner_reference_bootstrap_done", name=name)
