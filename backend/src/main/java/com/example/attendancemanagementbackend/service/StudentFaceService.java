package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceConflictVerificationResult;
import com.example.attendancemanagementbackend.dto.FaceEnrollmentOutcome;
import com.example.attendancemanagementbackend.dto.FaceEnrollmentResult;
import com.example.attendancemanagementbackend.dto.FaceMatchResult;

import com.example.attendancemanagementbackend.entity.Department;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentFaceConflict;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

import com.example.attendancemanagementbackend.dto.FaceConflictResolutionDecision;
import com.example.attendancemanagementbackend.dto.FaceConflictResolutionResult;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.StudentFaceRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class StudentFaceService {

    /**
     * Enrollment face-conflict threshold.
     *
     * Lower cosine distance = more similar.
     *
     * IMPORTANT:
     *
     * A distance <= 0.50 does NOT automatically prove
     * that two Student records belong to the same person.
     *
     * Instead, the pair enters the FACE_CONFLICT flow.
     *
     * Enrollment comparison intentionally remains GLOBAL
     * across all Sections and Departments.
     */
    private static final double FACE_CONFLICT_THRESHOLD =
            0.50;

    private final StudentRepository
            studentRepository;

    private final StudentFaceRepository
            studentFaceRepository;

    private final FaceRecognitionClient
            faceRecognitionClient;

    private final StudentFaceConflictService
            studentFaceConflictService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public StudentFaceService(
            StudentRepository studentRepository,
            StudentFaceRepository studentFaceRepository,
            FaceRecognitionClient faceRecognitionClient,
            StudentFaceConflictService studentFaceConflictService
    ) {

        this.studentRepository =
                studentRepository;

        this.studentFaceRepository =
                studentFaceRepository;

        this.faceRecognitionClient =
                faceRecognitionClient;

        this.studentFaceConflictService =
                studentFaceConflictService;
    }

    /* =========================================================
       LEGACY ENROLL / UPDATE ENTRY POINT
    ========================================================= */

    @Transactional
    public void enrollFace(
            String studentId,
            MultipartFile image
    ) throws IOException {

        FaceEnrollmentResult enrollmentResult =
                enrollFaceWithConflictHandling(
                        studentId,
                        image
                );

        if (
                enrollmentResult.outcome() ==
                        FaceEnrollmentOutcome.FACE_CONFLICT
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This face requires identity verification before registration"
            );
        }
    }

    /* =========================================================
       FACE-CONFLICT-AWARE LEGACY ENROLLMENT / UPDATE
    ========================================================= */

    @Transactional
    public FaceEnrollmentResult enrollFaceWithConflictHandling(
            String studentId,
            MultipartFile image
    ) throws IOException {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        String adviserId =
                getAuthenticatedAdviserId();

        verifyEnrollmentOwnership(
                student,
                adviserId
        );

        if (
                image == null ||
                        image.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        boolean alreadyRegistered =
                studentFaceRepository
                        .existsByStudentId(
                                studentId
                        );

        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient
                        .enrollFace(
                                studentId,
                                image.getBytes(),
                                image.getOriginalFilename()
                        );

        if (
                result == null ||
                        !result.success() ||
                        result.embedding() == null
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face enrollment failed"
            );
        }

        return processFaceEmbeddingWithConflictHandling(
                student,
                studentId,
                result.embedding(),
                alreadyRegistered
        );
    }

    /* =========================================================
       ACTIVE-LIVENESS VERIFIED EMBEDDING ENROLLMENT
    ========================================================= */

    @Transactional
    public FaceEnrollmentResult enrollFaceFromVerifiedEmbedding(
            String studentId,
            List<Double> verifiedEmbedding,
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

        /*
         * Validate trusted Python embedding before any
         * StudentFace write.
         */
        toVectorString(
                verifiedEmbedding
        );

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        verifyEnrollmentOwnership(
                student,
                adviserId
        );

        boolean alreadyRegistered =
                studentFaceRepository
                        .existsByStudentId(
                                studentId
                        );

        return processFaceEmbeddingWithConflictHandling(
                student,
                studentId,
                verifiedEmbedding,
                alreadyRegistered
        );
    }

    /* =========================================================
       SHARED FACE EMBEDDING DECISION LAYER
    ========================================================= */

    private FaceEnrollmentResult
    processFaceEmbeddingWithConflictHandling(
            Student student,
            String studentId,
            List<Double> embeddingValues,
            boolean alreadyRegistered
    ) {

        String embedding =
                toVectorString(
                        embeddingValues
                );

        FaceMatchResult conflictMatch =
                studentFaceRepository
                        .findMostSimilarFaceExcludingStudent(
                                embedding,
                                studentId
                        )
                        .orElse(
                                null
                        );

        if (
                conflictMatch != null &&
                        conflictMatch.distance() <=
                                FACE_CONFLICT_THRESHOLD
        ) {

            Student conflictingStudent =
                    studentRepository
                            .findById(
                                    conflictMatch.studentId()
                            )
                            .orElseThrow(() ->
                                    new ApiException(
                                            HttpStatus.INTERNAL_SERVER_ERROR,
                                            "Conflicting student record could not be resolved"
                                    )
                            );

            StudentFaceConflict conflict =
                    studentFaceConflictService
                            .findOrCreateConflict(
                                    student,
                                    conflictingStudent,
                                    conflictMatch.distance()
                            );

            if (
                    conflict.getStatus() ==
                            StudentFaceConflictStatus
                                    .VERIFIED_DIFFERENT_PEOPLE
            ) {

                return saveFaceEmbedding(
                        student,
                        studentId,
                        embedding,
                        alreadyRegistered
                );
            }

            String conflictingStudentName =
                    conflictingStudent.getName();

            String conflictingSectionId =
                    null;

            String conflictingSectionName =
                    null;

            String conflictingDepartmentId =
                    null;

            String conflictingDepartmentName =
                    null;

            Section conflictingSection =
                    conflictingStudent.getSection();

            if (conflictingSection != null) {

                conflictingSectionId =
                        conflictingSection.getId();

                conflictingSectionName =
                        conflictingSection.getName();

                Department conflictingDepartment =
                        conflictingSection.getDepartment();

                if (conflictingDepartment != null) {

                    conflictingDepartmentId =
                            conflictingDepartment.getId();

                    conflictingDepartmentName =
                            conflictingDepartment.getName();
                }
            }

            return FaceEnrollmentResult.conflict(
                    studentId,
                    conflict.getId(),
                    conflict.getStatus(),
                    conflictingStudent.getId(),
                    conflictingStudentName,
                    conflictingSectionId,
                    conflictingSectionName,
                    conflictingDepartmentId,
                    conflictingDepartmentName,
                    conflictMatch.distance()
            );
        }

        return saveFaceEmbedding(
                student,
                studentId,
                embedding,
                alreadyRegistered
        );
    }

    /* =========================================================
       VERIFY ENROLLMENT OWNERSHIP
    ========================================================= */

    private void verifyEnrollmentOwnership(
            Student student,
            String adviserId
    ) {

        Section section =
                student.getSection();

        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this student's face"
            );
        }
    }

    /* =========================================================
       SAVE FACE EMBEDDING
    ========================================================= */

    private FaceEnrollmentResult saveFaceEmbedding(
            Student student,
            String studentId,
            String embedding,
            boolean alreadyRegistered
    ) {

        LocalDateTime now =
                LocalDateTime.now();

        if (alreadyRegistered) {

            int updatedRows =
                    studentFaceRepository
                            .updateFaceEmbedding(
                                    studentId,
                                    embedding,
                                    now
                            );

            if (updatedRows == 0) {

                throw new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Unable to update student face"
                );
            }

            return FaceEnrollmentResult.enrolled(
                    studentId
            );
        }

        String faceId =
                UUID.randomUUID()
                        .toString();

        studentFaceRepository
                .insertFaceEmbedding(
                        faceId,
                        student.getId(),
                        embedding,
                        now,
                        now
                );

        return FaceEnrollmentResult.enrolled(
                studentId
        );
    }

    /* =========================================================
       LEGACY VERIFY PENDING FACE CONFLICT

       TEMPORARILY RETAINED.

       This old path still accepts a single image and calls
       the legacy Python enrollment endpoint.

       Production frontend will later stop using this path.
    ========================================================= */

    @Transactional
    public FaceConflictVerificationResult verifyFaceConflictCapture(
            String studentId,
            String conflictId,
            MultipartFile image
    ) throws IOException {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        String adviserId =
                getAuthenticatedAdviserId();

        Section section =
                student.getSection();

        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to verify this student's face"
            );
        }

        StudentFaceConflict conflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        Student conflictingStudent =
                studentFaceConflictService
                        .getOtherStudent(
                                conflict,
                                studentId
                        );

        if (
                conflict.getStatus() ==
                        StudentFaceConflictStatus
                                .VERIFIED_DIFFERENT_PEOPLE
        ) {

            return FaceConflictVerificationResult
                    .verifiedDifferentPeople(
                            conflict.getId(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName()
                    );
        }

        if (
                conflict.getStatus() ==
                        StudentFaceConflictStatus
                                .CONFIRMED_SAME_PERSON
        ) {

            return FaceConflictVerificationResult
                    .confirmedSamePerson(
                            conflict.getId(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName()
                    );
        }

        if (
                image == null ||
                        image.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Verification image is required"
            );
        }

        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient
                        .enrollFace(
                                studentId,
                                image.getBytes(),
                                image.getOriginalFilename()
                        );

        if (
                result == null ||
                        !result.success() ||
                        result.embedding() == null
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face verification capture failed"
            );
        }

        String embedding =
                toVectorString(
                        result.embedding()
                );

        FaceMatchResult verificationMatch =
                studentFaceRepository
                        .findMostSimilarFaceExcludingStudent(
                                embedding,
                                studentId
                        )
                        .orElse(
                                null
                        );

        if (
                verificationMatch != null &&
                        verificationMatch
                                .studentId()
                                .equals(
                                        conflictingStudent.getId()
                                ) &&
                        verificationMatch.distance() <=
                                FACE_CONFLICT_THRESHOLD
        ) {

            StudentFaceConflict updatedConflict =
                    studentFaceConflictService
                            .markManualReviewRequired(
                                    conflict,
                                    verificationMatch.distance()
                            );

            return FaceConflictVerificationResult
                    .manualReviewRequired(
                            updatedConflict.getId(),
                            updatedConflict.getStatus(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName(),
                            verificationMatch.distance()
                    );
        }

        Double verificationDistance =
                verificationMatch == null
                        ? null
                        : verificationMatch.distance();

        return FaceConflictVerificationResult
                .conflictNotReproduced(
                        conflict.getId(),
                        conflict.getStatus(),
                        studentId,
                        conflictingStudent.getId(),
                        conflictingStudent.getName(),
                        verificationDistance
                );
    }

    /* =========================================================
       ACTIVE-LIVENESS VERIFIED FACE-CONFLICT CHECK
       NEW SECURE PATH
    ========================================================= */

    /**
     * Performs the second face-conflict verification using
     * an embedding that has ALREADY passed active liveness.
     *
     * IMPORTANT:
     *
     * This method DOES NOT:
     *
     * - accept an image
     * - call Python /enrollment
     * - trust React with an embedding
     *
     * Expected upstream flow:
     *
     * FACE_CONFLICT_VERIFICATION challenge
     *      ->
     * Python passive liveness
     *      +
     * random active challenge
     *      +
     * same-person continuity
     *      ->
     * trusted 512-D embedding
     *      ->
     * THIS METHOD
     *
     * Existing conflict semantics are retained:
     *
     * - nearest OTHER face must still be the same
     *   conflicting Student
     *
     * - distance must still be <= 0.50
     *
     * If reproduced:
     *
     * verification_distance is stored
     * manual_review_required_at is stored
     * conflict status remains PENDING
     *
     * No StudentFace is inserted or updated.
     */
    @Transactional
    public FaceConflictVerificationResult
    verifyFaceConflictFromVerifiedEmbedding(
            String studentId,
            String conflictId,
            List<Double> verifiedEmbedding,
            String adviserId
    ) {

        /* =====================================================
           1. VALIDATE INPUT
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
                adviserId == null ||
                        adviserId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated Adviser is required"
            );
        }

        /*
         * Validates:
         *
         * - non-null
         * - exactly 512 dimensions
         *
         * Also converts once for pgvector query usage.
         */
        String embedding =
                toVectorString(
                        verifiedEmbedding
                );

        /* =====================================================
           2. FIND TARGET STUDENT
        ===================================================== */

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        /* =====================================================
           3. VERIFY ADVISER OWNERSHIP
        ===================================================== */

        Section section =
                student.getSection();

        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to verify this student's face"
            );
        }

        /* =====================================================
           4. LOAD SERVER-VALIDATED FACE CONFLICT

           Also proves studentId belongs to the conflict.
        ===================================================== */

        StudentFaceConflict conflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        Student conflictingStudent =
                studentFaceConflictService
                        .getOtherStudent(
                                conflict,
                                studentId
                        );

        /* =====================================================
           5. HANDLE ALREADY-RESOLVED CONFLICT
        ===================================================== */

        if (
                conflict.getStatus() ==
                        StudentFaceConflictStatus
                                .VERIFIED_DIFFERENT_PEOPLE
        ) {

            return FaceConflictVerificationResult
                    .verifiedDifferentPeople(
                            conflict.getId(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName()
                    );
        }

        if (
                conflict.getStatus() ==
                        StudentFaceConflictStatus
                                .CONFIRMED_SAME_PERSON
        ) {

            return FaceConflictVerificationResult
                    .confirmedSamePerson(
                            conflict.getId(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName()
                    );
        }

        /* =====================================================
           6. DEFENSIVE IDEMPOTENCY

           Normally LivenessChallengeService prevents creating
           another second-verification challenge after manual
           review proof exists.

           This protects the service layer too.
        ===================================================== */

        if (
                conflict.getManualReviewRequiredAt() != null &&
                        conflict.getVerificationDistance() != null
        ) {

            return FaceConflictVerificationResult
                    .manualReviewRequired(
                            conflict.getId(),
                            conflict.getStatus(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName(),
                            conflict.getVerificationDistance()
                    );
        }

        /* =====================================================
           7. SECOND SIMILAR-FACE CHECK

           The target Student is excluded because Student B
           may not have a stored face yet.

           We expect the nearest OTHER face to reproduce the
           original conflicting Student.
        ===================================================== */

        FaceMatchResult verificationMatch =
                studentFaceRepository
                        .findMostSimilarFaceExcludingStudent(
                                embedding,
                                studentId
                        )
                        .orElse(
                                null
                        );

        /* =====================================================
           8. ORIGINAL CONFLICT REPRODUCED
        ===================================================== */

        if (
                verificationMatch != null &&
                        verificationMatch
                                .studentId()
                                .equals(
                                        conflictingStudent.getId()
                                ) &&
                        verificationMatch.distance() <=
                                FACE_CONFLICT_THRESHOLD
        ) {

            StudentFaceConflict updatedConflict =
                    studentFaceConflictService
                            .markManualReviewRequired(
                                    conflict,
                                    verificationMatch.distance()
                            );

            return FaceConflictVerificationResult
                    .manualReviewRequired(
                            updatedConflict.getId(),
                            updatedConflict.getStatus(),
                            studentId,
                            conflictingStudent.getId(),
                            conflictingStudent.getName(),
                            verificationMatch.distance()
                    );
        }

        /* =====================================================
           9. ORIGINAL CONFLICT NOT REPRODUCED

           IMPORTANT:

           No StudentFace is saved.

           No manual decision is made automatically.

           Adviser may retake/retry according to frontend flow.
        ===================================================== */

        Double verificationDistance =
                verificationMatch == null
                        ? null
                        : verificationMatch.distance();

        return FaceConflictVerificationResult
                .conflictNotReproduced(
                        conflict.getId(),
                        conflict.getStatus(),
                        studentId,
                        conflictingStudent.getId(),
                        conflictingStudent.getName(),
                        verificationDistance
                );
    }

    /* =========================================================
       RESOLVE FACE CONFLICT
    ========================================================= */

    @Transactional
    public FaceConflictResolutionResult resolveFaceConflict(
            String studentId,
            String conflictId,
            FaceConflictResolutionDecision decision
    ) {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        String adviserId =
                getAuthenticatedAdviserId();

        Section section =
                student.getSection();

        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to resolve this student's face conflict"
            );
        }

        StudentFaceConflict conflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        Student conflictingStudent =
                studentFaceConflictService
                        .getOtherStudent(
                                conflict,
                                studentId
                        );

        StudentFaceConflict resolvedConflict =
                studentFaceConflictService
                        .resolveConflict(
                                conflict,
                                adviserId,
                                decision
                        );

        String verifiedByUserId =
                resolvedConflict.getVerifiedBy() == null
                        ? null
                        : resolvedConflict
                        .getVerifiedBy()
                        .getId();

        String verifiedByName =
                resolvedConflict.getVerifiedBy() == null
                        ? null
                        : resolvedConflict
                        .getVerifiedBy()
                        .getName();

        return new FaceConflictResolutionResult(
                resolvedConflict.getId(),
                resolvedConflict.getStatus(),
                studentId,
                conflictingStudent.getId(),
                conflictingStudent.getName(),
                verifiedByUserId,
                verifiedByName,
                resolvedConflict.getVerifiedAt()
        );
    }

    /* =========================================================
       EMBEDDING CONVERSION
    ========================================================= */

    private String toVectorString(
            List<Double> embedding
    ) {

        if (embedding == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face embedding is null"
            );
        }

        if (embedding.size() != 512) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid face embedding. Expected 512 dimensions, got "
                            + embedding.size()
            );
        }

        return embedding.toString();
    }

    /* =========================================================
       LEGACY GLOBAL FACE MATCH
    ========================================================= */

    @Transactional(readOnly = true)
    public FaceMatchResult findMostSimilarFace(
            List<Double> embedding
    ) {

        String vector =
                toVectorString(
                        embedding
                );

        return studentFaceRepository
                .findMostSimilarFace(
                        vector
                )
                .orElseThrow(() ->
                        new ApiException(
                                HttpStatus.NOT_FOUND,
                                "No registered face found"
                        )
                );
    }

    /* =========================================================
       SECTION-SCOPED TOP-2 FACE MATCH
    ========================================================= */

    @Transactional(readOnly = true)
    public List<FaceMatchResult> findTopSimilarFacesBySection(
            List<Double> embedding,
            String sectionId
    ) {

        if (
                sectionId == null ||
                        sectionId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Section ID is required for face recognition"
            );
        }

        String vector =
                toVectorString(
                        embedding
                );

        return studentFaceRepository
                .findTopSimilarFacesBySection(
                        vector,
                        sectionId
                );
    }

    /* =========================================================
       GET AUTHENTICATED ADVISER ID
    ========================================================= */

    private String getAuthenticatedAdviserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null ||
                        !authentication.isAuthenticated()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        return authentication.getName();
    }
}