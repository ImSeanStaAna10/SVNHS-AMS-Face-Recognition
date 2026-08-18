package com.example.attendancemanagementbackend.dto;

import java.math.BigDecimal;

public record AttendanceReportStudentSummary(

        String studentId,

        String studentNumber,

        String studentName,

        long sessionCount,

        long presentCount,

        long lateCount,

        long absentCount,

        long totalRecords,

        BigDecimal presentRate,

        BigDecimal lateRate,

        BigDecimal absenceRate,

        BigDecimal attendanceRate

) {
}