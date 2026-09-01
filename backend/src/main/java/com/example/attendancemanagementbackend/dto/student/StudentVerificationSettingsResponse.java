package com.example.attendancemanagementbackend.dto.student;

import java.util.List;

public record StudentVerificationSettingsResponse(

        String studentId,
        boolean blinkAllowed,
        boolean turnLeftAllowed,
        boolean turnRightAllowed,
        boolean assistedVerificationRequired,
        List<String> allowedChallenges

) {
}
