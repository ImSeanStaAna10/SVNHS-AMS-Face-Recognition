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


face_service = FaceService()


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
# EXISTING FACE ENROLLMENT
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
# EXISTING FACE RECOGNITION
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
                image
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
# NEW ACTIVE LIVENESS VERIFICATION
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
# Spring will eventually send challenge_type from its own
# server-authoritative LivenessChallenge database record.
# =============================================================

@liveness_router.post(
    "/verify",
    response_model=(
        LivenessVerificationResponse
    ),
)
async def verify_liveness(
    challenge_type: str = Form(...),

    baseline_images: list[
        UploadFile
    ] = File(...),

    challenge_images: list[
        UploadFile
    ] = File(...),
):

    try:

        result = (
            await face_service
            .verify_liveness_sequence(
                challenge_type=(
                    challenge_type
                ),
                baseline_images=(
                    baseline_images
                ),
                challenge_images=(
                    challenge_images
                ),
            )
        )

        return (
            LivenessVerificationResponse(
                **result
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error