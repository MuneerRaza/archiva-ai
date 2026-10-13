import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.models.detection import DetectRequest, DetectResponse, Modality, ModelInfo
from app.state import image_detector, text_detector, video_detector, vision_detector

router = APIRouter(tags=["detect"])


@router.post("/detect/text", response_model=DetectResponse)
async def detect_text(req: DetectRequest) -> DetectResponse:
    if req.content is None:
        raise HTTPException(status_code=422, detail="text detection requires 'content'")
    detections = await text_detector.detect(
        content=req.content,
        classes=req.classes,
        custom_regex=req.custom_regex,
        language=req.language,
    )
    return DetectResponse(
        modality=req.modality,
        detections=detections,
        model_info=ModelInfo(
            text={
                "gliner": settings.text.gliner_model_id,
                "presidio": "analyzer",
            }
        ),
    )


@router.post("/detect/image", response_model=DetectResponse)
async def detect_image(
    file: UploadFile = File(...),
    classes: str | None = Form(default=None),       # JSON array of YOLO classes
    text_entities: str | None = Form(default=None),  # JSON array of entity types
    custom_regex: str | None = Form(default=None),   # JSON array of patterns
    ocr: bool = Form(default=True),
) -> DetectResponse:
    image_bytes = await file.read()
    detections = await image_detector.detect(
        image_bytes,
        classes=_json_list(classes),
        text_entities=_json_list(text_entities),
        custom_regex=_json_list(custom_regex) or [],
        ocr=ocr,
    )
    return DetectResponse(
        modality=Modality.IMAGE,
        detections=detections,
        model_info=ModelInfo(
            vision=vision_detector.info or None,
            text={"gliner": settings.text.gliner_model_id, "presidio": "analyzer"} if ocr else None,
        ),
    )


@router.post("/detect/video", response_model=DetectResponse)
async def detect_video(
    file: UploadFile = File(...),
    classes: str | None = Form(default=None),
    sample_fps: float = Form(default=1.0),
) -> DetectResponse:
    video_bytes = await file.read()
    detections = await video_detector.detect(
        video_bytes, classes=_json_list(classes), sample_fps=sample_fps,
    )
    return DetectResponse(
        modality=Modality.VIDEO,
        detections=detections,
        model_info=ModelInfo(vision=vision_detector.info or None),
    )


def _json_list(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    parsed = json.loads(raw)
    return parsed if isinstance(parsed, list) else None
