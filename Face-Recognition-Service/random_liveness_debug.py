from __future__ import annotations

import argparse
import time

import cv2
from insightface.app import FaceAnalysis

from app.service.active_liveness_service import (
    ActiveLivenessService,
    BLINK,
)
from app.service.head_turn_liveness_service import (
    HeadTurnLivenessService,
    TURN_LEFT,
    TURN_RIGHT,
)
from app.service.liveness_challenge_policy import (
    ASSISTED_VERIFICATION_REQUIRED,
    SUPPORTED_CHALLENGES,
    select_random_challenge,
)


def build_face_app() -> FaceAnalysis:
    """
    Debug-only InsightFace instance.

    One call to app.get(frame) gives us:
    - detector 5-point keypoints for TURN_LEFT / TURN_RIGHT
    - 106-point landmarks for BLINK

    Existing production FaceService is NOT modified.
    """
    app = FaceAnalysis(
        name="buffalo_l",
        root="/opt/insightface",
        providers=[
            "CPUExecutionProvider",
        ],
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
    if len(timestamps) < 2:
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

        preview = frame.copy()

        remaining = max(
            0.0,
            ready_seconds
            - (
                time.perf_counter()
                - started_at
            ),
        )

        draw_centered_text(
            preview,
            "LOOK STRAIGHT AT THE CAMERA",
            45,
        )

        draw_centered_text(
            preview,
            "KEEP YOUR FACE CENTERED",
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

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            return None, None

    return frames, timestamps


def extract_frame_features(
    app: FaceAnalysis,
    frames,
    phase_name: str,
):
    """
    Analyze each captured frame exactly once.

    Returns two aligned temporal feature lists:
    - 106-point landmarks for blink
    - 5-point detector keypoints for head turns

    A frame is accepted only when exactly one face exists and BOTH feature
    types are available. This keeps the debug sequence consistent no matter
    which random challenge was selected.
    """
    landmarks_106 = []
    keypoints_5 = []

    no_face_frames = 0
    multiple_face_frames = 0
    invalid_feature_frames = 0

    for captured_index, frame in enumerate(
        frames
    ):
        faces = app.get(
            frame
        )

        if len(faces) == 0:
            no_face_frames += 1
            continue

        if len(faces) > 1:
            multiple_face_frames += 1
            continue

        face = faces[0]

        landmarks = getattr(
            face,
            "landmark_2d_106",
            None,
        )

        keypoints = getattr(
            face,
            "kps",
            None,
        )

        if (
            landmarks is None
            or getattr(
                landmarks,
                "shape",
                None,
            )
            != (106, 2)
            or keypoints is None
            or getattr(
                keypoints,
                "shape",
                None,
            )
            != (5, 2)
        ):
            invalid_feature_frames += 1
            continue

        landmarks_106.append(
            landmarks.copy()
        )

        keypoints_5.append(
            keypoints.copy()
        )

        print(
            f"{phase_name} "
            f"CAPTURED={captured_index:03d} "
            f"VALID={len(landmarks_106)-1:03d}"
        )

    return (
        landmarks_106,
        keypoints_5,
        no_face_frames,
        multiple_face_frames,
        invalid_feature_frames,
    )


def verify_selected_challenge(
    challenge_type: str,
    baseline_landmarks,
    challenge_landmarks,
    baseline_keypoints,
    challenge_keypoints,
):
    if challenge_type == BLINK:
        verifier = ActiveLivenessService(
            baseline_frame_count=3,
            minimum_total_frames=7,
            minimum_closed_frames=2,
        )

        if (
            len(baseline_landmarks)
            < verifier.baseline_frame_count
        ):
            return {
                "challenge_type": challenge_type,
                "status": "CHALLENGE_UNCERTAIN",
                "passed": False,
                "reason": "INSUFFICIENT_BASELINE_FRAMES",
                "detail": None,
            }

        selected_baseline = (
            baseline_landmarks[
                -verifier.baseline_frame_count :
            ]
        )

        result = verifier.verify_blink(
            selected_baseline
            + challenge_landmarks
        )

        return {
            "challenge_type": result.challenge_type,
            "status": result.status,
            "passed": result.passed,
            "reason": result.reason,
            "detail": (
                "baseline_eye_ratio="
                f"{result.baseline_eye_ratio}, "
                "minimum_eye_ratio="
                f"{result.minimum_eye_ratio}"
            ),
        }

    if challenge_type in {
        TURN_LEFT,
        TURN_RIGHT,
    }:
        verifier = HeadTurnLivenessService(
            baseline_frame_count=5,
            minimum_total_frames=10,
            turn_delta_threshold=0.12,
            minimum_turn_frames=3,
        )

        if (
            len(baseline_keypoints)
            < verifier.baseline_frame_count
        ):
            return {
                "challenge_type": challenge_type,
                "status": "CHALLENGE_UNCERTAIN",
                "passed": False,
                "reason": "INSUFFICIENT_BASELINE_FRAMES",
                "detail": None,
            }

        selected_baseline = (
            baseline_keypoints[
                -verifier.baseline_frame_count :
            ]
        )

        result = verifier.verify_turn(
            challenge_type=challenge_type,
            keypoint_sequence=(
                selected_baseline
                + challenge_keypoints
            ),
        )

        return {
            "challenge_type": result.challenge_type,
            "status": result.status,
            "passed": result.passed,
            "reason": result.reason,
            "detail": (
                "baseline_yaw="
                f"{result.baseline_yaw}, "
                "maximum_requested_delta="
                f"{result.maximum_requested_delta}, "
                "maximum_opposite_delta="
                f"{result.maximum_opposite_delta}"
            ),
        }

    raise ValueError(
        f"Unsupported challenge type: {challenge_type}"
    )


def run_random_challenge_test(
    camera_index: int,
    allowed_challenges: list[str],
    ready_seconds: float,
    baseline_seconds: float,
    challenge_seconds: float,
) -> int:
    selection = select_random_challenge(
        allowed_challenges
    )

    print()
    print("===================================================")
    print("SVNHS RANDOM ACTIVE LIVENESS DEBUG")
    print("===================================================")
    print(
        "Allowed challenges: "
        + (
            ", ".join(
                selection.allowed_challenges
            )
            if selection.allowed_challenges
            else "(none)"
        )
    )

    if (
        selection.status
        == ASSISTED_VERIFICATION_REQUIRED
    ):
        print(
            "Selected challenge: NONE"
        )
        print(
            "Result: ASSISTED_VERIFICATION_REQUIRED"
        )
        print(
            "No biometric movement challenge is required for this "
            "accessibility profile."
        )
        print(
            "Production flow: request authorized adviser assistance."
        )
        print("===================================================")
        print()
        return 0

    app = build_face_app()

    camera = configure_camera(
        camera_index
    )

    window_name = (
        "SVNHS Random Active Liveness Debug"
    )

    try:
        if not ready_phase(
            camera=camera,
            window_name=window_name,
            ready_seconds=ready_seconds,
        ):
            return 1

        print()
        print(
            "Capturing BASELINE raw frames..."
        )
        print(
            "KEEP FACE CENTERED."
        )

        (
            baseline_frames,
            baseline_timestamps,
        ) = capture_phase(
            camera=camera,
            window_name=window_name,
            duration_seconds=baseline_seconds,
            primary_text="KEEP FACE CENTERED",
            secondary_text_prefix="Baseline",
        )

        if baseline_frames is None:
            return 1

        # SECURITY BOUNDARY:
        # Challenge is selected by the trusted process and revealed only
        # after baseline capture is complete.
        #
        # In production, Spring Boot will own this authoritative challenge.
        print()
        print("==============================================")
        print("RANDOM CHALLENGE ISSUED")
        print(
            selection.prompt
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
            primary_text=selection.prompt,
            secondary_text_prefix="Challenge",
        )

        if challenge_frames is None:
            return 1

    finally:
        camera.release()
        cv2.destroyAllWindows()

    print()
    print("Capture complete.")
    print(
        "selected_challenge: "
        f"{selection.challenge_type}"
    )
    print(
        "baseline_raw_frames: "
        f"{len(baseline_frames)}"
    )
    print(
        "baseline_capture_fps: "
        f"{calculate_capture_fps(baseline_timestamps):.2f}"
    )
    print(
        "challenge_raw_frames: "
        f"{len(challenge_frames)}"
    )
    print(
        "challenge_capture_fps: "
        f"{calculate_capture_fps(challenge_timestamps):.2f}"
    )

    print()
    print(
        "Analyzing BASELINE frames..."
    )

    (
        baseline_landmarks,
        baseline_keypoints,
        baseline_no_face,
        baseline_multiple_faces,
        baseline_invalid_features,
    ) = extract_frame_features(
        app=app,
        frames=baseline_frames,
        phase_name="BASELINE",
    )

    print()
    print(
        "Analyzing CHALLENGE frames..."
    )

    (
        challenge_landmarks,
        challenge_keypoints,
        challenge_no_face,
        challenge_multiple_faces,
        challenge_invalid_features,
    ) = extract_frame_features(
        app=app,
        frames=challenge_frames,
        phase_name="CHALLENGE",
    )

    result = verify_selected_challenge(
        challenge_type=selection.challenge_type,
        baseline_landmarks=baseline_landmarks,
        challenge_landmarks=challenge_landmarks,
        baseline_keypoints=baseline_keypoints,
        challenge_keypoints=challenge_keypoints,
    )

    print()
    print("===================================================")
    print("RANDOM LIVENESS TEST RESULT")
    print("===================================================")
    print(
        f"challenge_type: {result['challenge_type']}"
    )
    print(
        f"status: {result['status']}"
    )
    print(
        f"passed: {result['passed']}"
    )
    print(
        f"reason: {result['reason']}"
    )
    print(
        f"detail: {result['detail']}"
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
        "baseline_invalid_feature_frames: "
        f"{baseline_invalid_features}"
    )
    print(
        "challenge_invalid_feature_frames: "
        f"{challenge_invalid_features}"
    )
    print("===================================================")
    print()

    return (
        0
        if result["passed"]
        else 2
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prototype random active-liveness flow for "
            "BLINK / TURN_LEFT / TURN_RIGHT with "
            "accessibility challenge filtering."
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
        "--allowed",
        nargs="*",
        default=list(
            SUPPORTED_CHALLENGES
        ),
        help=(
            "Allowed challenges for this test. "
            "Default: BLINK TURN_LEFT TURN_RIGHT. "
            "Examples: "
            "--allowed TURN_LEFT TURN_RIGHT ; "
            "--allowed BLINK ; "
            "or pass --allowed with no values to simulate "
            "assisted-verification-only."
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
            "Baseline raw capture duration. Default: 0.7"
        ),
    )

    parser.add_argument(
        "--challenge-seconds",
        type=float,
        default=2.0,
        help=(
            "Maximum challenge capture duration. Default: 2.0"
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    exit_code = run_random_challenge_test(
        camera_index=args.camera,
        allowed_challenges=args.allowed,
        ready_seconds=args.ready_seconds,
        baseline_seconds=args.baseline_seconds,
        challenge_seconds=args.challenge_seconds,
    )

    raise SystemExit(
        exit_code
    )


if __name__ == "__main__":
    main()
