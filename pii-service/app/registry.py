"""MLflow Model Registry helpers shared by the vision detector and bootstrap."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.config import settings
from app.logging import get_logger

if TYPE_CHECKING:
    from mlflow.entities.model_registry import ModelVersion
    from mlflow.tracking import MlflowClient

logger = get_logger(__name__)


def get_client() -> MlflowClient:
    import mlflow
    from mlflow.tracking import MlflowClient

    mlflow.set_tracking_uri(settings.mlflow.tracking_uri)
    return MlflowClient(tracking_uri=settings.mlflow.tracking_uri)


def latest_version_for_stage(name: str, stage: str) -> ModelVersion | None:
    client = get_client()
    try:
        versions = client.get_latest_versions(name=name, stages=[stage])
    except Exception:  # registry empty / model not registered yet
        return None
    return versions[0] if versions else None


def register_and_promote(model_uri: str, name: str, stage: str) -> str:
    """Register a logged model and transition it to `stage`. Returns version."""
    import mlflow

    result = mlflow.register_model(model_uri=model_uri, name=name)
    client = get_client()
    client.transition_model_version_stage(
        name=name, version=result.version, stage=stage, archive_existing_versions=True,
    )
    logger.info("model_registered", name=name, version=result.version, stage=stage)
    return str(result.version)
