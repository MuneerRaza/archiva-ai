"""Resolve a file's MIME type + filename into a FileCategory."""

from pathlib import Path

from app.models.workspace import FileCategory

# Exact MIME → category (checked first, order matters for text/csv)
_EXACT_MIME: dict[str, FileCategory] = {
    "application/pdf": FileCategory.DOCUMENT,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileCategory.DOCUMENT,
    "application/msword": FileCategory.DOCUMENT,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileCategory.SPREADSHEET,
    "application/vnd.ms-excel": FileCategory.SPREADSHEET,
    "text/csv": FileCategory.SPREADSHEET,
}

# MIME prefix → category (checked after exact)
_PREFIX_MIME: list[tuple[str, FileCategory]] = [
    ("image/", FileCategory.IMAGE),
    ("audio/", FileCategory.AUDIO),
    ("video/", FileCategory.VIDEO),
    ("text/", FileCategory.TEXT),
]

# Extension fallback for code files that come as application/octet-stream
_CODE_EXTENSIONS: set[str] = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java",
    ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".sh", ".bash",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml",
    ".html", ".css", ".scss", ".sass", ".less", ".sql", ".r",
    ".swift", ".kt", ".scala", ".lua", ".pl", ".ex", ".exs",
}


def resolve_file_category(mime_type: str, filename: str) -> FileCategory | None:
    """Map a file's MIME type (+ filename for fallback) to a FileCategory.

    Returns None for unsupported/unrecognised types.
    """
    # 1. Exact MIME match
    category = _EXACT_MIME.get(mime_type)
    if category is not None:
        return category

    # 2. Prefix match
    for prefix, cat in _PREFIX_MIME:
        if mime_type.startswith(prefix):
            return cat

    # 3. Code-file extension fallback
    ext = Path(filename).suffix.lower()
    if ext in _CODE_EXTENSIONS:
        return FileCategory.TEXT

    # 4. JSON / markdown by extension
    if ext in {".json", ".md", ".markdown"}:
        return FileCategory.TEXT

    return None
