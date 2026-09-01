package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.liveness.LivenessChallengeResponse;

import com.example.attendancemanagementbackend.entity.LivenessChallenge;
import com.example.attendancemanagementbackend.entity.LivenessChallengePurpose;
import com.example.attendancemanagementbackend.entity.LivenessChallengeStatus;
import com.example.attendancemanagementbackend.entity.LivenessChallengeType;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentFaceConflict;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.LivenessChallengeRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;

import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

import java.time.LocalDateTime;

import java.util.List;

@Service
public class LivenessChallengeService {

    /* =========================================================
       CHALLENGE EXPIRATION

       60 seconds currently gives enough time for:

       - frontend instruction
       - user reaction
       - baseline / challenge capture
       - upload to Spring

       IMPORTANT:

       The challenge only needs to still be valid when Spring
       CLAIMS it.

       Once safely claimed:

       PENDING -> VERIFYING

       Python verification may finish after expiresAt because
       replay protection is already enforced by the VERIFYING
       state.
    ========================================================= */

    private static final long
            CHALLENGE_EXPIRATION_SECONDS =
            60;

    /* =========================================================
       SECURE RANDOM GENERATOR
    ========================================================= */

    private final SecureRandom secureRandom =
            new SecureRandom();

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final StudentRepository
            studentRepository;

    private final LivenessChallengeRepository
            livenessChallengeRepository;

    private final StudentVerificationSettingsService
            studentVerificationSettingsService;

    private final StudentFaceConflictService
            studentFaceConflictService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public LivenessChallengeService(

            StudentRepository studentRepository,

            LivenessChallengeRepository
                    livenessChallengeRepository,

            StudentVerificationSettingsService
                    studentVerificationSettingsService,

            StudentFaceConflictService
                    studentFaceConflictService
    ) {

        this.studentRepository =
                studentRepository;

        this.livenessChallengeRepository =
                livenessChallengeRepository;

        this.studentVerificationSettingsService =
                studentVerificationSettingsService;

        this.studentFaceConflictService =
                studentFaceConflictService;
    }

    /* =========================================================
       CREATE ENROLLMENT CHALLENGE
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    createEnrollmentChallenge(

            String studentId,

            String adviserId
    ) {

        validateStudentAndAdviserIds(
                studentId,
                adviserId
        );

        Student student =
                loadStudent(
                        studentId
                );

        verifyStudentActive(
                student
        );

        verifyAdviserOwnership(
                student,
                adviserId
        );

        List<String> allowedChallenges =
                studentVerificationSettingsService
                        .getAllowedChallengesForStudent(
                                student
                        );

        if (allowedChallenges.isEmpty()) {

            return new LivenessChallengeResponse(

                    null,

                    student.getId(),

                    LivenessChallengePurpose
                            .ENROLLMENT,

                    null,

                    null,

                    null,

                    true
            );
        }

        LivenessChallengeType selectedChallenge =
                selectRandomChallenge(
                        allowedChallenges
                );

        LocalDateTime expiresAt =
                createExpiration();

        LivenessChallenge challenge =
                new LivenessChallenge(

                        selectedChallenge,

                        LivenessChallengePurpose
                                .ENROLLMENT,

                        student,

                        null,

                        adviserId,

                        expiresAt
                );

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       CREATE FACE-CONFLICT VERIFICATION CHALLENGE

       Server binds:

       student
       +
       face conflict
       +
       authenticated Adviser
       +
       random challenge type

       The browser cannot later switch this challenge to a
       different conflict.
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    createFaceConflictVerificationChallenge(

            String studentId,

            String conflictId,

            String adviserId
    ) {

        validateStudentAndAdviserIds(
                studentId,
                adviserId
        );

        validateConflictId(
                conflictId
        );

        Student student =
                loadStudent(
                        studentId
                );

        verifyStudentActive(
                student
        );

        verifyAdviserOwnership(
                student,
                adviserId
        );

        /* =====================================================
           LOAD + VALIDATE FACE CONFLICT

           getConflictForStudent() proves that the supplied
           Student actually belongs to this conflict.
        ===================================================== */

        StudentFaceConflict conflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        /* =====================================================
           SECOND VERIFICATION ONLY MAKES SENSE FOR PENDING
           CONFLICTS.
        ===================================================== */

