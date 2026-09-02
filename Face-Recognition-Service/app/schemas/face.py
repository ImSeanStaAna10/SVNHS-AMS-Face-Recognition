from pydantic import BaseModel


# ============================================================
# EXISTING FACE ENROLLMENT RESPONSE
# DO NOT REMOVE / CHANGE
# ============================================================

class FaceEnrollmentResponse(BaseModel):
    success: bool
    student_id: str
    embedding: list[float]


# ============================================================
# EXISTING FACE RECOGNITION RESPONSE
# DO NOT REMOVE / CHANGE
# ============================================================

class FaceRecognitionResponse(BaseModel):
    success: bool
    embedding: list[float]


# ============================================================
# NEW ACTIVE LIVENESS VERIFICATION RESPONSE
#
# Used only by the new liveness verification endpoint.
# Existing /enrollment and /recognize responses remain unchanged.
# ============================================================

class LivenessVerificationResponse(BaseModel):
    success: bool

    # LIVE
    # SPOOF_DETECTED
    # LIVENESS_UNCERTAIN
    outcome: str

    # BLINK
    # TURN_LEFT
    # TURN_RIGHT
    challenge_type: str

    # Whether the requested active challenge was successfully
    # verified from the submitted frame sequence.
    challenge_passed: bool

    # Human/backend-readable reason when verification does not pass.
    reason: str | None = None

    # Only returned when the entire liveness verification succeeds.
    #
    # This will eventually allow Spring Boot to continue directly
    # into its existing Top-2 face matching logic without performing
    # another image/embedding request.
    embedding: list[float] | None = None