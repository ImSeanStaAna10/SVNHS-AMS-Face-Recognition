package com.example.attendancemanagementbackend.dto;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        boolean success,
        int status,
        String error,
        String message,
        String path,
        LocalDateTime timestamp
) {
}