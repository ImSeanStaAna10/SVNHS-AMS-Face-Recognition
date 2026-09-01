package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceConflictVerificationResult;
import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FaceConflictLivenessFinalizationService {

    private final StudentFaceService
            studentFaceService;

    private final LivenessChallengeService
            livenessChallengeService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public FaceConflictLivenessFinalizationService(

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
       ATOMIC SUCCESS FINALIZATION

       IMPORTANT:

       This entire method runs inside ONE database transaction.

       Flow:

       1. Use the verified 512-D embedding to reproduce the
          original face conflict.

       2. If reproduced, StudentFaceConflictService stores:

              verification_distance
              manual_review_required_at
              updated_at

          Conflict status remains PENDING.

       3. Mark liveness challenge:

              VERIFYING -> PASSED

       If either operation fails, the transaction rolls back.

       Therefore we avoid a dangerous partial state such as:

          challenge = PASSED
          but
          conflict verification evidence = missing
    ========================================================= */

    @Transactional
    public FinalizationResult
    finalizeSuccessfulVerification(

            String studentId,

            String conflictId,

            String challengeId,

            String adviserId,

            List<Double> verifiedEmbedding
    ) {

        /* =====================================================
           1. VALIDATE REQUIRED INPUT
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
                conflictId == null ||
                        conflictId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict ID is required"
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

        if (
                verifiedEmbedding == null ||
                        verifiedEmbedding.size() != 512
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Verified face embedding must contain exactly 512 dimensions"
            );
        }

        /* =====================================================
           2. VERIFY ORIGINAL FACE CONFLICT USING THE
              LIVENESS-VERIFIED EMBEDDING

           IMPORTANT:

           This method does NOT call Python again.

           It may produce:

           MANUAL_REVIEW_REQUIRED
           CONFLICT_NOT_REPRODUCED
           VERIFIED_DIFFERENT_PEOPLE
           CONFIRMED_SAME_PERSON
        ===================================================== */

        FaceConflictVerificationResult
                verificationResult =
                studentFaceService
                        .verifyFaceConflictFromVerifiedEmbedding(

                                studentId,

                                conflictId,

                                verifiedEmbedding,

                                adviserId
                        );

        if (
                verificationResult == null ||
                        verificationResult.outcome() == null
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Face conflict verification returned an invalid result"
            );
        }

        /* =====================================================
           3. MARK LIVENESS CHALLENGE PASSED

           Still inside the SAME transaction.

           VERIFYING -> PASSED

           If this throws, the conflict verification update
           above rolls back too.
        ===================================================== */

        LivenessChallengeResponse
                passedChallenge =
                livenessChallengeService
                        .markFaceConflictVerificationChallengePassed(

                                challengeId,

                                adviserId
                        );

        if (
                passedChallenge == null
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to finalize liveness challenge"
            );
        }

        /* =====================================================
           4. RETURN BOTH RESULTS TO THE ORCHESTRATOR
        ===================================================== */

        return new FinalizationResult(

                passedChallenge,

                verificationResult
        );
    }

    /* =========================================================
       INTERNAL FINALIZATION RESULT

       Used only between backend services.

       Raw embedding is NOT stored here and is NOT returned
       to the browser.
    ========================================================= */

    public record FinalizationResult(

            LivenessChallengeResponse challenge,

            FaceConflictVerificationResult verificationResult

    ) {
    }
}