        if (
                conflict.getStatus() !=
                        StudentFaceConflictStatus.PENDING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This face conflict has already been resolved"
            );
        }

        /* =====================================================
           DO NOT CREATE ANOTHER SECOND-CAPTURE CHALLENGE IF
           SECOND-CAPTURE PROOF ALREADY EXISTS.

           At this point the flow should continue to the final
           manual SAME_PERSON / DIFFERENT_PEOPLE decision.
        ===================================================== */

        if (
                conflict.getManualReviewRequiredAt() != null &&
                        conflict.getVerificationDistance() != null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Second face verification has already been completed"
            );
        }

        /* =====================================================
           USE THE STUDENT'S EFFECTIVE ACCESSIBILITY SETTINGS.
        ===================================================== */

        List<String> allowedChallenges =
                studentVerificationSettingsService
                        .getAllowedChallengesForStudent(
                                student
                        );

        /* =====================================================
           ASSISTED VERIFICATION FALLBACK
        ===================================================== */

        if (allowedChallenges.isEmpty()) {

            return new LivenessChallengeResponse(

                    null,

                    student.getId(),

                    LivenessChallengePurpose
                            .FACE_CONFLICT_VERIFICATION,

                    null,

                    null,

                    null,

                    true
            );
        }

        /* =====================================================
           RANDOM SERVER-AUTHORITATIVE CHALLENGE
        ===================================================== */

        LivenessChallengeType selectedChallenge =
                selectRandomChallenge(
                        allowedChallenges
                );

        LocalDateTime expiresAt =
                createExpiration();

        /* =====================================================
           CREATE CHALLENGE WITH FACE-CONFLICT BINDING
        ===================================================== */

        LivenessChallenge challenge =
                new LivenessChallenge(

                        selectedChallenge,

                        LivenessChallengePurpose
                                .FACE_CONFLICT_VERIFICATION,

                        student,

                        null,

                        conflict,

                        adviserId,

                        expiresAt
                );

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       CLAIM ENROLLMENT CHALLENGE

       PENDING -> VERIFYING
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    claimEnrollmentChallenge(

            String studentId,

            String challengeId,

            String adviserId
    ) {

        validateClaimInput(
                studentId,
                challengeId,
                adviserId
        );

        LivenessChallenge challenge =
                loadChallengeForUpdate(
                        challengeId,
                        adviserId
                );

        Student challengeStudent =
                validateChallengeStudent(
                        challenge,
                        studentId,
                        adviserId
                );

        if (
                challenge.getPurpose() !=
                        LivenessChallengePurpose
                                .ENROLLMENT
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge is not an enrollment challenge"
            );
        }

        validatePendingAndNotExpired(
                challenge
        );

        challenge.markVerifying();

        LivenessChallenge claimedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                claimedChallenge
        );
    }

    /* =========================================================
       CLAIM FACE-CONFLICT VERIFICATION CHALLENGE

       PENDING -> VERIFYING

       Validates:

       - challenge owner
       - Student
       - Adviser ownership
       - purpose
       - server-bound face conflict
       - conflict still PENDING
       - one-time state
       - expiration
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    claimFaceConflictVerificationChallenge(

            String studentId,

            String conflictId,

            String challengeId,

            String adviserId
    ) {

        validateClaimInput(
                studentId,
                challengeId,
                adviserId
        );

        validateConflictId(
                conflictId
        );

        LivenessChallenge challenge =
                loadChallengeForUpdate(
                        challengeId,
                        adviserId
                );

        validateChallengeStudent(
                challenge,
                studentId,
                adviserId
        );

        /* =====================================================
           PURPOSE MUST MATCH
        ===================================================== */

        if (
                challenge.getPurpose() !=
                        LivenessChallengePurpose
                                .FACE_CONFLICT_VERIFICATION
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge is not a face-conflict verification challenge"
            );
        }

        /* =====================================================
           SERVER-SIDE FACE-CONFLICT BINDING
        ===================================================== */

        StudentFaceConflict boundConflict =
                challenge.getFaceConflict();

        if (
                boundConflict == null ||
                        boundConflict.getId() == null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge has no face-conflict binding"
            );
        }

        if (
                !conflictId.equals(
                        boundConflict.getId()
                )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Liveness challenge does not belong to this face conflict"
            );
        }

        /* =====================================================
           RE-VALIDATE THAT STUDENT BELONGS TO CONFLICT
        ===================================================== */

        StudentFaceConflict validatedConflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        /* =====================================================
           CONFLICT MUST STILL BE PENDING
        ===================================================== */

        if (
                validatedConflict.getStatus() !=
                        StudentFaceConflictStatus.PENDING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This face conflict has already been resolved"
            );
        }

        /* =====================================================
           DON'T RE-RUN IF SECOND-CAPTURE PROOF ALREADY EXISTS
        ===================================================== */

        if (
                validatedConflict
                        .getManualReviewRequiredAt() != null &&
                        validatedConflict
                                .getVerificationDistance() != null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Second face verification has already been completed"
            );
        }

        validatePendingAndNotExpired(
                challenge
        );

        /* =====================================================
           CLAIM
        ===================================================== */

        challenge.markVerifying();

        LivenessChallenge claimedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                claimedChallenge
        );
    }

    /* =========================================================
       MARK ENROLLMENT CHALLENGE PASSED

       VERIFYING -> PASSED
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    markEnrollmentChallengePassed(

            String challengeId,

            String adviserId
    ) {

        LivenessChallenge challenge =
                loadVerifyingChallengeForUpdate(

                        challengeId,

                        adviserId,

                        LivenessChallengePurpose
                                .ENROLLMENT
                );

        challenge.markPassed();

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       MARK ENROLLMENT CHALLENGE FAILED

       VERIFYING -> FAILED
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    markEnrollmentChallengeFailed(

            String challengeId,

            String adviserId,

            String failureReason
    ) {

        LivenessChallenge challenge =
                loadVerifyingChallengeForUpdate(

                        challengeId,

                        adviserId,

                        LivenessChallengePurpose
                                .ENROLLMENT
                );

        String safeFailureReason =
                normalizeFailureReason(
                        failureReason
                );

        challenge.markFailed(
                safeFailureReason
        );

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       MARK FACE-CONFLICT CHALLENGE PASSED

       VERIFYING -> PASSED
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    markFaceConflictVerificationChallengePassed(

            String challengeId,

            String adviserId
    ) {

        LivenessChallenge challenge =
                loadVerifyingChallengeForUpdate(

                        challengeId,

                        adviserId,

                        LivenessChallengePurpose
                                .FACE_CONFLICT_VERIFICATION
                );

        if (challenge.getFaceConflict() == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge has no face-conflict binding"
            );
        }

        challenge.markPassed();

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       MARK FACE-CONFLICT CHALLENGE FAILED

       VERIFYING -> FAILED
    ========================================================= */

    @Transactional
    public LivenessChallengeResponse
    markFaceConflictVerificationChallengeFailed(

            String challengeId,

            String adviserId,

            String failureReason
    ) {

        LivenessChallenge challenge =
                loadVerifyingChallengeForUpdate(

                        challengeId,

                        adviserId,

                        LivenessChallengePurpose
                                .FACE_CONFLICT_VERIFICATION
                );

        if (challenge.getFaceConflict() == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge has no face-conflict binding"
            );
        }

        String safeFailureReason =
                normalizeFailureReason(
                        failureReason
                );

        challenge.markFailed(
                safeFailureReason
        );

        LivenessChallenge savedChallenge =
                livenessChallengeRepository
                        .save(
                                challenge
                        );

        return toResponse(
                savedChallenge
        );
    }

    /* =========================================================
       VALIDATE STUDENT + ADVISER IDS
    ========================================================= */

    private void validateStudentAndAdviserIds(

            String studentId,

            String adviserId
    ) {

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
                adviserId == null ||
                        adviserId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated Adviser is required"
            );
        }
    }

    /* =========================================================
       VALIDATE CONFLICT ID
    ========================================================= */

    private void validateConflictId(
            String conflictId
    ) {

        if (
                conflictId == null ||
                        conflictId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict ID is required"
            );
        }
    }

    /* =========================================================
       VALIDATE CLAIM INPUT
    ========================================================= */

    private void validateClaimInput(

            String studentId,

            String challengeId,

            String adviserId
    ) {

        validateStudentAndAdviserIds(
                studentId,
                adviserId
        );

        if (
                challengeId == null ||
                        challengeId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Liveness challenge ID is required"
            );
        }
    }

    /* =========================================================
       LOAD STUDENT
    ========================================================= */

    private Student loadStudent(
            String studentId
    ) {

        return studentRepository
                .findById(
                        studentId
                )
                .orElseThrow(() ->
                        new ApiException(
                                HttpStatus.NOT_FOUND,
                                "Student not found"
                        )
                );
    }

    /* =========================================================
       VERIFY ACTIVE STUDENT
    ========================================================= */

    private void verifyStudentActive(
            Student student
    ) {

        if (!student.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive"
            );
        }
    }

    /* =========================================================
       VERIFY ADVISER OWNERSHIP
    ========================================================= */

    private void verifyAdviserOwnership(

            Student student,

            String adviserId
    ) {

        if (
                student.getSection() == null ||
                        student.getSection()
                                .getAdviser() == null ||
                        !student.getSection()
                                .getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this student's section"
            );
        }
    }

    /* =========================================================
       RANDOM CHALLENGE SELECTION
    ========================================================= */

    private LivenessChallengeType
    selectRandomChallenge(
            List<String> allowedChallenges
    ) {

        if (
                allowedChallenges == null ||
                        allowedChallenges.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "No liveness challenges are available"
            );
        }

        int selectedIndex =
                secureRandom.nextInt(
                        allowedChallenges.size()
                );

        String selectedChallengeName =
                allowedChallenges.get(
                        selectedIndex
                );

        try {

            return LivenessChallengeType
                    .valueOf(
                            selectedChallengeName
                    );

        } catch (
                IllegalArgumentException exception
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Invalid configured liveness challenge type"
            );
        }
    }

    /* =========================================================
       CREATE EXPIRATION
    ========================================================= */

    private LocalDateTime createExpiration() {

        return AppTime.now()
                .plusSeconds(
                        CHALLENGE_EXPIRATION_SECONDS
                );
    }

    /* =========================================================
       LOAD CHALLENGE WITH PESSIMISTIC LOCK
    ========================================================= */

    private LivenessChallenge
    loadChallengeForUpdate(

            String challengeId,

            String adviserId
    ) {

        return livenessChallengeRepository
                .findByIdAndCreatedByUserIdForUpdate(
                        challengeId,
                        adviserId
                )
                .orElseThrow(() ->
                        new ApiException(
                                HttpStatus.NOT_FOUND,
                                "Liveness challenge not found"
                        )
                );
    }

    /* =========================================================
       VALIDATE CHALLENGE STUDENT

       Returns the server-bound Student after validating:

       - Student exists on challenge
       - URL student matches DB student
       - active
       - Adviser ownership
    ========================================================= */

    private Student validateChallengeStudent(

            LivenessChallenge challenge,

            String studentId,

            String adviserId
    ) {

        Student challengeStudent =
                challenge.getStudent();

        if (challengeStudent == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge has no student"
            );
        }

        if (
                !studentId.equals(
                        challengeStudent.getId()
                )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Liveness challenge does not belong to this student"
            );
        }

        verifyStudentActive(
                challengeStudent
        );

        verifyAdviserOwnership(
                challengeStudent,
                adviserId
        );

        return challengeStudent;
    }

    /* =========================================================
       VERIFY ONE-TIME STATE + EXPIRATION
    ========================================================= */

    private void validatePendingAndNotExpired(
            LivenessChallenge challenge
    ) {

        if (
                challenge.getStatus() !=
                        LivenessChallengeStatus
                                .PENDING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge has already been used or is being verified"
            );
        }

        LocalDateTime currentTime =
                AppTime.now();

        if (
                challenge.isExpired(
                        currentTime
                )
        ) {

            throw new ApiException(
                    HttpStatus.GONE,
                    "Liveness challenge has expired"
            );
        }
    }

    /* =========================================================
       LOAD VERIFYING CHALLENGE WITH LOCK

       Final PASSED / FAILED state transitions are protected
       from concurrent completion attempts.
    ========================================================= */

    private LivenessChallenge
    loadVerifyingChallengeForUpdate(

            String challengeId,

            String adviserId,

            LivenessChallengePurpose expectedPurpose
    ) {

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

        LivenessChallenge challenge =
                loadChallengeForUpdate(
                        challengeId,
                        adviserId
                );

        if (
                challenge.getPurpose() !=
                        expectedPurpose
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge purpose does not match this operation"
            );
        }

        if (
                challenge.getStatus() !=
                        LivenessChallengeStatus
                                .VERIFYING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Liveness challenge is not currently being verified"
            );
        }

        return challenge;
    }

    /* =========================================================
       FAILURE REASON SAFETY

       DB column is VARCHAR(120).
    ========================================================= */

    private String normalizeFailureReason(
            String failureReason
    ) {

        String normalized =
                failureReason == null ||
                        failureReason.isBlank()
                        ? "LIVENESS_VERIFICATION_FAILED"
                        : failureReason.trim();

        if (normalized.length() > 120) {

            return normalized.substring(
                    0,
                    120
            );
        }

        return normalized;
    }

    /* =========================================================
       COMMON RESPONSE MAPPER
    ========================================================= */

    private LivenessChallengeResponse
    toResponse(
            LivenessChallenge challenge
    ) {

        Student student =
                challenge.getStudent();

        return new LivenessChallengeResponse(

                challenge.getId(),

                student == null
                        ? null
                        : student.getId(),

                challenge.getPurpose(),

                challenge.getChallengeType(),

                challenge.getStatus(),

                challenge.getExpiresAt(),

                false
        );
    }
}