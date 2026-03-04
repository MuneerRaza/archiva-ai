"""Agent tool implementations for Pydantic AI — browse, get_info, search, read."""

import uuid
from dataclasses import dataclass
from enum import StrEnum

import asyncpg
from pydantic_ai import RunContext

from app.logging import get_logger
from app.repositories.file import FileRepository, FileSortField, SortDirection
from app.repositories.folder import FolderRepository
from app.repositories.processing import ProcessingRepository
from app.repositories.search import SearchRepository
from app.repositories.tag import TagRepository

logger = get_logger(__name__)

DEFAULT_CONTEXT_CHARS = 16000  # fallback when no context_length configured (~4K tokens)
MIN_CONTEXT_CHARS = 4000  # never return less than this
BROWSE_LIMIT = 30
SEARCH_LIMIT = 20


class BrowseSortBy(StrEnum):
    NAME = "name"
    SIZE = "size"
    RECENT = "recent"


_SORT_MAP: dict[BrowseSortBy, tuple[FileSortField, SortDirection]] = {
    BrowseSortBy.NAME: (FileSortField.NAME, SortDirection.ASC),
    BrowseSortBy.SIZE: (FileSortField.SIZE, SortDirection.DESC),
    BrowseSortBy.RECENT: (FileSortField.UPDATED, SortDirection.DESC),
}

_STATUS_DESCRIPTIONS: dict[str, str] = {
    "processing": "Extraction in progress, content not yet available.",
    "failed": "Processing failed, file may be corrupt or unsupported.",
}


@dataclass
class AgentDeps:
    conn: asyncpg.Connection
    workspace_id: uuid.UUID
    user_id: str
    remaining_context_chars: int = DEFAULT_CONTEXT_CHARS


