package com.example.attendancemanagementbackend.dto;

public record AttendanceOverviewResponse(
        String sessionId,
        String sectionId,
        String sectionName,
        String adviserId,
        String adviserName,
        String attendanceDate,
        int totalStudents,
        int present,
        int absent,
        double attendanceRate
) {
}