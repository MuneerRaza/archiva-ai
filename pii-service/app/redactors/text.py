"""Plain-text redaction by character span."""

from app.models.redaction import RedactionMethod, RedactSpan


def redact_text(
    content: str,
    spans: list[RedactSpan],
    method: RedactionMethod = RedactionMethod.MASK,
    mask_char: str = "█",
) -> tuple[str, int]:
    """Replace each span with a mask or an entity label. Returns (text, count).

    Spans are applied right-to-left so earlier offsets stay valid as the string
    length changes. Overlapping spans are merged first.
    """
    valid = [s for s in spans if 0 <= s.start < s.end <= len(content)]
    if not valid:
        return content, 0

    merged = _merge(valid)
    out = content
    for span in sorted(merged, key=lambda s: s.start, reverse=True):
        original = out[span.start : span.end]
        if method == RedactionMethod.LABEL:
            replacement = f"[{span.entity_type}]"
        else:  # MASK
            replacement = mask_char * len(original)
        out = out[: span.start] + replacement + out[span.end :]
    return out, len(merged)


def _merge(spans: list[RedactSpan]) -> list[RedactSpan]:
    ordered = sorted(spans, key=lambda s: s.start)
    merged: list[RedactSpan] = [ordered[0]]
    for s in ordered[1:]:
        last = merged[-1]
        if s.start <= last.end:
            if s.end > last.end:
                merged[-1] = RedactSpan(
                    start=last.start, end=s.end, entity_type=last.entity_type,
                )
        else:
            merged.append(s)
    return merged
