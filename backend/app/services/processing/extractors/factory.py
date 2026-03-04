from app.services.processing.extractors.base import Extractor
from app.services.processing.extractors.text import TextExtractor

# Mime type prefixes/patterns → extractor classes
_TEXT_TYPES = {"text/", "application/json", "application/xml", "application/javascript"}
_CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss",
    ".md", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".sh", ".bash", ".zsh", ".fish", ".rs", ".go", ".java",
    ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".swift", ".kt",
    ".sql", ".graphql", ".proto", ".env", ".gitignore", ".dockerfile",
}


def get_extractor(mime_type: str, filename: str = "") -> Extractor | None:
    # Text and code files
    for prefix in _TEXT_TYPES:
        if mime_type.startswith(prefix):
            return TextExtractor()

    # Check file extension for code files that might have application/octet-stream
    suffix = ""
    if filename:
        from pathlib import Path
        suffix = Path(filename).suffix.lower()
    if suffix in _CODE_EXTENSIONS:
        return TextExtractor()

    # PDF
    if mime_type == "application/pdf":
        from app.services.processing.extractors.pdf import PDFExtractor
        return PDFExtractor()

    # DOCX
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        from app.services.processing.extractors.docx import DocxExtractor
        return DocxExtractor()

    # Spreadsheets
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ):
        from app.services.processing.extractors.spreadsheet import SpreadsheetExtractor
        return SpreadsheetExtractor()

    return None
