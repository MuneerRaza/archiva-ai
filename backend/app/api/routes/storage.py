from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.config import settings
from app.exceptions import NotFoundError

router = APIRouter(prefix="/storage/local", tags=["storage"])

STORAGE_DIR = Path(settings.app.local_storage_path)


@router.get("/{file_path:path}")
async def serve_local_file(file_path: str) -> FileResponse:
    """Serve files from local storage (dev only)."""
    full_path = STORAGE_DIR / file_path
    if not full_path.exists() or not full_path.is_file():
        raise NotFoundError("File", file_path)

    # Prevent path traversal
    try:
        full_path.resolve().relative_to(STORAGE_DIR.resolve())
    except ValueError:
        raise NotFoundError("File", file_path)

    return FileResponse(
        path=full_path,
        filename=full_path.name,
        media_type="application/octet-stream",
    )
