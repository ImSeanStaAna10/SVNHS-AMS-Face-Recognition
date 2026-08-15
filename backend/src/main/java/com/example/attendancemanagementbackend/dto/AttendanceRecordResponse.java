package com.example.attendancemanagementbackend.dto;

import java.time.LocalDateTime;

public class AttendanceRecordResponse {

    private String attendanceRecordId;
    private String sessionId;
    private String studentId;
    private String studentNumber;
    private String studentName;
    private LocalDateTime recordedAt;
    private String status;

    public AttendanceRecordResponse(
            String attendanceRecordId,
            String sessionId,
            String studentId,
            String studentNumber,
            String studentName,
            LocalDateTime recordedAt,
            String status
    ) {
        this.attendanceRecordId = attendanceRecordId;
        this.sessionId = sessionId;
        this.studentId = studentId;
        this.studentNumber = studentNumber;
        this.studentName = studentName;
        this.recordedAt = recordedAt;
        this.status = status;
    }

    public String getAttendanceRecordId() {
        return attendanceRecordId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getStudentId() {
        return studentId;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public String getStudentName() {
        return studentName;
    }

    public LocalDateTime getRecordedAt() {
        return recordedAt;
    }

    public String getStatus() {
        return status;
    }
}