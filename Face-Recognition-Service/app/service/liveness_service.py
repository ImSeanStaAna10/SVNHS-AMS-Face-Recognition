from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import cv2
import numpy as np
import onnxruntime as ort


LIVE: Final[str] = "LIVE"
SPOOF_DETECTED: Final[str] = "SPOOF_DETECTED"
LIVENESS_UNCERTAIN: Final[str] = "LIVENESS_UNCERTAIN"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MiniFASPrediction:
    real_probability: float
    predicted_class: int
    probabilities: tuple[float, ...]
    model_input_crop: np.ndarray


@dataclass(frozen=True)
class LivenessResult:
    outcome: str
    live_score: float
    v1se_live_score: float
    v2_live_score: float
    processing_ms: float

    # Extra diagnostics. Existing callers that only use the fields above
    # continue to work unchanged.
    v1se_predicted_class: int
    v2_predicted_class: int
    v1se_probabilities: tuple[float, ...]
    v2_probabilities: tuple[float, ...]

    @property
    def is_live(self) -> bool:
        return self.outcome == LIVE


class _MiniFASNetONNX:
    """
    Lightweight ONNX inference wrapper for one MiniFASNet model.

    The released MiniFASNet V1SE/V2 ONNX models use three output classes.
    Class index 1 represents a real/live face; the other classes represent
    spoof presentations.
    """

    REAL_CLASS_INDEX: Final[int] = 1

    def __init__(self, model_path: Path, crop_scale: float) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(
                f"Anti-spoof model not found: {model_path}"
            )

        self.model_path = model_path
        self.crop_scale = crop_scale

        session_options = ort.SessionOptions()
        session_options.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )

        self.session = ort.InferenceSession(
            str(model_path),
            sess_options=session_options,
            providers=["CPUExecutionProvider"],
        )

        input_config = self.session.get_inputs()[0]
        output_config = self.session.get_outputs()[0]

        self.input_name = input_config.name
        self.output_name = output_config.name

        input_shape = input_config.shape

        if len(input_shape) != 4:
            raise RuntimeError(
                f"Unexpected MiniFASNet input shape for {model_path.name}: "
                f"{input_shape}"
            )

        input_height = input_shape[2]
        input_width = input_shape[3]

        if (
            not isinstance(input_height, int)
            or not isinstance(input_width, int)
        ):
            raise RuntimeError(
                "MiniFASNet model must have a fixed HxW input size. "
                f"Received: {input_shape}"
            )

        self.input_height = input_height
        self.input_width = input_width

    @staticmethod
    def _xyxy_to_xywh(
        bbox_xyxy: np.ndarray | list[float] | tuple[float, ...],
    ) -> tuple[int, int, int, int]:
        if len(bbox_xyxy) != 4:
            raise ValueError(
                "Face bounding box must contain four values."
            )

        x1, y1, x2, y2 = [
            float(value)
            for value in bbox_xyxy
        ]

        x = int(round(x1))
        y = int(round(y1))
        width = int(round(x2 - x1))
        height = int(round(y2 - y1))

        if width <= 0 or height <= 0:
            raise ValueError(
                "Invalid face bounding box."
            )

        return x, y, width, height

    def _crop_face(
        self,
        frame: np.ndarray,
        bbox_xywh: tuple[int, int, int, int],
    ) -> np.ndarray:
        if frame is None or frame.size == 0:
            raise ValueError(
                "Invalid image frame."
            )

        frame_height, frame_width = frame.shape[:2]

        x, y, box_width, box_height = bbox_xywh

        if box_width <= 0 or box_height <= 0:
            raise ValueError(
                "Invalid face bounding box."
            )

        scale = min(
            (frame_height - 1) / box_height,
            (frame_width - 1) / box_width,
            self.crop_scale,
        )

        scaled_width = box_width * scale
        scaled_height = box_height * scale

        center_x = x + (box_width / 2.0)
        center_y = y + (box_height / 2.0)

        x1 = max(
            0,
            int(center_x - (scaled_width / 2.0)),
        )
        y1 = max(
            0,
            int(center_y - (scaled_height / 2.0)),
        )
        x2 = min(
            frame_width - 1,
            int(center_x + (scaled_width / 2.0)),
        )
        y2 = min(
            frame_height - 1,
            int(center_y + (scaled_height / 2.0)),
        )

        if x2 <= x1 or y2 <= y1:
            raise ValueError(
                "Unable to crop the detected face."
            )

        face_crop = frame[
            y1 : y2 + 1,
            x1 : x2 + 1,
        ]

        if face_crop.size == 0:
            raise ValueError(
                "Unable to crop the detected face."
            )

        # This resized BGR crop is the exact visual input that will be
        # converted to CHW float32 and fed to the ONNX model.
        return cv2.resize(
            face_crop,
            (self.input_width, self.input_height),
            interpolation=cv2.INTER_LINEAR,
        )

    def _prepare_input(
        self,
        frame: np.ndarray,
        bbox_xyxy: np.ndarray | list[float] | tuple[float, ...],
    ) -> tuple[np.ndarray, np.ndarray]:
        bbox_xywh = self._xyxy_to_xywh(
            bbox_xyxy
        )

        face_crop = self._crop_face(
            frame,
            bbox_xywh,
        )

        tensor = face_crop.astype(
            np.float32
        )
        tensor = np.transpose(
            tensor,
            (2, 0, 1),
        )
        tensor = np.expand_dims(
            tensor,
            axis=0,
        )

        input_tensor = np.ascontiguousarray(
            tensor,
            dtype=np.float32,
        )

        return input_tensor, face_crop

    @staticmethod
    def _softmax(
        logits: np.ndarray,
    ) -> np.ndarray:
        logits = np.asarray(
            logits,
            dtype=np.float32,
        )

        if (
            logits.ndim != 2
            or logits.shape[0] != 1
        ):
            raise RuntimeError(
                "Unexpected MiniFASNet output shape: "
                f"{logits.shape}"
            )

        shifted = logits - np.max(
            logits,
            axis=1,
            keepdims=True,
        )

        exponentials = np.exp(
            shifted
        )

        denominator = np.sum(
            exponentials,
            axis=1,
            keepdims=True,
        )

        if np.any(denominator <= 0):
            raise RuntimeError(
                "Invalid MiniFASNet probability output."
            )

        return (
            exponentials
            / denominator
        )

    def predict(
        self,
        frame: np.ndarray,
        bbox_xyxy: np.ndarray | list[float] | tuple[float, ...],
    ) -> MiniFASPrediction:
        input_tensor, face_crop = (
            self._prepare_input(
                frame,
                bbox_xyxy,
            )
        )

        outputs = self.session.run(
            [self.output_name],
            {
                self.input_name: input_tensor,
            },
        )

        probabilities_array = self._softmax(
            outputs[0]
        )[0]

        if (
            probabilities_array.shape[0]
            <= self.REAL_CLASS_INDEX
        ):
            raise RuntimeError(
                "MiniFASNet output does not contain "
                f"real class index {self.REAL_CLASS_INDEX}."
            )

        probabilities = tuple(
            float(value)
            for value in probabilities_array.tolist()
        )

        real_probability = float(
            probabilities_array[
                self.REAL_CLASS_INDEX
            ]
        )

        predicted_class = int(
            np.argmax(
                probabilities_array
            )
        )

        return MiniFASPrediction(
            real_probability=real_probability,
            predicted_class=predicted_class,
            probabilities=probabilities,
            model_input_crop=face_crop,
        )


