from __future__ import annotations

import argparse
import time

import cv2
from insightface.app import FaceAnalysis

from app.service.head_turn_liveness_service import (
    HeadTurnLivenessService,
    TURN_LEFT,
    TURN_RIGHT,
)


def build_face_app() -> FaceAnalysis:
    """
    Debug-only InsightFace instance.

    Head-turn V1 only needs the detector's 5-point face keypoints.
    Production FaceService is NOT modified by this script.
    """
    app = FaceAnalysis(
        name="buffalo_l",
        root="/opt/insightface",
        providers=[
            "CPUExecutionProvider",
        ],
        allowed_modules=[
            "detection",
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
        (
            frame.shape[1]
            - text_size[0]
        )
        // 2,
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
    if len(
        timestamps
    ) < 2:
        return 0.0

    duration = (
        timestamps[-1]
        - timestamps[0]
    )

    if duration <= 0.0:
        return 0.0

    return (
        len(timestamps) - 1
    ) / duration


def ready_phase(
    camera,
    window_name: str,
    ready_seconds: float,
) -> bool:
    started_at = time.perf_counter()

    while (
        time.perf_counter()
        - started_at
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

        preview = frame.copy()

        draw_centered_text(
            preview,
            "LOOK STRAIGHT AT THE CAMERA",
            45,
        )

        draw_centered_text(
            preview,
            "KEEP YOUR HEAD CENTERED",
            80,
            scale=0.65,
        )

        draw_centered_text(
            preview,
            f"Starting in {remaining:.1f}s",
            115,
            scale=0.60,
        )

        cv2.imshow(
            window_name,
            preview,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

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
            duration_seconds
            - elapsed,
        )

        draw_centered_text(
            preview,
            primary_text,
            50,
            scale=0.88,
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

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == ord("q"):
            return None, None

    return frames, timestamps


def get_single_face_keypoints(
    app: FaceAnalysis,
    frame,
):
    faces = app.get(
        frame
    )

    if len(faces) != 1:
        return None, faces

    face = faces[0]

    keypoints = getattr(
        face,
        "kps",
        None,
    )

    if (
        keypoints is None
        or getattr(
            keypoints,
            "shape",
            None,
        )
        != (5, 2)
    ):
        return None, faces

    return keypoints.copy(), faces


def extract_keypoints_from_frames(
    app: FaceAnalysis,
    verifier: HeadTurnLivenessService,
    frames,
    phase_name: str,
):
    valid_keypoints = []

    no_face_frames = 0
    multiple_face_frames = 0
    invalid_keypoint_frames = 0

    for captured_index, frame in enumerate(
        frames
    ):
        keypoints, faces = (
            get_single_face_keypoints(
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

        if keypoints is None:
            invalid_keypoint_frames += 1
            continue

        try:
            measurement = (
                verifier.measure_frame(
                    keypoints=keypoints,
                    frame_index=len(
                        valid_keypoints
                    ),
                )
            )
        except ValueError as exc:
            invalid_keypoint_frames += 1

            print(
                f"{phase_name} "
                f"CAPTURED={captured_index:03d} "
                f"INVALID={exc}"
            )
            continue

        valid_keypoints.append(
            keypoints
        )

        print(
            f"{phase_name} "
            f"CAPTURED={captured_index:03d} "
            f"VALID={len(valid_keypoints)-1:03d} "
            f"yaw={measurement.yaw_proxy:+.4f} "
            f"eye_distance={measurement.interocular_distance:.2f}"
        )

    return (
        valid_keypoints,
        no_face_frames,
        multiple_face_frames,
        invalid_keypoint_frames,
    )


def normalize_direction(
    direction: str,
) -> tuple[str, str]:
    normalized = (
        direction
        .strip()
        .lower()
    )

    if normalized == "left":
        return (
            TURN_LEFT,
            "TURN YOUR HEAD LEFT",
        )

    if normalized == "right":
        return (
            TURN_RIGHT,
            "TURN YOUR HEAD RIGHT",
        )

    raise ValueError(
        "direction must be 'left' or 'right'."
    )


def run_head_turn_test(
    camera_index: int,
    direction: str,
    ready_seconds: float,
    baseline_seconds: float,
    challenge_seconds: float,
) -> int:
    (
        challenge_type,
        challenge_text,
    ) = normalize_direction(
        direction
    )

    app = build_face_app()

    verifier = HeadTurnLivenessService(
        baseline_frame_count=5,
        minimum_total_frames=10,
        turn_delta_threshold=0.12,
        minimum_turn_frames=3,
    )

    camera = configure_camera(
        camera_index
    )

    window_name = (
        "SVNHS Active Liveness - "
        f"{challenge_type} Debug"
    )

    print()
    print("===================================================")
    print("SVNHS ACTIVE LIVENESS - HEAD TURN DEBUG")
    print("===================================================")
    print(
        f"Challenge: {challenge_type}"
    )
    print("1. Look straight at the webcam during BASELINE.")
    print(
        "2. Do NOT turn before the challenge prompt appears."
    )
    print(
        f"3. When prompted, physically turn your head "
        f"{direction.upper()}."
    )
    print("4. A small but clear head turn is enough.")
    print("5. Keep your whole face visible.")
    print("6. Press Q at any time to quit.")
    print()

    try:
        if not ready_phase(
            camera=camera,
            window_name=window_name,
            ready_seconds=ready_seconds,
        ):
            return 1

        print(
            "Capturing BASELINE raw frames..."
        )
        print(
            "KEEP HEAD CENTERED."
        )

        (
            baseline_frames,
            baseline_timestamps,
        ) = capture_phase(
            camera=camera,
            window_name=window_name,
            duration_seconds=baseline_seconds,
            primary_text="KEEP HEAD CENTERED",
            secondary_text_prefix="Baseline",
        )

        if baseline_frames is None:
            return 1

        # SECURITY BOUNDARY:
        # Frames above belong only to the baseline.
        # The requested action starts only after this exact point.
        print()
        print("==============================================")
        print("CHALLENGE START BOUNDARY")
        print(
            f"{challenge_text} NOW."
        )
        print("==============================================")
        print()

        (
            challenge_frames,
            challenge_timestamps,
        ) = capture_phase(
            camera=camera,
            window_name=window_name,
            duration_seconds=challenge_seconds,
            primary_text=challenge_text,
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
    print(
        "Analyzing BASELINE frames..."
    )

    (
        baseline_keypoints,
        baseline_no_face,
        baseline_multiple_faces,
        baseline_invalid_keypoints,
    ) = extract_keypoints_from_frames(
        app=app,
        verifier=verifier,
        frames=baseline_frames,
        phase_name="BASELINE",
    )

    print()
    print(
        "Analyzing CHALLENGE frames..."
    )

    (
        challenge_keypoints,
        challenge_no_face,
        challenge_multiple_faces,
        challenge_invalid_keypoints,
    ) = extract_keypoints_from_frames(
        app=app,
        verifier=verifier,
        frames=challenge_frames,
        phase_name="CHALLENGE",
    )

    if (
        len(baseline_keypoints)
        < verifier.baseline_frame_count
    ):
        print()
        print("===================================================")
        print("HEAD TURN TEST RESULT")
        print("===================================================")
        print("status: CHALLENGE_UNCERTAIN")
        print("passed: False")
        print("reason: INSUFFICIENT_BASELINE_FRAMES")
        print("===================================================")
        print()
        return 2

    selected_baseline = (
        baseline_keypoints[
            -verifier.baseline_frame_count :
        ]
    )

    # Boundary-safe sequence:
    # only PRE-prompt keypoints establish the baseline,
    # and only POST-prompt keypoints can satisfy the turn.
    verification_sequence = (
        selected_baseline
        + challenge_keypoints
    )

    result = verifier.verify_turn(
        challenge_type=challenge_type,
        keypoint_sequence=verification_sequence,
    )

    print()
    print("===================================================")
    print("HEAD TURN TEST RESULT")
    print("===================================================")
    print(
        f"challenge_type: {result.challenge_type}"
    )
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
        f"baseline_yaw: {result.baseline_yaw}"
    )
    print(
        f"extreme_yaw: {result.extreme_yaw}"
    )
    print(
        "turn_delta_threshold: "
        f"{verifier.turn_delta_threshold}"
    )
    print(
        "maximum_requested_delta: "
        f"{result.maximum_requested_delta}"
    )
    print(
        "maximum_opposite_delta: "
        f"{result.maximum_opposite_delta}"
    )
    print(
        "minimum_turn_frames: "
        f"{verifier.minimum_turn_frames}"
    )
    print(
        "selected_baseline_frames: "
        f"{len(selected_baseline)}"
    )
    print(
        "valid_challenge_frames: "
        f"{len(challenge_keypoints)}"
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
        "baseline_invalid_keypoint_frames: "
        f"{baseline_invalid_keypoints}"
    )
    print(
        "challenge_invalid_keypoint_frames: "
        f"{challenge_invalid_keypoints}"
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
            "for SVNHS TURN_LEFT / TURN_RIGHT active liveness."
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
        "--direction",
        choices=[
            "left",
            "right",
        ],
        default="left",
        help=(
            "Physical head-turn challenge. Default: left"
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
            "Raw capture duration after turn prompt appears. "
            "Default: 2.0"
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    exit_code = run_head_turn_test(
        camera_index=args.camera,
        direction=args.direction,
        ready_seconds=args.ready_seconds,
        baseline_seconds=args.baseline_seconds,
        challenge_seconds=args.challenge_seconds,
    )

    raise SystemExit(
        exit_code
    )


if __name__ == "__main__":
    main()
