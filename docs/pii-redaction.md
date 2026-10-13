# PII Detection & Redaction — Architecture & MLOps

An on-demand, human-in-the-loop system that detects and redacts personally
identifiable information (PII) across **text, PDFs, spreadsheets, images, audio
transcripts, and video** — built as a modular microservice with a full MLflow
model lifecycle.

## Why it's interesting (the engineering story)

- **Modular service split.** All heavy ML (Presidio, GLiNER, Ultralytics YOLO,
  OpenCV, PyMuPDF) lives in a dedicated `pii-service` container. The main
  FastAPI backend stays light and proxies over HTTP. The backend owns storage +
  DB + orchestration; `pii-service` is stateless compute (bytes in → detections
  / redacted bytes out).
- **Registry-driven models.** `pii-service` loads its YOLO model from the
  **MLflow Model Registry** by `name + stage=Production`. Promoting a new
  version + calling `POST /models/reload` swaps the live model with **zero code
  change** — the core MLOps demonstration. A custom multi-class PII YOLO trained
  later (faces / plates / IDs) drops in the same way.
- **Reproducible eval gate.** A labeled eval set scores per-entity
  precision/recall/F1 and logs to MLflow; registry promotion is gated on
  macro-F1 not regressing.

## Architecture

```
Next.js UI ──/api──> backend (FastAPI) ──httpx──> pii-service (FastAPI + ML)
                          │                              │
                     Postgres (pii_* tables)        MLflow registry/tracking ──> MinIO
```

Services (docker-compose): `backend`, `frontend`, `db`, `pii-service`,
`mlflow` (+ `mlflow-postgres`), `minio` (+ `minio-setup`).

## Detection engines

| Modality | Engine | Location type |
|---|---|---|
| Text / PDF / spreadsheet | Microsoft **Presidio** (regex + NLP) + **GLiNER** (zero-shot NER) + user regex | char span |
| Audio (transcript) | same text engines over the Whisper transcript | char span → time range |
| Image | **YOLO** visual objects + **Tesseract OCR** text-in-image* | bounding box |
| Video | **YOLO** on sampled frames (OpenCV decode) | bbox + frame/timestamp |

\* OCR (`tesseract-ocr`) and audio/video re-encoding (`ffmpeg`) are **not baked
into the image** because their apt trees OOM the memory-constrained build VM.
The code paths degrade gracefully (clear error / visual-only). Install
`tesseract-ocr` and `ffmpeg` on a capable build host to enable them — no code
change required.

## Redaction

| Modality | Method | Tool |
|---|---|---|
| Text / spreadsheet | mask (████) or label ([TYPE]) | in-process |
| PDF | burn-in black box (text truly removed) | PyMuPDF redaction annotations |
| Image | blur or black box over regions | OpenCV |
| Audio | beep or silence over time ranges | ffmpeg* |
| Video | frame blur + timed audio mute | ffmpeg* |

Output is configurable: **new redacted copy** (keeps original) or **in place**.

### Transcript → audio mapping

Whisper is requested with `timestamp_granularities=[segment, word]`. Each word's
char offset into the transcript is stored (`file_contents.transcript_words`). A
detected PII char span is mapped to overlapping words → `[min start, max end]`
seconds, padded and merged, then beeped/silenced. See
`spans_to_time_ranges()` (`backend/app/services/pii.py`).

## Data model (`migration 010`, `011`)

- `pii_detection_runs` — one row per detect invocation (modality, requested
  classes, model provenance, status).
- `pii_detections` — each finding (entity type, value, score, source,
  `location_type` + `location` JSONB: char_span | bbox | time_range, selected).
- `pii_redactions` — applied redactions (mode, method, output key).
- `file_contents.transcript_words` — word timings for audio/video.

## API (backend)

```
POST /api/workspaces/{ws}/files/{file}/pii/detect          {modality, classes?, custom_regex?}
GET  /api/workspaces/{ws}/files/{file}/pii                 # latest run + detections
GET  /api/workspaces/{ws}/files/{file}/pii/runs/{run}
POST /api/workspaces/{ws}/files/{file}/pii/runs/{run}/redact  {mode, method, detection_ids?}
```

Gated by the workspace setting `ingestion.pii.enabled` — when on, a **Detect
PII** action appears on each file with a review panel (select findings → choose
copy/in-place + method → redact).

## MLflow model lifecycle

1. **Bootstrap** (first run): pretrained COCO YOLO downloaded, logged, registered
   as `pii-vision-yolo`, promoted to `Production`. GLiNER registered as a
   reference.
2. **Serve**: `pii-service` loads `models:/pii-vision-yolo/Production` at startup
   and on `POST /models/reload`.
3. **Evaluate**: `uv run --no-sync python -m app.eval.run_eval` logs per-entity
   metrics to the `pii-text-eval` experiment.
4. **Promote**: register a new version → promote to `Production` (gated on
   macro-F1) → `reload`. Zero code change.

## Run it

```bash
docker compose up -d --build       # backend, frontend, db, pii-service, mlflow, minio
# pii-service bootstraps + registers the YOLO model on first start
curl localhost:8500/health         # vision_model loaded from registry
```

MLflow UI: `localhost:5000` · MinIO console: `localhost:9001`.
