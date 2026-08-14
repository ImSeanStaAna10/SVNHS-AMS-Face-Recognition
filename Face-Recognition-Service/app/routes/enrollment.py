from fastapi import APIRouter, File, UploadFile, Form

from app.schemas.face import FaceEnrollmentResponse
from app.service.face_service import FaceService


router = APIRouter(
    prefix="/enrollment",
    tags=["Face Enrollment"]
)

face_service = FaceService()


@router.post(
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

