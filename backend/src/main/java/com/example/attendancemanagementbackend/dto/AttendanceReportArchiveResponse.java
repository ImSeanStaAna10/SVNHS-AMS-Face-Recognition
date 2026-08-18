package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record AttendanceReportArchiveResponse(

        UUID id,

        String sectionId,

        String sectionName,

        String adviserId,

        String adviserName,

        AttendanceReportType reportType,

        LocalDate periodStart,

        LocalDate periodEnd,

        int studentCount,

        int sessionCount,

        int presentCount,

        int lateCount,

        int absentCount,

        BigDecimal attendanceRate,

        String pdfFileName,

        String excelFileName,

        LocalDateTime generatedAt,

        LocalDateTime updatedAt

) {

    public static AttendanceReportArchiveResponse from(
            AttendanceReportArchive archive
    ) {

        return new AttendanceReportArchiveResponse(

                archive.getId(),

                archive.getSectionId(),

                archive.getSectionName(),

                archive.getAdviserId(),

                archive.getAdviserName(),

                archive.getReportType(),

                archive.getPeriodStart(),

                archive.getPeriodEnd(),

                archive.getStudentCount(),

                archive.getSessionCount(),

                archive.getPresentCount(),

                archive.getLateCount(),

                archive.getAbsentCount(),

                archive.getAttendanceRate(),

                archive.getPdfFileName(),

                archive.getExcelFileName(),

                archive.getGeneratedAt(),

                archive.getUpdatedAt()
        );
    }
}