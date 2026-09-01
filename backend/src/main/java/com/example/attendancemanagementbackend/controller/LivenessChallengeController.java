package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.liveness.EnrollmentLivenessVerificationResponse;
import com.example.attendancemanagementbackend.dto.liveness.FaceConflictLivenessVerificationResponse;
import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.service.EnrollmentLivenessVerificationService;
import com.example.attendancemanagementbackend.service.FaceConflictLivenessVerificationService;
import com.example.attendancemanagementbackend.service.LivenessChallengeService;

import org.springframework.http.MediaType;

import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping(
        "/api/students/{studentId}/liveness-challenges"
)
public class LivenessChallengeController {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final LivenessChallengeService
            livenessChallengeService;

    private final EnrollmentLivenessVerificationService
            enrollmentLivenessVerificationService;

    private final FaceConflictLivenessVerificationService
            faceConflictLivenessVerificationService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public LivenessChallengeController(

            LivenessChallengeService
                    livenessChallengeService,

            EnrollmentLivenessVerificationService
                    enrollmentLivenessVerificationService,

            FaceConflictLivenessVerificationService
                    faceConflictLivenessVerificationService
    ) {

        this.livenessChallengeService =
                livenessChallengeService;

        this.enrollmentLivenessVerificationService =
                enrollmentLivenessVerificationService;

        this.faceConflictLivenessVerificationService =
                faceConflictLivenessVerificationService;
    }

    /* =========================================================
       CREATE ENROLLMENT CHALLENGE

       No request body.

       Spring randomly selects the authoritative challenge.

       Example:

       POST
       /api/students/{studentId}/liveness-challenges/enrollment
    ========================================================= */

    @PostMapping(
            "/enrollment"
    )
    public LivenessChallengeResponse
    createEnrollmentChallenge(

            @PathVariable("studentId")
            String studentId,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return livenessChallengeService
                .createEnrollmentChallenge(

                        studentId,

                        adviserId
                );
    }

    /* =========================================================
       CREATE FACE-CONFLICT VERIFICATION CHALLENGE

       Spring validates:

       - Student
       - Adviser ownership
       - face conflict exists
       - Student belongs to conflict
       - conflict is still PENDING
       - second verification is not already completed
       - accessibility / allowed challenges

       Spring then binds the challenge SERVER-SIDE to:

       - Student
       - FaceConflict
       - Adviser
       - FACE_CONFLICT_VERIFICATION purpose
       - random challenge type

       Example:

       POST
       /api/students/{studentId}/liveness-challenges
       /face-conflicts/{conflictId}
    ========================================================= */

    @PostMapping(
            "/face-conflicts/{conflictId}"
    )
    public LivenessChallengeResponse
    createFaceConflictVerificationChallenge(

            @PathVariable("studentId")
            String studentId,

            @PathVariable("conflictId")
            String conflictId,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return livenessChallengeService
                .createFaceConflictVerificationChallenge(

                        studentId,

                        conflictId,

                        adviserId
                );
    }

    /* =========================================================
       MANUAL ENROLLMENT CLAIM ENDPOINT

       TEMPORARILY RETAINED.

       Useful for backend / Postman runtime testing.

       Production frontend should normally use /verify directly.

       Example:

       POST
       /api/students/{studentId}/liveness-challenges
       /{challengeId}/claim
    ========================================================= */

    @PostMapping(
            "/{challengeId}/claim"
    )
    public LivenessChallengeResponse
    claimEnrollmentChallenge(

            @PathVariable("studentId")
            String studentId,

            @PathVariable("challengeId")
            String challengeId,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return livenessChallengeService
                .claimEnrollmentChallenge(

                        studentId,

                        challengeId,

                        adviserId
                );
    }

    /* =========================================================
       MANUAL FACE-CONFLICT CLAIM ENDPOINT

       TEMPORARILY RETAINED.

       Useful for backend / Postman runtime tests.

       Validates the server-side binding between:

       - studentId
       - conflictId
       - challengeId
       - Adviser

       Example:

       POST
       /api/students/{studentId}/liveness-challenges
       /face-conflicts/{conflictId}/{challengeId}/claim
    ========================================================= */

