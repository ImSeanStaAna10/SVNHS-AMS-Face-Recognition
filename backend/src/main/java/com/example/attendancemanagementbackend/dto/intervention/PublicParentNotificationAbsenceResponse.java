package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PublicParentNotificationAbsenceResponse(

        LocalDate attendanceDate,

        LocalDateTime sessionStartedAt,

        LocalDateTime sessionEndedAt,

        AttendanceStatus status

) {
}