package com.example.attendancemanagementbackend.dto.attendance;

public record AttendanceReportSummaryResponse(

        long sections,

        long sessions,

        long students,

        long present,

        long late,

        long absent,

        long totalRecords,

        double presentRate,

        double lateRate,

        double attendanceRate,

        double absenceRate

) {
}