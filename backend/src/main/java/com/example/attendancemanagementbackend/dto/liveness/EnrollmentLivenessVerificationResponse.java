package com.example.attendancemanagementbackend.dto.liveness;

import com.example.attendancemanagementbackend.dto.FaceEnrollmentOutcome;
import com.example.attendancemanagementbackend.entity.LivenessChallengePurpose;
import com.example.attendancemanagementbackend.entity.LivenessChallengeStatus;
import com.example.attendancemanagementbackend.entity.LivenessChallengeType;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

public record EnrollmentLivenessVerificationResponse(

        String challengeId,

        String studentId,

        LivenessChallengePurpose purpose,

        LivenessChallengeType challengeType,

        LivenessChallengeStatus status,

        boolean passed,

        String reason,

        Integer embeddingDimensions,

        Double passiveLiveScore,

        Double maxContinuityDistance,

        FaceEnrollmentOutcome faceEnrollmentOutcome,

        String conflictId,

        StudentFaceConflictStatus conflictStatus,

        String conflictingStudentId,

        String conflictingStudentName,

        String conflictingSectionId,

        String conflictingSectionName,

        String conflictingDepartmentId,

        String conflictingDepartmentName,

        Double conflictDistance

) {
}