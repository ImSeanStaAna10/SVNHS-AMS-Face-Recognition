package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record AttendanceReportBatchGenerationResponse(

        AttendanceReportType reportType,

        LocalDate periodStart,

        LocalDate periodEnd,

        int totalSections,

        int generatedCount,

        int notGeneratedCount,

        LocalDateTime completedAt

) {
}