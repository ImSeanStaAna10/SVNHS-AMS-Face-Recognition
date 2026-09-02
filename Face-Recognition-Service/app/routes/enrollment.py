from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from app.schemas.face import (
    FaceEnrollmentResponse,
    FaceRecognitionResponse,
)

from app.schemas.liveness import (
    LivenessVerificationResponse,
)

from app.service.face_service import (
    FaceService,
)


# =============================================================
# FACE SERVICE
#
# Loaded once when this module is imported.
#
# This keeps InsightFace and the MiniFAS anti-spoof models
# initialized and reusable across requests instead of reloading
# them on every request.
# =============================================================

face_service = FaceService()


# =============================================================
# ROUTERS
# =============================================================

enrollment_router = APIRouter(
    prefix="/enrollment",
    tags=["Face Enrollment"],
)

recognition_router = APIRouter(
    prefix="/recognize",
    tags=["Face Recognition"],
)

liveness_router = APIRouter(
    prefix="/liveness",
    tags=["Liveness Verification"],
)


# =============================================================
# FACE ENROLLMENT
#
# IMPORTANT:
#
# Enrollment keeps its existing passive-liveness behavior.
#
# We intentionally DO NOT enable:
#
# strict_recognition_liveness=True
#
# here.
#
# Therefore the stricter attendance-recognition rule does not
# affect the existing enrollment workflow.
# =============================================================

@enrollment_router.post(
    "",
    response_model=FaceEnrollmentResponse,
)
async def enroll_face(
    student_id: str = Form(...),
    image: UploadFile = File(...),
):

    try:

        result = await face_service.enroll(
            student_id,
            image,
        )

        return FaceEnrollmentResponse(
            success=result["success"],
            student_id=result["student_id"],
            embedding=result["embedding"],
        )

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


# =============================================================
# FACE RECOGNITION
#
# Used by the current Spring Boot attendance face-recognition
# flow.
#
# Existing API contract remains unchanged:
#
# REQUEST:
#
# multipart/form-data
# image = captured face image
#
# RESPONSE:
#
# {
#     "success": true,
#     "embedding": [...]
# }
#
# SECURITY UPDATE:
#
# Recognition now enables:
#
# strict_recognition_liveness=True
#
# This means /recognize must pass:
#
# 1. Existing MiniFAS V1SE + V2 passive liveness
# 2. Existing ensemble LIVE threshold
# 3. NEW individual-model live-score floor
#
# Only after all checks pass is the 512-D embedding returned.
#
# Enrollment is NOT affected.
# =============================================================

@recognition_router.post(
    "",
    response_model=FaceRecognitionResponse,
)
async def recognize_face(
    image: UploadFile = File(...),
):

    try:

        embedding = (
            await face_service
            .extract_embedding(
                image,
                strict_recognition_liveness=True,
            )
        )

        return FaceRecognitionResponse(
            success=True,
            embedding=embedding,
        )

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


# =============================================================
# PASSIVE MULTI-FRAME LIVENESS VERIFICATION
#
# Multipart fields:
#
# challenge_type
#
# baseline_images
# baseline_images
# baseline_images
# ...
#
# challenge_images
# challenge_images
# challenge_images
# ...
#
# IMPORTANT:
#
# The current public endpoint uses:
#
# verify_liveness_sequence()
#
# That method treats baseline_images + challenge_images as one
# ordered passive frame sequence.
#
# It currently performs:
#
# - exactly one valid face per frame
# - MiniFAS passive anti-spoofing on representative frames
# - same-person continuity across the sequence
# - 512-D embedding only after successful verification
#
# It does NOT call verify_active_liveness_sequence(), so this
# endpoint does not currently require BLINK / TURN_LEFT /
# TURN_RIGHT behavior.
#
# challenge_type remains part of the existing Spring/Python API
# contract and is returned as transaction metadata.
# =============================================================

@liveness_router.post(
    "/verify",
    response_model=LivenessVerificationResponse,
)
async def verify_liveness(
    challenge_type: str = Form(...),
    baseline_images: list[UploadFile] = File(...),
    challenge_images: list[UploadFile] = File(...),
):

    try:

        result = (
            await face_service
            .verify_liveness_sequence(
                challenge_type=challenge_type,
                baseline_images=baseline_images,
                challenge_images=challenge_images,
            )
        )

        return LivenessVerificationResponse(
            **result
        )

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error