class LivenessService:
    """
    Passive anti-spoofing gate using MiniFASNet V1SE + V2.

    Safety policy:
      - Both models must agree on REAL and the ensemble score must be high
        enough to return LIVE.
      - Both models must agree on a spoof class and the ensemble real score
        must be low enough to return SPOOF_DETECTED.
      - Disagreement or borderline scores return LIVENESS_UNCERTAIN.

    Thresholds are configurable because they must eventually be calibrated
    using the actual school camera/device/lighting conditions.

    Optional local diagnostic mode:
      LIVENESS_DEBUG=1

    When enabled, the exact resized BGR input crops sent to V1SE and V2 are
    saved under debug/liveness so they can be visually inspected. Diagnostic
    probability logs are also emitted at WARNING level.
    """

    def __init__(
        self,
        model_directory: str | Path | None = None,
        spoof_threshold: float | None = None,
        live_threshold: float | None = None,
    ) -> None:
        project_root = (
            Path(__file__)
            .resolve()
            .parents[2]
        )

        default_model_directory = (
            project_root
            / "models"
            / "anti_spoof"
        )

        self.model_directory = Path(
            model_directory
            or os.getenv(
                "LIVENESS_MODEL_DIR",
                str(default_model_directory),
            )
        )

        self.spoof_threshold = (
            self._read_threshold(
                explicit_value=spoof_threshold,
                environment_name=(
                    "LIVENESS_SPOOF_THRESHOLD"
                ),
                default_value=0.20,
            )
        )

        self.live_threshold = (
            self._read_threshold(
                explicit_value=live_threshold,
                environment_name=(
                    "LIVENESS_LIVE_THRESHOLD"
                ),
                default_value=0.80,
            )
        )

        if (
            self.spoof_threshold
            >= self.live_threshold
        ):
            raise ValueError(
                "LIVENESS_SPOOF_THRESHOLD must be lower "
                "than LIVENESS_LIVE_THRESHOLD."
            )

        self.debug_enabled = (
            self._read_boolean_environment(
                "LIVENESS_DEBUG",
                default=False,
            )
        )

        self.debug_directory = Path(
            os.getenv(
                "LIVENESS_DEBUG_DIR",
                str(
                    project_root
                    / "debug"
                    / "liveness"
                ),
            )
        )

        if self.debug_enabled:
            self.debug_directory.mkdir(
                parents=True,
                exist_ok=True,
            )

        self.v1se = _MiniFASNetONNX(
            (
                self.model_directory
                / "MiniFASNetV1SE.onnx"
            ),
            crop_scale=4.0,
        )

        self.v2 = _MiniFASNetONNX(
            (
                self.model_directory
                / "MiniFASNetV2.onnx"
            ),
            crop_scale=2.7,
        )

    @staticmethod
    def _read_boolean_environment(
        environment_name: str,
        default: bool,
    ) -> bool:
        raw_value = os.getenv(
            environment_name
        )

        if raw_value is None:
            return default

        normalized = (
            raw_value
            .strip()
            .lower()
        )

        if normalized in {
            "1",
            "true",
            "yes",
            "on",
        }:
            return True

        if normalized in {
            "0",
            "false",
            "no",
            "off",
        }:
            return False

        raise ValueError(
            f"{environment_name} must be one of "
            "1/0, true/false, yes/no, or on/off."
        )

    @staticmethod
    def _read_threshold(
        explicit_value: float | None,
        environment_name: str,
        default_value: float,
    ) -> float:
        raw_value = (
            explicit_value
            if explicit_value is not None
            else os.getenv(
                environment_name,
                str(default_value),
            )
        )

        try:
            value = float(
                raw_value
            )
        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                f"{environment_name} must be a "
                "number between 0 and 1."
            ) from error

        if not 0.0 <= value <= 1.0:
            raise ValueError(
                f"{environment_name} must be "
                "between 0 and 1."
            )

        return value

    def _save_debug_crops(
        self,
        v1se_crop: np.ndarray,
        v2_crop: np.ndarray,
    ) -> tuple[Path, Path]:
        # time_ns avoids collisions when several requests arrive very close
        # together. Files are only written when LIVENESS_DEBUG=1.
        run_id = str(
            time.time_ns()
        )

        v1se_path = (
            self.debug_directory
            / f"{run_id}_V1SE_input.jpg"
        )

        v2_path = (
            self.debug_directory
            / f"{run_id}_V2_input.jpg"
        )

        if not cv2.imwrite(
            str(v1se_path),
            v1se_crop,
        ):
            raise RuntimeError(
                f"Failed to save debug crop: {v1se_path}"
            )

        if not cv2.imwrite(
            str(v2_path),
            v2_crop,
        ):
            raise RuntimeError(
                f"Failed to save debug crop: {v2_path}"
            )

        return (
            v1se_path,
            v2_path,
        )

    @staticmethod
    def _format_probabilities(
        probabilities: tuple[float, ...],
    ) -> str:
        return ", ".join(
            (
                f"class_{index}="
                f"{probability:.6f}"
            )
            for index, probability
            in enumerate(
                probabilities
            )
        )

    def check(
        self,
        frame: np.ndarray,
        bbox_xyxy: np.ndarray | list[float] | tuple[float, ...],
    ) -> LivenessResult:
        started_at = (
            time.perf_counter()
        )

        v1se_prediction = (
            self.v1se.predict(
                frame,
                bbox_xyxy,
            )
        )

        v2_prediction = (
            self.v2.predict(
                frame,
                bbox_xyxy,
            )
        )

        v1se_live_score = (
            v1se_prediction
            .real_probability
        )

        v2_live_score = (
            v2_prediction
            .real_probability
        )

        live_score = (
            v1se_live_score
            + v2_live_score
        ) / 2.0

        both_predict_real = (
            v1se_prediction.predicted_class
            == _MiniFASNetONNX.REAL_CLASS_INDEX
            and
            v2_prediction.predicted_class
            == _MiniFASNetONNX.REAL_CLASS_INDEX
        )

        both_predict_spoof = (
            v1se_prediction.predicted_class
            != _MiniFASNetONNX.REAL_CLASS_INDEX
            and
            v2_prediction.predicted_class
            != _MiniFASNetONNX.REAL_CLASS_INDEX
        )

        if (
            both_predict_real
            and live_score
            >= self.live_threshold
        ):
            outcome = LIVE

        elif (
            both_predict_spoof
            and live_score
            <= self.spoof_threshold
        ):
            outcome = SPOOF_DETECTED

        else:
            outcome = (
                LIVENESS_UNCERTAIN
            )

        processing_ms = (
            time.perf_counter()
            - started_at
        ) * 1000.0

        if self.debug_enabled:
            v1se_path, v2_path = (
                self._save_debug_crops(
                    v1se_prediction.model_input_crop,
                    v2_prediction.model_input_crop,
                )
            )

            logger.warning(
                (
                    "LIVENESS DEBUG | "
                    "outcome=%s | "
                    "ensemble_real=%.6f | "
                    "V1SE predicted_class=%d | "
                    "V1SE probabilities=[%s] | "
                    "V2 predicted_class=%d | "
                    "V2 probabilities=[%s] | "
                    "V1SE crop=%s | "
                    "V2 crop=%s"
                ),
                outcome,
                live_score,
                v1se_prediction.predicted_class,
                self._format_probabilities(
                    v1se_prediction.probabilities
                ),
                v2_prediction.predicted_class,
                self._format_probabilities(
                    v2_prediction.probabilities
                ),
                v1se_path,
                v2_path,
            )

        return LivenessResult(
            outcome=outcome,
            live_score=live_score,
            v1se_live_score=v1se_live_score,
            v2_live_score=v2_live_score,
            processing_ms=processing_ms,
            v1se_predicted_class=(
                v1se_prediction.predicted_class
            ),
            v2_predicted_class=(
                v2_prediction.predicted_class
            ),
            v1se_probabilities=(
                v1se_prediction.probabilities
            ),
            v2_probabilities=(
                v2_prediction.probabilities
            ),
        )
