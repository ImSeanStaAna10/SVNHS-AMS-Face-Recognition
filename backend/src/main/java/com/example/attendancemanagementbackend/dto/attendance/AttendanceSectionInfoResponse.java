package com.example.attendancemanagementbackend.dto.attendance;

public record AttendanceSectionInfoResponse(

        String sectionId,

        String sectionName,

        String adviserId,

        String adviserName

) {
}