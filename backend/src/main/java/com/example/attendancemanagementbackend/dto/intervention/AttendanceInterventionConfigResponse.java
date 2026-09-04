package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceNotificationMode;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class AttendanceInterventionConfigResponse {

    private String id;

    private String sectionId;

    private String sectionName;

    private boolean enabled;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private int warningAbsenceCount;

    private int atRiskAbsenceCount;

    private int criticalAbsenceCount;

    private boolean parentNotificationEnabled;

    private AttendanceNotificationMode
            warningNotificationMode;

    private AttendanceNotificationMode
            atRiskNotificationMode;

    private AttendanceNotificationMode
            criticalNotificationMode;

    private boolean allowParentAcknowledgement;

    private boolean allowParentResponse;

    private String defaultAdviserMessage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public AttendanceInterventionConfigResponse(
            String id,
            String sectionId,
            String sectionName,
            boolean enabled,
            LocalDate periodStart,
            LocalDate periodEnd,
            int warningAbsenceCount,
            int atRiskAbsenceCount,
            int criticalAbsenceCount,
            boolean parentNotificationEnabled,
            AttendanceNotificationMode warningNotificationMode,
            AttendanceNotificationMode atRiskNotificationMode,
            AttendanceNotificationMode criticalNotificationMode,
            boolean allowParentAcknowledgement,
            boolean allowParentResponse,
            String defaultAdviserMessage,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {

        this.id = id;

        this.sectionId = sectionId;

        this.sectionName = sectionName;

        this.enabled = enabled;

        this.periodStart = periodStart;

        this.periodEnd = periodEnd;

        this.warningAbsenceCount =
                warningAbsenceCount;

        this.atRiskAbsenceCount =
                atRiskAbsenceCount;

        this.criticalAbsenceCount =
                criticalAbsenceCount;

        this.parentNotificationEnabled =
                parentNotificationEnabled;

        this.warningNotificationMode =
                warningNotificationMode;

        this.atRiskNotificationMode =
                atRiskNotificationMode;

        this.criticalNotificationMode =
                criticalNotificationMode;

        this.allowParentAcknowledgement =
                allowParentAcknowledgement;

        this.allowParentResponse =
                allowParentResponse;

        this.defaultAdviserMessage =
                defaultAdviserMessage;

        this.createdAt =
                createdAt;

        this.updatedAt =
                updatedAt;
    }

    public String getId() {
        return id;
    }

    public String getSectionId() {
        return sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public int getWarningAbsenceCount() {
        return warningAbsenceCount;
    }

    public int getAtRiskAbsenceCount() {
        return atRiskAbsenceCount;
    }

    public int getCriticalAbsenceCount() {
        return criticalAbsenceCount;
    }

    public boolean isParentNotificationEnabled() {
        return parentNotificationEnabled;
    }

    public AttendanceNotificationMode
    getWarningNotificationMode() {

        return warningNotificationMode;
    }

    public AttendanceNotificationMode
    getAtRiskNotificationMode() {

        return atRiskNotificationMode;
    }

    public AttendanceNotificationMode
    getCriticalNotificationMode() {

        return criticalNotificationMode;
    }

    public boolean isAllowParentAcknowledgement() {
        return allowParentAcknowledgement;
    }

    public boolean isAllowParentResponse() {
        return allowParentResponse;
    }

    public String getDefaultAdviserMessage() {
        return defaultAdviserMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}