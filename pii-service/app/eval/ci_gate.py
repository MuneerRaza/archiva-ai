"""CI eval gate — run the PII eval offline (no MLflow) and fail if macro-F1
regresses below PII_EVAL_MIN_MACRO_F1. Used by .github/workflows/pii-eval.yml.

    uv run python -m app.eval.ci_gate
"""

import asyncio
import os
import sys

from app.detectors.text import TextDetector
from app.eval.run_eval import evaluate


async def main() -> int:
    threshold = float(os.environ.get("PII_EVAL_MIN_MACRO_F1", "0.6"))
    detector = TextDetector()
    await detector.warm()
    metrics = await evaluate(detector)

    macro_f1 = metrics["macro_f1"]
    for k, v in sorted(metrics.items()):
        print(f"{k}: {v:.3f}")
    print(f"\nmacro_f1={macro_f1:.3f} threshold={threshold:.3f}")

    if macro_f1 < threshold:
        print(f"FAIL: macro-F1 {macro_f1:.3f} below threshold {threshold:.3f}")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
