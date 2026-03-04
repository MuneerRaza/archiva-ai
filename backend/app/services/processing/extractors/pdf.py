import asyncio
import re
from pathlib import Path

from app.services.processing.extractors.base import Extractor, ExtractionResult, TableData
from app.services.processing.extractors.text import _detect_language


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
_MD_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_MD_ITALIC_RE = re.compile(r"\*(.+?)\*")


def _strip_md_inline(text: str) -> str:
    """Remove markdown bold/italic markers from a string."""
    text = _MD_BOLD_RE.sub(r"\1", text)
    text = _MD_ITALIC_RE.sub(r"\1", text)
    return text.strip()


_MAX_HEADING_LEVEL = 3
_MAX_HEADING_LENGTH = 100


def _extract_structure_from_markdown(md_text: str, pages_text: list[str]) -> dict | None:
    """Extract headings from pymupdf4llm markdown output with page mapping.

    Only keeps level 1-3 headings (actual chapter/section titles) and filters
    out items that are too long to be real headings.
    """
    headings: list[dict] = []
    for match in _HEADING_RE.finditer(md_text):
        level = len(match.group(1))
        if level > _MAX_HEADING_LEVEL:
            continue
        raw_title = match.group(2).strip()
        title = _strip_md_inline(raw_title)
        if not title or len(title) > _MAX_HEADING_LENGTH:
            continue

        page = _find_heading_page(title, pages_text)
        entry: dict = {"title": title, "level": level}
        if page is not None:
            entry["page"] = page
        headings.append(entry)

    if not headings:
        return None

    return {
        "title": headings[0]["title"],
        "sections": headings,
        "key_topics": [],
    }


def _find_heading_page(title: str, pages_text: list[str]) -> int | None:
    """Find the 1-based page number where a heading title first appears."""
    title_lower = title.lower()
    for i, page_text in enumerate(pages_text):
        if title_lower in page_text.lower():
            return i + 1
    return None


def _extract_structure_from_toc(toc: list[list]) -> dict | None:
    """Build structure from PyMuPDF TOC with page numbers."""
    if not toc:
        return None

    sections = []
    for entry in toc:
        level, title, page = entry[0], entry[1], entry[2]
        if title.strip():
            sections.append({"title": title.strip(), "level": level, "page": page})

    if not sections:
        return None

    return {
        "title": sections[0]["title"],
        "sections": sections,
        "key_topics": [],
    }


def _extract_pdf_sync(file_path: Path) -> ExtractionResult:
    import pymupdf
    import pymupdf4llm

    doc = pymupdf.open(str(file_path))

    # Extract text + tables per page
    pages_text: list[str] = []
    tables: list[TableData] = []

    for page_num, page in enumerate(doc):
        text = page.get_text()
        pages_text.append(text)

        try:
            page_tables = page.find_tables()
            for table in page_tables:
                extracted = table.extract()
                if not extracted or len(extracted) < 2:
                    continue
                headers = [str(h) if h else "" for h in extracted[0]]
                rows = [[str(c) if c else "" for c in row] for row in extracted[1:]]
                tables.append(TableData(
                    headers=headers,
                    rows=rows,
                    page_number=page_num + 1,
                ))
        except Exception:
            pass

    # Extract structure from TOC (has page numbers) — fallback to markdown headings
    toc = doc.get_toc()
    doc.close()

    structure = _extract_structure_from_toc(toc)
    if not structure:
        md_text = pymupdf4llm.to_markdown(str(file_path))
        structure = _extract_structure_from_markdown(md_text, pages_text)

    raw_text = "\n\n".join(pages_text)
    words = raw_text.split()

    return ExtractionResult(
        raw_text=raw_text,
        page_count=len(pages_text),
        word_count=len(words),
        language=_detect_language(raw_text),
        tables=tables,
        structure=structure,
    )


class PDFExtractor(Extractor):
    async def extract(self, file_path: Path, mime_type: str) -> ExtractionResult:
        return await asyncio.to_thread(_extract_pdf_sync, file_path)
