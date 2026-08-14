import cv2
import numpy as np
from fastapi import UploadFile
from insightface.app import FaceAnalysis


class FaceService:

    def __init__(self):

        self.face_app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"]
        )

        self.face_app.prepare(
            ctx_id=0,
            det_size=(640, 640)
        )

    async def enroll(
        self,
        student_id: str,
        image: UploadFile
    ):

        # Read uploaded image
        image_bytes = await image.read()

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:
            raise ValueError("Invalid image file")

        # Detect faces
        faces = self.face_app.get(frame)

        if len(faces) == 0:
            raise ValueError("No face detected")

        if len(faces) > 1:
            raise ValueError(
                "Multiple faces detected. "
                "Please provide an image with one face."
            )

        # Get the only detected face
        face = faces[0]

        # Generate face embedding
        embedding = face.embedding

        # Validate embedding dimensions
        if embedding is None or len(embedding) != 512:
            raise ValueError(
                "Invalid face embedding. Expected 512 dimensions."
            )

        # Convert NumPy array to regular Python list
        embedding = embedding.tolist()

        return {
            "success": True,
            "student_id": student_id,
            "embedding": embedding
        }