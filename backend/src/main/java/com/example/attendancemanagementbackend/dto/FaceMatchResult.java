package com.example.attendancemanagementbackend.dto;

public record FaceMatchResult(
        String studentId,
        double distance
) {
}