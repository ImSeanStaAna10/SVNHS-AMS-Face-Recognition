package com.example.attendancemanagementbackend.dto.intervention;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ParentNotificationResponseRequest(

        @NotBlank(
                message = "Parent response is required"
        )
        @Size(
                max = 2000,
                message = "Parent response must not exceed 2000 characters"
        )
        String response

) {
}