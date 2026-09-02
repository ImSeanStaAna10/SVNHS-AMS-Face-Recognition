from __future__ import annotations

import argparse
import time

import cv2
from insightface.app import FaceAnalysis

from app.service.active_liveness_service import (
    ActiveLivenessService,
)


def build_landmark_app() -> FaceAnalysis:
    """
    Debug-only InsightFace instance.

    Loads only:
    - face detection
    - 106-point 2D landmarks

    Production FaceService is not modified.
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


def draw_centered_text(
    frame,
    text: str,
    y: int,
    scale: float = 0.8,
    thickness: int = 2,
) -> None:
    text_size, _ = cv2.getTextSize(
        text,
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        thickness,
    )

    x = max(
        10,
        (frame.shape[1] - text_size[0]) // 2,
    )

    cv2.putText(
        frame,
        text,
        (x, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        (255, 255, 255),
        thickness + 2,
        cv2.LINE_AA,
    )

    cv2.putText(
        frame,
        text,
        (x, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        (0, 0, 0),
        thickness,
        cv2.LINE_AA,
    )


def get_single_face_landmarks(
    app: FaceAnalysis,
    frame,
):
    faces = app.get(frame)

    if len(faces) != 1:
        return None, faces

    face = faces[0]

    landmarks = getattr(
        face,
        "landmark_2d_106",
        None,
    )

    if landmarks is None or len(landmarks) != 106:
        return None, faces

    return landmarks.copy(), faces


def configure_camera(
    camera_index: int,
):
    camera = cv2.VideoCapture(
        camera_index
    )

    if not camera.isOpened():
        raise RuntimeError(
            f"Could not open camera index {camera_index}."
        )

    camera.set(
        cv2.CAP_PROP_FRAME_WIDTH,
        640,
    )
    camera.set(
        cv2.CAP_PROP_FRAME_HEIGHT,
        480,
    )
    camera.set(
        cv2.CAP_PROP_FPS,
        30,
    )

    return camera


def calculate_capture_fps(
    timestamps,
) -> float:
    if len(timestamps) < 2:
        return 0.0

    duration = (
        timestamps[-1]
        - timestamps[0]
    )

    if duration <= 0.0:
        return 0.0

    return (
        (len(timestamps) - 1)
        / duration
    )


def ready_phase(
    camera,
    window_name: str,
    ready_seconds: float,
) -> bool:
    started_at = time.perf_counter()

    while (
        time.perf_counter() - started_at
        < ready_seconds
    ):
        ok, frame = camera.read()

        if not ok or frame is None:
            continue

        remaining = max(
            0.0,
            ready_seconds
            - (
                time.perf_counter()
                - started_at
            ),
        )

        draw_centered_text(
            frame,
            "LOOK AT THE CAMERA",
            45,
        )

        draw_centered_text(
            frame,
            "KEEP YOUR EYES OPEN",
            80,
            scale=0.65,
        )

        draw_centered_text(
            frame,
            f"Starting in {remaining:.1f}s",
            115,
            scale=0.60,
        )

        cv2.imshow(
            window_name,
            frame,
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            return False

    return True


def capture_phase(
    camera,
    window_name: str,
    duration_seconds: float,
    primary_text: str,
    secondary_text_prefix: str,
):
    frames = []
    timestamps = []

    started_at = time.perf_counter()

    while True:
        elapsed = (
            time.perf_counter()
            - started_at
        )

        if elapsed >= duration_seconds:
            break

        ok, frame = camera.read()

        if not ok or frame is None:
            continue

        frames.append(
            frame.copy()
        )

        timestamps.append(
            time.perf_counter()
        )

        preview = frame.copy()

        remaining = max(
            0.0,
            duration_seconds - elapsed,
        )

        draw_centered_text(
            preview,
            primary_text,
            50,
            scale=0.95,
        )

        draw_centered_text(
            preview,
            (
                f"{secondary_text_prefix} "
                f"{remaining:.1f}s"
            ),
            90,
            scale=0.60,
        )

        cv2.imshow(
            window_name,
            preview,
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            return None, None

    return frames, timestamps


def extract_landmarks_from_frames(
    app: FaceAnalysis,
    verifier: ActiveLivenessService,
    frames,
    phase_name: str,
):
    valid_landmarks = []

    no_face_frames = 0
    multiple_face_frames = 0
    invalid_landmark_frames = 0

    for captured_index, frame in enumerate(
        frames
    ):
        landmarks, faces = (
            get_single_face_landmarks(
                app,
                frame,
            )
        )

        if len(faces) == 0:
            no_face_frames += 1
            continue

        if len(faces) > 1:
            multiple_face_frames += 1
            continue

        if landmarks is None:
            invalid_landmark_frames += 1
            continue

        measurement = (
            verifier.measure_frame(
                landmarks=landmarks,
                frame_index=len(
                    valid_landmarks
                ),
            )
        )

        valid_landmarks.append(
            landmarks
        )

        print(
            f"{phase_name} "
            f"CAPTURED={captured_index:03d} "
            f"VALID={len(valid_landmarks)-1:03d} "
            f"left={measurement.left_eye_ratio:.4f} "
            f"right={measurement.right_eye_ratio:.4f} "
            f"combined={measurement.combined_eye_ratio:.4f}"
        )

    return (
        valid_landmarks,
        no_face_frames,
        multiple_face_frames,
        invalid_landmark_frames,
    )


def run_blink_test(
    camera_index: int,
    ready_seconds: float,
    baseline_seconds: float,
    challenge_seconds: float,
) -> int:
    app = build_landmark_app()

    verifier = ActiveLivenessService(
        baseline_frame_count=3,
        minimum_total_frames=7,
    )

    camera = configure_camera(
        camera_index
    )

    window_name = (
        "SVNHS Active Liveness - BLINK Boundary-Safe Debug"
    )

    print()
    print("===================================================")
    print("SVNHS ACTIVE LIVENESS - BLINK BOUNDARY-SAFE DEBUG")
    print("===================================================")
    print("1. Look directly at the webcam.")
    print("2. Keep your eyes open during BASELINE.")
    print("3. Only blink AFTER the BLINK ONCE prompt appears.")
    print("4. Use one normal quick blink.")
    print("5. Press Q at any time to quit.")
    print()

    try:
        if not ready_phase(
            camera=camera,
            window_name=window_name,
            ready_seconds=ready_seconds,
        ):
            return 1

        print("Capturing BASELINE raw frames...")
        print("KEEP EYES OPEN.")

        (
            baseline_frames,
            baseline_timestamps,
        ) = capture_phase(
            camera=camera,
            window_name=window_name,
            duration_seconds=baseline_seconds,
            primary_text="KEEP EYES OPEN",
            secondary_text_prefix="Baseline",
        )

        if baseline_frames is None:
            return 1

        # SECURITY BOUNDARY:
        # The challenge does not exist before this exact point.
        print()
        print("==============================================")
        print("CHALLENGE START BOUNDARY")
        print("BLINK ONCE NOW.")
        print("==============================================")
        print()

        (
            challenge_frames,
            challenge_timestamps,
        ) = capture_phase(
            camera=camera,
            window_name=window_name,
            duration_seconds=challenge_seconds,
            primary_text="BLINK ONCE",
            secondary_text_prefix="Challenge",
        )

        if challenge_frames is None:
            return 1

    finally:
        camera.release()
        cv2.destroyAllWindows()

    baseline_capture_fps = (
        calculate_capture_fps(
            baseline_timestamps
        )
    )

    challenge_capture_fps = (
        calculate_capture_fps(
            challenge_timestamps
        )
    )

    print()
    print("Capture complete.")
    print(
        "baseline_raw_frames: "
        f"{len(baseline_frames)}"
    )
    print(
        "baseline_capture_fps: "
        f"{baseline_capture_fps:.2f}"
    )
    print(
        "challenge_raw_frames: "
        f"{len(challenge_frames)}"
    )
    print(
        "challenge_capture_fps: "
        f"{challenge_capture_fps:.2f}"
    )

    print()
    print("Analyzing BASELINE frames...")
    (
        baseline_landmarks,
        baseline_no_face,
        baseline_multiple_faces,
        baseline_invalid_landmarks,
    ) = extract_landmarks_from_frames(
        app=app,
        verifier=verifier,
        frames=baseline_frames,
        phase_name="BASELINE",
    )

    print()
    print("Analyzing CHALLENGE frames...")
    (
        challenge_landmarks,
        challenge_no_face,
        challenge_multiple_faces,
        challenge_invalid_landmarks,
    ) = extract_landmarks_from_frames(
        app=app,
        verifier=verifier,
        frames=challenge_frames,
        phase_name="CHALLENGE",
    )

    if (
        len(baseline_landmarks)
        < verifier.baseline_frame_count
    ):
        print()
        print("===================================================")
        print("BLINK TEST RESULT")
        print("===================================================")
        print("status: CHALLENGE_UNCERTAIN")
        print("passed: False")
        print("reason: INSUFFICIENT_BASELINE_FRAMES")
        print("===================================================")
        print()
        return 2

    # IMPORTANT:
    # Only baseline landmarks captured BEFORE the challenge boundary
    # are allowed to establish the open-eye baseline.
    #
    # We use the final valid baseline frames because they are temporally
    # closest to the challenge start.
    selected_baseline = (
        baseline_landmarks[
            -verifier.baseline_frame_count :
        ]
    )

    # IMPORTANT SECURITY RULE:
    # Only frames captured AFTER "BLINK ONCE" are appended after baseline.
    # A blink that happened before the challenge prompt cannot satisfy
    # the challenge.
    verification_sequence = (
        selected_baseline
        + challenge_landmarks
    )

    result = verifier.verify_blink(
        verification_sequence
    )

    print()
    print("===================================================")
    print("BLINK TEST RESULT")
    print("===================================================")
    print(
        f"status: {result.status}"
    )
    print(
        f"passed: {result.passed}"
    )
    print(
        f"reason: {result.reason}"
    )
    print(
        "baseline_eye_ratio: "
        f"{result.baseline_eye_ratio}"
    )
    print(
        "minimum_eye_ratio: "
        f"{result.minimum_eye_ratio}"
    )
    print(
        "selected_baseline_frames: "
        f"{len(selected_baseline)}"
    )
    print(
        "valid_challenge_frames: "
        f"{len(challenge_landmarks)}"
    )
    print(
        "baseline_raw_frames: "
        f"{len(baseline_frames)}"
    )
    print(
        "challenge_raw_frames: "
        f"{len(challenge_frames)}"
    )
    print(
        "baseline_capture_fps: "
        f"{baseline_capture_fps:.2f}"
    )
    print(
        "challenge_capture_fps: "
        f"{challenge_capture_fps:.2f}"
    )
    print(
        "baseline_no_face_frames: "
        f"{baseline_no_face}"
    )
    print(
        "challenge_no_face_frames: "
        f"{challenge_no_face}"
    )
    print(
        "baseline_multiple_face_frames: "
        f"{baseline_multiple_faces}"
    )
    print(
        "challenge_multiple_face_frames: "
        f"{challenge_multiple_faces}"
    )
    print(
        "baseline_invalid_landmark_frames: "
        f"{baseline_invalid_landmarks}"
    )
    print(
        "challenge_invalid_landmark_frames: "
        f"{challenge_invalid_landmarks}"
    )
    print("===================================================")
    print()

    return (
        0
        if result.passed
        else 2
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Boundary-safe capture-first webcam test "
            "for SVNHS BLINK active liveness."
        )
    )

    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help=(
            "OpenCV camera index. Default: 0"
        ),
    )

    parser.add_argument(
        "--ready-seconds",
        type=float,
        default=2.0,
        help=(
            "Preparation time. Default: 2.0"
        ),
    )

    parser.add_argument(
        "--baseline-seconds",
        type=float,
        default=0.7,
        help=(
            "Raw capture duration before challenge starts. "
            "Default: 0.7"
        ),
    )

    parser.add_argument(
        "--challenge-seconds",
        type=float,
        default=2.0,
        help=(
            "Raw capture duration after BLINK ONCE appears. "
            "Default: 2.0"
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    exit_code = run_blink_test(
        camera_index=args.camera,
        ready_seconds=args.ready_seconds,
        baseline_seconds=args.baseline_seconds,
        challenge_seconds=args.challenge_seconds,
    )

    raise SystemExit(
        exit_code
    )


if __name__ == "__main__":
    main()
