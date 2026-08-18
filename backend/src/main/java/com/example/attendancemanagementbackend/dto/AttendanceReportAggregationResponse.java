package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AttendanceReportAggregationResponse(

        String sectionId,

        String sectionName,

        String adviserId,

        String adviserName,

        AttendanceReportType reportType,

        LocalDate periodStart,

        LocalDate periodEnd,

        long sessionCount,

        long studentCount,

        long presentCount,

        long lateCount,

        long absentCount,

        long totalRecords,

        BigDecimal presentRate,

        BigDecimal lateRate,

        BigDecimal absenceRate,

        BigDecimal attendanceRate,

        List<AttendanceReportStudentSummary> students

) {
}