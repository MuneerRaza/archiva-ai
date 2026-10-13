from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.state import vision_detector

logger = get_logger(__name__)
router = APIRouter(tags=["models"])


@router.get("/models/vision")
async def vision_model_info() -> dict:
    return {"loaded": vision_detector.ready, "model": vision_detector.info or None}


@router.post("/models/reload")
async def reload_models() -> dict:
    """Re-read the Production version from the registry and swap the live model.

    Call this after promoting a new model version in MLflow — zero code change.
    """
    try:
        info = await vision_detector.reload()
    except Exception as exc:
        logger.exception("vision_reload_failed", error=str(exc))
        raise HTTPException(status_code=503, detail=f"reload failed: {exc}") from exc
    return {"reloaded": True, "model": info}
