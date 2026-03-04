import time
import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RequestIDMiddleware:
    """Attach a unique request ID to every request for end-to-end tracing.

    Pure ASGI middleware — avoids Starlette BaseHTTPMiddleware issues
    with shutdown and task group cancellation.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        request_id = headers.get(b"x-request-id", b"").decode() or str(uuid.uuid4())

        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = list(message.get("headers", []))
                response_headers.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": response_headers}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            if scope["type"] == "http":
                duration_ms = round((time.perf_counter() - start) * 1000, 2)
                path = scope.get("path", "")
                method = scope.get("method", "")
                # Strip query string to avoid logging sensitive tokens
                path = path.split("?", 1)[0]
                structlog.get_logger().info(
                    "request_completed",
                    method=method,
                    path=path,
                    status=status_code,
                    duration_ms=duration_ms,
                )
