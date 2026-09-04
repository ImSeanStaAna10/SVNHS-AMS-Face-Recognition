package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceNotificationMode;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class AttendanceInterventionConfigRequest {

    private boolean enabled = true;

    @NotNull(
            message = "Risk period start date is required"
    )
    private LocalDate periodStart;

    @NotNull(
            message = "Risk period end date is required"
    )
    private LocalDate periodEnd;

    @Min(
            value = 1,
            message = "Warning absence count must be at least 1"
    )
    private int warningAbsenceCount;

    @Min(
            value = 1,
            message = "At-risk absence count must be at least 1"
    )
    private int atRiskAbsenceCount;

    @Min(
            value = 1,
            message = "Critical absence count must be at least 1"
    )
    private int criticalAbsenceCount;

    private boolean parentNotificationEnabled = true;

    @NotNull(
            message = "Warning notification mode is required"
    )
    private AttendanceNotificationMode
            warningNotificationMode;

    @NotNull(
            message = "At-risk notification mode is required"
    )
    private AttendanceNotificationMode
            atRiskNotificationMode;

    @NotNull(
            message = "Critical notification mode is required"
    )
    private AttendanceNotificationMode
            criticalNotificationMode;

    private boolean allowParentAcknowledgement = true;

    private boolean allowParentResponse = true;

    @Size(
            max = 2000,
            message = "Default adviser message must not exceed 2000 characters"
    )
    private String defaultAdviserMessage;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(
            boolean enabled
    ) {
        this.enabled = enabled;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(
            LocalDate periodStart
    ) {
        this.periodStart =
                periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(
            LocalDate periodEnd
    ) {
        this.periodEnd =
                periodEnd;
    }

    public int getWarningAbsenceCount() {
        return warningAbsenceCount;
    }

    public void setWarningAbsenceCount(
            int warningAbsenceCount
    ) {
        this.warningAbsenceCount =
                warningAbsenceCount;
    }

    public int getAtRiskAbsenceCount() {
        return atRiskAbsenceCount;
    }

    public void setAtRiskAbsenceCount(
            int atRiskAbsenceCount
    ) {
        this.atRiskAbsenceCount =
                atRiskAbsenceCount;
    }

    public int getCriticalAbsenceCount() {
        return criticalAbsenceCount;
    }

    public void setCriticalAbsenceCount(
            int criticalAbsenceCount
    ) {
        this.criticalAbsenceCount =
                criticalAbsenceCount;
    }

    public boolean isParentNotificationEnabled() {
        return parentNotificationEnabled;
    }

    public void setParentNotificationEnabled(
            boolean parentNotificationEnabled
    ) {
        this.parentNotificationEnabled =
                parentNotificationEnabled;
    }

    public AttendanceNotificationMode
    getWarningNotificationMode() {

        return warningNotificationMode;
    }

    public void setWarningNotificationMode(
            AttendanceNotificationMode warningNotificationMode
    ) {
        this.warningNotificationMode =
                warningNotificationMode;
    }

    public AttendanceNotificationMode
    getAtRiskNotificationMode() {

        return atRiskNotificationMode;
    }

    public void setAtRiskNotificationMode(
            AttendanceNotificationMode atRiskNotificationMode
    ) {
        this.atRiskNotificationMode =
                atRiskNotificationMode;
    }

    public AttendanceNotificationMode
    getCriticalNotificationMode() {

        return criticalNotificationMode;
    }

    public void setCriticalNotificationMode(
            AttendanceNotificationMode criticalNotificationMode
    ) {
        this.criticalNotificationMode =
                criticalNotificationMode;
    }

    public boolean isAllowParentAcknowledgement() {
        return allowParentAcknowledgement;
    }

    public void setAllowParentAcknowledgement(
            boolean allowParentAcknowledgement
    ) {
        this.allowParentAcknowledgement =
                allowParentAcknowledgement;
    }

    public boolean isAllowParentResponse() {
        return allowParentResponse;
    }

    public void setAllowParentResponse(
            boolean allowParentResponse
    ) {
        this.allowParentResponse =
                allowParentResponse;
    }

    public String getDefaultAdviserMessage() {
        return defaultAdviserMessage;
    }

    public void setDefaultAdviserMessage(
            String defaultAdviserMessage
    ) {
        this.defaultAdviserMessage =
                defaultAdviserMessage;
    }
}