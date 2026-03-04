from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TableData:
    headers: list[str]
    rows: list[list[str]]
    page_number: int | None = None
    sheet_name: str | None = None


@dataclass
class StructureSection:
    title: str
    level: int = 0
    summary: str | None = None
    page: int | None = None
    children: list["StructureSection"] = field(default_factory=list)


@dataclass
class ExtractionResult:
    raw_text: str
    page_count: int | None = None
    word_count: int | None = None
    language: str | None = None
    tables: list[TableData] = field(default_factory=list)
    structure: dict | None = None


class Extractor(ABC):
    @abstractmethod
    async def extract(self, file_path: Path, mime_type: str) -> ExtractionResult:
        """Extract text and metadata from a file."""
