package com.example.attendancemanagementbackend.dto.attendance;

public record AttendanceSectionCardResponse(

        String sectionId,

        String sectionName,

        String adviserId,

        String adviserName,

        long sessionCount,

        long studentCount,

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