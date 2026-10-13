"""Image redaction — blur or black-box rectangular regions via OpenCV."""

from app.models.redaction import RedactionMethod


def redact_image(
    image_bytes: bytes,
    boxes: list[dict],
    method: RedactionMethod = RedactionMethod.BLUR,
) -> tuple[bytes, int]:
    """Apply blur/box to each {x,y,w,h} region. Returns (png_bytes, count)."""
    import cv2
    import numpy as np

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    h_img, w_img = img.shape[:2]
    count = 0
    for b in boxes:
        x1 = max(0, int(b["x"]))
        y1 = max(0, int(b["y"]))
        x2 = min(w_img, int(b["x"] + b["w"]))
        y2 = min(h_img, int(b["y"] + b["h"]))
        if x2 <= x1 or y2 <= y1:
            continue
        if method == RedactionMethod.BOX:
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 0), thickness=-1)
        else:  # BLUR — strong pixelation-style gaussian
            roi = img[y1:y2, x1:x2]
            k = max(31, ((x2 - x1) // 3) | 1)  # odd kernel scaled to region
            img[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (k, k), 0)
        count += 1

    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise ValueError("Could not encode redacted image")
    return buf.tobytes(), count
