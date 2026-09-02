from __future__ import annotations

import argparse
import sys
import time
from typing import Final

import cv2
import requests


BLINK: Final[str] = "BLINK"
TURN_LEFT: Final[str] = "TURN_LEFT"
TURN_RIGHT: Final[str] = "TURN_RIGHT"

SUPPORTED_CHALLENGES = {
    BLINK,
    TURN_LEFT,
    TURN_RIGHT,
}

BASELINE_FRAME_COUNT = 5
CHALLENGE_FRAME_COUNT = 12

CAPTURE_INTERVAL_SECONDS = 0.10

JPEG_QUALITY = 90


# =============================================================
# TEXT / DISPLAY HELPERS
# =============================================================


def challenge_instruction(
    challenge_type: str,
) -> str:

    if challenge_type == BLINK:
        return "BLINK ONCE"

    if challenge_type == TURN_LEFT:
        return "TURN YOUR HEAD LEFT"

    if challenge_type == TURN_RIGHT:
        return "TURN YOUR HEAD RIGHT"

    return challenge_type


def draw_overlay(
    frame,
    title: str,
    subtitle: str | None = None,
):
    """
    Preview may be mirrored for natural selfie UX.

    IMPORTANT:
    Only this DISPLAY COPY is mirrored.

    The raw camera frame that gets uploaded to Python remains
    completely unmirrored.
    """

    preview = cv2.flip(
        frame,
        1,
    )

    cv2.rectangle(
        preview,
        (0, 0),
        (
            preview.shape[1],
            105,
        ),
        (0, 0, 0),
        -1,
    )

    cv2.putText(
        preview,
        title,
        (25, 42),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    if subtitle:

        cv2.putText(
            preview,
            subtitle,
            (25, 82),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    return preview


# =============================================================
# CAMERA FRAME
# =============================================================


def read_camera_frame(
    camera: cv2.VideoCapture,
):

    success, frame = camera.read()

    if (
        not success
        or frame is None
        or frame.size == 0
    ):
        raise RuntimeError(
            "Unable to read webcam frame."
        )

    return frame


# =============================================================
# COUNTDOWN
# =============================================================


def show_countdown(
    camera: cv2.VideoCapture,
    window_name: str,
):

    for number in (
        3,
        2,
        1,
    ):

        started_at = (
            time.perf_counter()
        )

        while (
            time.perf_counter()
            - started_at
            < 1.0
        ):

            frame = read_camera_frame(
                camera
            )

            preview = draw_overlay(
                frame,
                "GET READY",
                str(number),
            )

            cv2.imshow(
                window_name,
                preview,
            )

            key = (
                cv2.waitKey(1)
                & 0xFF
            )

            if key == 27:
                raise KeyboardInterrupt


# =============================================================
# BASELINE CAPTURE
#
# User should remain neutral / front-facing.
#
# These frames are captured BEFORE the challenge prompt.
# =============================================================


def capture_baseline_frames(
    camera: cv2.VideoCapture,
    window_name: str,
) -> list:

    frames = []

    print()
    print(
        "Capturing baseline..."
    )
    print(
        "Look straight at the camera."
    )

    while (
        len(frames)
        < BASELINE_FRAME_COUNT
    ):

        frame = read_camera_frame(
            camera
        )

        preview = draw_overlay(
            frame,
            "LOOK AT THE CAMERA",
            (
                f"Baseline "
                f"{len(frames) + 1}/"
                f"{BASELINE_FRAME_COUNT}"
            ),
        )

        cv2.imshow(
            window_name,
            preview,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == 27:
            raise KeyboardInterrupt

        frames.append(
            frame.copy()
        )

        time.sleep(
            CAPTURE_INTERVAL_SECONDS
        )

    return frames


# =============================================================
# CHALLENGE BOUNDARY
#
# VERY IMPORTANT:
#
# This happens AFTER baseline capture.
#
# Therefore challenge frames cannot accidentally be treated as
# pre-prompt baseline frames.
# =============================================================


def show_challenge_prompt(
    camera: cv2.VideoCapture,
    window_name: str,
    challenge_type: str,
):

    instruction = (
        challenge_instruction(
            challenge_type
        )
    )

    print()
    print(
        "============================================"
    )
    print(
        f"CHALLENGE: {instruction}"
    )
    print(
        "============================================"
    )
    print()

    prompt_started_at = (
        time.perf_counter()
    )

    # Give the person a brief moment to SEE the instruction
    # before actual challenge-frame collection begins.
    while (
        time.perf_counter()
        - prompt_started_at
        < 0.45
    ):

        frame = read_camera_frame(
            camera
        )

        preview = draw_overlay(
            frame,
            instruction,
            "Perform the action now",
        )

        cv2.imshow(
            window_name,
            preview,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == 27:
            raise KeyboardInterrupt


# =============================================================
# CHALLENGE CAPTURE
#
# Every frame here is POST-PROMPT.
# =============================================================


def capture_challenge_frames(
    camera: cv2.VideoCapture,
    window_name: str,
    challenge_type: str,
) -> list:

    frames = []

    instruction = (
        challenge_instruction(
            challenge_type
        )
    )

    print(
        "Capturing challenge frames..."
    )

    while (
        len(frames)
        < CHALLENGE_FRAME_COUNT
    ):

        frame = read_camera_frame(
            camera
        )

        preview = draw_overlay(
            frame,
            instruction,
            (
                f"Challenge "
                f"{len(frames) + 1}/"
                f"{CHALLENGE_FRAME_COUNT}"
            ),
        )

        cv2.imshow(
            window_name,
            preview,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == 27:
            raise KeyboardInterrupt

        # IMPORTANT:
        #
        # Save raw/unmirrored frame.
        frames.append(
            frame.copy()
        )

        time.sleep(
            CAPTURE_INTERVAL_SECONDS
        )

    return frames


# =============================================================
# JPEG ENCODING
# =============================================================


def encode_frame(
    frame,
    filename: str,
):

    success, encoded = cv2.imencode(
        ".jpg",
        frame,
        [
            cv2.IMWRITE_JPEG_QUALITY,
            JPEG_QUALITY,
        ],
    )

    if not success:
        raise RuntimeError(
            f"Unable to encode {filename}."
        )

    return (
        filename,
        encoded.tobytes(),
        "image/jpeg",
    )


# =============================================================
# API CALL
# =============================================================


def send_liveness_request(
    base_url: str,
    challenge_type: str,
    baseline_frames: list,
    challenge_frames: list,
):

    url = (
        base_url.rstrip("/")
        + "/liveness/verify"
    )

    multipart_files = []

    for index, frame in enumerate(
        baseline_frames
    ):

        multipart_files.append(
            (
                "baseline_images",
                encode_frame(
                    frame,
                    (
                        f"baseline_"
                        f"{index:02d}.jpg"
                    ),
                ),
            )
        )

    for index, frame in enumerate(
        challenge_frames
    ):

        multipart_files.append(
            (
                "challenge_images",
                encode_frame(
                    frame,
                    (
                        f"challenge_"
                        f"{index:02d}.jpg"
                    ),
                ),
            )
        )

    data = {
        "challenge_type":
            challenge_type,
    }

    print()
    print(
        f"POST {url}"
    )
    print(
        f"Challenge: {challenge_type}"
    )
    print(
        f"Baseline frames: "
        f"{len(baseline_frames)}"
    )
    print(
        f"Challenge frames: "
        f"{len(challenge_frames)}"
    )
    print()
    print(
        "Waiting for liveness service..."
    )

    response = requests.post(
        url,
        data=data,
        files=multipart_files,
        timeout=120,
    )

    return response


# =============================================================
# HEALTH CHECK
# =============================================================


def check_health(
    base_url: str,
):

    url = (
        base_url.rstrip("/")
        + "/health"
    )

    print(
        f"Checking {url} ..."
    )

    response = requests.get(
        url,
        timeout=15,
    )

    response.raise_for_status()

    print(
        "Face service health check passed."
    )


# =============================================================
# RESULT OUTPUT
# =============================================================


def print_response(
    response: requests.Response,
):

    print()
    print(
        "============================================"
    )
    print(
        "LIVENESS API RESULT"
    )
    print(
        "============================================"
    )

    print(
        f"HTTP Status: "
        f"{response.status_code}"
    )

    try:

        result = response.json()

    except ValueError:

        print(
            response.text
        )

        return

    print()

    for key, value in (
        result.items()
    ):

        if key == "embedding":

            if value is None:

                print(
                    "embedding: null"
                )

            else:

                print(
                    "embedding: "
                    f"[{len(value)} dimensions]"
                )

        else:

            print(
                f"{key}: {value}"
            )


# =============================================================
# MAIN
# =============================================================


def main():

    parser = argparse.ArgumentParser(
        description=(
            "SVNHS active-liveness API "
            "webcam tester"
        )
    )

    parser.add_argument(
        "--challenge",
        required=True,
        choices=[
            BLINK,
            TURN_LEFT,
            TURN_RIGHT,
        ],
        help=(
            "Liveness challenge to test"
        ),
    )

    parser.add_argument(
        "--base-url",
        default=(
            "http://127.0.0.1:8000"
        ),
        help=(
            "Face service base URL"
        ),
    )

    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help=(
            "OpenCV camera index"
        ),
    )

    args = parser.parse_args()

    challenge_type = (
        args.challenge
        .strip()
        .upper()
    )

    if (
        challenge_type
        not in SUPPORTED_CHALLENGES
    ):

        print(
            "Unsupported challenge."
        )

        sys.exit(1)

    try:

        check_health(
            args.base_url
        )

    except Exception as error:

        print()
        print(
            "Health check FAILED:"
        )
        print(
            str(error)
        )
        print()
        print(
            "Make sure FastAPI is running."
        )

        sys.exit(1)

    camera = cv2.VideoCapture(
        args.camera
    )

    if not camera.isOpened():

        print(
            "Unable to open webcam."
        )

        sys.exit(1)

    window_name = (
        "SVNHS Liveness API Debug"
    )

    cv2.namedWindow(
        window_name,
        cv2.WINDOW_NORMAL,
    )

    try:

        show_countdown(
            camera,
            window_name,
        )

        baseline_frames = (
            capture_baseline_frames(
                camera,
                window_name,
            )
        )

        # =====================================================
        # CHALLENGE BOUNDARY
        # =====================================================

        show_challenge_prompt(
            camera,
            window_name,
            challenge_type,
        )

        challenge_frames = (
            capture_challenge_frames(
                camera,
                window_name,
                challenge_type,
            )
        )

        response = (
            send_liveness_request(
                base_url=args.base_url,
                challenge_type=(
                    challenge_type
                ),
                baseline_frames=(
                    baseline_frames
                ),
                challenge_frames=(
                    challenge_frames
                ),
            )
        )

        print_response(
            response
        )

    except KeyboardInterrupt:

        print()
        print(
            "Test cancelled."
        )

    except requests.RequestException as error:

        print()
        print(
            "API request failed:"
        )
        print(
            str(error)
        )

    except Exception as error:

        print()
        print(
            "Test failed:"
        )
        print(
            str(error)
        )

        raise

    finally:

        camera.release()

        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()