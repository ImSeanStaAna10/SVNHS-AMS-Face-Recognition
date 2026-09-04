package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "attendance_intervention_configs",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_attendance_intervention_config_section",
                        columnNames = "section_id"
                )
        },
        indexes = {
                @Index(
                        name = "idx_attendance_intervention_config_section_id",
                        columnList = "section_id"
                )
        }
)
public class AttendanceInterventionConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =====================================================
       SECTION
    ===================================================== */

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "section_id",
            nullable = false,
            unique = true
    )
    private Section section;

    /* =====================================================
       CONFIG STATUS
    ===================================================== */

    @Column(nullable = false)
    private boolean enabled = true;

    /* =====================================================
       RISK PERIOD
    ===================================================== */

    /*
     * Only finalized attendance sessions inside this
     * period will eventually be considered by the
     * attendance risk engine.
     */
    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false)
    private LocalDate periodEnd;

    /* =====================================================
       ABSENCE THRESHOLDS
    ===================================================== */

    @Column(nullable = false)
    private int warningAbsenceCount;

    @Column(nullable = false)
    private int atRiskAbsenceCount;

    @Column(nullable = false)
    private int criticalAbsenceCount;

    /* =====================================================
       PARENT NOTIFICATION
    ===================================================== */

    @Column(nullable = false)
    private boolean parentNotificationEnabled = true;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    private AttendanceNotificationMode warningNotificationMode =
            AttendanceNotificationMode.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    private AttendanceNotificationMode atRiskNotificationMode =
            AttendanceNotificationMode.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    private AttendanceNotificationMode criticalNotificationMode =
            AttendanceNotificationMode.MANUAL;

    /* =====================================================
       PARENT NOTICE OPTIONS
    ===================================================== */

    @Column(nullable = false)
    private boolean allowParentAcknowledgement = true;

    @Column(nullable = false)
    private boolean allowParentResponse = true;

    @Column(
            columnDefinition = "TEXT"
    )
    private String defaultAdviserMessage;

    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public AttendanceInterventionConfig() {
    }

    public AttendanceInterventionConfig(
            Section section,
            LocalDate periodStart,
            LocalDate periodEnd,
            int warningAbsenceCount,
            int atRiskAbsenceCount,
            int criticalAbsenceCount
    ) {

        this.section = section;

        this.periodStart = periodStart;

        this.periodEnd = periodEnd;

        this.warningAbsenceCount =
                warningAbsenceCount;

        this.atRiskAbsenceCount =
                atRiskAbsenceCount;

        this.criticalAbsenceCount =
                criticalAbsenceCount;

        this.enabled = true;

        this.parentNotificationEnabled = true;

        this.warningNotificationMode =
                AttendanceNotificationMode.MANUAL;

        this.atRiskNotificationMode =
                AttendanceNotificationMode.MANUAL;

        this.criticalNotificationMode =
                AttendanceNotificationMode.MANUAL;

        this.allowParentAcknowledgement = true;

        this.allowParentResponse = true;
    }

    @PrePersist
    public void prePersist() {

        LocalDateTime now =
                LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt =
                LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public Section getSection() {
        return section;
    }

    public void setSection(
            Section section
    ) {
        this.section = section;
    }

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}