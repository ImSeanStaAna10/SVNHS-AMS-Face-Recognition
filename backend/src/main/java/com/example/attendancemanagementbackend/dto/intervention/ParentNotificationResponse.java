package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.ParentNotificationSendMode;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import java.time.LocalDateTime;
import java.util.List;

public class ParentNotificationResponse {

    private final String id;

    private final String interventionId;

    private final String studentId;

    private final String guardianId;

    private final ParentNotificationSendMode sendMode;

    private final ParentNotificationStatus status;

    private final String recipientName;

    private final String recipientEmail;

    private final String studentNumber;

    private final String studentName;

    private final String subject;

    private final String adviserNote;

    private final int absenceCountAtSend;

    private final AttendanceRiskLevel riskLevelAtSend;

    private final LocalDateTime createdAt;

    private final List<ParentNotificationAbsenceResponse> absences;

    public ParentNotificationResponse(
            String id,
            String interventionId,
            String studentId,
            String guardianId,
            ParentNotificationSendMode sendMode,
            ParentNotificationStatus status,
            String recipientName,
            String recipientEmail,
            String studentNumber,
            String studentName,
            String subject,
            String adviserNote,
            int absenceCountAtSend,
            AttendanceRiskLevel riskLevelAtSend,
            LocalDateTime createdAt,
            List<ParentNotificationAbsenceResponse> absences
    ) {
        this.id = id;
        this.interventionId = interventionId;
        this.studentId = studentId;
        this.guardianId = guardianId;
        this.sendMode = sendMode;
        this.status = status;
        this.recipientName = recipientName;
        this.recipientEmail = recipientEmail;
        this.studentNumber = studentNumber;
        this.studentName = studentName;
        this.subject = subject;
        this.adviserNote = adviserNote;
        this.absenceCountAtSend = absenceCountAtSend;
        this.riskLevelAtSend = riskLevelAtSend;
        this.createdAt = createdAt;
        this.absences = absences;
    }

    public String getId() {
        return id;
    }

    public String getInterventionId() {
        return interventionId;
    }

    public String getStudentId() {
        return studentId;
    }

    public String getGuardianId() {
        return guardianId;
    }

    public ParentNotificationSendMode getSendMode() {
        return sendMode;
    }

    public ParentNotificationStatus getStatus() {
        return status;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public String getStudentName() {
        return studentName;
    }

    public String getSubject() {
        return subject;
    }

    public String getAdviserNote() {
        return adviserNote;
    }

    public int getAbsenceCountAtSend() {
        return absenceCountAtSend;
    }

    public AttendanceRiskLevel getRiskLevelAtSend() {
        return riskLevelAtSend;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public List<ParentNotificationAbsenceResponse> getAbsences() {
        return absences;
    }
}