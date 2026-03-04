"""Pydantic models for the AI agent feature."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SessionStatus(StrEnum):
    IDLE = "idle"
    STREAMING = "streaming"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"


class SSEEventType(StrEnum):
    SESSION_CREATED = "session_created"
    TEXT_DELTA = "text_delta"
    THINKING_DELTA = "thinking_delta"
    TOOL_CALL_START = "tool_call_start"
    TOOL_CALL_RESULT = "tool_call_result"
    STATUS = "status"
    DONE = "done"
    ERROR = "error"


# ---------------------------------------------------------------------------
# SSE events
# ---------------------------------------------------------------------------

class TextDeltaEvent(BaseModel):
    content: str


class ThinkingDeltaEvent(BaseModel):
    content: str


class ToolCallStartEvent(BaseModel):
    id: str
    name: str
    arguments: dict


class ToolCallResultEvent(BaseModel):
    id: str
    name: str
    result: dict


class SessionCreatedEvent(BaseModel):
    session_id: str
    title: str | None = None


class StatusEvent(BaseModel):
    text: str


class DoneEvent(BaseModel):
    session_id: str
    message_id: str | None = None


class ErrorEvent(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Session & message models
# ---------------------------------------------------------------------------

class ContextLocation(BaseModel):
    type: str = "workspace"  # "workspace" | "folder" | "file"
    id: str | None = None


class AgentMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: MessageRole
    content: str | None = None
    tool_name: str | None = None
    tool_args: dict | None = None
    tool_result: dict | None = None
    thinking: str | None = None
    created_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "AgentMessageResponse":
        import json

        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        tool_args = r["tool_args"]
        if isinstance(tool_args, str):
            tool_args = json.loads(tool_args)
        tool_result = r["tool_result"]
        if isinstance(tool_result, str):
            tool_result = json.loads(tool_result)
        return cls(
            id=r["id"],
            session_id=r["session_id"],
            role=r["role"],
            content=r["content"],
            tool_name=r["tool_name"],
            tool_args=tool_args,
            tool_result=tool_result,
            thinking=r["thinking"],
            created_at=r["created_at"],
        )


class AgentSessionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: str
    title: str | None = None
    context_location: ContextLocation | None = None
    status: SessionStatus = SessionStatus.IDLE
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "AgentSessionResponse":
        import json

        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        ctx = r["context_location"]
        if isinstance(ctx, str):
            ctx = json.loads(ctx)
        return cls(
            id=r["id"],
            workspace_id=r["workspace_id"],
            user_id=str(r["user_id"]),
            title=r["title"],
            context_location=ContextLocation(**ctx) if ctx else None,
            status=r["status"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )


class AgentSessionDetail(AgentSessionResponse):
    messages: list[AgentMessageResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    session_id: str | None = None
    context_location: ContextLocation | None = None
