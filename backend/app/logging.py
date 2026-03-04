import logging
import sys
from pathlib import Path

import structlog

from app.config import Environment, settings


def setup_logging() -> None:
    """Configure structlog for the application."""
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.app.env == Environment.PRODUCTION:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    log_file = _open_log_file(settings.app.log_file)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.app.log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=log_file),
        cache_logger_on_first_use=True,
    )


def _open_log_file(log_file: str | None) -> object:
    """Return the file handle for logging output.

    - None / "stdout" → sys.stdout
    - "stderr" → sys.stderr
    - Any path → opens (append mode) after creating parent dirs
    """
    if log_file is None or log_file.lower() == "stdout":
        return sys.stdout

    if log_file.lower() == "stderr":
        return sys.stderr

    path = Path(log_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path.open("a", encoding="utf-8")


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)
