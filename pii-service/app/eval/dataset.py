"""Small labeled PII eval set for the text detector.

Each sample lists the entity types that SHOULD be found in the text. We score
at the (sample, entity_type) level: did the detector surface that type? This is
deliberately simple and deterministic — the point is a repeatable metric logged
to MLflow across model/threshold versions, not a benchmark-grade corpus.
"""

from pydantic import BaseModel


class EvalSample(BaseModel):
    text: str
    expected: list[str]  # entity types expected somewhere in the text


EVAL_SAMPLES: list[EvalSample] = [
    EvalSample(
        text="Contact John Doe at john.doe@example.com or 555-123-4567.",
        expected=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"],
    ),
    EvalSample(
        text="Patient SSN is 123-45-6789 and lives in Seattle.",
        expected=["US_SSN", "LOCATION"],
    ),
    EvalSample(
        text="Wire the payment to IBAN GB33BUKB20201555555555 before Friday.",
        expected=["IBAN_CODE"],
    ),
    EvalSample(
        text="Her card number 4111 1111 1111 1111 was declined.",
        expected=["CREDIT_CARD"],
    ),
    EvalSample(
        text="The server at 192.168.1.50 went down overnight.",
        expected=["IP_ADDRESS"],
    ),
    EvalSample(
        text="Dr. Maria Garcia emailed maria.garcia@hospital.org about the case.",
        expected=["PERSON", "EMAIL_ADDRESS"],
    ),
    EvalSample(
        text="Call our office line 020 7946 0958 during business hours.",
        expected=["PHONE_NUMBER"],
    ),
    EvalSample(
        text="The quarterly revenue grew by twelve percent last year.",
        expected=[],  # no PII — guards against over-detection (false positives)
    ),
]

# All entity types covered by the eval, for per-class metric reporting.
EVAL_ENTITY_TYPES: list[str] = sorted(
    {e for s in EVAL_SAMPLES for e in s.expected}
)