async def browse(
    ctx: RunContext[AgentDeps],
    folder_id: str | None = None,
    sort_by: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> str:
    """List files and folders in the workspace.

    Args:
        folder_id: Folder ID to browse. Leave empty for the workspace root.
        sort_by: Sort order for files — "name", "size", or "recent" (by last updated).
        limit: Maximum number of items to return (1-50).
        offset: Number of items to skip for pagination.
    """
    deps = ctx.deps
    file_repo = FileRepository(deps.conn)
    folder_repo = FolderRepository(deps.conn)

    folder_id = (folder_id or "").strip()
    sort_by = (sort_by or "name").strip()
    limit = min(max(limit, 1), 50)
    offset = max(offset, 0)

    try:
        fid = uuid.UUID(folder_id) if folder_id else None
    except ValueError:
        return f"Error: Invalid folder_id '{folder_id}'"

    # Map sort param
    try:
        sort_enum = BrowseSortBy(sort_by)
    except ValueError:
        sort_enum = BrowseSortBy.NAME
    file_sort, sort_dir = _SORT_MAP[sort_enum]

    try:
        folders = await folder_repo.list_children(deps.workspace_id, fid)
        files_rows, total_files = await file_repo.list_by_folder(
            deps.workspace_id, fid,
            sort_by=file_sort, sort_dir=sort_dir,
            limit=limit, offset=offset,
        )
    except Exception as exc:
        logger.warning("tool_browse_error", error=str(exc))
        return f"Error browsing: {exc}"

    lines: list[str] = []

    # Resolve parent folder name
    if fid:
        parent = await folder_repo.get_by_id(fid, deps.workspace_id)
        if parent:
            lines.append(f"Contents of folder: {parent['name']}")
        else:
            return f"Error: Folder {folder_id} not found in this workspace."
    else:
        lines.append("Contents of home:")

    for f in folders[:limit]:
        lines.append(f"  [folder] {f['name']}  (id: {f['id']})")

    remaining = limit - len(folders[:limit])
    for f in files_rows[:remaining]:
        size_kb = f["size_bytes"] / 1024 if f["size_bytes"] else 0
        lines.append(f"  [file] {f['name']}  ({size_kb:.0f} KB)  (id: {f['id']})")

    total = len(folders) + total_files
    shown = len(folders[:limit]) + len(files_rows[:remaining])
    lines.append(f"\nTotal items: {total}")
    if total > shown:
        lines.append(f"(showing {shown} of {total} — use offset={offset + shown} to see more)")

    return "\n".join(lines)


async def get_info(
    ctx: RunContext[AgentDeps],
    file_id: str,
    include: str | None = None,
) -> str:
    """Get detailed information about a specific file.

    Args:
        file_id: The ID of the file to get info about.
        include: Comma-separated list of sections to include. Options: "summary", "structure", "metadata", "tags". Use all for full details, or pick specific sections to reduce output.
    """
    deps = ctx.deps
    file_repo = FileRepository(deps.conn)
    tag_repo = TagRepository(deps.conn)

    include = (include or "summary,structure,metadata,tags").strip()
    include_set = {s.strip().lower() for s in include.split(",") if s.strip()}

    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        return f"Error: Invalid file_id '{file_id}'"

    row = await file_repo.get_by_id(fid, deps.workspace_id)
    if not row:
        return f"Error: File {file_id} not found in this workspace."

    content = await file_repo.get_content(fid)
    tag_rows = await tag_repo.get_file_tags(fid)
    tags = [r["name"] for r in tag_rows]

    status = row["status"]

    lines = [
        f"File: {row['name']}",
        f"ID: {row['id']}",
        f"Type: {row['mime_type']}",
        f"Size: {row['size_bytes'] / 1024:.0f} KB",
    ]

    # Only show status when it's actionable (processing or failed)
    if status in ("processing", "failed"):
        status_desc = _STATUS_DESCRIPTIONS[status]
        lines.append(f"Status: {status} — {status_desc}")

    # Show per-step failures from latest processing job
    proc_repo = ProcessingRepository(deps.conn)
    job = await proc_repo.get_job_by_file(fid)
    if job and job["steps"]:
        import json as _json
        steps = job["steps"]
        if isinstance(steps, str):
            steps = _json.loads(steps)
        if isinstance(steps, dict):
            failed_steps = [
                (k, v.split(": ", 1)[1] if ": " in v else "unknown")
                for k, v in steps.items()
                if isinstance(v, str) and v.startswith("failed")
            ]
            if failed_steps:
                lines.append("\nProcessing issues:")
                for step_name, reason in failed_steps:
                    lines.append(f"  - {step_name}: {reason}")

    if row["folder_id"]:
        lines.append(f"Folder ID: {row['folder_id']}")

    if content:
        if "summary" in include_set:
            if content["summary"]:
                lines.append(f"\nSummary:\n{content['summary']}")
            if content["overview"]:
                lines.append(f"\nOverview:\n{content['overview']}")
        if "structure" in include_set and content["structure"]:
            headings = content["structure"]
            if isinstance(headings, list):
                lines.append("\nStructure:")
                for h in headings[:30]:
                    if isinstance(h, dict):
                        level = h.get("level", 1)
                        text = h.get("text", "")
                        indent = "  " * (level - 1)
                        lines.append(f"  {indent}{text}")
        if "metadata" in include_set:
            if content["page_count"]:
                lines.append(f"Pages: {content['page_count']}")
            if content["word_count"]:
                lines.append(f"Words: {content['word_count']}")
            if content["language"]:
                lines.append(f"Language: {content['language']}")

    if "tags" in include_set and tags:
        lines.append(f"\nTags: {', '.join(tags)}")

    lines.append(f"\nCreated: {row['created_at']}")
    lines.append(f"Updated: {row['updated_at']}")

    return "\n".join(lines)


async def search(
    ctx: RunContext[AgentDeps],
    query: str,
    limit: int = 10,
    offset: int = 0,
) -> str:
    """Search for files in the workspace by content or filename. Uses full-text search and fuzzy matching.

    Args:
        query: Search query string.
        limit: Maximum number of results to return (1-20).
        offset: Number of results to skip for pagination.
    """
    deps = ctx.deps
    search_repo = SearchRepository(deps.conn)

    limit = min(max(limit, 1), SEARCH_LIMIT)
    offset = max(offset, 0)

    try:
        rows, total = await search_repo.search(
            deps.workspace_id, query, limit=limit, offset=offset,
        )
    except Exception as exc:
        logger.warning("tool_search_error", error=str(exc))
        return f"Error searching: {exc}"

    if not rows:
        return f"No results found for '{query}'."

    lines = [f"Search results for '{query}' ({total} total):"]
    for r in rows:
        summary_preview = ""
        if r["summary"]:
            summary_preview = f" — {r['summary'][:100]}"
        lines.append(
            f"  {r['name']} (id: {r['id']}, rank: {float(r['rank']):.2f}){summary_preview}"
        )

    shown = offset + len(rows)
    if total > shown:
        lines.append(f"\n(showing {len(rows)} of {total} results — use offset={shown} to see more)")

    return "\n".join(lines)


async def read(
    ctx: RunContext[AgentDeps],
    file_id: str,
    offset: int = 0,
    match: str | None = None,
) -> str:
    """Read the extracted text content of a file.

    Args:
        file_id: The ID of the file to read.
        offset: Character offset to start reading from. Use for pagination through long documents.
        match: Optional search term. When provided, returns the first passage containing this term instead of reading from the offset. Useful for jumping directly to relevant content.
    """
    deps = ctx.deps
    file_repo = FileRepository(deps.conn)
    budget = max(deps.remaining_context_chars, MIN_CONTEXT_CHARS)

    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        return f"Error: Invalid file_id '{file_id}'"

    row = await file_repo.get_by_id(fid, deps.workspace_id)
    if not row:
        return f"Error: File {file_id} not found in this workspace."

    content = await file_repo.get_content(fid)
    raw_text = content["raw_text"] if content and content["raw_text"] else ""

    total = len(raw_text)

    # Match mode: find the passage containing the search term
    match = (match or "").strip()
    if match:
        idx = raw_text.lower().find(match.lower())
        if idx == -1:
            return f"No match for '{match}' in '{row['name']}' ({total} chars total)."
        # Center the chunk around the match
        start = max(0, idx - budget // 4)
        chunk = raw_text[start : start + budget]
        end = start + len(chunk)
        lines = [
            f"Content of '{row['name']}' matching '{match}' (chars {start}-{end} of {total}):",
            chunk,
        ]
        if end < total:
            lines.append(f"\n[Truncated — showing {len(chunk)} of {total} chars. Use offset={end} to continue.]")
        return "\n".join(lines)

    # Normal mode: return full content if it fits, otherwise truncate to budget
    if offset >= total:
        return f"File '{row['name']}' has {total} characters. Offset {offset} is beyond the end."

    remaining_text = raw_text[offset:]

    if len(remaining_text) <= budget:
        # Full content fits (or remaining content fits)
        if offset == 0:
            return f"Content of '{row['name']}' ({total} chars):\n{remaining_text}"
        return f"Content of '{row['name']}' (chars {offset}-{total} of {total}):\n{remaining_text}"

    # Truncate to budget
    chunk = remaining_text[:budget]
    end = offset + len(chunk)
    lines = [
        f"Content of '{row['name']}' (chars {offset}-{end} of {total}):",
        chunk,
        f"\n[Truncated — showing {len(chunk)} of {total} chars. Use offset={end} to continue.]",
    ]
    return "\n".join(lines)
