import asyncio
import io
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.models.redaction import (
    RedactionMethod,
    RedactTextRequest,
    RedactTextResponse,
)
from app.redactors.audio import ffmpeg_available, redact_audio
from app.redactors.image import redact_image
from app.redactors.pdf import redact_pdf
from app.redactors.text import redact_text

router = APIRouter(tags=["redact"])


@router.post("/redact/text", response_model=RedactTextResponse)
async def redact_text_route(req: RedactTextRequest) -> RedactTextResponse:
    redacted, count = await asyncio.to_thread(
        redact_text, req.content, req.spans, req.method, req.mask_char,
    )
    return RedactTextResponse(redacted=redacted, redaction_count=count)


@router.post("/redact/document")
async def redact_document_route(
    file: UploadFile = File(...),
    values: str = Form(...),  # JSON array of PII strings to black-box
) -> StreamingResponse:
    """Burn-in redaction of a PDF. Returns the redacted PDF bytes.

    The redaction count is returned in the `X-Redaction-Count` header.
    """
    pdf_bytes = await file.read()
    value_list: list[str] = json.loads(values)
    redacted, count = await asyncio.to_thread(redact_pdf, pdf_bytes, value_list)
    return StreamingResponse(
        io.BytesIO(redacted),
        media_type="application/pdf",
        headers={"X-Redaction-Count": str(count)},
    )


@router.post("/redact/image")
async def redact_image_route(
    file: UploadFile = File(...),
    boxes: str = Form(...),  # JSON array of {x,y,w,h}
    method: str = Form(default="blur"),
) -> StreamingResponse:
    """Blur/box regions of an image. Returns the redacted PNG bytes."""
    image_bytes = await file.read()
    box_list: list[dict] = json.loads(boxes)
    redacted, count = await asyncio.to_thread(
        redact_image, image_bytes, box_list, RedactionMethod(method),
    )
    return StreamingResponse(
        io.BytesIO(redacted),
        media_type="image/png",
        headers={"X-Redaction-Count": str(count)},
    )


@router.post("/redact/audio")
async def redact_audio_route(
    file: UploadFile = File(...),
    ranges: str = Form(...),  # JSON array of {start_s, end_s}
    method: str = Form(default="beep"),
    suffix: str = Form(default=".mp3"),
) -> StreamingResponse:
    """Beep/silence time ranges in audio. Returns the redacted audio bytes."""
    if not ffmpeg_available():
        raise HTTPException(status_code=501, detail="ffmpeg not installed in pii-service")
    audio_bytes = await file.read()
    range_list: list[dict] = json.loads(ranges)
    redacted, count = await asyncio.to_thread(
        redact_audio, audio_bytes, range_list, RedactionMethod(method), suffix,
    )
    return StreamingResponse(
        io.BytesIO(redacted),
        media_type="application/octet-stream",
        headers={"X-Redaction-Count": str(count)},
    )
