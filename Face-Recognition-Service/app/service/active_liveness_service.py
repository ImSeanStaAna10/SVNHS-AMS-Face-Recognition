from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Sequence

import numpy as np


BLINK: Final[str] = "BLINK"

CHALLENGE_PASSED: Final[str] = "CHALLENGE_PASSED"
CHALLENGE_FAILED: Final[str] = "CHALLENGE_FAILED"
CHALLENGE_UNCERTAIN: Final[str] = "CHALLENGE_UNCERTAIN"


@dataclass(frozen=True)
class BlinkFrameMeasurement:
    frame_index: int
    left_eye_ratio: float
    right_eye_ratio: float
    combined_eye_ratio: float


@dataclass(frozen=True)
class ActiveLivenessResult:
    challenge_type: str
    status: str
    passed: bool
    reason: str | None
    baseline_eye_ratio: float | None
    minimum_eye_ratio: float | None
    measurements: tuple[BlinkFrameMeasurement, ...]


class ActiveLivenessService:
    """
    Active-liveness logic for a BLINK challenge.

    This service deliberately contains no camera, HTTP, FastAPI, or database
    code. It receives a temporal sequence of InsightFace 106-point landmark
    arrays and verifies whether a genuine bilateral:

        OPEN -> CLOSED -> OPEN

    eye pattern occurred.

    Security properties in this version:
    - The blink is verified temporally, not from a single image.
    - Thresholds are relative to the person's own open-eye baseline.
    - BOTH eyes must independently close enough.
    - BOTH eyes must independently reopen enough.
    - The closed state must persist for multiple consecutive analyzed frames.
    - Unreliable baseline/landmark geometry returns CHALLENGE_UNCERTAIN
      instead of being treated as a valid blink.

    The numeric defaults are prototype values and must still be calibrated
    against the actual school camera, lighting, distance, and frame rate.
    """

    # InsightFace buffalo_l 106-point eye landmarks used by the current
    # prototype.
    LEFT_EYE_INDICES: Final[tuple[int, ...]] = (
        35,
        36,
        37,
        39,
        41,
        42,
    )

    RIGHT_EYE_INDICES: Final[tuple[int, ...]] = (
        89,
        90,
        91,
        93,
        95,
        96,
    )

    EXPECTED_LANDMARK_COUNT: Final[int] = 106

    def __init__(
        self,
        baseline_frame_count: int = 3,
        minimum_total_frames: int = 7,
        closed_ratio_factor: float = 0.60,
        reopened_ratio_factor: float = 0.80,
        minimum_closed_frames: int = 2,
        minimum_baseline_ratio: float = 0.08,
        maximum_eye_asymmetry: float = 0.12,
        maximum_baseline_relative_spread: float = 0.25,
    ) -> None:
        if baseline_frame_count < 2:
            raise ValueError(
                "baseline_frame_count must be at least 2."
            )

        if minimum_total_frames <= baseline_frame_count:
            raise ValueError(
                "minimum_total_frames must be greater than "
                "baseline_frame_count."
            )

        if not 0.0 < closed_ratio_factor < reopened_ratio_factor < 1.0:
            raise ValueError(
                "Expected 0 < closed_ratio_factor < "
                "reopened_ratio_factor < 1."
            )

        if minimum_closed_frames < 2:
            raise ValueError(
                "minimum_closed_frames must be at least 2."
            )

        if minimum_baseline_ratio <= 0.0:
            raise ValueError(
                "minimum_baseline_ratio must be positive."
            )

        if maximum_eye_asymmetry <= 0.0:
            raise ValueError(
                "maximum_eye_asymmetry must be positive."
            )

        if not 0.0 < maximum_baseline_relative_spread < 1.0:
            raise ValueError(
                "maximum_baseline_relative_spread must be "
                "between 0 and 1."
            )

        self.baseline_frame_count = baseline_frame_count
        self.minimum_total_frames = minimum_total_frames
        self.closed_ratio_factor = closed_ratio_factor
        self.reopened_ratio_factor = reopened_ratio_factor
        self.minimum_closed_frames = minimum_closed_frames
        self.minimum_baseline_ratio = minimum_baseline_ratio
        self.maximum_eye_asymmetry = maximum_eye_asymmetry
        self.maximum_baseline_relative_spread = (
            maximum_baseline_relative_spread
        )

    @staticmethod
    def _validate_landmarks(
        landmarks: np.ndarray,
    ) -> np.ndarray:
        array = np.asarray(
            landmarks,
            dtype=np.float32,
        )

        if array.shape != (106, 2):
            raise ValueError(
                "Expected InsightFace landmarks with shape (106, 2). "
                f"Received {array.shape}."
            )

        if not np.all(np.isfinite(array)):
            raise ValueError(
                "Facial landmarks contain non-finite values."
            )

        return array

    @staticmethod
    def _eye_opening_ratio(
        landmarks: np.ndarray,
        eye_indices: tuple[int, ...],
    ) -> float:
        points = landmarks[
            list(eye_indices)
        ]

        min_x = float(
            np.min(points[:, 0])
        )
        max_x = float(
            np.max(points[:, 0])
        )
        min_y = float(
            np.min(points[:, 1])
        )
        max_y = float(
            np.max(points[:, 1])
        )

        eye_width = max_x - min_x
        eye_height = max_y - min_y

        if eye_width <= 1e-6:
            raise ValueError(
                "Invalid eye landmark geometry."
            )

        ratio = eye_height / eye_width

        if not np.isfinite(ratio) or ratio <= 0.0:
            raise ValueError(
                "Invalid eye opening ratio."
            )

        return float(ratio)

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

    @staticmethod
    def _relative_spread(
        values: Sequence[float],
        center: float,
    ) -> float:
        if center <= 1e-6:
            raise ValueError(
                "Invalid baseline center."
            )

        array = np.asarray(
            values,
            dtype=np.float32,
        )

        spread = float(
            np.max(array) - np.min(array)
        )

        return spread / center

    def measure_frame(
        self,
        landmarks: np.ndarray,
        frame_index: int,
    ) -> BlinkFrameMeasurement:
        landmarks = self._validate_landmarks(
            landmarks
        )

        left_ratio = self._eye_opening_ratio(
            landmarks,
            self.LEFT_EYE_INDICES,
        )

        right_ratio = self._eye_opening_ratio(
            landmarks,
            self.RIGHT_EYE_INDICES,
        )

        combined_ratio = (
            left_ratio + right_ratio
        ) / 2.0

        return BlinkFrameMeasurement(
            frame_index=frame_index,
            left_eye_ratio=left_ratio,
            right_eye_ratio=right_ratio,
            combined_eye_ratio=combined_ratio,
        )

    def verify_blink(
        self,
        landmark_sequence: Sequence[np.ndarray],
    ) -> ActiveLivenessResult:
        if len(landmark_sequence) < self.minimum_total_frames:
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="INSUFFICIENT_FRAMES",
                baseline_eye_ratio=None,
                minimum_eye_ratio=None,
                measurements=(),
            )

        measurements: list[BlinkFrameMeasurement] = []

        try:
            for frame_index, landmarks in enumerate(
                landmark_sequence
            ):
                measurement = self.measure_frame(
                    landmarks=landmarks,
                    frame_index=frame_index,
                )

                measurements.append(
                    measurement
                )

        except ValueError:
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="INVALID_FACE_LANDMARKS",
                baseline_eye_ratio=None,
                minimum_eye_ratio=None,
                measurements=tuple(
                    measurements
                ),
            )

        baseline_measurements = measurements[
            : self.baseline_frame_count
        ]

        baseline_left_values = [
            measurement.left_eye_ratio
            for measurement in baseline_measurements
        ]

        baseline_right_values = [
            measurement.right_eye_ratio
            for measurement in baseline_measurements
        ]

        baseline_combined_values = [
            measurement.combined_eye_ratio
            for measurement in baseline_measurements
        ]

        try:
            baseline_left = self._median(
                baseline_left_values
            )

            baseline_right = self._median(
                baseline_right_values
            )

            baseline_eye_ratio = self._median(
                baseline_combined_values
            )

            left_relative_spread = self._relative_spread(
                baseline_left_values,
                baseline_left,
            )

            right_relative_spread = self._relative_spread(
                baseline_right_values,
                baseline_right,
            )

        except ValueError:
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="INVALID_BASELINE",
                baseline_eye_ratio=None,
                minimum_eye_ratio=min(
                    measurement.combined_eye_ratio
                    for measurement in measurements
                ),
                measurements=tuple(
                    measurements
                ),
            )

        if (
            baseline_left < self.minimum_baseline_ratio
            or baseline_right < self.minimum_baseline_ratio
            or baseline_eye_ratio < self.minimum_baseline_ratio
        ):
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="EYES_NOT_CLEARLY_OPEN_AT_START",
                baseline_eye_ratio=baseline_eye_ratio,
                minimum_eye_ratio=min(
                    measurement.combined_eye_ratio
                    for measurement in measurements
                ),
                measurements=tuple(
                    measurements
                ),
            )

        if abs(
            baseline_left - baseline_right
        ) > self.maximum_eye_asymmetry:
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="UNSTABLE_EYE_LANDMARKS",
                baseline_eye_ratio=baseline_eye_ratio,
                minimum_eye_ratio=min(
                    measurement.combined_eye_ratio
                    for measurement in measurements
                ),
                measurements=tuple(
                    measurements
                ),
            )

        if (
            left_relative_spread
            > self.maximum_baseline_relative_spread
            or right_relative_spread
            > self.maximum_baseline_relative_spread
        ):
            return ActiveLivenessResult(
                challenge_type=BLINK,
                status=CHALLENGE_UNCERTAIN,
                passed=False,
                reason="UNSTABLE_BASELINE",
                baseline_eye_ratio=baseline_eye_ratio,
                minimum_eye_ratio=min(
                    measurement.combined_eye_ratio
                    for measurement in measurements
                ),
                measurements=tuple(
                    measurements
                ),
            )

        # Each eye gets its own independent threshold.
        #
        # A frame only counts as CLOSED if BOTH eyes cross their respective
        # closed thresholds at the same time.
        left_closed_threshold = (
            baseline_left
            * self.closed_ratio_factor
        )

        right_closed_threshold = (
            baseline_right
            * self.closed_ratio_factor
        )

        left_reopened_threshold = (
            baseline_left
            * self.reopened_ratio_factor
        )

        right_reopened_threshold = (
            baseline_right
            * self.reopened_ratio_factor
        )

        challenge_measurements = measurements[
            self.baseline_frame_count :
        ]

        state = "WAITING_FOR_CLOSE"
        consecutive_closed_frames = 0

        for measurement in challenge_measurements:
            both_eyes_closed = (
                measurement.left_eye_ratio
                <= left_closed_threshold
                and measurement.right_eye_ratio
                <= right_closed_threshold
            )

            both_eyes_reopened = (
                measurement.left_eye_ratio
                >= left_reopened_threshold
                and measurement.right_eye_ratio
                >= right_reopened_threshold
            )

            if state == "WAITING_FOR_CLOSE":
                if both_eyes_closed:
                    consecutive_closed_frames += 1

                    if (
                        consecutive_closed_frames
                        >= self.minimum_closed_frames
                    ):
                        state = "WAITING_FOR_REOPEN"

                else:
                    # Closed frames must be consecutive.
                    consecutive_closed_frames = 0

            elif state == "WAITING_FOR_REOPEN":
                if both_eyes_reopened:
                    return ActiveLivenessResult(
                        challenge_type=BLINK,
                        status=CHALLENGE_PASSED,
                        passed=True,
                        reason=None,
                        baseline_eye_ratio=baseline_eye_ratio,
                        minimum_eye_ratio=min(
                            item.combined_eye_ratio
                            for item in measurements
                        ),
                        measurements=tuple(
                            measurements
                        ),
                    )

        if state == "WAITING_FOR_REOPEN":
            failure_reason = "EYES_DID_NOT_REOPEN"
        else:
            failure_reason = "BLINK_NOT_DETECTED"

        return ActiveLivenessResult(
            challenge_type=BLINK,
            status=CHALLENGE_FAILED,
            passed=False,
            reason=failure_reason,
            baseline_eye_ratio=baseline_eye_ratio,
            minimum_eye_ratio=min(
                measurement.combined_eye_ratio
                for measurement in measurements
            ),
            measurements=tuple(
                measurements
            ),
        )
