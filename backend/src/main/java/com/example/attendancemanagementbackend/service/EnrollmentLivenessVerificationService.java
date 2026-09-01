package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceEnrollmentResult;

import com.example.attendancemanagementbackend.dto.liveness.EnrollmentLivenessVerificationResponse;
import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.ArrayList;
import java.util.List;

@Service
public class EnrollmentLivenessVerificationService {

    /* =========================================================
       FRAME LIMITS

       Must match the current Python API limits.

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

    private final StudentFaceService
            studentFaceService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public EnrollmentLivenessVerificationService(

            LivenessChallengeService
                    livenessChallengeService,

            FaceRecognitionClient
                    faceRecognitionClient,

            StudentFaceService
                    studentFaceService
    ) {

        this.livenessChallengeService =
                livenessChallengeService;

        this.faceRecognitionClient =
                faceRecognitionClient;

        this.studentFaceService =
                studentFaceService;
    }

    /* =========================================================
       VERIFY ENROLLMENT LIVENESS

       IMPORTANT TRANSACTION DESIGN:

       This method itself is intentionally NOT @Transactional.

       Step 1:
       claimEnrollmentChallenge()
       opens a short transaction and commits VERIFYING.

       Step 2:
       DB lock is released.

       Step 3:
       Python ML request happens WITHOUT holding DB lock.

       Step 4:
       another short transaction marks PASSED / FAILED.

       Step 5:
       If liveness PASSED, the verified embedding is passed
       internally into StudentFaceService.

       The biometric vector is NEVER returned to the browser.
    ========================================================= */

    public EnrollmentLivenessVerificationResponse
    verifyEnrollmentChallenge(

            String studentId,

            String challengeId,

            String adviserId,

            List<MultipartFile> baselineImages,

            List<MultipartFile> challengeImages
    ) {

        /* =====================================================
           VALIDATE MULTIPART BEFORE CONSUMING CHALLENGE
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
           CLAIM CHALLENGE

           PENDING -> VERIFYING
        ===================================================== */

        LivenessChallengeResponse claimedChallenge =
                livenessChallengeService
                        .claimEnrollmentChallenge(
                                studentId,
                                challengeId,
                                adviserId
                        );

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
           SERVER-AUTHORITATIVE CHALLENGE TYPE
        ===================================================== */

        String authoritativeChallengeType =
                claimedChallenge
                        .challengeType()
                        .name();

        /* =====================================================
           CALL PYTHON
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

            failChallengeSafely(
                    challengeId,
                    adviserId,
                    "LIVENESS_SERVICE_ERROR"
            );

            throw exception;
        }

        /* =====================================================
           VALIDATE PYTHON RESPONSE
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
           VERIFY PYTHON DID NOT CHANGE CHALLENGE TYPE
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
           PYTHON LOGICAL FAILURE
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
                            .markEnrollmentChallengeFailed(
                                    challengeId,
                                    adviserId,
                                    reason
                            );

            return new EnrollmentLivenessVerificationResponse(

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

                    null,

                    null,

                    null,

                    null,

                    null,

                    null,

                    null,

                    null,

                    null,

                    null
            );
        }

        /* =====================================================
           SUCCESS MUST HAVE EXACTLY 512-D EMBEDDING
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
           LIVENESS FINAL STATE

           VERIFYING -> PASSED
        ===================================================== */

        LivenessChallengeResponse
                passedChallenge =
                livenessChallengeService
                        .markEnrollmentChallengePassed(
                                challengeId,
                                adviserId
                        );

        /* =====================================================
           FACE ENROLLMENT USING VERIFIED EMBEDDING
        ===================================================== */

        FaceEnrollmentResult
                faceEnrollmentResult =
                studentFaceService
                        .enrollFaceFromVerifiedEmbedding(
                                studentId,
                                embedding,
                                adviserId
                        );

        /* =====================================================
           DEFENSIVE VALIDATION
        ===================================================== */

        if (
                faceEnrollmentResult == null ||
                        faceEnrollmentResult.outcome()
                                == null
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Face enrollment returned an invalid result"
            );
        }

        /* =====================================================
           FINAL RESPONSE
        ===================================================== */

        return new EnrollmentLivenessVerificationResponse(

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

                faceEnrollmentResult
                        .outcome(),

                faceEnrollmentResult
                        .conflictId(),

                faceEnrollmentResult
                        .conflictStatus(),

                faceEnrollmentResult
                        .conflictingStudentId(),

                faceEnrollmentResult
                        .conflictingStudentName(),

                faceEnrollmentResult
                        .conflictingSectionId(),

                faceEnrollmentResult
                        .conflictingSectionName(),

                faceEnrollmentResult
                        .conflictingDepartmentId(),

                faceEnrollmentResult
                        .conflictingDepartmentName(),

                faceEnrollmentResult
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
       FAIL CHALLENGE SAFELY
    ========================================================= */

    private void failChallengeSafely(

            String challengeId,

            String adviserId,

            String reason
    ) {

        try {

            livenessChallengeService
                    .markEnrollmentChallengeFailed(
                            challengeId,
                            adviserId,
                            reason
                    );

        } catch (RuntimeException ignored) {

            /*
             * Preserve original downstream exception.
             */
        }
    }

    /* =========================================================
       PYTHON FAILURE REASON
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