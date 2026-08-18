package com.example.attendancemanagementbackend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class AdviserAttendanceHistoryResponse {

    private String sessionId;

    private String sectionId;

    private String sectionName;

    private LocalDate attendanceDate;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    private String status;

    private long studentCount;

    private long presentCount;

    private long lateCount;

    private long absentCount;

    private double attendanceRate;

    public AdviserAttendanceHistoryResponse(
            String sessionId,
            String sectionId,
            String sectionName,
            LocalDate attendanceDate,
            LocalDateTime startedAt,
            LocalDateTime endedAt,
            String status,
            long studentCount,
            long presentCount,
            long lateCount,
            long absentCount,
            double attendanceRate
    ) {
        this.sessionId = sessionId;

        this.sectionId = sectionId;

        this.sectionName = sectionName;

        this.attendanceDate =
                attendanceDate;

        this.startedAt =
                startedAt;

        this.endedAt =
                endedAt;

        this.status =
                status;

        this.studentCount =
                studentCount;

        this.presentCount =
                presentCount;

        this.lateCount =
                lateCount;

        this.absentCount =
                absentCount;

        this.attendanceRate =
                attendanceRate;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getSectionId() {
        return sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getEndedAt() {
        return endedAt;
    }

    public String getStatus() {
        return status;
    }

    public long getStudentCount() {
        return studentCount;
    }

    public long getPresentCount() {
        return presentCount;
    }

    public long getLateCount() {
        return lateCount;
    }

    public long getAbsentCount() {
        return absentCount;
    }

    public double getAttendanceRate() {
        return attendanceRate;
    }
}