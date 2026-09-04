package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;

import java.time.LocalDate;
import java.util.List;

public class ParentNotificationPreviewResponse {

    private final String interventionId;

    private final String studentId;

    private final String studentNumber;

    private final String studentName;

    private final String guardianId;

    private final String guardianName;

    private final String guardianEmail;

    private final AttendanceRiskLevel riskLevel;

    private final int thresholdAbsenceCount;

    private final int interventionAbsenceCount;

    private final int currentAbsenceCount;

    private final boolean attendanceChangedSinceIntervention;

    private final LocalDate periodStart;

    private final LocalDate periodEnd;

    private final String subject;

    private final String suggestedAdviserNote;

    private final List<ParentNotificationAbsenceResponse> absences;

    public ParentNotificationPreviewResponse(
            String interventionId,
            String studentId,
            String studentNumber,
            String studentName,
            String guardianId,
            String guardianName,
            String guardianEmail,
            AttendanceRiskLevel riskLevel,
            int thresholdAbsenceCount,
            int interventionAbsenceCount,
            int currentAbsenceCount,
            boolean attendanceChangedSinceIntervention,
            LocalDate periodStart,
            LocalDate periodEnd,
            String subject,
            String suggestedAdviserNote,
            List<ParentNotificationAbsenceResponse> absences
    ) {
        this.interventionId =
                interventionId;

        this.studentId =
                studentId;

        this.studentNumber =
                studentNumber;

        this.studentName =
                studentName;

        this.guardianId =
                guardianId;

        this.guardianName =
                guardianName;

        this.guardianEmail =
                guardianEmail;

        this.riskLevel =
                riskLevel;

        this.thresholdAbsenceCount =
                thresholdAbsenceCount;

        this.interventionAbsenceCount =
                interventionAbsenceCount;

        this.currentAbsenceCount =
                currentAbsenceCount;

        this.attendanceChangedSinceIntervention =
                attendanceChangedSinceIntervention;

        this.periodStart =
                periodStart;

        this.periodEnd =
                periodEnd;

        this.subject =
                subject;

        this.suggestedAdviserNote =
                suggestedAdviserNote;

        this.absences =
                absences;
    }

    public String getInterventionId() {
        return interventionId;
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

    public String getGuardianId() {
        return guardianId;
    }

    public String getGuardianName() {
        return guardianName;
    }

    public String getGuardianEmail() {
        return guardianEmail;
    }

    public AttendanceRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public int getThresholdAbsenceCount() {
        return thresholdAbsenceCount;
    }

    public int getInterventionAbsenceCount() {
        return interventionAbsenceCount;
    }

    public int getCurrentAbsenceCount() {
        return currentAbsenceCount;
    }

    public boolean isAttendanceChangedSinceIntervention() {
        return attendanceChangedSinceIntervention;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public String getSubject() {
        return subject;
    }

    public String getSuggestedAdviserNote() {
        return suggestedAdviserNote;
    }

    public List<ParentNotificationAbsenceResponse> getAbsences() {
        return absences;
    }
}