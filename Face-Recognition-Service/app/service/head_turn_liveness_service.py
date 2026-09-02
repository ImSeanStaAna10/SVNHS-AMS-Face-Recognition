from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Sequence

import numpy as np


TURN_LEFT: Final[str] = "TURN_LEFT"
TURN_RIGHT: Final[str] = "TURN_RIGHT"

CHALLENGE_PASSED: Final[str] = "CHALLENGE_PASSED"
CHALLENGE_FAILED: Final[str] = "CHALLENGE_FAILED"
CHALLENGE_UNCERTAIN: Final[str] = "CHALLENGE_UNCERTAIN"


@dataclass(frozen=True)
class HeadTurnFrameMeasurement:
    frame_index: int
    yaw_proxy: float
    interocular_distance: float


@dataclass(frozen=True)
class HeadTurnLivenessResult:
    challenge_type: str
    status: str
    passed: bool
    reason: str | None
    baseline_yaw: float | None
    extreme_yaw: float | None
    maximum_requested_delta: float | None
    maximum_opposite_delta: float | None
    measurements: tuple[HeadTurnFrameMeasurement, ...]


class HeadTurnLivenessService:
    """
    Prototype active-liveness verifier for TURN_LEFT / TURN_RIGHT.

    Input:
        A temporal sequence of InsightFace 5-point face keypoints
        with shape (5, 2):

            0 = first eye
            1 = second eye
            2 = nose
            3 = first mouth corner
            4 = second mouth corner

    The verifier calculates a lightweight yaw proxy:

        nose displacement from the eye midpoint
        projected onto the eye-to-eye axis
        ------------------------------------------------
                    interocular distance

    This makes the measurement:
    - translation independent
    - mostly scale independent
    - less sensitive to small in-plane head tilt

    Security / UX behavior:
    - Baseline must be reasonably centered and stable.
    - The requested movement must occur AFTER the challenge boundary.
      The caller is responsible for only appending challenge frames after
      the prompt has actually been issued.
    - The requested turn must persist for multiple consecutive analyzed
      frames.
    - A clear movement in the opposite direction is reported separately.

    Direction convention for normal, non-mirrored raw camera frames:
    - TURN_LEFT  -> positive yaw delta
    - TURN_RIGHT -> negative yaw delta

    A CSS-mirrored browser preview does not need to mirror the raw frame sent
    to this verifier. If raw pixels are mirrored before upload, the direction
    convention must be reversed by the caller or configuration.

    IMPORTANT:
    This is a prototype that still requires calibration using the actual
    camera, user distance, lighting, and real spoof tests before production.
    """

    EXPECTED_KEYPOINT_COUNT: Final[int] = 5

    def __init__(
        self,
        baseline_frame_count: int = 5,
        minimum_total_frames: int = 10,
        turn_delta_threshold: float = 0.12,
        minimum_turn_frames: int = 3,
        minimum_interocular_distance: float = 20.0,
        maximum_center_offset: float = 0.22,
        maximum_baseline_spread: float = 0.08,
    ) -> None:
        if baseline_frame_count < 3:
            raise ValueError(
                "baseline_frame_count must be at least 3."
            )

        if minimum_total_frames <= baseline_frame_count:
            raise ValueError(
                "minimum_total_frames must be greater than "
                "baseline_frame_count."
            )

        if turn_delta_threshold <= 0.0:
            raise ValueError(
                "turn_delta_threshold must be positive."
            )

        if minimum_turn_frames < 2:
            raise ValueError(
                "minimum_turn_frames must be at least 2."
            )

        if minimum_interocular_distance <= 0.0:
            raise ValueError(
                "minimum_interocular_distance must be positive."
            )

        if maximum_center_offset <= 0.0:
            raise ValueError(
                "maximum_center_offset must be positive."
            )

        if maximum_baseline_spread <= 0.0:
            raise ValueError(
                "maximum_baseline_spread must be positive."
            )

        self.baseline_frame_count = baseline_frame_count
        self.minimum_total_frames = minimum_total_frames
        self.turn_delta_threshold = turn_delta_threshold
        self.minimum_turn_frames = minimum_turn_frames
        self.minimum_interocular_distance = minimum_interocular_distance
        self.maximum_center_offset = maximum_center_offset
        self.maximum_baseline_spread = maximum_baseline_spread

    @staticmethod
    def _validate_keypoints(
        keypoints: np.ndarray,
    ) -> np.ndarray:
        array = np.asarray(
            keypoints,
            dtype=np.float32,
        )

        if array.shape != (5, 2):
            raise ValueError(
                "Expected InsightFace 5-point keypoints with shape (5, 2). "
                f"Received {array.shape}."
            )

        if not np.all(np.isfinite(array)):
            raise ValueError(
                "Face keypoints contain non-finite values."
            )

        return array

    @staticmethod
    def _median(
        values: Sequence[float],
    ) -> float:
        array = np.asarray(
            values,
            dtype=np.float32,
        )

        if array.size == 0:
            raise ValueError(
                "Cannot calculate median from an empty sequence."
            )

        value = float(
            np.median(array)
        )

        if not np.isfinite(value):
            raise ValueError(
                "Invalid median value."
            )

        return value

    def measure_frame(
        self,
        keypoints: np.ndarray,
        frame_index: int,
    ) -> HeadTurnFrameMeasurement:
        keypoints = self._validate_keypoints(
            keypoints
        )

        first_eye = keypoints[0]
        second_eye = keypoints[1]
        nose = keypoints[2]

        eye_vector = (
            second_eye - first_eye
        )

        interocular_distance = float(
            np.linalg.norm(
                eye_vector
            )
        )

        if (
            not np.isfinite(
                interocular_distance
            )
            or interocular_distance
            < self.minimum_interocular_distance
        ):
            raise ValueError(
                "Face is too small or eye keypoints are unreliable."
            )

        eye_axis = (
            eye_vector
            / interocular_distance
        )

        eye_midpoint = (
            first_eye + second_eye
        ) / 2.0

        nose_vector = (
            nose - eye_midpoint
        )

        horizontal_nose_offset = float(
            np.dot(
                nose_vector,
                eye_axis,
            )
        )

        yaw_proxy = (
            horizontal_nose_offset
            / interocular_distance
        )

        if not np.isfinite(
            yaw_proxy
        ):
            raise ValueError(
                "Invalid head-turn measurement."
            )

        return HeadTurnFrameMeasurement(
            frame_index=frame_index,
            yaw_proxy=float(
                yaw_proxy
            ),
            interocular_distance=interocular_distance,
        )

    def verify_turn(
        self,
        challenge_type: str,
        keypoint_sequence: Sequence[np.ndarray],
    ) -> HeadTurnLivenessResult:
        if challenge_type not in {
            TURN_LEFT,
            TURN_RIGHT,
        }:
            raise ValueError(
                "challenge_type must be TURN_LEFT or TURN_RIGHT."
            )

        if len(
            keypoint_sequence
        ) < self.minimum_total_frames:
            return HeadTurnLivenessResult(
                challenge_type=challenge_type,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="INSUFFICIENT_FRAMES",
                baseline_yaw=None,
                extreme_yaw=None,
                maximum_requested_delta=None,
                maximum_opposite_delta=None,
                measurements=(),
            )

        measurements: list[
            HeadTurnFrameMeasurement
        ] = []

        try:
            for frame_index, keypoints in enumerate(
                keypoint_sequence
            ):
                measurements.append(
                    self.measure_frame(
                        keypoints=keypoints,
                        frame_index=frame_index,
                    )
                )

        except ValueError:
            return HeadTurnLivenessResult(
                challenge_type=challenge_type,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="INVALID_FACE_KEYPOINTS",
                baseline_yaw=None,
                extreme_yaw=None,
                maximum_requested_delta=None,
                maximum_opposite_delta=None,
                measurements=tuple(
                    measurements
                ),
            )

        baseline_measurements = measurements[
            : self.baseline_frame_count
        ]

        baseline_values = [
            measurement.yaw_proxy
            for measurement in baseline_measurements
        ]

        baseline_yaw = self._median(
            baseline_values
        )

        baseline_spread = (
            max(
                baseline_values
            )
            - min(
                baseline_values
            )
        )

        if abs(
            baseline_yaw
        ) > self.maximum_center_offset:
            return HeadTurnLivenessResult(
                challenge_type=challenge_type,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="FACE_NOT_CENTERED_AT_START",
                baseline_yaw=baseline_yaw,
                extreme_yaw=None,
                maximum_requested_delta=None,
                maximum_opposite_delta=None,
                measurements=tuple(
                    measurements
                ),
            )

        if (
            baseline_spread
            > self.maximum_baseline_spread
        ):
            return HeadTurnLivenessResult(
                challenge_type=challenge_type,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="UNSTABLE_BASELINE",
                baseline_yaw=baseline_yaw,
                extreme_yaw=None,
                maximum_requested_delta=None,
                maximum_opposite_delta=None,
                measurements=tuple(
                    measurements
                ),
            )

        challenge_measurements = measurements[
            self.baseline_frame_count :
        ]

        deltas = [
            measurement.yaw_proxy
            - baseline_yaw
            for measurement in challenge_measurements
        ]

        if challenge_type == TURN_LEFT:
            requested_deltas = deltas
            opposite_deltas = [
                -delta
                for delta in deltas
            ]
        else:
            requested_deltas = [
                -delta
                for delta in deltas
            ]
            opposite_deltas = deltas

        maximum_requested_delta = max(
            requested_deltas
        )

        maximum_opposite_delta = max(
            opposite_deltas
        )

        consecutive_requested_frames = 0

        for requested_delta in requested_deltas:
            if (
                requested_delta
                >= self.turn_delta_threshold
            ):
                consecutive_requested_frames += 1

                if (
                    consecutive_requested_frames
                    >= self.minimum_turn_frames
                ):
                    if challenge_type == TURN_LEFT:
                        extreme_yaw = max(
                            measurement.yaw_proxy
                            for measurement in challenge_measurements
                        )
                    else:
                        extreme_yaw = min(
                            measurement.yaw_proxy
                            for measurement in challenge_measurements
                        )

                    return HeadTurnLivenessResult(
                        challenge_type=challenge_type,
                        status=CHALLENGE_PASSED,
                        passed=True,
                        reason=None,
                        baseline_yaw=baseline_yaw,
                        extreme_yaw=extreme_yaw,
                        maximum_requested_delta=maximum_requested_delta,
                        maximum_opposite_delta=maximum_opposite_delta,
                        measurements=tuple(
                            measurements
                        ),
                    )
            else:
                consecutive_requested_frames = 0

        if (
            maximum_opposite_delta
            >= self.turn_delta_threshold
        ):
            reason = "WRONG_DIRECTION"
        else:
            reason = "TURN_NOT_DETECTED"

        if challenge_type == TURN_LEFT:
            extreme_yaw = max(
                measurement.yaw_proxy
                for measurement in challenge_measurements
            )
        else:
            extreme_yaw = min(
                measurement.yaw_proxy
                for measurement in challenge_measurements
            )

        return HeadTurnLivenessResult(
            challenge_type=challenge_type,
            status=CHALLENGE_FAILED,
            passed=False,
            reason=reason,
            baseline_yaw=baseline_yaw,
            extreme_yaw=extreme_yaw,
            maximum_requested_delta=maximum_requested_delta,
            maximum_opposite_delta=maximum_opposite_delta,
            measurements=tuple(
                measurements
            ),
        )
