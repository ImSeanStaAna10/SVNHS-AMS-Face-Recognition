package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceConflictResolutionDecision;

import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentFaceConflict;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.StudentFaceConflictRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class StudentFaceConflictService {

    private final StudentFaceConflictRepository
            studentFaceConflictRepository;

    private final UserRepository
            userRepository;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public StudentFaceConflictService(
            StudentFaceConflictRepository studentFaceConflictRepository,
            UserRepository userRepository
    ) {

        this.studentFaceConflictRepository =
                studentFaceConflictRepository;

        this.userRepository =
                userRepository;
    }

    /* =========================================================
       FIND OR CREATE FACE CONFLICT
    ========================================================= */

    @Transactional
    public StudentFaceConflict findOrCreateConflict(
            Student firstStudent,
            Student secondStudent,
            double distance
    ) {

        if (
                firstStudent == null ||
                        firstStudent.getId() == null ||
                        secondStudent == null ||
                        secondStudent.getId() == null
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Both students are required for face conflict creation"
            );
        }

        if (
                firstStudent
                        .getId()
                        .equals(
                                secondStudent.getId()
                        )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "A student cannot conflict with the same student record"
            );
        }

        Student studentA;
        Student studentB;

        // =====================================================
        // NORMALIZE PAIR
        // =====================================================

        if (
                firstStudent
                        .getId()
                        .compareTo(
                                secondStudent.getId()
                        ) < 0
        ) {

            studentA =
                    firstStudent;

            studentB =
                    secondStudent;

        } else {

            studentA =
                    secondStudent;

            studentB =
                    firstStudent;
        }

        // =====================================================
        // FIND EXISTING CONFLICT
        // =====================================================

        StudentFaceConflict existingConflict =
                studentFaceConflictRepository
                        .findByStudentA_IdAndStudentB_Id(
                                studentA.getId(),
                                studentB.getId()
                        )
                        .orElse(
                                null
                        );

        if (existingConflict != null) {

            /*
             * Preserve the existing conflict state.
             *
             * Do NOT reset:
             *
             * PENDING
             * VERIFIED_DIFFERENT_PEOPLE
             * CONFIRMED_SAME_PERSON
             *
             * Do NOT remove second-capture evidence either.
             */
            return existingConflict;
        }

        // =====================================================
        // CREATE NEW PENDING CONFLICT
        // =====================================================

        StudentFaceConflict conflict =
                new StudentFaceConflict(
                        studentA,
                        studentB,
                        distance
                );

        return studentFaceConflictRepository
                .save(
                        conflict
                );
    }

    /* =========================================================
       GET CONFLICT FOR STUDENT
    ========================================================= */

    @Transactional(readOnly = true)
    public StudentFaceConflict getConflictForStudent(
            String conflictId,
            String studentId
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

        if (
                studentId == null ||
                        studentId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Student ID is required"
            );
        }

        StudentFaceConflict conflict =
                studentFaceConflictRepository
                        .findById(
                                conflictId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Face conflict not found"
                                )
                        );

        Student studentA =
                conflict.getStudentA();

        Student studentB =
                conflict.getStudentB();

        boolean belongsToConflict =
                (
                        studentA != null &&
                                studentId.equals(
                                        studentA.getId()
                                )
                )
                        ||
                        (
                                studentB != null &&
                                        studentId.equals(
                                                studentB.getId()
                                        )
                        );

        if (!belongsToConflict) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "This face conflict does not belong to the supplied student"
            );
        }

        return conflict;
    }

    /* =========================================================
       GET OTHER STUDENT
    ========================================================= */

    @Transactional(readOnly = true)
    public Student getOtherStudent(
            StudentFaceConflict conflict,
            String studentId
    ) {

        if (conflict == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict is required"
            );
        }

        if (
                studentId == null ||
                        studentId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Student ID is required"
            );
        }

        Student studentA =
                conflict.getStudentA();

        Student studentB =
                conflict.getStudentB();

        // =====================================================
        // STUDENT IS A -> RETURN B
        // =====================================================

        if (
                studentA != null &&
                        studentId.equals(
                                studentA.getId()
                        )
        ) {

            if (studentB == null) {

                throw new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Conflicting student is unavailable"
                );
            }

            return studentB;
        }

        // =====================================================
        // STUDENT IS B -> RETURN A
        // =====================================================

        if (
                studentB != null &&
                        studentId.equals(
                                studentB.getId()
                        )
        ) {

            if (studentA == null) {

                throw new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Conflicting student is unavailable"
                );
            }

            return studentA;
        }

        throw new ApiException(
                HttpStatus.FORBIDDEN,
                "Student does not belong to this face conflict"
        );
    }

    /* =========================================================
       MARK MANUAL REVIEW REQUIRED
    ========================================================= */

    @Transactional
    public StudentFaceConflict markManualReviewRequired(
            StudentFaceConflict conflict,
            double verificationDistance
    ) {

        if (conflict == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict is required"
            );
        }

        // =====================================================
        // DO NOT MODIFY ALREADY-RESOLVED CONFLICT
        // =====================================================

        if (
                conflict.getStatus() !=
                        StudentFaceConflictStatus.PENDING
        ) {

            return conflict;
        }

        LocalDateTime now =
                LocalDateTime.now();

        conflict.setVerificationDistance(
                verificationDistance
        );

        conflict.setManualReviewRequiredAt(
                now
        );

        conflict.setUpdatedAt(
                now
        );

        return studentFaceConflictRepository
                .save(
                        conflict
                );
    }

    /* =========================================================
       RESOLVE FACE CONFLICT
    ========================================================= */

    /**
     * Final manual resolution.
     *
     * SECURITY / FLOW REQUIREMENTS:
     *
     * 1. Conflict must exist.
     * 2. Authenticated verifier must exist.
     * 3. Decision must exist.
     * 4. Successful second capture must already have been
     *    recorded.
     * 5. Conflict must still be PENDING.
     *
     * The caller remains responsible for verifying that
     * the authenticated Adviser owns the target Student.
     */
    @Transactional
    public StudentFaceConflict resolveConflict(
            StudentFaceConflict conflict,
            String verifierUserId,
            FaceConflictResolutionDecision decision
    ) {

        // =====================================================
        // VALIDATE CONFLICT
        // =====================================================

        if (conflict == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict is required"
            );
        }

        // =====================================================
        // VALIDATE VERIFIER
        // =====================================================

        if (
                verifierUserId == null ||
                        verifierUserId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated verifier is required"
            );
        }

        // =====================================================
        // VALIDATE DECISION
        // =====================================================

        if (decision == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face conflict resolution decision is required"
            );
        }

        // =====================================================
        // MAP CLIENT DECISION TO INTERNAL STATUS
        // =====================================================

        StudentFaceConflictStatus requestedStatus;

        if (
                decision ==
                        FaceConflictResolutionDecision
                                .DIFFERENT_PEOPLE
        ) {

            requestedStatus =
                    StudentFaceConflictStatus
                            .VERIFIED_DIFFERENT_PEOPLE;

        } else if (
                decision ==
                        FaceConflictResolutionDecision
                                .SAME_PERSON
        ) {

            requestedStatus =
                    StudentFaceConflictStatus
                            .CONFIRMED_SAME_PERSON;

        } else {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported face conflict resolution decision"
            );
        }

        // =====================================================
        // HANDLE ALREADY-RESOLVED CONFLICT
        //
        // Same repeated request is treated as idempotent.
        //
        // Opposite decision is rejected.
        // =====================================================

        if (
                conflict.getStatus() !=
                        StudentFaceConflictStatus.PENDING
        ) {

            if (
                    conflict.getStatus() ==
                            requestedStatus
            ) {

                return conflict;
            }

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This face conflict has already been resolved with a different decision"
            );
        }

        // =====================================================
        // REQUIRE SECOND-CAPTURE PROOF
        //
        // This prevents callers from skipping directly from
        // FACE_CONFLICT to manual approval.
        // =====================================================

        if (
                conflict.getManualReviewRequiredAt() == null ||
                        conflict.getVerificationDistance() == null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Second face verification must be completed before manual resolution"
            );
        }

        // =====================================================
        // LOAD AUTHENTICATED USER
        // =====================================================

        User verifier =
                userRepository
                        .findById(
                                verifierUserId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.UNAUTHORIZED,
                                        "Authenticated verifier was not found"
                                )
                        );

        // =====================================================
        // SAVE FINAL RESOLUTION
        // =====================================================

        LocalDateTime now =
                LocalDateTime.now();

        conflict.setStatus(
                requestedStatus
        );

        conflict.setVerifiedBy(
                verifier
        );

        conflict.setVerifiedAt(
                now
        );

        conflict.setUpdatedAt(
                now
        );

        return studentFaceConflictRepository
                .save(
                        conflict
                );
    }
}