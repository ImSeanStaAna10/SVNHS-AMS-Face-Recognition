from pydantic import BaseModel


class LivenessVerificationResponse(
    BaseModel
):

    success: bool

    passed: bool

    challenge_type: str

    status: str

    reason: str | None = None

    embedding: list[float] | None = None

    passive_live_score: float | None = None

    max_continuity_distance: float | None = None