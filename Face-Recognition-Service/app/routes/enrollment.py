from fastapi import APIRouter, File, UploadFile, Form

from app.schemas.face import (
    FaceEnrollmentResponse,
    FaceRecognitionResponse
)

from app.service.face_service import FaceService


face_service = FaceService()


enrollment_router = APIRouter(
    prefix="/enrollment",
    tags=["Face Enrollment"]
)

recognition_router = APIRouter(
    prefix="/recognize",
    tags=["Face Recognition"]
)


@enrollment_router.post(
    "",
    response_model=FaceEnrollmentResponse
)
async def enroll_face(
    student_id: str = Form(...),
    image: UploadFile = File(...)
):

    result = await face_service.enroll(
        student_id,
        image
    )

    return FaceEnrollmentResponse(
        success=result["success"],
        student_id=result["student_id"],
        embedding=result["embedding"]
    )


@recognition_router.post(
    "",
    response_model=FaceRecognitionResponse
)
async def recognize_face(
    image: UploadFile = File(...)
):

    embedding = await face_service.extract_embedding(
        image
    )

    return FaceRecognitionResponse(
        success=True,
        embedding=embedding
    )