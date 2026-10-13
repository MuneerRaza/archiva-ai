from fastapi import APIRouter

from app.state import text_detector, vision_detector

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "text_ready": text_detector.ready,
        "vision_ready": vision_detector.ready,
        "vision_model": vision_detector.info or None,
    }
