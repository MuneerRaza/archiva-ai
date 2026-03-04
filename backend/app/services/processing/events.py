import asyncio
import uuid
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any

from app.logging import get_logger

logger = get_logger(__name__)

# Set during app shutdown to unblock all SSE generators
shutdown_event = asyncio.Event()


@dataclass
class FileUploaded:
    file_id: uuid.UUID
    workspace_id: uuid.UUID
    storage_key: str
    mime_type: str
    step_overrides: list[str] | None = None


@dataclass
class ProcessingStarted:
    file_id: uuid.UUID
    workspace_id: uuid.UUID


@dataclass
class ProcessingCompleted:
    file_id: uuid.UUID
    workspace_id: uuid.UUID


@dataclass
class ProcessingFailed:
    file_id: uuid.UUID
    workspace_id: uuid.UUID
    error: str


ProcessingEvent = FileUploaded | ProcessingStarted | ProcessingCompleted | ProcessingFailed
EventCallback = Callable[[ProcessingEvent], Coroutine[Any, Any, None]]


class ProcessingEventBus:
    def __init__(self) -> None:
        self._subscribers: list[EventCallback] = []

    def subscribe(self, callback: EventCallback) -> None:
        self._subscribers.append(callback)

    def unsubscribe(self, callback: EventCallback) -> None:
        try:
            self._subscribers.remove(callback)
        except ValueError:
            pass

    async def emit(self, event: ProcessingEvent) -> None:
        logger.info("event_emitted", event_type=type(event).__name__)
        for callback in list(self._subscribers):
            try:
                await callback(event)
            except Exception:
                logger.exception(
                    "event_handler_error",
                    event_type=type(event).__name__,
                )


# Global singleton — initialized in app startup
event_bus = ProcessingEventBus()
