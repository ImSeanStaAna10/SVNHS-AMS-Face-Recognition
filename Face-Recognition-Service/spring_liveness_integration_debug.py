from __future__ import annotations

import argparse
import getpass
import os
import sys
import time

import cv2
import requests


BASELINE_FRAME_COUNT = 5
CHALLENGE_FRAME_COUNT = 12

CAPTURE_INTERVAL_SECONDS = 0.10
JPEG_QUALITY = 90


# =============================================================
# CHALLENGE INSTRUCTION
# =============================================================


def challenge_instruction(
    challenge_type: str,
) -> str:

    if challenge_type == "BLINK":
        return "BLINK ONCE"

    if challenge_type == "TURN_LEFT":
        return "TURN YOUR HEAD LEFT"

    if challenge_type == "TURN_RIGHT":
        return "TURN YOUR HEAD RIGHT"

    return challenge_type


# =============================================================
# CAMERA
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


def draw_overlay(
    frame,
    title: str,
    subtitle: str | None = None,
):

    # ---------------------------------------------------------
    # Preview is mirrored only for natural selfie UX.
    #
    # Raw frames sent to Spring remain UNMIRRORED.
    # ---------------------------------------------------------

    preview = cv2.flip(
        frame,
        1,
    )

    cv2.rectangle(
        preview,
        (0, 0),
        (
            preview.shape[1],
            110,
        ),
        (0, 0, 0),
        -1,
    )

    cv2.putText(
        preview,
        title,
        (25, 42),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
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
            0.60,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    return preview


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

            if (
                cv2.waitKey(1)
                & 0xFF
            ) == 27:

                raise KeyboardInterrupt


# =============================================================
# BASELINE CAPTURE
#
# IMPORTANT:
#
# Baseline is captured BEFORE asking Spring to generate the
# random challenge.
#
# Therefore the challenge is not yet known while baseline
# frames are being collected.
# =============================================================


def capture_baseline_frames(
    camera: cv2.VideoCapture,
    window_name: str,
):

    frames = []

    print()
    print(
        "Capturing PRE-CHALLENGE baseline..."
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

        if (
            cv2.waitKey(1)
            & 0xFF
        ) == 27:

            raise KeyboardInterrupt

        # Raw / unmirrored frame.
        frames.append(
            frame.copy()
        )

        time.sleep(
            CAPTURE_INTERVAL_SECONDS
        )

    return frames


# =============================================================
# SPRING CREATE CHALLENGE
# =============================================================


def create_spring_challenge(
    spring_url: str,
    student_id: str,
    jwt_token: str,
):

    url = (
        spring_url.rstrip("/")
        + "/api/students/"
        + student_id
        + "/liveness-challenges/enrollment"
    )

    response = requests.post(
        url,
        headers={
            "Authorization":
                f"Bearer {jwt_token}",
        },
        timeout=30,
    )

    if not response.ok:

        print()
        print(
            "CREATE CHALLENGE FAILED"
        )
        print(
            f"HTTP {response.status_code}"
        )
        print(
            response.text
        )

        response.raise_for_status()

    result = response.json()

    if result.get(
        "assistedVerificationRequired"
    ):

        raise RuntimeError(
            "Student requires assisted verification."
        )

    challenge_id = result.get(
        "challengeId"
    )

    challenge_type = result.get(
        "challengeType"
    )

    if (
        not challenge_id
        or not challenge_type
    ):

        raise RuntimeError(
            "Spring returned an invalid liveness challenge."
        )

    print()
    print(
        "SPRING CHALLENGE CREATED"
    )
    print(
        f"challengeId: {challenge_id}"
    )
    print(
        f"challengeType: {challenge_type}"
    )
    print(
        f"status: {result.get('status')}"
    )
    print(
        f"expiresAt: {result.get('expiresAt')}"
    )

    return (
        challenge_id,
        challenge_type,
    )


# =============================================================
# CHALLENGE PROMPT
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
        f"SPRING CHALLENGE: {instruction}"
    )
    print(
        "============================================"
    )

    started_at = (
        time.perf_counter()
    )

    while (
        time.perf_counter()
        - started_at
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

        if (
            cv2.waitKey(1)
            & 0xFF
        ) == 27:

            raise KeyboardInterrupt


# =============================================================
# CHALLENGE FRAMES
# =============================================================


def capture_challenge_frames(
    camera: cv2.VideoCapture,
    window_name: str,
    challenge_type: str,
):

    frames = []

    instruction = (
        challenge_instruction(
            challenge_type
        )
    )

    print(
        "Capturing POST-CHALLENGE frames..."
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

        if (
            cv2.waitKey(1)
            & 0xFF
        ) == 27:

            raise KeyboardInterrupt

        # Raw / unmirrored frame.
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
# SPRING VERIFY
#
# IMPORTANT:
#
# challenge_type is NOT sent.
#
# Spring must load challengeType from its own database.
# =============================================================


def verify_through_spring(
    spring_url: str,
    student_id: str,
    challenge_id: str,
    jwt_token: str,
    baseline_frames: list,
    challenge_frames: list,
):

    url = (
        spring_url.rstrip("/")
        + "/api/students/"
        + student_id
        + "/liveness-challenges/"
        + challenge_id
        + "/verify"
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

    print()
    print(
        "POSTING FRAMES TO SPRING..."
    )
    print(
        f"POST {url}"
    )
    print()
    print(
        "IMPORTANT:"
    )
    print(
        "No challenge_type is being sent by this client."
    )
    print(
        "Spring must read it from the database."
    )

    response = requests.post(
        url,
        headers={
            "Authorization":
                f"Bearer {jwt_token}",
        },
        files=multipart_files,
        timeout=180,
    )

    return response


# =============================================================
# RESULT
# =============================================================


def print_result(
    response: requests.Response,
):

    print()
    print(
        "============================================"
    )
    print(
        "SPRING -> PYTHON INTEGRATION RESULT"
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

        print(
            f"{key}: {value}"
        )


# =============================================================
# JWT NORMALIZATION
#
# Accept either:
#
# eyJ...
#
# OR:
#
# Bearer eyJ...
#
# Internally we always keep only the raw token.
# =============================================================


def normalize_jwt_token(
    token: str,
) -> str:

    normalized = token.strip()

    if normalized.lower().startswith(
        "bearer "
    ):

        normalized = (
            normalized[7:]
            .strip()
        )

    if not normalized:

        raise RuntimeError(
            "Adviser JWT is required."
        )

    return normalized


# =============================================================
# JWT
#
# Avoid putting JWT into shell command history.
# =============================================================


def get_jwt_token() -> str:

    environment_token = (
        os.getenv(
            "SVNHS_ADVISER_JWT"
        )
    )

    if (
        environment_token
        and environment_token.strip()
    ):

        return normalize_jwt_token(
            environment_token
        )

    token = getpass.getpass(
        "Paste Adviser JWT "
        "(hidden input): "
    )

    return normalize_jwt_token(
        token
    )


# =============================================================
# REPLAY TEST
#
# Sends the EXACT SAME:
#
# - challengeId
# - baseline frames
# - challenge frames
#
# A challenge that already became PASSED or FAILED must not be
# accepted for verification again.
#
# EXPECTED:
#
# HTTP 409 CONFLICT
#
# IMPORTANT:
#
# Spring should reject the replay before Python liveness
# inference is allowed to consume the challenge again.
# =============================================================


def replay_verify_request(
    spring_url: str,
    student_id: str,
    challenge_id: str,
    jwt_token: str,
    baseline_frames: list,
    challenge_frames: list,
):

    print()
    print(
        "============================================"
    )
    print(
        "REPLAY ATTACK TEST"
    )
    print(
        "============================================"
    )
    print(
        "Re-sending the EXACT same:"
    )
    print(
        "- challengeId"
    )
    print(
        "- baseline frames"
    )
    print(
        "- challenge frames"
    )
    print()
    print(
        "Expected result: HTTP 409 CONFLICT"
    )

    replay_response = (
        verify_through_spring(

            spring_url=(
                spring_url
            ),

            student_id=(
                student_id
            ),

            challenge_id=(
                challenge_id
            ),

            jwt_token=(
                jwt_token
            ),

            baseline_frames=(
                baseline_frames
            ),

            challenge_frames=(
                challenge_frames
            ),
        )
    )

    print()
    print(
        "============================================"
    )
    print(
        "REPLAY RESULT"
    )
    print(
        "============================================"
    )

    print(
        f"HTTP Status: "
        f"{replay_response.status_code}"
    )

    try:

        result = (
            replay_response.json()
        )

    except ValueError:

        print(
            replay_response.text
        )

        return replay_response

    print()

    for key, value in (
        result.items()
    ):

        print(
            f"{key}: {value}"
        )

    return replay_response


# =============================================================
# MAIN
# =============================================================


def main():

    parser = argparse.ArgumentParser(
        description=(
            "SVNHS full Spring -> Python "
            "liveness integration tester"
        )
    )

    parser.add_argument(
        "--student-id",
        required=True,
    )

    parser.add_argument(
        "--spring-url",
        default=(
            "http://localhost:8080"
        ),
    )

    parser.add_argument(
        "--camera",
        type=int,
        default=0,
    )

    args = parser.parse_args()

    jwt_token = get_jwt_token()

    camera = cv2.VideoCapture(
        args.camera
    )

    if not camera.isOpened():

        print(
            "Unable to open webcam."
        )

        sys.exit(1)

    window_name = (
        "SVNHS Spring Liveness Integration"
    )

    cv2.namedWindow(
        window_name,
        cv2.WINDOW_NORMAL,
    )

    try:

        # -----------------------------------------------------
        # STEP 1
        # PRE-CHALLENGE baseline.
        # -----------------------------------------------------

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

        # -----------------------------------------------------
        # STEP 2
        # Spring NOW chooses random challenge.
        # -----------------------------------------------------

        (
            challenge_id,
            challenge_type,
        ) = create_spring_challenge(

            spring_url=(
                args.spring_url
            ),

            student_id=(
                args.student_id
            ),

            jwt_token=(
                jwt_token
            ),
        )

        # -----------------------------------------------------
        # STEP 3
        # Show Spring-selected challenge.
        # -----------------------------------------------------

        show_challenge_prompt(
            camera,
            window_name,
            challenge_type,
        )

        # -----------------------------------------------------
        # STEP 4
        # Capture post-prompt challenge frames.
        # -----------------------------------------------------

        challenge_frames = (
            capture_challenge_frames(
                camera,
                window_name,
                challenge_type,
            )
        )

        # -----------------------------------------------------
        # STEP 5
        # Send frames + challengeId to Spring.
        #
        # NO challengeType is sent.
        # -----------------------------------------------------

        response = (
            verify_through_spring(

                spring_url=(
                    args.spring_url
                ),

                student_id=(
                    args.student_id
                ),

                challenge_id=(
                    challenge_id
                ),

                jwt_token=(
                    jwt_token
                ),

                baseline_frames=(
                    baseline_frames
                ),

                challenge_frames=(
                    challenge_frames
                ),
            )
        )

        print_result(
            response
        )

        # -----------------------------------------------------
        # STEP 6
        # EXACT REQUEST REPLAY TEST
        #
        # We only perform the replay when the first verification
        # request completed normally.
        #
        # A valid liveness PASS or liveness FAIL both currently
        # return HTTP 200.
        #
        # At that point Spring has already finalized:
        #
        # VERIFYING -> PASSED
        #
        # OR:
        #
        # VERIFYING -> FAILED
        #
        # Therefore an exact replay must be rejected.
        # -----------------------------------------------------

        if response.status_code == 200:

            replay_response = (
                replay_verify_request(

                    spring_url=(
                        args.spring_url
                    ),

                    student_id=(
                        args.student_id
                    ),

                    challenge_id=(
                        challenge_id
                    ),

                    jwt_token=(
                        jwt_token
                    ),

                    baseline_frames=(
                        baseline_frames
                    ),

                    challenge_frames=(
                        challenge_frames
                    ),
                )
            )

            # -------------------------------------------------
            # SIMPLE AUTOMATED SECURITY VERDICT
            # -------------------------------------------------

            print()
            print(
                "============================================"
            )
            print(
                "REPLAY SECURITY VERDICT"
            )
            print(
                "============================================"
            )

            if (
                replay_response
                .status_code
                == 409
            ):

                print(
                    "PASS"
                )
                print(
                    "The consumed challenge "
                    "was rejected on replay."
                )

            else:

                print(
                    "FAIL"
                )
                print(
                    "Expected HTTP 409, "
                    f"received "
                    f"{replay_response.status_code}."
                )

        else:

            print()
            print(
                "Replay test skipped because "
                "the first verification request "
                "did not complete with HTTP 200."
            )

    except KeyboardInterrupt:

        print()
        print(
            "Test cancelled."
        )

    except Exception as error:

        print()
        print(
            "TEST FAILED:"
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