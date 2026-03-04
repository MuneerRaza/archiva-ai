import re
from pathlib import Path

import aiofiles

from app.services.processing.extractors.base import Extractor, ExtractionResult


# Simple heuristic: check for common character ranges
def _detect_language(text: str) -> str:
    if not text:
        return "en"

    sample = text[:2000]

    # CJK characters
    cjk_count = sum(1 for c in sample if "\u4e00" <= c <= "\u9fff")
    if cjk_count > len(sample) * 0.1:
        return "zh"

    # Japanese (hiragana/katakana)
    jp_count = sum(1 for c in sample if "\u3040" <= c <= "\u30ff")
    if jp_count > len(sample) * 0.05:
        return "ja"

    # Arabic
    ar_count = sum(1 for c in sample if "\u0600" <= c <= "\u06ff")
    if ar_count > len(sample) * 0.1:
        return "ar"

    return "en"


def _extract_markdown_structure(text: str) -> dict | None:
    """Extract headings from markdown content."""
    headings: list[dict] = []
    for line in text.split("\n"):
        match = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            if title:
                headings.append({"title": title, "level": level})

    if not headings:
        return None

    doc_title = headings[0]["title"] if headings else "Untitled"
    sections = []
    for i, h in enumerate(headings):
        sections.append({"title": h["title"], "level": h["level"], "anchor": f"heading-{i}"})
    return {
        "title": doc_title,
        "sections": sections,
    }


class TextExtractor(Extractor):
    async def extract(self, file_path: Path, mime_type: str) -> ExtractionResult:
        async with aiofiles.open(file_path, "r", errors="replace") as f:
            raw_text = await f.read()

        words = raw_text.split()
        word_count = len(words)

        # Estimate pages (roughly 250 words per page)
        page_count = max(1, word_count // 250)

        language = _detect_language(raw_text)

        # Extract structure from markdown files
        structure = None
        if mime_type in ("text/markdown", "text/x-markdown"):
            structure = _extract_markdown_structure(raw_text)

        return ExtractionResult(
            raw_text=raw_text,
            page_count=page_count,
            word_count=word_count,
            language=language,
            structure=structure,
        )
