from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.bootstrap import ensure_models_registered
from app.logging import get_logger, setup_logging
from app.routes import detect, health, models, redact
from app.state import text_detector, vision_detector

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("pii_service_starting")
    # Each step is best-effort: the service must still serve /health for
    # debugging even if a model fails to load (slow CPU, registry hiccup).
    try:
        ensure_models_registered()
    except Exception as exc:
        logger.exception("bootstrap_failed", error=str(exc))
    try:
        await vision_detector.load_from_registry()
    except Exception as exc:
        logger.exception("vision_load_failed", error=str(exc))
    try:
        await text_detector.warm()
    except Exception as exc:
        logger.exception("text_warm_failed", error=str(exc))

    logger.info("pii_service_ready")
    yield
    logger.info("pii_service_shutdown")


app = FastAPI(title="Archiva PII Service", version="0.1.0", lifespan=lifespan)
app.include_router(health.router)
app.include_router(detect.router)
app.include_router(redact.router)
app.include_router(models.router)
