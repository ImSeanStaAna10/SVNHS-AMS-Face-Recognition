package com.example.attendancemanagementbackend.dto.attendance;

public record AttendanceStudentReportResponse(

        String studentId,

        String studentNumber,

        String studentName,

        long sessions,

        long present,

        long late,

        long absent,

        double presentRate,

        double lateRate,

        double attendanceRate,

        double absenceRate

) {
}