import modal

app = modal.App("svn-face-service")

image = modal.Image.from_dockerfile("./Dockerfile")


@app.function(
    image=image,
    memory=2048,
    timeout=300,
)
@modal.asgi_app()
def web():
    from app.main import app as fastapi_app

    return fastapi_app