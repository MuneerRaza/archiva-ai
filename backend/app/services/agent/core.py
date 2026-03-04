"""Core agent loop — Pydantic AI Agent with streaming and tool execution."""

import asyncio
import json
import time
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

import asyncpg
from pydantic_ai import Agent, PartDeltaEvent, TextPartDelta, ThinkingPartDelta
from pydantic_ai import FunctionToolCallEvent, FunctionToolResultEvent

from app.database import get_pool
from app.logging import get_logger
from app.models.agent import (
    ContextLocation,
    DoneEvent,
    ErrorEvent,
    MessageRole,
    SSEEventType,
    SessionCreatedEvent,
    SessionStatus,
    StatusEvent,
    TextDeltaEvent,
    ThinkingDeltaEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from app.models.workspace import AgentSettings, WorkspaceSettingsModel
from app.repositories.agent import AgentRepository
from app.repositories.ai_model import AIModelRepository
from app.repositories.workspace import WorkspaceRepository
from app.services.agent.context import build_system_prompt
from app.services.agent.model_factory import (
    build_model_settings_from_record,
    create_model_from_record,
)
from app.services.agent.session_cache import (
    CachedSession,
    cache_session,
    get_cached_session,
    invalidate_session,
    needs_prompt_refresh,
)
from app.services.agent.tools import (
    MIN_CONTEXT_CHARS,
    AgentDeps,
    browse,
    get_info,
    read,
    search,
)

logger = get_logger(__name__)

# Status messages for tool execution
_TOOL_STATUS = {
    "browse": "Browsing files...",
    "search": "Searching documents...",
    "get_info": "Getting file info...",
    "read": "Reading document...",
}


@dataclass
class SSEEvent:
    event: SSEEventType
    data: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# The Pydantic AI Agent — created once, model set per-request
# ---------------------------------------------------------------------------

agent = Agent(
    "test",  # placeholder model, overridden per-request
    deps_type=AgentDeps,
    retries=3,
)

# Register tools on the agent
agent.tool(browse)
agent.tool(get_info)
agent.tool(search)
agent.tool(read)


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _parse_agent_settings(ws_settings: dict) -> AgentSettings:
    """Extract agent settings from workspace settings dict."""
    parsed = WorkspaceSettingsModel.model_validate(ws_settings)
    return parsed.agent


# ---------------------------------------------------------------------------
# Message history conversion: DB rows → Pydantic AI ModelMessage format
# ---------------------------------------------------------------------------

def _build_message_history(history_rows: list) -> list[dict]:
    """Convert DB message rows to a list usable by Pydantic AI.

    Pydantic AI accepts message_history as list[ModelMessage].
    We build ModelRequest/ModelResponse objects from the DB rows.
    """
    from pydantic_ai.messages import (
        ModelRequest,
        ModelResponse,
        SystemPromptPart,
        TextPart,
        ToolCallPart,
        ToolReturnPart,
        UserPromptPart,
    )

    messages: list[ModelRequest | ModelResponse] = []

    i = 0
    while i < len(history_rows):
        row = history_rows[i]
        role = row["role"]

        if role == MessageRole.USER:
            messages.append(ModelRequest(parts=[UserPromptPart(content=row["content"] or "")]))
            i += 1

        elif role == MessageRole.ASSISTANT:
            messages.append(ModelResponse(parts=[TextPart(content=row["content"] or "")]))
            i += 1

        elif role == MessageRole.TOOL_CALL:
            # Collect consecutive tool_call + tool_result pairs
            tool_call_parts: list[ToolCallPart] = []
            tool_return_parts: list[ToolReturnPart] = []

            while i < len(history_rows) and history_rows[i]["role"] == MessageRole.TOOL_CALL:
                tc_row = history_rows[i]
                tool_call_id = f"call_{uuid.uuid4().hex[:8]}"
                tool_args = tc_row["tool_args"] if tc_row["tool_args"] else {}
                tool_call_parts.append(ToolCallPart(
                    tool_name=tc_row["tool_name"],
                    args=tool_args,
                    tool_call_id=tool_call_id,
                ))

                # Look ahead for matching tool_result
                if i + 1 < len(history_rows) and history_rows[i + 1]["role"] == MessageRole.TOOL_RESULT:
                    tr_row = history_rows[i + 1]
                    result_content = json.dumps(tr_row["tool_result"]) if tr_row["tool_result"] else "{}"
                    tool_return_parts.append(ToolReturnPart(
                        tool_name=tr_row["tool_name"],
                        content=result_content,
                        tool_call_id=tool_call_id,
                    ))
                    i += 2
                else:
                    i += 1

            # Add assistant response with tool calls
            if tool_call_parts:
                messages.append(ModelResponse(parts=tool_call_parts))
            # Add tool returns as a request
            if tool_return_parts:
                messages.append(ModelRequest(parts=tool_return_parts))

        elif role == MessageRole.TOOL_RESULT:
            # Orphaned tool_result (shouldn't happen, but handle gracefully)
            i += 1

        else:
            i += 1

    return messages


def _estimate_history_chars(message_history: list) -> int:
    """Estimate character count from Pydantic AI message history objects."""
    total = 0
    for msg in message_history:
        for part in getattr(msg, "parts", []):
            content = getattr(part, "content", None)
            if content and isinstance(content, str):
                total += len(content)
            args = getattr(part, "args", None)
            if args:
                total += len(str(args))
    return total


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

async def run_agent(
    conn: asyncpg.Connection,
    workspace_id: uuid.UUID,
    user_id: str,
    user_message: str,
    session_id: uuid.UUID | None = None,
    context_location: ContextLocation | None = None,
    ws_row: asyncpg.Record | None = None,
) -> AsyncGenerator[SSEEvent, None]:
    """Run the agent loop, yielding SSE events."""
    repo = AgentRepository(conn)

    # ---- Try session cache for existing sessions (warm path) ----
    cached = get_cached_session(session_id) if session_id else None

    if cached:
        logger.info("session_cache_hit", session_id=str(session_id))
        model_row = cached.model_row
        agent_settings = cached.agent_settings
        ws_settings = cached.ws_settings
        message_history = cached.message_history

        # Refresh system prompt if stale (every 5min)
        if needs_prompt_refresh(cached):
            system_prompt = await build_system_prompt(
                conn, workspace_id, context_location, ws_row=ws_row,
            )
            cached.system_prompt = system_prompt
            cached.system_prompt_built_at = time.monotonic()
        else:
            system_prompt = cached.system_prompt

        # Verify session still exists
        session_row = await repo.get_session(session_id, workspace_id)
        if not session_row:
            invalidate_session(session_id)
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(message="Session not found").model_dump())
            return

        is_new_session = False
        history_rows = []  # not needed — we have message_history from cache

    else:
        # ---- Cold path: full DB load ----
        logger.info("session_cache_miss", session_id=str(session_id) if session_id else "new")

        # Get workspace settings (skip query if caller already has it)
        if ws_row is None:
            ws_repo = WorkspaceRepository(conn)
            ws_row = await ws_repo.get_by_id(workspace_id)
        if not ws_row:
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(message="Workspace not found").model_dump())
            return

        ws_settings = ws_row["settings"]
        if isinstance(ws_settings, str):
            ws_settings = json.loads(ws_settings)

        agent_settings = _parse_agent_settings(ws_settings)

        # Resolve AI model from registry
        if not agent_settings.model_id:
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message="No agent model configured. Add an AI model in Settings > AI Models.",
            ).model_dump())
            return

        ai_model_repo = AIModelRepository(conn)
        model_row = await ai_model_repo.get_by_id(uuid.UUID(agent_settings.model_id))
        if not model_row:
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message="Configured agent model not found. Check Settings > AI Models.",
            ).model_dump())
            return

        # Create or load session
        is_new_session = session_id is None
        if is_new_session:
            ctx_dict = context_location.model_dump() if context_location else None
            session_row = await repo.create_session(
                workspace_id, user_id, context_location=ctx_dict,
            )
            session_id = session_row["id"]
        else:
            session_row = await repo.get_session(session_id, workspace_id)
            if not session_row:
                yield SSEEvent(SSEEventType.ERROR, ErrorEvent(message="Session not found").model_dump())
                return

        # Build system prompt + load history in parallel using separate connections
        if not is_new_session:
            pool = get_pool()
            async with pool.acquire() as second_conn:
                system_prompt, history_rows = await asyncio.gather(
                    build_system_prompt(second_conn, workspace_id, context_location, ws_row=ws_row),
                    repo.get_messages(session_id),
                )
        else:
            system_prompt = await build_system_prompt(conn, workspace_id, context_location, ws_row=ws_row)
            history_rows = []

        message_history = _build_message_history(history_rows)

    # Save user message to DB
    await repo.add_message(session_id, MessageRole.USER, content=user_message)

    # Auto-title immediately for new sessions so the tile shows a title
    title: str | None = None
    if is_new_session:
        title = _generate_title(user_message)
        await repo.update_session_title(session_id, title)

    # Tell the frontend the session ID immediately — before any LLM work.
    yield SSEEvent(SSEEventType.SESSION_CREATED, SessionCreatedEvent(
        session_id=str(session_id),
        title=title,
    ).model_dump())

    # Build model and settings from ai_models record
    try:
        model = create_model_from_record(model_row)
    except Exception as exc:
        logger.exception("model_creation_error", error=str(exc))
        yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
            message=f"Failed to create LLM model: {exc}",
        ).model_dump())
        return

    # Build model settings using stored capabilities from ai_models record
    stored_caps = model_row["capabilities"] or []
    has_thinking = "thinking" in stored_caps
    has_budget = "thinking_budget" in stored_caps
    model_settings = build_model_settings_from_record(
        model_row,
        agent_settings.thinking_enabled,
        agent_settings.thinking_budget,
        has_thinking,
        has_budget,
    )

    # Compute remaining context budget for tool results
    context_length = model_row["context_length"] or 8192
    used_chars = len(system_prompt) + len(user_message)
    if history_rows:
        for h_row in history_rows:
            used_chars += len(h_row["content"] or "")
    else:
        used_chars += _estimate_history_chars(message_history)
    used_tokens = used_chars // 4  # rough char-to-token estimate
    remaining_tokens = context_length - used_tokens - 1000  # reserve for LLM response
    remaining_context_chars = max(remaining_tokens * 4, MIN_CONTEXT_CHARS)

    # Build deps
    deps = AgentDeps(
        conn=conn,
        workspace_id=workspace_id,
        user_id=user_id,
        remaining_context_chars=remaining_context_chars,
    )

    # Mark session as streaming
    await repo.set_session_status(session_id, SessionStatus.STREAMING)

    # Run agent with streaming
    full_text = ""
    full_thinking = ""

    try:
        async with agent.iter(
            user_message,
            model=model,
            model_settings=model_settings,
            message_history=message_history,
            deps=deps,
            instructions=system_prompt,
        ) as run:
            async for node in run:
                if Agent.is_model_request_node(node):
                    async with node.stream(run.ctx) as request_stream:
                        async for event in request_stream:
                            if isinstance(event, PartDeltaEvent):
                                if isinstance(event.delta, TextPartDelta):
                                    text = event.delta.content_delta
                                    if text:
                                        full_text += text
                                        yield SSEEvent(
                                            SSEEventType.TEXT_DELTA,
                                            TextDeltaEvent(content=text).model_dump(),
                                        )

                                elif isinstance(event.delta, ThinkingPartDelta):
                                    thinking = event.delta.content_delta
                                    if thinking:
                                        full_thinking += thinking
                                        yield SSEEvent(
                                            SSEEventType.THINKING_DELTA,
                                            ThinkingDeltaEvent(content=thinking).model_dump(),
                                        )

                elif Agent.is_call_tools_node(node):
                    async with node.stream(run.ctx) as handle_stream:
                        async for event in handle_stream:
                            if isinstance(event, FunctionToolCallEvent):
                                tool_name = event.part.tool_name
                                tool_call_id = event.part.tool_call_id or f"call_{uuid.uuid4().hex[:8]}"

                                # Parse args
                                args_raw = event.part.args
                                if isinstance(args_raw, str):
                                    try:
                                        tool_args = json.loads(args_raw)
                                    except json.JSONDecodeError:
                                        tool_args = {}
                                elif isinstance(args_raw, dict):
                                    tool_args = args_raw
                                else:
                                    tool_args = {}

                                yield SSEEvent(SSEEventType.STATUS, StatusEvent(
                                    text=_TOOL_STATUS.get(tool_name, f"Running {tool_name}..."),
                                ).model_dump())
                                yield SSEEvent(SSEEventType.TOOL_CALL_START, ToolCallStartEvent(
                                    id=tool_call_id, name=tool_name, arguments=tool_args,
                                ).model_dump())

                                # Save tool call to DB
                                await repo.add_message(
                                    session_id, MessageRole.TOOL_CALL,
                                    tool_name=tool_name, tool_args=tool_args,
                                )

                            elif isinstance(event, FunctionToolResultEvent):
                                tool_name = event.result.tool_name
                                tool_call_id = event.result.tool_call_id or ""
                                result_content = event.result.content

                                # Convert result to dict for SSE
                                if isinstance(result_content, str):
                                    result_dict = {"output": result_content}
                                elif isinstance(result_content, dict):
                                    result_dict = result_content
                                else:
                                    result_dict = {"output": str(result_content)}

                                yield SSEEvent(SSEEventType.TOOL_CALL_RESULT, ToolCallResultEvent(
                                    id=tool_call_id, name=tool_name, result=result_dict,
                                ).model_dump())

                                # Save tool result to DB
                                await repo.add_message(
                                    session_id, MessageRole.TOOL_RESULT,
                                    tool_name=tool_name, tool_result=result_dict,
                                )

        # Save assistant message (with thinking for UI display, never sent back to LLM)
        msg_row = await repo.add_message(
            session_id, MessageRole.ASSISTANT, content=full_text,
            thinking=full_thinking or None,
        )

        # Update session cache with new message history
        # Append user message + assistant response to cached history
        from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart
        updated_history = list(message_history)
        updated_history.append(ModelRequest(parts=[UserPromptPart(content=user_message)]))
        if full_text:
            updated_history.append(ModelResponse(parts=[TextPart(content=full_text)]))

        cache_session(CachedSession(
            session_id=session_id,
            workspace_id=workspace_id,
            model_row=model_row,
            system_prompt=system_prompt,
            message_history=updated_history,
            agent_settings=agent_settings,
            ws_settings=ws_settings,
            system_prompt_built_at=time.monotonic() if not cached else cached.system_prompt_built_at,
        ))

        yield SSEEvent(SSEEventType.DONE, DoneEvent(
            session_id=str(session_id),
            message_id=str(msg_row["id"]) if msg_row else None,
        ).model_dump())

    except Exception as exc:
        error_msg = str(exc)
        logger.exception("agent_run_error", error=error_msg)

        # Invalidate cache on error to force fresh load next time
        if session_id:
            invalidate_session(session_id)

        # Provide user-friendly error messages for common failures
        provider_name = model_row["provider"] if model_row else "LLM"
        if "connect" in error_msg.lower() or "connection" in error_msg.lower():
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message=f"Cannot connect to LLM. Is {provider_name} running?",
            ).model_dump())
        elif "401" in error_msg or "403" in error_msg or "unauthorized" in error_msg.lower():
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message="LLM authentication failed. Check your API key in AI Models settings.",
            ).model_dump())
        elif "timeout" in error_msg.lower():
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message=f"LLM request timed out ({provider_name})",
            ).model_dump())
        elif "exceeded max retries" in error_msg.lower() or "invalid tool call" in error_msg.lower():
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message="Model generated invalid tool arguments. Try again, or switch to a model with better tool calling support.",
            ).model_dump())
        elif "invalid_request_error" in error_msg.lower():
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message=f"LLM rejected the request ({provider_name}). This may be a temporary issue — try again.",
            ).model_dump())
        else:
            yield SSEEvent(SSEEventType.ERROR, ErrorEvent(
                message=f"LLM error: {error_msg[:200]}",
            ).model_dump())

    finally:
        # Always reset status to idle
        try:
            await repo.set_session_status(session_id, SessionStatus.IDLE)
        except Exception:
            logger.warning("failed_to_reset_session_status", session_id=str(session_id))


def _generate_title(user_message: str) -> str:
    """Generate a session title from the first user message."""
    title = user_message.strip()
    if len(title) > 60:
        title = title[:57] + "..."
    return title
