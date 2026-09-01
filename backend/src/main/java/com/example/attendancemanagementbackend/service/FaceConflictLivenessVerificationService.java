package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceConflictVerificationResult;

import com.example.attendancemanagementbackend.dto.liveness.FaceConflictLivenessVerificationResponse;
import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.ArrayList;
import java.util.List;

@Service
public class FaceConflictLivenessVerificationService {

    /* =========================================================
       FRAME LIMITS

       Must remain compatible with the Python liveness API.

       Python currently expects:

       baseline:  5 - 8
       challenge: 5 - 20
    ========================================================= */

    private static final int
            MIN_BASELINE_FRAMES =
            5;

    private static final int
            MAX_BASELINE_FRAMES =
            8;

    private static final int
            MIN_CHALLENGE_FRAMES =
            5;

    private static final int
            MAX_CHALLENGE_FRAMES =
            20;

    private static final long
            MAX_FRAME_BYTES =
            3_000_000L;

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final LivenessChallengeService
            livenessChallengeService;

    private final FaceRecognitionClient
            faceRecognitionClient;

    private final FaceConflictLivenessFinalizationService
            faceConflictLivenessFinalizationService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public FaceConflictLivenessVerificationService(

            LivenessChallengeService
                    livenessChallengeService,

            FaceRecognitionClient
                    faceRecognitionClient,

            FaceConflictLivenessFinalizationService
                    faceConflictLivenessFinalizationService
    ) {

        this.livenessChallengeService =
                livenessChallengeService;

        this.faceRecognitionClient =
                faceRecognitionClient;

        this.faceConflictLivenessFinalizationService =
                faceConflictLivenessFinalizationService;
    }

    /* =========================================================
       VERIFY FACE-CONFLICT LIVENESS

       IMPORTANT TRANSACTION DESIGN:

       This orchestration method intentionally has NO
       @Transactional annotation.

       Flow:

       1. Validate uploaded frames.

       2. Claim challenge in a short transaction:

              PENDING -> VERIFYING

       3. Release DB lock.

       4. Call Python active-liveness verification.

       5A. If liveness fails:

              VERIFYING -> FAILED

       5B. If liveness succeeds:

           perform the conflict verification AND mark the
           liveness challenge PASSED inside one atomic
           transaction using:

           FaceConflictLivenessFinalizationService

       SECURITY:

       The raw biometric embedding is NEVER returned to React.

       React/browser NEVER supplies an embedding back to Spring.
    ========================================================= */

    public FaceConflictLivenessVerificationResponse
    verifyFaceConflictChallenge(

            String studentId,

            String conflictId,

            String challengeId,

            String adviserId,

            List<MultipartFile> baselineImages,

            List<MultipartFile> challengeImages
    ) {

        /* =====================================================
           1. VALIDATE MULTIPART BEFORE CONSUMING CHALLENGE

           Malformed requests should not unnecessarily consume
           a valid one-time challenge.
        ===================================================== */

        validateFrameCollection(

                baselineImages,

                MIN_BASELINE_FRAMES,

                MAX_BASELINE_FRAMES,

                "baseline"
        );

        validateFrameCollection(

                challengeImages,

                MIN_CHALLENGE_FRAMES,

                MAX_CHALLENGE_FRAMES,

                "challenge"
        );

        /* =====================================================
           2. CONVERT MULTIPART -> INTERNAL LIVENESS FRAMES
        ===================================================== */

        List<FaceRecognitionClient.LivenessFrame>
                baselineFrames =
                convertFrames(

                        baselineImages,

                        "baseline"
                );

        List<FaceRecognitionClient.LivenessFrame>
                challengeFrames =
                convertFrames(

                        challengeImages,

                        "challenge"
                );

        /* =====================================================
           3. CLAIM FACE-CONFLICT CHALLENGE

           PENDING -> VERIFYING

           LivenessChallengeService validates:

           - challenge ownership
           - authenticated Adviser
           - Student
           - Adviser ownership
           - FACE_CONFLICT_VERIFICATION purpose
           - server-side conflict binding
           - supplied conflictId matches binding
           - Student belongs to conflict
           - conflict remains PENDING
           - second verification not already completed
           - challenge is unused
           - challenge has not expired
        ===================================================== */

        LivenessChallengeResponse
                claimedChallenge =
                livenessChallengeService
                        .claimFaceConflictVerificationChallenge(

                                studentId,

                                conflictId,

                                challengeId,

                                adviserId
                        );

        /* =====================================================
           4. DEFENSIVE CHALLENGE-TYPE VALIDATION
        ===================================================== */

        if (
                claimedChallenge.challengeType()
                        == null
        ) {

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "MISSING_CHALLENGE_TYPE"
            );

            throw new ApiException(

                    HttpStatus.INTERNAL_SERVER_ERROR,

                    "Liveness challenge has no challenge type"
            );
        }

        /* =====================================================
           5. SERVER-AUTHORITATIVE CHALLENGE TYPE

           This value comes from Spring's persisted challenge.

           NOT React.
           NOT multipart fields.
        ===================================================== */

