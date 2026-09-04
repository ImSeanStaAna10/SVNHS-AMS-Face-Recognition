package com.example.attendancemanagementbackend.event;

public record AttendanceSessionFinalizedEvent(
        String sessionId
) {
}