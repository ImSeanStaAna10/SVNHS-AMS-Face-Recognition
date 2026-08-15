from pydantic import BaseModel


class FaceEnrollmentResponse(BaseModel):
    success: bool
    student_id: str
    embedding: list[float]


class FaceRecognitionResponse(BaseModel):
    success: bool
    embedding: list[float]