        String authoritativeChallengeType =
                claimedChallenge
                        .challengeType()
                        .name();

        /* =====================================================
           6. CALL PYTHON LIVENESS SERVICE

           No pessimistic DB lock is held during this network /
           machine-learning operation.
        ===================================================== */

        FaceRecognitionClient
                .LivenessVerificationResult
                pythonResult;

        try {

            pythonResult =
                    faceRecognitionClient
                            .verifyLiveness(

                                    authoritativeChallengeType,

                                    baselineFrames,

                                    challengeFrames
                            );

        } catch (RuntimeException exception) {

            /*
             * Challenge is already VERIFYING.
             *
             * Fail closed after a Python/network error.
             */

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "LIVENESS_SERVICE_ERROR"
            );

            throw exception;
        }

        /* =====================================================
           7. EMPTY PYTHON RESPONSE
        ===================================================== */

        if (pythonResult == null) {

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "EMPTY_LIVENESS_RESPONSE"
            );

            throw new ApiException(

                    HttpStatus.BAD_GATEWAY,

                    "Liveness service returned an empty response"
            );
        }

        /* =====================================================
           8. VERIFY PYTHON DID NOT CHANGE CHALLENGE TYPE

           Example:

           Spring:
               TURN_LEFT

           Python response:
               BLINK

           -> reject.

           Spring is authoritative.
        ===================================================== */

        if (
                pythonResult.challenge_type()
                        == null ||

                        !authoritativeChallengeType
                                .equals(
                                        pythonResult
                                                .challenge_type()
                                )
        ) {

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "CHALLENGE_TYPE_MISMATCH"
            );

            throw new ApiException(

                    HttpStatus.BAD_GATEWAY,

                    "Liveness service returned a mismatched challenge type"
            );
        }

        /* =====================================================
           9. PYTHON LOGICAL LIVENESS FAILURE

           Examples:

           SPOOF_DETECTED
           BLINK_NOT_DETECTED
           TURN_NOT_DETECTED
           WRONG_DIRECTION
           CONTINUITY_FAILED

           IMPORTANT:

           No face-conflict comparison occurs.
        ===================================================== */

        if (
                !pythonResult.success() ||
                        !pythonResult.passed()
        ) {

            String reason =
                    normalizePythonReason(
                            pythonResult.reason()
                    );

            LivenessChallengeResponse
                    failedChallenge =
                    livenessChallengeService
                            .markFaceConflictVerificationChallengeFailed(

                                    challengeId,

                                    adviserId,

                                    reason
                            );

            return new FaceConflictLivenessVerificationResponse(

                    failedChallenge.challengeId(),

                    failedChallenge.studentId(),

                    failedChallenge.purpose(),

                    failedChallenge.challengeType(),

                    failedChallenge.status(),

                    false,

                    reason,

                    null,

                    pythonResult
                            .passive_live_score(),

                    pythonResult
                            .max_continuity_distance(),

                    // =========================================
                    // FACE-CONFLICT COMPARISON DID NOT RUN
                    // =========================================

                    null,

                    conflictId,

                    null,

                    null,

                    null,

                    null
            );
        }

        /* =====================================================
           10. PASSED LIVENESS MUST PROVIDE 512-D EMBEDDING

           Fail closed if Python claims success without the
           expected biometric vector.
        ===================================================== */

        List<Double> embedding =
                pythonResult.embedding();

        if (
                embedding == null ||
                        embedding.size() != 512
        ) {

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "INVALID_LIVENESS_EMBEDDING"
            );

            throw new ApiException(

                    HttpStatus.BAD_GATEWAY,

                    "Liveness service returned an invalid face embedding"
            );
        }

        /* =====================================================
           11. ATOMIC SUCCESS FINALIZATION

           IMPORTANT:

           We intentionally DO NOT do this:

               mark challenge PASSED
                       ↓
               verify face conflict

           because an error during the second operation could
           leave the challenge PASSED without conflict evidence.

           Instead:

           ONE TRANSACTION:

               verify face conflict
                       +
               VERIFYING -> PASSED
        ===================================================== */

        FaceConflictLivenessFinalizationService
                .FinalizationResult
                finalizationResult;

        try {

            finalizationResult =
                    faceConflictLivenessFinalizationService
                            .finalizeSuccessfulVerification(

                                    studentId,

                                    conflictId,

                                    challengeId,

                                    adviserId,

                                    embedding
                            );

        } catch (RuntimeException exception) {

            /*
             * The atomic finalization transaction rolled back.
             *
             * At this point the original challenge should still
             * be VERIFYING.
             *
             * Best-effort transition to FAILED.
             */

            failChallengeSafely(

                    challengeId,

                    adviserId,

                    "FACE_CONFLICT_FINALIZATION_ERROR"
            );

            throw exception;
        }

        /* =====================================================
           12. EXTRACT ATOMIC FINALIZATION RESULTS
        ===================================================== */

        LivenessChallengeResponse
                passedChallenge =
                finalizationResult
                        .challenge();

        FaceConflictVerificationResult
                verificationResult =
                finalizationResult
                        .verificationResult();

        /* =====================================================
           13. DEFENSIVE CONTRACT VALIDATION
        ===================================================== */

        if (
                passedChallenge == null ||
                        verificationResult == null ||
                        verificationResult.outcome() == null
        ) {

            throw new ApiException(

                    HttpStatus.INTERNAL_SERVER_ERROR,

                    "Face conflict verification returned an invalid result"
            );
        }

        /* =====================================================
           14. FINAL RESPONSE

           Possible successful outcomes:

           MANUAL_REVIEW_REQUIRED

           CONFLICT_NOT_REPRODUCED

           Defensive concurrent-resolution outcomes:

           VERIFIED_DIFFERENT_PEOPLE

           CONFIRMED_SAME_PERSON

           Raw embedding is intentionally NOT returned.
        ===================================================== */

        return new FaceConflictLivenessVerificationResponse(

                passedChallenge.challengeId(),

                passedChallenge.studentId(),

                passedChallenge.purpose(),

                passedChallenge.challengeType(),

                passedChallenge.status(),

                true,

                null,

                embedding.size(),

                pythonResult
                        .passive_live_score(),

                pythonResult
                        .max_continuity_distance(),

                verificationResult
                        .outcome(),

                verificationResult
                        .conflictId(),

                verificationResult
                        .conflictStatus(),

                verificationResult
                        .conflictingStudentId(),

                verificationResult
                        .conflictingStudentName(),

                verificationResult
                        .distance()
        );
    }

    /* =========================================================
       VALIDATE FRAME COLLECTION
    ========================================================= */

    private void validateFrameCollection(

            List<MultipartFile> frames,

            int minimumFrames,

            int maximumFrames,

            String phase
    ) {

        if (frames == null) {

            throw new ApiException(

                    HttpStatus.BAD_REQUEST,

                    phase
                            + " liveness frames are required"
            );
        }

        if (
                frames.size()
                        < minimumFrames
        ) {

            throw new ApiException(

                    HttpStatus.BAD_REQUEST,

                    "At least "
                            + minimumFrames
                            + " "
                            + phase
                            + " liveness frames are required"
            );
        }

        if (
                frames.size()
                        > maximumFrames
        ) {

            throw new ApiException(

                    HttpStatus.BAD_REQUEST,

                    "Too many "
                            + phase
                            + " liveness frames"
            );
        }

        for (
                MultipartFile frame
                : frames
        ) {

            if (
                    frame == null ||
                            frame.isEmpty()
            ) {

                throw new ApiException(

                        HttpStatus.BAD_REQUEST,

                        "Invalid "
                                + phase
                                + " liveness frame"
                );
            }

            if (
                    frame.getSize()
                            > MAX_FRAME_BYTES
            ) {

                throw new ApiException(

                        HttpStatus.BAD_REQUEST,

                        phase
                                + " liveness frame is too large"
                );
            }
        }
    }

    /* =========================================================
       CONVERT MULTIPART -> INTERNAL FRAME
    ========================================================= */

    private List<FaceRecognitionClient.LivenessFrame>
    convertFrames(

            List<MultipartFile> multipartFiles,

            String phase
    ) {

        List<FaceRecognitionClient.LivenessFrame>
                frames =
                new ArrayList<>(
                        multipartFiles.size()
                );

        for (
                int index = 0;
                index < multipartFiles.size();
                index++
        ) {

            MultipartFile file =
                    multipartFiles.get(
                            index
                    );

            try {

                String filename =
                        file.getOriginalFilename();

                if (
                        filename == null ||
                                filename.isBlank()
                ) {

                    filename =
                            phase
                                    + "_"
                                    + index
                                    + ".jpg";
                }

                frames.add(

                        new FaceRecognitionClient
                                .LivenessFrame(

                                file.getBytes(),

                                filename
                        )
                );

            } catch (IOException exception) {

                throw new ApiException(

                        HttpStatus.BAD_REQUEST,

                        "Unable to read "
                                + phase
                                + " liveness frame"
                );
            }
        }

        return frames;
    }

    /* =========================================================
       FAIL FACE-CONFLICT CHALLENGE SAFELY
    ========================================================= */

    private void failChallengeSafely(

            String challengeId,

            String adviserId,

            String reason
    ) {

        try {

            livenessChallengeService
                    .markFaceConflictVerificationChallengeFailed(

                            challengeId,

                            adviserId,

                            reason
                    );

        } catch (RuntimeException ignored) {

            /*
             * Preserve the original exception.

             * Cleanup failure should never hide the actual
             * Python / protocol / DB error.
             */
        }
    }

    /* =========================================================
       NORMALIZE PYTHON FAILURE REASON

       DB failureReason column is VARCHAR(120).
    ========================================================= */

    private String normalizePythonReason(
            String reason
    ) {

        if (
                reason == null ||
                        reason.isBlank()
        ) {

            return "LIVENESS_VERIFICATION_FAILED";
        }

        String normalized =
                reason.trim();

        if (
                normalized.length()
                        > 120
        ) {

            return normalized.substring(
                    0,
                    120
            );
        }

        return normalized;
    }
}