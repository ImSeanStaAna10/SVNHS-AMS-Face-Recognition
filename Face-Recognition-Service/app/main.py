from fastapi import FastAPI

from app.routes.enrollment import (
    enrollment_router,
    recognition_router
)


app = FastAPI(
    title="Attendance Face Recognition Service",
    version="1.0.0"
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "face-recognition"
    }


app.include_router(enrollment_router)
app.include_router(recognition_router)