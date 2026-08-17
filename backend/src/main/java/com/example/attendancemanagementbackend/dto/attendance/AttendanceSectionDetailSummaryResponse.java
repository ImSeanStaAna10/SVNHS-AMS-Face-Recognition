package com.example.attendancemanagementbackend.dto.attendance;

public record AttendanceSectionDetailSummaryResponse(

        long students,

        long sessions,

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