
from pydantic import BaseModel


class FaceEnrollmentResponse(BaseModel):
    success: bool
    student_id: str
    embedding: list[float]

