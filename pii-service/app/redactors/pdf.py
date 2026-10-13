"""PDF burn-in redaction via PyMuPDF.

We redact by matching the detected PII *values* on each page (search_for →
redaction annotations → apply). This permanently removes the underlying text
and draws a black box, so the output PDF carries no recoverable PII.
"""

from app.logging import get_logger

logger = get_logger(__name__)


def redact_pdf(pdf_bytes: bytes, values: list[str]) -> tuple[bytes, int]:
    """Black-box every occurrence of each value across all pages.

    Returns (redacted_pdf_bytes, redaction_count).
    """
    import pymupdf  # PyMuPDF

    uniq = [v for v in dict.fromkeys(v.strip() for v in values) if v]
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    count = 0
    try:
        for page in doc:
            for value in uniq:
                for rect in page.search_for(value):
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    count += 1
            if count:
                page.apply_redactions()
        out = doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()
    logger.info("pdf_redacted", values=len(uniq), redactions=count)
    return out, count
