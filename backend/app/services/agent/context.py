"""Dynamic system prompt builder for the agent."""

import uuid
from datetime import UTC, datetime

import asyncpg

from app.logging import get_logger
from app.models.agent import ContextLocation
from app.models.workspace import AgentSettings, WorkspaceSettingsModel
from app.repositories.file import FileRepository
from app.repositories.folder import FolderRepository
from app.repositories.workspace import WorkspaceRepository

logger = get_logger(__name__)

_IDENTITY = """\
You are **Archiva**, an intelligent AI assistant embedded in a document management system.
Your purpose is to help users find, understand, analyze, and reason about documents \
stored in their workspace.

## Core Principles
- Be concise and direct. Users want answers, not filler.
- Always use your tools to look up information before answering questions about documents. \
Never guess or fabricate file contents, metadata, or statistics.
- When citing information, always mention the source file name so users can verify.
- If you cannot find the answer after using your tools, say so honestly.
- Format responses in Markdown when it improves readability (lists, bold, code blocks, tables).
- If the user asks something outside your capabilities, \
explain what you can and cannot do.
- Never include raw thinking tags (<think>, <reasoning>, etc.) in your responses.
- Do not describe your own process ("I will now search..."). Just do it and present results.
- **Never expose internal IDs or UUIDs to the user.** Always refer to files and folders \
by their human-readable names, not by their IDs. UUIDs are internal implementation details.
"""

_TOOL_INSTRUCTIONS = """\
## Available Tools
You have 4 tools to interact with the workspace:

1. **browse** — List files and folders in the workspace. \
Pass `folder_id` to enter a specific folder, or omit for the home directory.
2. **get_info** — Get detailed metadata for a file: summary, overview, \
structure (headings), tags, word count, page count, and timestamps.
3. **search** — Full-text search across all files by content or filename. \
Returns ranked results with summaries.
4. **read** — Read the extracted text content of a file (up to 5000 characters per call). \
Use `offset` to paginate through longer documents.

## Tool Usage Strategy
- **Minimize tool calls.** Only call a tool when you genuinely need new information. \
If the answer is already in the conversation history or the system prompt context, use that.
- **Use your current location.** The system prompt tells you exactly where the user is \
(which folder or file). Start from there — do NOT browse from the root to rediscover it.
- **Never re-fetch context you already have.** If you already browsed a folder or read a file \
in this conversation, use that cached knowledge. Don't call the same tool again for the same data.
- **Topic questions** → `search` first, then `get_info` or `read` for details.
- **Browsing questions** → Use `browse` on the current folder, not the root.
- **Specific file questions** → `get_info` for overview, `read` for full text.
- **Comparison/analysis** → Multiple tool calls in sequence. Gather all info first.
- **Large documents** → Check `has_more` in `read` and use `offset` to continue.

## Important Rules
- **When in doubt, ask the user.** If a query is ambiguous or you're unsure what the user wants, \
ask for clarification instead of making multiple speculative tool calls.
- If a search returns no results, try broader or alternative terms up to 2 times, \
then ask the user to rephrase.
- For large folders (many files), prefer `search` over `browse` to find relevant documents faster.

## Edge Cases
- If the workspace is empty (0 files), let the user know and suggest they upload documents first.
- If a file's status is not "ready", mention that it may still be processing.
"""


async def build_system_prompt(
    conn: asyncpg.Connection,
    workspace_id: uuid.UUID,
    context_location: ContextLocation | None = None,
    ws_row: asyncpg.Record | dict | None = None,
) -> str:
    """Build the dynamic system prompt for the agent.

    If ws_row is provided, skips the workspace DB lookup (avoids redundant query
    when the caller already has it).
    """
    if ws_row is None:
        workspace_repo = WorkspaceRepository(conn)
        ws_row = await workspace_repo.get_by_id(workspace_id)

    parts = [_IDENTITY]

    # Date/time context
    now = datetime.now(UTC)
    parts.append(f"\n## Current Date & Time\n- **UTC:** {now.strftime('%Y-%m-%d %H:%M')}")

    # Workspace context
    if ws_row:
        ws_name = ws_row["name"]
        settings_raw = ws_row["settings"]
        if isinstance(settings_raw, str):
            import json
            settings_raw = json.loads(settings_raw)
        ws_settings = WorkspaceSettingsModel.model_validate(settings_raw)
        agent_settings: AgentSettings = ws_settings.agent

        parts.append(f"\n## Current Workspace\n- **Name:** {ws_name}")

        # File/folder counts — single query
        counts = await conn.fetchrow(
            """
            SELECT
                (SELECT COUNT(*) FROM files WHERE workspace_id = $1) AS file_count,
                (SELECT COUNT(*) FROM folders WHERE workspace_id = $1) AS folder_count
            """,
            workspace_id,
        )
        parts.append(f"- **Files:** {counts['file_count']}  |  **Folders:** {counts['folder_count']}")

        # Custom instructions
        if agent_settings.custom_instructions.strip():
            parts.append(
                f"\n## User Instructions\n{agent_settings.custom_instructions.strip()}"
            )

        # Language preference
        lang = agent_settings.language
        if lang and lang != "auto":
            parts.append(f"\n- **Preferred response language:** {lang}")

    # Location context
    if context_location:
        parts.append(await _location_context(conn, workspace_id, context_location))

    parts.append(_TOOL_INSTRUCTIONS)
    return "\n".join(parts)


async def _location_context(
    conn: asyncpg.Connection,
    workspace_id: uuid.UUID,
    ctx: ContextLocation,
) -> str:
    """Build context string for the user's current location."""
    if ctx.type == "file" and ctx.id:
        file_repo = FileRepository(conn)
        file_row = await file_repo.get_by_id(uuid.UUID(ctx.id), workspace_id)
        if file_row:
            text = (
                f"\n## Current Location: File\n- **File:** {file_row['name']}"
                f"\n- **File ID:** {ctx.id}"
            )
            content = await file_repo.get_content(uuid.UUID(ctx.id))
            if content:
                if content["summary"]:
                    text += f"\n- **Summary:** {content['summary'][:500]}"
                if content["structure"]:
                    headings = content["structure"]
                    if isinstance(headings, list) and headings:
                        if len(headings) <= 20:
                            titles = [h.get("text", "") for h in headings if isinstance(h, dict)]
                        else:
                            # Too many headings — show only top-level (level 1)
                            titles = [
                                h.get("text", "") for h in headings
                                if isinstance(h, dict) and h.get("level", 1) == 1
                            ][:20]
                        titles = [t for t in titles if t]
                        if titles:
                            text += "\n- **Structure:** " + " → ".join(titles)
            text += (
                f"\nWhen the user says \"this file\" or \"current file\", "
                f"they mean this file. Use file_id=\"{ctx.id}\" with get_info or read."
            )
            return text

    if ctx.type == "folder" and ctx.id:
        folder_repo = FolderRepository(conn)
        folder = await folder_repo.get_by_id(uuid.UUID(ctx.id), workspace_id)
        if folder:
            name = folder['name']
            path = folder['path']
            return (
                f"\n## Current Location: Folder\n- **Folder:** {name} (path: {path})"
                f"\n- **Folder ID:** {ctx.id}"
                f"\nWhen the user says \"this folder\" or \"current folder\", "
                f"they mean this folder. Use `browse(folder_id=\"{ctx.id}\")` to list its contents."
            )

    return ""
