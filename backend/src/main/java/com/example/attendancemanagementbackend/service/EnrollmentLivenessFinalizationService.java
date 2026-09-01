package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceEnrollmentResult;

import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EnrollmentLivenessFinalizationService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final StudentFaceService
            studentFaceService;

    private final LivenessChallengeService
            livenessChallengeService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public EnrollmentLivenessFinalizationService(

            StudentFaceService
                    studentFaceService,

            LivenessChallengeService
                    livenessChallengeService
    ) {

        this.studentFaceService =
                studentFaceService;

        this.livenessChallengeService =
                livenessChallengeService;
    }

    /* =========================================================
       ATOMIC SUCCESSFUL ENROLLMENT FINALIZATION

       Python has ALREADY successfully completed:

       - passive liveness verification
       - active random challenge
       - same-person continuity verification
       - trusted 512-D embedding generation

       IMPORTANT:

       No Python / network request occurs inside this method.

       This transaction performs BOTH:

       1. Conflict-aware StudentFace enrollment.

       2. LivenessChallenge:

              VERIFYING -> PASSED

       If either operation fails:

              ROLLBACK BOTH

       Possible enrollment outcomes:

       ENROLLED
       FACE_CONFLICT

       A FACE_CONFLICT does NOT mean liveness failed.
    ========================================================= */

    @Transactional
    public FinalizationResult finalizeSuccessfulEnrollment(

            String studentId,

            String challengeId,

            String adviserId,

            List<Double> verifiedEmbedding
    ) {

        /* =====================================================
           1. DEFENSIVE INPUT VALIDATION
        ===================================================== */

        if (
                studentId == null ||
                        studentId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Student ID is required"
            );
        }

        if (
                challengeId == null ||
                        challengeId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Liveness challenge ID is required"
            );
        }

        if (
                adviserId == null ||
                        adviserId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated Adviser is required"
            );
        }

        if (verifiedEmbedding == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Verified face embedding is required"
            );
        }

        if (
                verifiedEmbedding.size() != 512
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid verified face embedding. Expected 512 dimensions, got "
                            + verifiedEmbedding.size()
            );
        }

        /* =====================================================
           2. CONFLICT-AWARE FACE ENROLLMENT

           Existing StudentFaceService behavior remains intact.

           It may:

           - save/update StudentFace
           - return FACE_CONFLICT
           - preserve an existing VERIFIED_DIFFERENT_PEOPLE
             conflict decision
        ===================================================== */

        FaceEnrollmentResult
                faceEnrollmentResult =
                studentFaceService
                        .enrollFaceFromVerifiedEmbedding(

                                studentId,

                                verifiedEmbedding,

                                adviserId
                        );

        /* =====================================================
           3. DEFENSIVE ENROLLMENT RESULT VALIDATION

           Do not mark the challenge PASSED unless enrollment
           returned a valid structured result.

           Any StudentFace / FaceConflict DB write performed
           above will roll back if this validation fails.
        ===================================================== */

        if (faceEnrollmentResult == null) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Face enrollment returned no result"
            );
        }

        if (
                faceEnrollmentResult.outcome()
                        == null
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Face enrollment returned an invalid outcome"
            );
        }

        /* =====================================================
           4. MARK LIVENESS CHALLENGE PASSED

           VERIFYING -> PASSED

           Because this outer method is already transactional,
           LivenessChallengeService joins this transaction using
           Spring's default REQUIRED propagation.
        ===================================================== */

        LivenessChallengeResponse
                passedChallenge =
                livenessChallengeService
                        .markEnrollmentChallengePassed(

                                challengeId,

                                adviserId
                        );

        /* =====================================================
           5. DEFENSIVE CHALLENGE RESULT VALIDATION
        ===================================================== */

        if (passedChallenge == null) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Liveness challenge finalization returned no result"
            );
        }

        /* =====================================================
           6. RETURN BOTH RESULTS
        ===================================================== */

        return new FinalizationResult(

                passedChallenge,

                faceEnrollmentResult
        );
    }

    /* =========================================================
       FINALIZATION RESULT
    ========================================================= */

    public record FinalizationResult(

            LivenessChallengeResponse challenge,

            FaceEnrollmentResult faceEnrollmentResult

    ) {
    }
}