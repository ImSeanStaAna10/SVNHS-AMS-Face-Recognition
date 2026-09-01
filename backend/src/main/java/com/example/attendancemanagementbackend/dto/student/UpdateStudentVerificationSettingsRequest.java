package com.example.attendancemanagementbackend.dto.student;

public record UpdateStudentVerificationSettingsRequest(

        Boolean blinkAllowed,
        Boolean turnLeftAllowed,
        Boolean turnRightAllowed

) {
}
