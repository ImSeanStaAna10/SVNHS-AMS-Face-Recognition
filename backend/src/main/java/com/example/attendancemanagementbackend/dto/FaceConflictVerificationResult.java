package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

public record FaceConflictVerificationResult(

        FaceConflictVerificationOutcome outcome,

        String conflictId,

        StudentFaceConflictStatus conflictStatus,

        String studentId,

        String conflictingStudentId,

        String conflictingStudentName,

        Double distance

) {

    public static FaceConflictVerificationResult manualReviewRequired(
            String conflictId,
            StudentFaceConflictStatus conflictStatus,
            String studentId,
            String conflictingStudentId,
            String conflictingStudentName,
            Double distance
    ) {

        return new FaceConflictVerificationResult(
                FaceConflictVerificationOutcome.MANUAL_REVIEW_REQUIRED,
                conflictId,
                conflictStatus,
                studentId,
                conflictingStudentId,
                conflictingStudentName,
                distance
        );
    }

    public static FaceConflictVerificationResult conflictNotReproduced(
            String conflictId,
            StudentFaceConflictStatus conflictStatus,
            String studentId,
            String conflictingStudentId,
            String conflictingStudentName,
            Double distance
    ) {

        return new FaceConflictVerificationResult(
                FaceConflictVerificationOutcome.CONFLICT_NOT_REPRODUCED,
                conflictId,
                conflictStatus,
                studentId,
                conflictingStudentId,
                conflictingStudentName,
                distance
        );
    }

    public static FaceConflictVerificationResult verifiedDifferentPeople(
            String conflictId,
            String studentId,
            String conflictingStudentId,
            String conflictingStudentName
    ) {

        return new FaceConflictVerificationResult(
                FaceConflictVerificationOutcome.VERIFIED_DIFFERENT_PEOPLE,
                conflictId,
                StudentFaceConflictStatus.VERIFIED_DIFFERENT_PEOPLE,
                studentId,
                conflictingStudentId,
                conflictingStudentName,
                null
        );
    }

    public static FaceConflictVerificationResult confirmedSamePerson(
            String conflictId,
            String studentId,
            String conflictingStudentId,
            String conflictingStudentName
    ) {

        return new FaceConflictVerificationResult(
                FaceConflictVerificationOutcome.CONFIRMED_SAME_PERSON,
                conflictId,
                StudentFaceConflictStatus.CONFIRMED_SAME_PERSON,
                studentId,
                conflictingStudentId,
                conflictingStudentName,
                null
        );
    }
}