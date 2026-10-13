"""Evaluate the text PII detector and log per-entity precision/recall/F1 to MLflow.

Run inside the pii-service container:

    uv run --no-sync python -m app.eval.run_eval

Logs a run to the configured MLflow tracking server with:
  - params: gliner model id, sample/entity counts
  - metrics: precision/recall/f1 per entity type + macro averages
This is the gate the registry promotion should check (Step 6): only promote a
new detector version if macro-F1 does not regress.
"""

import asyncio

from app.config import settings
from app.detectors.text import TextDetector
from app.eval.dataset import EVAL_ENTITY_TYPES, EVAL_SAMPLES
from app.logging import get_logger

logger = get_logger(__name__)


async def evaluate(detector: TextDetector) -> dict[str, float]:
    # Per entity type: true positives, false positives, false negatives.
    tp: dict[str, int] = dict.fromkeys(EVAL_ENTITY_TYPES, 0)
    fp: dict[str, int] = dict.fromkeys(EVAL_ENTITY_TYPES, 0)
    fn: dict[str, int] = dict.fromkeys(EVAL_ENTITY_TYPES, 0)

    for sample in EVAL_SAMPLES:
        detections = await detector.detect(sample.text, None, [])
        found = {d.entity_type for d in detections}
        expected = set(sample.expected)
        for etype in EVAL_ENTITY_TYPES:
            if etype in expected and etype in found:
                tp[etype] += 1
            elif etype in found and etype not in expected:
                fp[etype] += 1
            elif etype in expected and etype not in found:
                fn[etype] += 1

    metrics: dict[str, float] = {}
    f1s: list[float] = []
    for etype in EVAL_ENTITY_TYPES:
        precision = _safe_div(tp[etype], tp[etype] + fp[etype])
        recall = _safe_div(tp[etype], tp[etype] + fn[etype])
        f1 = _safe_div(2 * precision * recall, precision + recall)
        metrics[f"precision_{etype}"] = precision
        metrics[f"recall_{etype}"] = recall
        metrics[f"f1_{etype}"] = f1
        f1s.append(f1)

    metrics["macro_f1"] = sum(f1s) / len(f1s) if f1s else 0.0
    metrics["macro_precision"] = (
        sum(metrics[f"precision_{e}"] for e in EVAL_ENTITY_TYPES) / len(EVAL_ENTITY_TYPES)
    )
    metrics["macro_recall"] = (
        sum(metrics[f"recall_{e}"] for e in EVAL_ENTITY_TYPES) / len(EVAL_ENTITY_TYPES)
    )
    return metrics


def _safe_div(num: float, den: float) -> float:
    return num / den if den else 0.0


async def main() -> None:
    import mlflow

    detector = TextDetector()
    await detector.warm()
    metrics = await evaluate(detector)

    mlflow.set_tracking_uri(settings.mlflow.tracking_uri)
    mlflow.set_experiment("pii-text-eval")
    with mlflow.start_run(run_name="text-detector-eval"):
        mlflow.log_param("gliner_model_id", settings.text.gliner_model_id)
        mlflow.log_param("num_samples", len(EVAL_SAMPLES))
        mlflow.log_param("entity_types", ",".join(EVAL_ENTITY_TYPES))
        mlflow.log_metrics(metrics)

    logger.info(
        "eval_complete",
        macro_f1=round(metrics["macro_f1"], 3),
        macro_precision=round(metrics["macro_precision"], 3),
        macro_recall=round(metrics["macro_recall"], 3),
    )
    for k, v in sorted(metrics.items()):
        print(f"{k}: {v:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
