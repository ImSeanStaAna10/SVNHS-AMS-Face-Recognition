package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

public record FaceEnrollmentResult(

        FaceEnrollmentOutcome outcome,

        String studentId,

        String conflictId,

        StudentFaceConflictStatus conflictStatus,

        String conflictingStudentId,

        String conflictingStudentName,

        String conflictingSectionId,

        String conflictingSectionName,

        String conflictingDepartmentId,

        String conflictingDepartmentName,

        Double distance

) {

    /* =========================================================
       ENROLLED RESULT
    ========================================================= */

    public static FaceEnrollmentResult enrolled(
            String studentId
    ) {

        return new FaceEnrollmentResult(
                FaceEnrollmentOutcome.ENROLLED,
                studentId,
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

    /* =========================================================
       FACE CONFLICT RESULT
    ========================================================= */

    public static FaceEnrollmentResult conflict(
            String studentId,
            String conflictId,
            StudentFaceConflictStatus conflictStatus,
            String conflictingStudentId,
            String conflictingStudentName,
            String conflictingSectionId,
            String conflictingSectionName,
            String conflictingDepartmentId,
            String conflictingDepartmentName,
            Double distance
    ) {

        return new FaceEnrollmentResult(
                FaceEnrollmentOutcome.FACE_CONFLICT,
                studentId,
                conflictId,
                conflictStatus,
                conflictingStudentId,
                conflictingStudentName,
                conflictingSectionId,
                conflictingSectionName,
                conflictingDepartmentId,
                conflictingDepartmentName,
                distance
        );
    }
}