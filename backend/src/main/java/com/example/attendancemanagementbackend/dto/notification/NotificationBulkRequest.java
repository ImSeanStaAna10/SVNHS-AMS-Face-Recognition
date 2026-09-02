package com.example.attendancemanagementbackend.dto.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record NotificationBulkRequest(

        @NotEmpty(
                message = "At least one notification ID is required"
        )
        List<
                @NotBlank(
                        message = "Notification ID cannot be blank"
                )
                        String
                > notificationIds

) {
}