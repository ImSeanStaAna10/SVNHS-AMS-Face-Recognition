package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class ParentNotificationAbsenceResponse {

    private final String attendanceRecordId;

    private final String attendanceSessionId;

    private final LocalDate attendanceDate;

    private final LocalDateTime sessionStartedAt;

    private final LocalDateTime sessionEndedAt;

    private final AttendanceStatus status;

    public ParentNotificationAbsenceResponse(
            String attendanceRecordId,
            String attendanceSessionId,
            LocalDate attendanceDate,
            LocalDateTime sessionStartedAt,
            LocalDateTime sessionEndedAt,
            AttendanceStatus status
    ) {
        this.attendanceRecordId =
                attendanceRecordId;

        this.attendanceSessionId =
                attendanceSessionId;

        this.attendanceDate =
                attendanceDate;

        this.sessionStartedAt =
                sessionStartedAt;

        this.sessionEndedAt =
                sessionEndedAt;

        this.status =
                status;
    }

    public String getAttendanceRecordId() {
        return attendanceRecordId;
    }

    public String getAttendanceSessionId() {
        return attendanceSessionId;
    }

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public LocalDateTime getSessionStartedAt() {
        return sessionStartedAt;
    }

    public LocalDateTime getSessionEndedAt() {
        return sessionEndedAt;
    }

    public AttendanceStatus getStatus() {
        return status;
    }
}