    @PostMapping(
            "/face-conflicts/{conflictId}/{challengeId}/claim"
    )
    public LivenessChallengeResponse
    claimFaceConflictVerificationChallenge(

            @PathVariable("studentId")
            String studentId,

            @PathVariable("conflictId")
            String conflictId,

            @PathVariable("challengeId")
            String challengeId,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return livenessChallengeService
                .claimFaceConflictVerificationChallenge(

                        studentId,

                        conflictId,

                        challengeId,

                        adviserId
                );
    }

    /* =========================================================
       VERIFY ENROLLMENT LIVENESS

       Client sends ONLY:

       - studentId through URL
       - challengeId through URL
       - baseline_images[]
       - challenge_images[]

       Client does NOT send challengeType.

       Spring loads challengeType from the database.

       Flow:

       PENDING
           ↓
       VERIFYING
           ↓
       Spring -> Python /liveness/verify
           ↓
       PASSED / FAILED
           ↓
       trusted 512-D embedding
           ↓
       conflict-aware StudentFace enrollment

       Example:

       POST
       /api/students/{studentId}/liveness-challenges
       /{challengeId}/verify
    ========================================================= */

    @PostMapping(
            value = "/{challengeId}/verify",
            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public EnrollmentLivenessVerificationResponse
    verifyEnrollmentChallenge(

            @PathVariable("studentId")
            String studentId,

            @PathVariable("challengeId")
            String challengeId,

            @RequestPart(
                    "baseline_images"
            )
            List<MultipartFile>
                    baselineImages,

            @RequestPart(
                    "challenge_images"
            )
            List<MultipartFile>
                    challengeImages,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return enrollmentLivenessVerificationService
                .verifyEnrollmentChallenge(

                        studentId,

                        challengeId,

                        adviserId,

                        baselineImages,

                        challengeImages
                );
    }

    /* =========================================================
       VERIFY FACE-CONFLICT LIVENESS

       NEW SECURE SECOND-VERIFICATION ENDPOINT.

       Client sends ONLY:

       - studentId through URL
       - conflictId through URL
       - challengeId through URL
       - baseline_images[]
       - challenge_images[]

       Client does NOT send:

       - challengeType
       - biometric embedding
       - conflict status
       - verification distance

       Spring validates all authoritative state from the DB.

       Flow:

       FACE_CONFLICT / PENDING
           ↓
       FACE_CONFLICT_VERIFICATION challenge
           ↓
       PENDING -> VERIFYING
           ↓
       Python passive liveness
       +
       active random challenge
       +
       same-person continuity
           ↓
       trusted 512-D embedding
           ↓
       atomic finalization
           ↓
       second face-conflict comparison
       +
       VERIFYING -> PASSED
           ↓
       MANUAL_REVIEW_REQUIRED

       OR

       CONFLICT_NOT_REPRODUCED

       Example:

       POST
       /api/students/{studentId}/liveness-challenges
       /face-conflicts/{conflictId}/{challengeId}/verify
    ========================================================= */

    @PostMapping(
            value =
                    "/face-conflicts/{conflictId}/{challengeId}/verify",

            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public FaceConflictLivenessVerificationResponse
    verifyFaceConflictChallenge(

            @PathVariable("studentId")
            String studentId,

            @PathVariable("conflictId")
            String conflictId,

            @PathVariable("challengeId")
            String challengeId,

            @RequestPart(
                    "baseline_images"
            )
            List<MultipartFile>
                    baselineImages,

            @RequestPart(
                    "challenge_images"
            )
            List<MultipartFile>
                    challengeImages,

            Authentication authentication
    ) {

        String adviserId =
                authentication.getName();

        return faceConflictLivenessVerificationService
                .verifyFaceConflictChallenge(

                        studentId,

                        conflictId,

                        challengeId,

                        adviserId,

                        baselineImages,

                        challengeImages
                );
    }
}