"""Audio redaction — overlay a beep or silence over time ranges via ffmpeg.

Requires the `ffmpeg` binary. If absent, raises a clear error so the backend
can report it (ffmpeg is intentionally not baked into the memory-constrained
build image; install it on a capable build host to enable audio/video redaction).
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

from app.logging import get_logger
from app.models.redaction import RedactionMethod

logger = get_logger(__name__)


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def redact_audio(
    audio_bytes: bytes,
    ranges: list[dict],
    method: RedactionMethod = RedactionMethod.BEEP,
    suffix: str = ".mp3",
) -> tuple[bytes, int]:
    """Beep/silence the given time ranges. Returns (audio_bytes, count)."""
    if not ffmpeg_available():
        raise RuntimeError("ffmpeg is not installed in the pii-service image")

    valid = [r for r in ranges if float(r["end_s"]) > float(r["start_s"])]
    if not valid:
        return audio_bytes, 0

    # volume=0 between each range; for beep, overlay a sine tone in the gaps.
    vol_expr = "+".join(
        f"between(t,{float(r['start_s'])},{float(r['end_s'])})" for r in valid
    )
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"in{suffix}"
        dst = Path(tmp) / f"out{suffix}"
        src.write_bytes(audio_bytes)

        if method == RedactionMethod.BEEP:
            filter_complex = (
                f"[0:a]volume=0:enable='{vol_expr}'[main];"
                f"sine=frequency=1000[s];"
                f"[s][0:a]atrim=0,asetpts=PTS-STARTPTS[beep];"
                f"[beep]volume=1:enable='{vol_expr}',volume=0:enable='not({vol_expr})'[tone];"
                f"[main][tone]amix=inputs=2:duration=first[out]"
            )
            args = ["ffmpeg", "-y", "-i", str(src), "-filter_complex", filter_complex,
                    "-map", "[out]", str(dst)]
        else:
            args = ["ffmpeg", "-y", "-i", str(src), "-af",
                    f"volume=0:enable='{vol_expr}'", str(dst)]

        proc = subprocess.run(args, capture_output=True, timeout=600)
        if proc.returncode != 0:
            logger.warning("ffmpeg_failed", stderr=proc.stderr.decode("utf-8", "ignore")[:400])
            raise RuntimeError("ffmpeg redaction failed")
        return dst.read_bytes(), len(valid)
