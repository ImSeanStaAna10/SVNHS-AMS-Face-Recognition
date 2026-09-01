package com.example.attendancemanagementbackend.dto.liveness;

import com.example.attendancemanagementbackend.entity.LivenessChallengePurpose;
import com.example.attendancemanagementbackend.entity.LivenessChallengeStatus;
import com.example.attendancemanagementbackend.entity.LivenessChallengeType;

import java.time.LocalDateTime;

public record LivenessChallengeResponse(

        String challengeId,

        String studentId,

        LivenessChallengePurpose purpose,

        LivenessChallengeType challengeType,

        LivenessChallengeStatus status,

        LocalDateTime expiresAt,

        boolean assistedVerificationRequired

) {
}