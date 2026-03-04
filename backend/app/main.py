import asyncio
import signal
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import agent, ai_models, auth, browse, files, folders, health, processing, search, storage, tags, workspaces
from app.config import settings
from app.database import close_pool, create_pool
from app.exceptions import ArchivaError
from app.logging import get_logger, setup_logging
from app.middleware import RequestIDMiddleware
from app.models.responses import ErrorDetail, ErrorResponse
from app.services.processing.events import shutdown_event

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown logic."""
    logger.info("starting_archiva", env=settings.app.env.value)

    # Chain a signal handler that fires shutdown_event BEFORE uvicorn's
    # graceful shutdown waits for connections. This lets SSE generators
    # exit so uvicorn can actually complete.
    loop = asyncio.get_running_loop()
    original_handlers: dict[int, object] = {}
    for sig in (signal.SIGINT, signal.SIGTERM):
        original_handlers[sig] = signal.getsignal(sig)

    def chained_handler(signum: int, frame: object) -> None:
        # Schedule on the event loop so asyncio waiters are properly woken
        loop.call_soon_threadsafe(shutdown_event.set)
        original = original_handlers.get(signum)
        if callable(original):
            original(signum, frame)

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, chained_handler)

    await create_pool()

    # Warm JWKS cache so first request doesn't block on network
    from app.auth import jwks_client
    try:
        await jwks_client.get_keys()
        logger.info("jwks_cache_warmed")
    except Exception:
        logger.warning("jwks_warmup_failed_will_retry_on_first_request")

    # Reset any sessions stuck in "streaming" from a prior crash
    from app.database import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        reset_count = await conn.execute(
            "UPDATE agent_sessions SET status = 'idle' WHERE status = 'streaming'",
        )
        if reset_count != "UPDATE 0":
            logger.info("reset_stale_sessions", count=reset_count)

    from app.services.processing.worker import worker
    await worker.start()

    yield

    from app.services.processing.worker import worker
    try:
        await asyncio.wait_for(worker.stop(), timeout=5.0)
    except asyncio.TimeoutError:
        logger.warning("worker_stop_timeout")

    # Close shared HTTP clients for LLM providers
    from app.services.llm.clients import close_all as close_llm_clients
    await close_llm_clients()

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
app.include_router(auth.router, prefix="/api")
app.include_router(workspaces.router, prefix="/api")
app.include_router(browse.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(processing.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(ai_models.router, prefix="/api")
if not settings.app.is_production:
    app.include_router(storage.router, prefix="/api")
