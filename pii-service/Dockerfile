FROM python:3.12-slim

WORKDIR /app

# Headless OpenCV (see pyproject) avoids the libGL/mesa stack; it still dlopen's
# libxcb at import, so libxcb1 (tiny) is included. glib + libgomp for
# ultralytics/torch, curl for healthchecks. One apt pass — the VM's Debian
# mirror is slow, so we minimize apt calls.
# Check-Valid-Until=false: skip apt's repo-metadata expiry check (host clock skew).
# tesseract-ocr (for OCR text-in-image) is intentionally NOT installed here:
# its apt tree OOMs the memory-constrained build VM. The OCR path degrades
# gracefully without the binary (see ImageDetector._detect_ocr). To enable OCR,
# add `tesseract-ocr` below on a build host with more memory.
RUN apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends \
       libglib2.0-0 libgomp1 libxcb1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./

RUN uv sync --frozen --no-dev || uv sync --no-dev

# Bake the spaCy model into the image so Presidio's NLP engine is ready offline.
RUN uv run python -m spacy download en_core_web_sm

# ultralytics pulls the GUI build (opencv-python → needs libGL/mesa). Replace it
# with the headless build (same cv2 API, no libGL). Done last so it's the final
# venv state; combined with `uv run --no-sync` (CMD) it survives at runtime.
RUN uv pip uninstall opencv-python \
    && uv pip install "opencv-python-headless>=4.8"

COPY . .

EXPOSE 8001

# --no-sync: do NOT re-sync the venv at startup. `uv run` would otherwise
# reinstall the GUI opencv-python from the lockfile and undo the headless swap.
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
