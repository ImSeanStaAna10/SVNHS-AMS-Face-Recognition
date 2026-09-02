import logging
import os

import cv2
import numpy as np

from fastapi import UploadFile
from insightface.app import FaceAnalysis

from app.service.liveness_service import (
    LIVE,
    LIVENESS_UNCERTAIN,
    SPOOF_DETECTED,
    LivenessService,
)

from app.service.active_liveness_service import (
    BLINK,
    ActiveLivenessService,
)

from app.service.head_turn_liveness_service import (
    TURN_LEFT,
    TURN_RIGHT,
    HeadTurnLivenessService,
)


logger = logging.getLogger(__name__)


class FaceService:

    # =========================================================
    # DEFAULT PASSIVE ENROLLMENT FRAME LIMITS
    #
    # The normal school enrollment flow captures one continuous
    # burst. Spring may still send that burst through the existing
    # baseline_images/challenge_images multipart fields while the
    # Java contract is being migrated.
    #
    # They are treated as one ordered passive sequence here.
    # No movement is required.
    # =========================================================

    MIN_PASSIVE_FRAMES = 8
    MAX_PASSIVE_FRAMES = 20

    # =========================================================
    # ACTIVE LIVENESS FRAME LIMITS
    #
    # Generic sequence requirements:
    #
    # baseline:
    #   at least 5 frames
    #
    # challenge:
    #   at least 5 frames
    #
    # Blink internally uses:
    #   last 3 baseline frames
    #   + challenge frames
    #
    # Head turn internally uses:
    #   last 5 baseline frames
    #   + challenge frames
    #
    # This preserves the real challenge boundary:
    #
    # baseline frames
    #       ↓
    # server challenge shown
    #       ↓
    # challenge frames
    # =========================================================

    MIN_BASELINE_FRAMES = 5
    MIN_CHALLENGE_FRAMES = 5

    MAX_BASELINE_FRAMES = 8
    MAX_CHALLENGE_FRAMES = 20

    MAX_FRAME_BYTES = 3_000_000

    def __init__(self):

        # =====================================================
        # INSIGHTFACE
        #
        # Existing:
        # - detection
        # - recognition / 512-D embedding
        #
        # Added:
        # - landmark_2d_106
        #
        # landmark_2d_106 is required for blink verification.
        #
        # 5-point face.kps from detection is used for
        # TURN_LEFT / TURN_RIGHT.
        # =====================================================

        self.face_app = FaceAnalysis(
            name="buffalo_l",
            root="/opt/insightface",
            providers=[
                "CPUExecutionProvider"
            ],
            allowed_modules=[
                "detection",
                "recognition",
                "landmark_2d_106",
            ],
        )

        self.face_app.prepare(
            ctx_id=0,
            det_size=(640, 640),
        )

        # =====================================================
        # PASSIVE LIVENESS
        #
        # MiniFASNetV1SE + MiniFASNetV2
        # =====================================================

        self.liveness_service = (
            LivenessService()
        )

        # =====================================================
        # ACTIVE LIVENESS
        #
        # Loaded once together with FaceService.
        # =====================================================

        self.active_liveness_service = (
            ActiveLivenessService()
        )

        self.head_turn_liveness_service = (
            HeadTurnLivenessService()
        )

        # =====================================================
        # SAME-PERSON CONTINUITY
        #
        # This is NOT the student's final identity match.
        #
        # It only checks that the person appearing throughout
        # baseline + challenge frames appears to remain the
        # same person.
        #
        # Final student identity matching still belongs to
        # Spring / pgvector.
        #
        # Configurable because it must eventually be calibrated
        # using real school camera conditions.
        # =====================================================

        self.continuity_max_cosine_distance = (
            self._read_float_environment(
                environment_name=(
                    "LIVENESS_CONTINUITY_MAX_DISTANCE"
                ),
                default_value=0.45,
                minimum_value=0.0,
                maximum_value=1.0,
            )
        )

        # =====================================================
        # STRICT ATTENDANCE RECOGNITION LIVENESS
        #
        # Normal passive liveness already requires:
        #
        # - MiniFASNetV1SE predicts REAL
        # - MiniFASNetV2 predicts REAL
        # - ensemble score passes LIVENESS_LIVE_THRESHOLD
        #
        # Attendance recognition is slightly stricter:
        #
        # BOTH individual MiniFAS model live probabilities must
        # also meet this floor.
        #
        # Enrollment does NOT automatically use this stricter
        # rule. It is enabled only when:
        #
        # strict_recognition_liveness=True
        #
        # Current /recognize route uses that flag.
        # =====================================================

        self.recognition_min_model_live_score = (
            self._read_float_environment(
                environment_name=(
                    "RECOGNITION_MIN_MODEL_LIVE_SCORE"
                ),
                default_value=0.70,
                minimum_value=0.0,
                maximum_value=1.0,
            )
        )

    # =========================================================
    # EXISTING FACE ENROLLMENT
    #
    # Existing behavior retained.
    #
    # IMPORTANT:
    #
    # This intentionally DOES NOT enable strict attendance
    # recognition liveness.
    #
    # Enrollment continues using the normal passive MiniFAS
    # security decision.
    # =========================================================

    async def enroll(
        self,
        student_id: str,
        image: UploadFile,
    ):

        embedding = await self.extract_embedding(
            image
        )

        return {
            "success": True,
            "student_id": student_id,
            "embedding": embedding,
        }

    # =========================================================
    # FACE EMBEDDING EXTRACTION
    #
    # Used by:
    #
    # /enrollment
    #     strict_recognition_liveness=False
    #
    # /recognize
    #     strict_recognition_liveness=True
    #
    # This fixes compatibility with the current recognition
    # route while preserving enrollment behavior.
    # =========================================================

    async def extract_embedding(
        self,
        image: UploadFile,
        *,
        strict_recognition_liveness: bool = False,
    ):

        # =====================================================
        # 1. READ + DECODE IMAGE ONCE
        # =====================================================

        image_bytes = await image.read()

        if not image_bytes:
            raise ValueError(
                "Invalid image file"
            )

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8,
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR,
        )

        if frame is None:
            raise ValueError(
                "Invalid image file"
            )

        # =====================================================
        # 2. INSIGHTFACE FACE DETECTION
        # =====================================================

        faces = self.face_app.get(
            frame
        )

        if len(faces) == 0:
            raise ValueError(
                "No face detected"
            )

        if len(faces) > 1:
            raise ValueError(
                "Multiple faces detected. "
                "Please provide an image with one face."
            )

        face = faces[0]

        if (
            face.bbox is None
            or len(face.bbox) != 4
        ):
            raise ValueError(
                "Invalid detected face bounding box"
            )

        # =====================================================
        # 3. PASSIVE LIVENESS
        #
        # MiniFASNetV1SE + MiniFASNetV2
        # =====================================================

        try:

            liveness_result = (
                self.liveness_service.check(
                    frame=frame,
                    bbox_xyxy=face.bbox,
                )
            )

        except Exception as error:

            logger.exception(
                "Liveness inference failed."
            )

            raise ValueError(
                LIVENESS_UNCERTAIN
            ) from error

        logger.warning(
            (
                "LIVENESS RESULT | "
                "mode=%s | "
                "outcome=%s | "
                "live_score=%.4f | "
                "V1SE=%.4f | "
                "V2=%.4f | "
                "processing_ms=%.2f"
            ),
            (
                "STRICT_RECOGNITION"
                if strict_recognition_liveness
                else "STANDARD"
            ),
            liveness_result.outcome,
            liveness_result.live_score,
            liveness_result.v1se_live_score,
            liveness_result.v2_live_score,
            liveness_result.processing_ms,
        )

        # =====================================================
        # 4. NORMAL PASSIVE-LIVENESS SECURITY DECISION
        # =====================================================

        if (
            liveness_result.outcome
            == SPOOF_DETECTED
        ):
            raise ValueError(
                SPOOF_DETECTED
            )

        if (
            liveness_result.outcome
            == LIVENESS_UNCERTAIN
        ):
            raise ValueError(
                LIVENESS_UNCERTAIN
            )

        if (
            liveness_result.outcome
            != LIVE
        ):
            raise ValueError(
                LIVENESS_UNCERTAIN
            )

        # =====================================================
        # 5. STRICT ATTENDANCE-RECOGNITION SECURITY GATE
        #
        # Applied ONLY when requested by /recognize.
        #
        # Even when the ensemble result is LIVE, BOTH individual
        # MiniFAS model live probabilities must be strong enough.
        #
        # Example:
        #
        # V1SE = 0.92
        # V2   = 0.71
        # threshold = 0.70
        #
        # PASS
        #
        # V1SE = 0.92
        # V2   = 0.54
        #
        # FAIL as LIVENESS_UNCERTAIN
        #
        # This avoids returning a recognition embedding when one
        # anti-spoof model is substantially less confident.
        # =====================================================

        if strict_recognition_liveness:

            weakest_model_live_score = min(
                liveness_result.v1se_live_score,
                liveness_result.v2_live_score,
            )

            if (
                weakest_model_live_score
                < self.recognition_min_model_live_score
            ):

                logger.warning(
                    (
                        "STRICT RECOGNITION LIVENESS REJECTED | "
                        "weakest_model_score=%.4f | "
                        "required_score=%.4f | "
                        "V1SE=%.4f | "
                        "V2=%.4f"
                    ),
                    weakest_model_live_score,
                    self.recognition_min_model_live_score,
                    liveness_result.v1se_live_score,
                    liveness_result.v2_live_score,
                )

                raise ValueError(
                    LIVENESS_UNCERTAIN
                )

        # =====================================================
        # 6. 512-D EMBEDDING
        #
        # Embedding is returned only after liveness passes.
        # =====================================================

        embedding = face.embedding

        if (
            embedding is None
            or len(embedding) != 512
        ):
            raise ValueError(
                "Invalid face embedding. "
                "Expected 512 dimensions."
            )

        return embedding.tolist()

    # =========================================================
    # DEFAULT PASSIVE MULTI-FRAME VERIFICATION
    #
    # Backward-compatible contract:
    #
    # - The current Spring endpoint still supplies challenge_type,
    #   baseline_images, and challenge_images.
    #
    # - challenge_type is retained only as transaction metadata.
    #
    # - The two image lists are joined into ONE continuous capture.
    #
    # - BLINK / TURN_LEFT / TURN_RIGHT are NOT evaluated here.
    #
    # Security gates retained:
    #
    # - exactly one valid face per frame
    # - MiniFASNetV1SE + MiniFASNetV2 on representative frames
    # - same-person continuity across the entire burst
    # - 512-D embedding returned only after every gate passes
    # =========================================================

    async def verify_liveness_sequence(
        self,
        challenge_type: str,
        baseline_images: list[UploadFile],
        challenge_images: list[UploadFile],
    ):

        transaction_type = (
            str(challenge_type or "PASSIVE")
            .strip()
            .upper()
            or "PASSIVE"
        )

        submitted_images = [
            *baseline_images,
            *challenge_images,
        ]

        if len(submitted_images) < self.MIN_PASSIVE_FRAMES:
            raise ValueError(
                "At least 8 passive liveness frames are required"
            )

        if len(submitted_images) > self.MAX_PASSIVE_FRAMES:
            raise ValueError(
                "Too many passive liveness frames"
            )

        analysis = []

        for image in submitted_images:

            frame = await self._decode_liveness_frame(
                image
            )

            result = self._analyze_liveness_frame(
                frame
            )

            if result is None:

                return self._failed_verification_result(
                    challenge_type=transaction_type,
                    status="CHALLENGE_UNCERTAIN",
                    reason="INVALID_PASSIVE_FACE",
                )

            analysis.append(
                result
            )

        # =====================================================
        # REPRESENTATIVE PASSIVE-LIVENESS FRAMES
        #
        # first
        # middle
        # last
        # =====================================================

        passive_indices = sorted(
            {
                0,
                len(analysis) // 2,
                len(analysis) - 1,
            }
        )

        passive_live_scores = []

        for index in passive_indices:

            frame, face = analysis[index]

            try:

                passive_result = (
                    self.liveness_service.check(
                        frame=frame,
                        bbox_xyxy=face.bbox,
                    )
                )

            except Exception:

                logger.exception(
                    "Passive liveness inference failed during "
                    "multi-frame enrollment verification."
                )

                return self._failed_verification_result(
                    challenge_type=transaction_type,
                    status="CHALLENGE_UNCERTAIN",
                    reason=LIVENESS_UNCERTAIN,
                )

            passive_live_scores.append(
                passive_result.live_score
            )

            if (
                passive_result.outcome
                == SPOOF_DETECTED
            ):

                return self._failed_verification_result(
                    challenge_type=transaction_type,
                    status="CHALLENGE_FAILED",
                    reason=SPOOF_DETECTED,
                    passive_live_score=float(
                        np.mean(
                            passive_live_scores
                        )
                    ),
                )

            if (
                passive_result.outcome
                != LIVE
            ):

                return self._failed_verification_result(
                    challenge_type=transaction_type,
                    status="CHALLENGE_UNCERTAIN",
                    reason=LIVENESS_UNCERTAIN,
                    passive_live_score=float(
                        np.mean(
                            passive_live_scores
                        )
                    ),
                )

        passive_live_score = float(
            np.mean(
                passive_live_scores
            )
        )

        # =====================================================
        # SAME-PERSON CONTINUITY
        #
        # All captured embeddings are normalized and averaged
        # into a centroid.
        #
        # Every frame must remain sufficiently close to that
        # identity centroid.
        # =====================================================

        normalized_embeddings = [
            self._normalized_embedding(
                face.embedding
            )
            for _, face in analysis
        ]

        centroid = np.mean(
            np.stack(
                normalized_embeddings
            ),
            axis=0,
        )

        centroid_norm = float(
            np.linalg.norm(
                centroid
            )
        )

        if (
            not np.isfinite(
                centroid_norm
            )
            or centroid_norm <= 1e-8
        ):

            return self._failed_verification_result(
                challenge_type=transaction_type,
                status="CHALLENGE_UNCERTAIN",
                reason="INVALID_FACE_CONTINUITY",
                passive_live_score=passive_live_score,
            )

        centroid = (
            centroid
            / centroid_norm
        )

        continuity_distances = []

        for normalized_embedding in normalized_embeddings:

            similarity = float(
                np.clip(
                    np.dot(
                        centroid,
                        normalized_embedding,
                    ),
                    -1.0,
                    1.0,
                )
            )

            continuity_distances.append(
                1.0 - similarity
            )

        max_continuity_distance = float(
            max(
                continuity_distances
            )
        )

        if (
            max_continuity_distance
            > self.continuity_max_cosine_distance
        ):

            return self._failed_verification_result(
                challenge_type=transaction_type,
                status="CHALLENGE_FAILED",
                reason="FACE_CONTINUITY_FAILED",
                passive_live_score=passive_live_score,
                max_continuity_distance=(
                    max_continuity_distance
                ),
            )

        # =====================================================
        # BEST FACE FOR FINAL ENROLLMENT EMBEDDING
        #
        # Highest detection-confidence face is selected.
        # =====================================================

        best_face = max(
            (
                face
                for _, face in analysis
            ),
            key=lambda face: float(
                getattr(
                    face,
                    "det_score",
                    0.0,
                )
                or 0.0
            ),
        )

        final_embedding = (
            best_face.embedding
        )

        if (
            final_embedding is None
            or len(final_embedding) != 512
        ):

            return self._failed_verification_result(
                challenge_type=transaction_type,
                status="CHALLENGE_UNCERTAIN",
                reason="INVALID_FACE_EMBEDDING",
                passive_live_score=passive_live_score,
                max_continuity_distance=(
                    max_continuity_distance
                ),
            )

        return {
            "success": True,
            "passed": True,
            "challenge_type": transaction_type,
            "status": "CHALLENGE_PASSED",
            "reason": None,
            "embedding": (
                final_embedding.tolist()
            ),
            "passive_live_score": (
                passive_live_score
            ),
            "max_continuity_distance": (
                max_continuity_distance
            ),
        }

    # =========================================================
    # OPTIONAL HIGH-SECURITY ACTIVE VERIFICATION
    #
    # This method DOES NOT randomly choose a challenge.
    #
    # challenge_type must eventually come from Spring's
    # server-authoritative LivenessChallenge DB record.
    #
    # Flow:
    #
    # decode frames
    #     ↓
    # exactly one face per frame
    #     ↓
    # passive liveness on baseline
    #     ↓
    # same-person continuity
    #     ↓
    # BLINK / TURN_LEFT / TURN_RIGHT
    #     ↓
    # successful challenge
    #     ↓
    # return 512-D embedding
    # =========================================================

    async def verify_active_liveness_sequence(
        self,
        challenge_type: str,
        baseline_images: list[UploadFile],
        challenge_images: list[UploadFile],
    ):

        challenge_type = (
            challenge_type
            .strip()
            .upper()
        )

        if challenge_type not in {
            BLINK,
            TURN_LEFT,
            TURN_RIGHT,
        }:

            raise ValueError(
                "Unsupported liveness challenge type"
            )

        # =====================================================
        # FRAME COUNT VALIDATION
        # =====================================================

        if (
            len(baseline_images)
            < self.MIN_BASELINE_FRAMES
        ):

            raise ValueError(
                "At least 5 baseline frames are required"
            )

        if (
            len(challenge_images)
            < self.MIN_CHALLENGE_FRAMES
        ):

            raise ValueError(
                "At least 5 challenge frames are required"
            )

        if (
            len(baseline_images)
            > self.MAX_BASELINE_FRAMES
        ):

            raise ValueError(
                "Too many baseline frames"
            )

        if (
            len(challenge_images)
            > self.MAX_CHALLENGE_FRAMES
        ):

            raise ValueError(
                "Too many challenge frames"
            )

        # =====================================================
        # DECODE ALL FRAMES
        # =====================================================

        baseline_frames = []

        for image in baseline_images:

            baseline_frames.append(
                await self._decode_liveness_frame(
                    image
                )
            )

        challenge_frames = []

        for image in challenge_images:

            challenge_frames.append(
                await self._decode_liveness_frame(
                    image
                )
            )

        # =====================================================
        # ANALYZE EACH FRAME ONCE
        #
        # Each entry stores:
        #
        # frame
        # InsightFace Face object
        #
        # The same analysis is reused by:
        #
        # passive liveness
        # active liveness
        # continuity
        # final embedding
        # =====================================================

        baseline_analysis = []

        for frame in baseline_frames:

            result = (
                self._analyze_liveness_frame(
                    frame
                )
            )

            if result is None:

                return (
                    self._failed_verification_result(
                        challenge_type=challenge_type,
                        status="CHALLENGE_UNCERTAIN",
                        reason=(
                            "INVALID_BASELINE_FACE"
                        ),
                    )
                )

            baseline_analysis.append(
                result
            )

        challenge_analysis = []

        for frame in challenge_frames:

            result = (
                self._analyze_liveness_frame(
                    frame
                )
            )

            if result is None:

                return (
                    self._failed_verification_result(
                        challenge_type=challenge_type,
                        status="CHALLENGE_UNCERTAIN",
                        reason=(
                            "INVALID_CHALLENGE_FACE"
                        ),
                    )
                )

            challenge_analysis.append(
                result
            )

        # =====================================================
        # PASSIVE LIVENESS
        #
        # Passive MiniFAS is checked on three representative
        # FRONT-FACING baseline frames:
        #
        # first
        # middle
        # last
        #
        # We deliberately do not require MiniFAS to classify
        # an extreme turned-head frame because the passive
        # model may be less stable at strong yaw angles.
        # =====================================================

        passive_indices = sorted(
            {
                0,
                len(baseline_analysis) // 2,
                len(baseline_analysis) - 1,
            }
        )

        passive_live_scores = []

        for index in passive_indices:

            frame, face = (
                baseline_analysis[index]
            )

            try:

                passive_result = (
                    self.liveness_service.check(
                        frame=frame,
                        bbox_xyxy=face.bbox,
                    )
                )

            except Exception:

                logger.exception(
                    "Passive liveness inference "
                    "failed during active verification."
                )

                return (
                    self._failed_verification_result(
                        challenge_type=challenge_type,
                        status="CHALLENGE_UNCERTAIN",
                        reason=LIVENESS_UNCERTAIN,
                    )
                )

            passive_live_scores.append(
                passive_result.live_score
            )

            if (
                passive_result.outcome
                == SPOOF_DETECTED
            ):

                return (
                    self._failed_verification_result(
                        challenge_type=challenge_type,
                        status="CHALLENGE_FAILED",
                        reason=SPOOF_DETECTED,
                        passive_live_score=float(
                            np.mean(
                                passive_live_scores
                            )
                        ),
                    )
                )

            if (
                passive_result.outcome
                != LIVE
            ):

                return (
                    self._failed_verification_result(
                        challenge_type=challenge_type,
                        status="CHALLENGE_UNCERTAIN",
                        reason=LIVENESS_UNCERTAIN,
                        passive_live_score=float(
                            np.mean(
                                passive_live_scores
                            )
                        ),
                    )
                )

        passive_live_score = float(
            np.mean(
                passive_live_scores
            )
        )

        # =====================================================
        # SAME-PERSON CONTINUITY
        #
        # Build an identity anchor from baseline embeddings.
        #
        # Then compare every baseline + challenge frame
        # against that baseline identity anchor.
        #
        # This helps prevent:
        #
        # Person A during baseline
        #       ↓
        # Person B performs challenge
        #
        # This does NOT replace final Student matching.
        # =====================================================

        baseline_embeddings = [
            self._normalized_embedding(
                face.embedding
            )
            for _, face
            in baseline_analysis
        ]

        baseline_centroid = np.mean(
            np.stack(
                baseline_embeddings
            ),
            axis=0,
        )

        centroid_norm = float(
            np.linalg.norm(
                baseline_centroid
            )
        )

        if (
            not np.isfinite(
                centroid_norm
            )
            or centroid_norm <= 1e-8
        ):

            return (
                self._failed_verification_result(
                    challenge_type=challenge_type,
                    status="CHALLENGE_UNCERTAIN",
                    reason=(
                        "INVALID_FACE_CONTINUITY"
                    ),
                    passive_live_score=(
                        passive_live_score
                    ),
                )
            )

        baseline_centroid = (
            baseline_centroid
            / centroid_norm
        )

        all_analysis = (
            baseline_analysis
            + challenge_analysis
        )

        continuity_distances = []

        for _, face in all_analysis:

            normalized_embedding = (
                self._normalized_embedding(
                    face.embedding
                )
            )

            similarity = float(
                np.dot(
                    baseline_centroid,
                    normalized_embedding,
                )
            )

            similarity = float(
                np.clip(
                    similarity,
                    -1.0,
                    1.0,
                )
            )

            cosine_distance = (
                1.0 - similarity
            )

            continuity_distances.append(
                cosine_distance
            )

        max_continuity_distance = float(
            max(
                continuity_distances
            )
        )

        if (
            max_continuity_distance
            > self.continuity_max_cosine_distance
        ):

            return (
                self._failed_verification_result(
                    challenge_type=challenge_type,
                    status="CHALLENGE_FAILED",
                    reason=(
                        "FACE_CONTINUITY_FAILED"
                    ),
                    passive_live_score=(
                        passive_live_score
                    ),
                    max_continuity_distance=(
                        max_continuity_distance
                    ),
                )
            )

        # =====================================================
        # ACTIVE CHALLENGE
        # =====================================================

        if challenge_type == BLINK:

            # Blink prototype expects 3 baseline frames.
            #
            # IMPORTANT:
            #
            # These are PRE-PROMPT frames only.
            #
            # Challenge frames are appended only after the
            # challenge boundary.

            blink_baseline = (
                baseline_analysis[-3:]
            )

            landmark_sequence = []

            for _, face in (
                blink_baseline
                + challenge_analysis
            ):

                landmarks = getattr(
                    face,
                    "landmark_2d_106",
                    None,
                )

                if landmarks is None:

                    return (
                        self._failed_verification_result(
                            challenge_type=(
                                challenge_type
                            ),
                            status=(
                                "CHALLENGE_UNCERTAIN"
                            ),
                            reason=(
                                "INVALID_FACE_LANDMARKS"
                            ),
                            passive_live_score=(
                                passive_live_score
                            ),
                            max_continuity_distance=(
                                max_continuity_distance
                            ),
                        )
                    )

                landmark_sequence.append(
                    np.asarray(
                        landmarks,
                        dtype=np.float32,
                    )
                )

            active_result = (
                self.active_liveness_service
                .verify_blink(
                    landmark_sequence
                )
            )

        else:

            # Head-turn verifier uses 5 baseline frames.

            turn_baseline = (
                baseline_analysis[-5:]
            )

            keypoint_sequence = []

            for _, face in (
                turn_baseline
                + challenge_analysis
            ):

                keypoints = getattr(
                    face,
                    "kps",
                    None,
                )

                if keypoints is None:

                    return (
                        self._failed_verification_result(
                            challenge_type=(
                                challenge_type
                            ),
                            status=(
                                "CHALLENGE_UNCERTAIN"
                            ),
                            reason=(
                                "INVALID_FACE_KEYPOINTS"
                            ),
                            passive_live_score=(
                                passive_live_score
                            ),
                            max_continuity_distance=(
                                max_continuity_distance
                            ),
                        )
                    )

                keypoint_sequence.append(
                    np.asarray(
                        keypoints,
                        dtype=np.float32,
                    )
                )

            active_result = (
                self.head_turn_liveness_service
                .verify_turn(
                    challenge_type=(
                        challenge_type
                    ),
                    keypoint_sequence=(
                        keypoint_sequence
                    ),
                )
            )

        # =====================================================
        # ACTIVE CHALLENGE FAILED / UNCERTAIN
        # =====================================================

        if not active_result.passed:

            return (
                self._failed_verification_result(
                    challenge_type=(
                        challenge_type
                    ),
                    status=(
                        active_result.status
                    ),
                    reason=(
                        active_result.reason
                    ),
                    passive_live_score=(
                        passive_live_score
                    ),
                    max_continuity_distance=(
                        max_continuity_distance
                    ),
                )
            )

        # =====================================================
        # CHALLENGE PASSED
        #
        # Select the highest-confidence baseline face.
        #
        # Baseline is used because the person is expected to
        # be front-facing there.
        #
        # A strongly turned challenge frame is less desirable
        # for the final recognition embedding.
        # =====================================================

        best_baseline_face = max(
            (
                face
                for _, face
                in baseline_analysis
            ),
            key=lambda face: float(
                getattr(
                    face,
                    "det_score",
                    0.0,
                )
                or 0.0
            ),
        )

        final_embedding = (
            best_baseline_face.embedding
        )

        if (
            final_embedding is None
            or len(final_embedding) != 512
        ):

            return (
                self._failed_verification_result(
                    challenge_type=(
                        challenge_type
                    ),
                    status=(
                        "CHALLENGE_UNCERTAIN"
                    ),
                    reason=(
                        "INVALID_FACE_EMBEDDING"
                    ),
                    passive_live_score=(
                        passive_live_score
                    ),
                    max_continuity_distance=(
                        max_continuity_distance
                    ),
                )
            )

        # =====================================================
        # FINAL SUCCESS
        #
        # Embedding is ONLY returned after:
        #
        # passive liveness ✅
        # same-person continuity ✅
        # active challenge ✅
        # =====================================================

        return {
            "success": True,
            "passed": True,
            "challenge_type": challenge_type,
            "status": "CHALLENGE_PASSED",
            "reason": None,
            "embedding": (
                final_embedding.tolist()
            ),
            "passive_live_score": (
                passive_live_score
            ),
            "max_continuity_distance": (
                max_continuity_distance
            ),
        }

    # =========================================================
    # LIVENESS FRAME DECODER
    # =========================================================

    async def _decode_liveness_frame(
        self,
        image: UploadFile,
    ) -> np.ndarray:

        image_bytes = await image.read()

        if not image_bytes:

            raise ValueError(
                "Invalid liveness frame"
            )

        if (
            len(image_bytes)
            > self.MAX_FRAME_BYTES
        ):

            raise ValueError(
                "Liveness frame is too large"
            )

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8,
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR,
        )

        if frame is None:

            raise ValueError(
                "Invalid liveness frame"
            )

        return frame

    # =========================================================
    # SINGLE FRAME FACE ANALYSIS
    # =========================================================

    def _analyze_liveness_frame(
        self,
        frame: np.ndarray,
    ):

        faces = self.face_app.get(
            frame
        )

        if len(faces) != 1:

            return None

        face = faces[0]

        if (
            face.bbox is None
            or len(face.bbox) != 4
        ):

            return None

        embedding = (
            face.embedding
        )

        if (
            embedding is None
            or len(embedding) != 512
        ):

            return None

        return (
            frame,
            face,
        )

    # =========================================================
    # NORMALIZE EMBEDDING
    # =========================================================

    @staticmethod
    def _normalized_embedding(
        embedding,
    ) -> np.ndarray:

        array = np.asarray(
            embedding,
            dtype=np.float32,
        )

        if array.shape != (512,):

            raise ValueError(
                "Invalid face embedding"
            )

        norm = float(
            np.linalg.norm(
                array
            )
        )

        if (
            not np.isfinite(
                norm
            )
            or norm <= 1e-8
        ):

            raise ValueError(
                "Invalid face embedding"
            )

        return (
            array
            / norm
        )

    # =========================================================
    # FAILED VERIFICATION RESPONSE
    #
    # IMPORTANT:
    #
    # No embedding is returned when verification fails.
    # =========================================================

    @staticmethod
    def _failed_verification_result(
        challenge_type: str,
        status: str,
        reason: str,
        passive_live_score: float | None = None,
        max_continuity_distance: float | None = None,
    ):

        return {
            "success": True,
            "passed": False,
            "challenge_type": challenge_type,
            "status": status,
            "reason": reason,
            "embedding": None,
            "passive_live_score": (
                passive_live_score
            ),
            "max_continuity_distance": (
                max_continuity_distance
            ),
        }

    # =========================================================
    # ENVIRONMENT FLOAT
    # =========================================================

    @staticmethod
    def _read_float_environment(
        environment_name: str,
        default_value: float,
        minimum_value: float,
        maximum_value: float,
    ) -> float:

        raw_value = os.getenv(
            environment_name,
            str(default_value),
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
                f"{environment_name} must be a number"
            ) from error

        if not (
            minimum_value
            < value
            <= maximum_value
        ):

            raise ValueError(
                f"{environment_name} must be "
                f"> {minimum_value} and "
                f"<= {maximum_value}"
            )

        return value