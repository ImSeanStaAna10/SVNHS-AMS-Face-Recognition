package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.FaceConflictResolutionRequest;
import com.example.attendancemanagementbackend.dto.FaceConflictResolutionResult;
import com.example.attendancemanagementbackend.dto.FaceConflictVerificationOutcome;
import com.example.attendancemanagementbackend.dto.FaceConflictVerificationResult;
import com.example.attendancemanagementbackend.dto.FaceEnrollmentOutcome;
import com.example.attendancemanagementbackend.dto.FaceEnrollmentResult;

import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

import com.example.attendancemanagementbackend.service.StudentFaceService;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
public class StudentFaceController {

    private final StudentFaceService
            studentFaceService;

    public StudentFaceController(
            StudentFaceService studentFaceService
    ) {

        this.studentFaceService =
                studentFaceService;
    }

    /* =========================================================
       ENROLL / UPDATE STUDENT FACE
    ========================================================= */

    /**
     * Enrolls or updates a student's registered face.
     *
     * ENROLLED
     * -> HTTP 200
     *
     * FACE_CONFLICT
     * -> HTTP 409
     * -> face is NOT saved while verification is pending
     */
    @PostMapping(
            value = "/{studentId}/face",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> enrollFace(
            @PathVariable String studentId,
            @RequestParam("image") MultipartFile image
    ) throws IOException {

        FaceEnrollmentResult result =
                studentFaceService
                        .enrollFaceWithConflictHandling(
                                studentId,
                                image
                        );

        // =====================================================
        // FACE CONFLICT
        // =====================================================

        if (
                result.outcome() ==
                        FaceEnrollmentOutcome.FACE_CONFLICT
        ) {

            Map<String, Object> response =
                    new LinkedHashMap<>();

            response.put(
                    "success",
                    false
            );

            response.put(
                    "outcome",
                    FaceEnrollmentOutcome
                            .FACE_CONFLICT
                            .name()
            );

            response.put(
                    "conflictId",
                    result.conflictId()
            );

            response.put(
                    "conflictStatus",
                    result.conflictStatus() == null
                            ? null
                            : result.conflictStatus().name()
            );

            if (
                    result.conflictStatus() ==
                            StudentFaceConflictStatus
                                    .CONFIRMED_SAME_PERSON
            ) {

                response.put(
                        "message",
                        "This face matches an identity previously confirmed as the same person. Face registration is blocked."
                );

            } else {

                response.put(
                        "message",
                        "A highly similar enrolled face was detected. Additional identity verification is required."
                );
            }

            response.put(
                    "studentId",
                    result.studentId()
            );

            response.put(
                    "conflictingStudentId",
                    result.conflictingStudentId()
            );

            response.put(
                    "conflictingStudentName",
                    result.conflictingStudentName()
            );

            response.put(
                    "conflictingSectionId",
                    result.conflictingSectionId()
            );

            response.put(
                    "conflictingSectionName",
                    result.conflictingSectionName()
            );

            response.put(
                    "conflictingDepartmentId",
                    result.conflictingDepartmentId()
            );

            response.put(
                    "conflictingDepartmentName",
                    result.conflictingDepartmentName()
            );

            response.put(
                    "distance",
                    result.distance()
            );

            return ResponseEntity
                    .status(
                            HttpStatus.CONFLICT
                    )
                    .body(
                            response
                    );
        }

        // =====================================================
        // FACE ENROLLED
        // =====================================================

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "outcome",
                FaceEnrollmentOutcome
                        .ENROLLED
                        .name()
        );

        response.put(
                "message",
                "Face enrolled successfully"
        );

        response.put(
                "studentId",
                result.studentId()
        );

        return ResponseEntity
                .ok(
                        response
                );
    }

    /* =========================================================
       VERIFY FACE CONFLICT - SECOND CAPTURE
    ========================================================= */

