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

    /**
     * Retained temporarily so existing code that still
     * calls enrollFace(...) continues working.
     *
     * The structured StudentFaceController uses:
     *
     * enrollFaceWithConflictHandling(...)
     */
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
       FACE-CONFLICT-AWARE ENROLLMENT / UPDATE
    ========================================================= */

    /**
     * Registers OR updates a student's face.
     *
     * Flow:
     *
     * 1. Find Student
     * 2. Verify Adviser ownership
     * 3. Validate image
     * 4. Determine REGISTER or UPDATE
     * 5. Generate embedding using Python
     * 6. Validate embedding
     * 7. Search globally for nearest OTHER enrolled face
     *
     * 8. If distance <= FACE_CONFLICT_THRESHOLD:
     *
     *    Create or reuse persistent StudentFaceConflict.
     *
     *    PENDING
     *    -> return FACE_CONFLICT
     *
     *    CONFIRMED_SAME_PERSON
     *    -> return FACE_CONFLICT
     *
     *    VERIFIED_DIFFERENT_PEOPLE
     *    -> allow separate enrollment
     *
     * 9. Otherwise save normally.
     */
    @Transactional
    public FaceEnrollmentResult enrollFaceWithConflictHandling(
            String studentId,
            MultipartFile image
    ) throws IOException {

        // =====================================================
        // 1. FIND STUDENT
        // =====================================================

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

        // =====================================================
        // 2. VERIFY ADVISER OWNERSHIP
        // =====================================================

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
                    "You are not allowed to manage this student's face"
            );
        }

        // =====================================================
        // 3. VALIDATE IMAGE
        // =====================================================

        if (
                image == null ||
                        image.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        // =====================================================
        // 4. DETERMINE REGISTER OR UPDATE
        // =====================================================

        boolean alreadyRegistered =
                studentFaceRepository
                        .existsByStudentId(
                                studentId
                        );

        // =====================================================
        // 5. GENERATE EMBEDDING USING PYTHON SERVICE
        // =====================================================

        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient
                        .enrollFace(
                                studentId,
                                image.getBytes(),
                                image.getOriginalFilename()
                        );

        // =====================================================
        // 6. VALIDATE PYTHON RESPONSE
        // =====================================================

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

        // =====================================================
        // 7. CONVERT EMBEDDING TO PGVECTOR FORMAT
        // =====================================================

        String embedding =
                toVectorString(
                        result.embedding()
                );

        // =====================================================
        // 8. GLOBAL SIMILAR-FACE SEARCH
        //
        // The current Student is excluded so updating their
        // own face does not conflict with itself.
        // =====================================================

        FaceMatchResult conflictMatch =
                studentFaceRepository
                        .findMostSimilarFaceExcludingStudent(
                                embedding,
                                studentId
                        )
                        .orElse(
                                null
                        );

        // =====================================================
        // 9. POSSIBLE FACE CONFLICT
        // =====================================================

        if (
                conflictMatch != null &&
                        conflictMatch.distance() <=
                                FACE_CONFLICT_THRESHOLD
        ) {

            // =================================================
            // LOAD CONFLICTING STUDENT
            // =================================================

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

            // =================================================
            // CREATE OR REUSE PERSISTENT CONFLICT
            // =================================================

            StudentFaceConflict conflict =
                    studentFaceConflictService
                            .findOrCreateConflict(
                                    student,
                                    conflictingStudent,
                                    conflictMatch.distance()
                            );

            // =================================================
            // ALREADY VERIFIED AS DIFFERENT PEOPLE
            // =================================================

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

            // =================================================
            // BUILD CONFLICT INFORMATION
            // =================================================

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

            // =================================================
            // SECTION INFORMATION
            // =================================================

            if (conflictingSection != null) {

                conflictingSectionId =
                        conflictingSection.getId();

                conflictingSectionName =
                        conflictingSection.getName();

                // =============================================
                // DEPARTMENT INFORMATION
                // =============================================

                Department conflictingDepartment =
                        conflictingSection.getDepartment();

                if (conflictingDepartment != null) {

                    conflictingDepartmentId =
                            conflictingDepartment.getId();

                    conflictingDepartmentName =
                            conflictingDepartment.getName();
                }
            }

            // =================================================
            // RETURN STRUCTURED FACE CONFLICT
            //
            // No StudentFace insert/update occurs here.
            // =================================================

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

        // =====================================================
        // 10. NO FACE CONFLICT
        // =====================================================

        return saveFaceEmbedding(
                student,
                studentId,
                embedding,
                alreadyRegistered
        );
    }

    /* =========================================================
       SAVE FACE EMBEDDING
    ========================================================= */

    /**
     * Inserts or updates a StudentFace only after the
     * enrollment decision layer allows the operation.
     */
    private FaceEnrollmentResult saveFaceEmbedding(
            Student student,
            String studentId,
            String embedding,
            boolean alreadyRegistered
    ) {

        LocalDateTime now =
                LocalDateTime.now();

        // =====================================================
        // UPDATE EXISTING FACE
        // =====================================================

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

        // =====================================================
        // INSERT NEW FACE
        // =====================================================

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
       VERIFY PENDING FACE CONFLICT
    ========================================================= */

    /**
     * Performs a second automatic capture check for a
     * previously detected face conflict.
     *
     * IMPORTANT:
     *
     * This method NEVER automatically marks two people
     * as different.
     *
     * The second capture only checks whether the original
     * highly-similar-face result can be reproduced.
     *
     * If reproduced:
     *
     * -> stores verification distance
     * -> stores manual review timestamp
     * -> returns MANUAL_REVIEW_REQUIRED
     *
     * If not reproduced:
     *
     * -> CONFLICT_NOT_REPRODUCED
     *
     * No new StudentFace embedding is saved here.
     */
    @Transactional
    public FaceConflictVerificationResult verifyFaceConflictCapture(
            String studentId,
            String conflictId,
            MultipartFile image
    ) throws IOException {

        // =====================================================
        // 1. FIND STUDENT
        // =====================================================

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

        // =====================================================
        // 2. VERIFY ADVISER OWNERSHIP
        // =====================================================

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

        // =====================================================
        // 3. LOAD FACE CONFLICT
        //
        // This verifies that studentId actually belongs
        // to the supplied conflict.
        // =====================================================

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

        // =====================================================
        // 4. HANDLE ALREADY-RESOLVED CONFLICT
        // =====================================================

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

        // =====================================================
        // 5. VALIDATE SECOND CAPTURE
        // =====================================================

        if (
                image == null ||
                        image.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Verification image is required"
            );
        }

        // =====================================================
        // 6. GENERATE SECOND EMBEDDING
        // =====================================================

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

        // =====================================================
        // 7. GLOBAL SECOND SIMILAR-FACE CHECK
        //
        // Current Student is excluded.
        // =====================================================

        FaceMatchResult verificationMatch =
                studentFaceRepository
                        .findMostSimilarFaceExcludingStudent(
                                embedding,
                                studentId
                        )
                        .orElse(
                                null
                        );

        // =====================================================
        // 8. ORIGINAL CONFLICT REPRODUCED
        //
        // Requirements:
        //
        // - nearest OTHER Student is still the same
        //   conflicting Student
        //
        // - distance is still within threshold
        // =====================================================

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

            // =================================================
            // IMPORTANT:
            //
            // Persist proof that the second verification
            // capture reproduced the original conflict.
            //
            // This updates:
            //
            // verification_distance
            // manual_review_required_at
            // updated_at
            //
            // Status remains PENDING.
            // =================================================

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

        // =====================================================
        // 9. ORIGINAL CONFLICT NOT REPRODUCED
        //
        // Still DO NOT save a StudentFace automatically.
        //
        // Frontend should tell the Adviser to retake and
        // retry the normal enrollment flow.
        // =====================================================

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

    /**
     * Performs the final human/manual decision for a face
     * conflict after second-capture verification.
     *
     * Only the Adviser who owns the target Student's Section
     * may resolve the conflict through this Student endpoint.
     */
    @Transactional
    public FaceConflictResolutionResult resolveFaceConflict(
            String studentId,
            String conflictId,
            FaceConflictResolutionDecision decision
    ) {

        // =====================================================
        // 1. FIND TARGET STUDENT
        // =====================================================

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

        // =====================================================
        // 2. VERIFY ADVISER OWNERSHIP
        // =====================================================

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

        // =====================================================
        // 3. LOAD CONFLICT
        //
        // Also verifies that the supplied Student belongs to
        // this conflict.
        // =====================================================

        StudentFaceConflict conflict =
                studentFaceConflictService
                        .getConflictForStudent(
                                conflictId,
                                studentId
                        );

        // =====================================================
        // 4. GET OTHER STUDENT
        // =====================================================

        Student conflictingStudent =
                studentFaceConflictService
                        .getOtherStudent(
                                conflict,
                                studentId
                        );

        // =====================================================
        // 5. FINAL RESOLUTION
        // =====================================================

        StudentFaceConflict resolvedConflict =
                studentFaceConflictService
                        .resolveConflict(
                                conflict,
                                adviserId,
                                decision
                        );

        // =====================================================
        // 6. BUILD RESULT
        // =====================================================

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

    /**
     * Converts a 512-dimensional face embedding into
     * PostgreSQL pgvector format.
     */
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

    /**
     * Retained temporarily for compatibility.
     *
     * Attendance recognition should use the
     * Section-scoped Top-2 method below.
     */
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

    /**
     * Finds up to the two closest registered faces
     * restricted to ACTIVE Students inside the
     * supplied Section.
     *
     * This method does NOT decide:
     *
     * MATCH
     * NO_MATCH
     * AMBIGUOUS
     *
     * AttendanceRecordService remains responsible
     * for that decision.
     */
    @Transactional(readOnly = true)
    public List<FaceMatchResult> findTopSimilarFacesBySection(
            List<Double> embedding,
            String sectionId
    ) {

        // =====================================================
        // 1. VALIDATE SECTION
        // =====================================================

        if (
                sectionId == null ||
                        sectionId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Section ID is required for face recognition"
            );
        }

        // =====================================================
        // 2. VALIDATE AND CONVERT EMBEDDING
        // =====================================================

        String vector =
                toVectorString(
                        embedding
                );

        // =====================================================
        // 3. FIND TOP TWO MATCHES INSIDE SECTION
        // =====================================================

        return studentFaceRepository
                .findTopSimilarFacesBySection(
                        vector,
                        sectionId
                );
    }

    /* =========================================================
       GET AUTHENTICATED ADVISER ID
    ========================================================= */

    /**
     * Used for face enrollment/update/verification ownership.
     *
     * Attendance recognition gets its Section scope
     * through the validated AttendanceSession instead.
     */
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