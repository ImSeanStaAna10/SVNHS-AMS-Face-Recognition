package com.example.attendancemanagementbackend.dto.liveness;

import com.example.attendancemanagementbackend.dto.FaceConflictVerificationOutcome;

import com.example.attendancemanagementbackend.entity.LivenessChallengePurpose;
import com.example.attendancemanagementbackend.entity.LivenessChallengeStatus;
import com.example.attendancemanagementbackend.entity.LivenessChallengeType;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

public record FaceConflictLivenessVerificationResponse(

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

        FaceConflictVerificationOutcome
        faceConflictVerificationOutcome,

        String conflictId,

        StudentFaceConflictStatus conflictStatus,

        String conflictingStudentId,

        String conflictingStudentName,

        Double verificationDistance

) {
}