    /**
     * Performs a second face capture for an existing
     * PENDING face conflict.
     *
     * This does NOT automatically approve two students
     * as different people.
     *
     * It only checks whether the original similarity
     * conflict can be reproduced.
     */
    @PostMapping(
            value = "/{studentId}/face-conflicts/{conflictId}/verify-capture",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> verifyFaceConflict(
            @PathVariable String studentId,
            @PathVariable String conflictId,
            @RequestParam("image") MultipartFile image
    ) throws IOException {

        FaceConflictVerificationResult result =
                studentFaceService
                        .verifyFaceConflictCapture(
                                studentId,
                                conflictId,
                                image
                        );

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "outcome",
                result.outcome().name()
        );

        response.put(
                "conflictId",
                result.conflictId()
        );

        response.put(
                "conflictStatus",
                result.conflictStatus() == null
                        ? null
                        : result.conflictStatus().name()
        );

        response.put(
                "studentId",
                result.studentId()
        );

        response.put(
                "conflictingStudentId",
                result.conflictingStudentId()
        );

        response.put(
                "conflictingStudentName",
                result.conflictingStudentName()
        );

        response.put(
                "distance",
                result.distance()
        );

        // =====================================================
        // RESULT MESSAGE
        // =====================================================

        if (
                result.outcome() ==
                        FaceConflictVerificationOutcome
                                .MANUAL_REVIEW_REQUIRED
        ) {

            response.put(
                    "message",
                    "The second capture reproduced the same face conflict. Manual identity review is required."
            );

        } else if (
                result.outcome() ==
                        FaceConflictVerificationOutcome
                                .CONFLICT_NOT_REPRODUCED
        ) {

            response.put(
                    "message",
                    "The original face conflict was not reproduced. Retake the enrollment photo and try again."
            );

        } else if (
                result.outcome() ==
                        FaceConflictVerificationOutcome
                                .VERIFIED_DIFFERENT_PEOPLE
        ) {

            response.put(
                    "message",
                    "These students were previously verified as different people."
            );

        } else if (
                result.outcome() ==
                        FaceConflictVerificationOutcome
                                .CONFIRMED_SAME_PERSON
        ) {

            response.put(
                    "message",
                    "These student records were previously confirmed as the same physical person."
            );

        } else {

            response.put(
                    "message",
                    "Face conflict verification completed."
            );
        }

        return ResponseEntity
                .ok(
                        response
                );
    }

    /* =========================================================
       RESOLVE FACE CONFLICT
    ========================================================= */

    /**
     * Performs the final manual identity decision after
     * the second verification capture has reproduced the
     * original face conflict.
     *
     * Request body:
     *
     * {
     *     "decision": "DIFFERENT_PEOPLE"
     * }
     *
     * OR
     *
     * {
     *     "decision": "SAME_PERSON"
     * }
     */
    @PostMapping(
            value = "/{studentId}/face-conflicts/{conflictId}/resolve",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Map<String, Object>> resolveFaceConflict(
            @PathVariable String studentId,
            @PathVariable String conflictId,
            @RequestBody FaceConflictResolutionRequest request
    ) {

        FaceConflictResolutionResult result =
                studentFaceService
                        .resolveFaceConflict(
                                studentId,
                                conflictId,
                                request == null
                                        ? null
                                        : request.decision()
                        );

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "conflictId",
                result.conflictId()
        );

        response.put(
                "conflictStatus",
                result.conflictStatus().name()
        );

        response.put(
                "studentId",
                result.studentId()
        );

        response.put(
                "conflictingStudentId",
                result.conflictingStudentId()
        );

        response.put(
                "conflictingStudentName",
                result.conflictingStudentName()
        );

        response.put(
                "verifiedByUserId",
                result.verifiedByUserId()
        );

        response.put(
                "verifiedByName",
                result.verifiedByName()
        );

        response.put(
                "verifiedAt",
                result.verifiedAt()
        );

        // =====================================================
        // FINAL RESOLUTION MESSAGE
        // =====================================================

        if (
                result.conflictStatus() ==
                        StudentFaceConflictStatus
                                .VERIFIED_DIFFERENT_PEOPLE
        ) {

            response.put(
                    "message",
                    "The students were verified as different people. Separate face enrollment is now allowed."
            );

        } else if (
                result.conflictStatus() ==
                        StudentFaceConflictStatus
                                .CONFIRMED_SAME_PERSON
        ) {

            response.put(
                    "message",
                    "The student records were confirmed as the same physical person. Separate face enrollment remains blocked."
            );

        } else {

            response.put(
                    "message",
                    "Face conflict resolution completed."
            );
        }

        return ResponseEntity
                .ok(
                        response
                );
    }
}