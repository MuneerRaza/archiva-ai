from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health
from app.config import settings
from app.database import close_pool, create_pool
from app.exceptions import ArchivaError
from app.logging import get_logger, setup_logging
from app.middleware import RequestIDMiddleware
from app.models.responses import ErrorDetail, ErrorResponse

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown logic."""
    logger.info("starting_archiva", env=settings.app.env.value)
    await create_pool()
    yield
    await close_pool()
    logger.info("archiva_shutdown")


app = FastAPI(
    title="Archiva.ai",
    description="AI-powered CMS API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app.debug else None,
    redoc_url=None,
)

# --- Middleware (order matters: last added = first executed) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)


# --- Exception handlers ---
@app.exception_handler(ArchivaError)
async def archiva_error_handler(request: Request, exc: ArchivaError) -> JSONResponse:
    logger.warning(
        "archiva_error",
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=exc.code,
                message=exc.message,
                details=exc.details if exc.details else None,
            )
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error", error=str(exc))
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=ErrorDetail(
                code="internal_error",
                message="An unexpected error occurred",
            )
        ).model_dump(),
    )


# --- Routes ---
app.include_router(health.router, prefix="/api")
