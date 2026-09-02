from __future__ import annotations

import argparse
from pathlib import Path

import cv2
from insightface.app import FaceAnalysis


def build_landmark_app() -> FaceAnalysis:
    """
    Loads only the InsightFace modules needed for this diagnostic:
    - face detection
    - 106-point 2D facial landmarks

    This script does NOT modify the production FaceService.
    """
    app = FaceAnalysis(
        name="buffalo_l",
        root="/opt/insightface",
        providers=["CPUExecutionProvider"],
        allowed_modules=[
            "detection",
            "landmark_2d_106",
        ],
    )

    app.prepare(
        ctx_id=0,
        det_size=(640, 640),
    )

    return app


def annotate_landmarks(
    image_path: Path,
    output_path: Path,
) -> None:
    frame = cv2.imread(
        str(image_path),
        cv2.IMREAD_COLOR,
    )

    if frame is None:
        raise ValueError(
            f"Could not read image: {image_path}"
        )

    app = build_landmark_app()

    faces = app.get(frame)

    if len(faces) == 0:
        raise ValueError(
            "No face detected in the image."
        )

    if len(faces) > 1:
        raise ValueError(
            "Multiple faces detected. "
            "Please use an image containing exactly one face."
        )

    face = faces[0]

    landmarks = getattr(
        face,
        "landmark_2d_106",
        None,
    )

    if landmarks is None:
        raise RuntimeError(
            "InsightFace did not return landmark_2d_106."
        )

    if len(landmarks) != 106:
        raise RuntimeError(
            "Expected 106 facial landmarks, "
            f"but received {len(landmarks)}."
        )

    annotated = frame.copy()

    # Draw detected face bounding box.
    bbox = face.bbox.astype(int)
    x1, y1, x2, y2 = bbox.tolist()

    cv2.rectangle(
        annotated,
        (x1, y1),
        (x2, y2),
        (0, 255, 0),
        2,
    )

    # Scale the marker/text size relative to the input image.
    image_height, image_width = annotated.shape[:2]
    reference_size = max(
        image_width,
        image_height,
    )

    circle_radius = max(
        2,
        int(reference_size * 0.003),
    )

    font_scale = max(
        0.30,
        reference_size / 2500.0,
    )

    text_thickness = max(
        1,
        int(reference_size / 1200),
    )

    # Draw every landmark with its exact array index.
    for index, point in enumerate(landmarks):
        x = int(round(float(point[0])))
        y = int(round(float(point[1])))

        cv2.circle(
            annotated,
            (x, y),
            circle_radius,
            (0, 0, 255),
            -1,
        )

        cv2.putText(
            annotated,
            str(index),
            (
                x + circle_radius + 1,
                y - circle_radius - 1,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (255, 0, 0),
            text_thickness,
            cv2.LINE_AA,
        )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    saved = cv2.imwrite(
        str(output_path),
        annotated,
    )

    if not saved:
        raise RuntimeError(
            f"Failed to save annotated image: {output_path}"
        )

    print()
    print("106 LANDMARK DIAGNOSTIC COMPLETE")
    print(f"Input:  {image_path.resolve()}")
    print(f"Output: {output_path.resolve()}")
    print(f"Landmarks detected: {len(landmarks)}")
    print()
    print(
        "Open the output image and inspect the point numbers "
        "around both eyes."
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Draw and number InsightFace buffalo_l "
            "106-point facial landmarks."
        )
    )

    parser.add_argument(
        "image",
        type=Path,
        help="Path to an image containing exactly one face.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help=(
            "Optional output path. "
            "Default: debug/landmarks/<image>_landmarks_106.jpg"
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    image_path = args.image

    if not image_path.is_file():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    if args.output is not None:
        output_path = args.output
    else:
        project_root = Path(__file__).resolve().parent

        output_path = (
            project_root
            / "debug"
            / "landmarks"
            / f"{image_path.stem}_landmarks_106.jpg"
        )

    annotate_landmarks(
        image_path=image_path,
        output_path=output_path,
    )


if __name__ == "__main__":
    main()
