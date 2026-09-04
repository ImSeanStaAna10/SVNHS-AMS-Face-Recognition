package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "attendance_interventions",

        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_attendance_intervention_student_period_risk",
                        columnNames = {
                                "student_id",
                                "period_start",
                                "period_end",
                                "risk_level"
                        }
                )
        },

        indexes = {
                @Index(
                        name = "idx_attendance_interventions_student_id",
                        columnList = "student_id"
                ),

                @Index(
                        name = "idx_attendance_interventions_section_id",
                        columnList = "section_id"
                ),

                @Index(
                        name = "idx_attendance_interventions_status",
                        columnList = "status"
                ),

                @Index(
                        name = "idx_attendance_interventions_risk_level",
                        columnList = "risk_level"
                ),

                @Index(
                        name = "idx_attendance_interventions_trigger_session_id",
                        columnList = "trigger_session_id"
                )
        }
)
public class AttendanceIntervention {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =====================================================
       STUDENT
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "student_id",
            nullable = false
    )
    private Student student;

    /* =====================================================
       SECTION SNAPSHOT
    ===================================================== */

    /*
     * The Section where the student belonged when
     * this intervention was triggered.
     *
     * This is historical context only.
     *
     * If the student later transfers to another
     * Section, this intervention still retains
     * the Section that originally triggered it.
     */
    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "section_id",
            nullable = false
    )
    private Section section;

    /* =====================================================
       RISK LEVEL
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "risk_level",
            nullable = false,
            length = 30
    )
    private AttendanceRiskLevel riskLevel;

    /* =====================================================
       RISK PERIOD SNAPSHOT
    ===================================================== */

    /*
     * Freeze the configured attendance risk period
     * that was active when the intervention occurred.
     *
     * This prevents future configuration changes from
     * changing the historical meaning of this event.
     */
    @Column(
            name = "period_start",
            nullable = false
    )
    private LocalDate periodStart;

    @Column(
            name = "period_end",
            nullable = false
    )
    private LocalDate periodEnd;

    /* =====================================================
       ABSENCE SNAPSHOT
    ===================================================== */

    /*
     * Configured threshold that caused this event.
     *
     * Example:
     *
     * WARNING threshold = 2
     * AT_RISK threshold = 4
     * CRITICAL threshold = 6
     */
    @Column(
            name = "threshold_absence_count",
            nullable = false
    )
    private int thresholdAbsenceCount;

    /*
     * Actual calculated number of absences when
     * this intervention was created.
     *
     * Normally this will equal the threshold.
     *
     * It can be greater during future recalculation,
     * migration, or backfill workflows.
     */
    @Column(
            name = "actual_absence_count",
            nullable = false
    )
    private int actualAbsenceCount;

    /* =====================================================
       TRIGGER SESSION
    ===================================================== */

    /*
     * Attendance session whose finalization caused
     * this threshold evaluation.
     *
     * Nullable to keep the entity compatible with
     * possible future manual recalculation/backfill.
     */
    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "trigger_session_id"
    )
    private AttendanceSession triggerSession;

    /* =====================================================
       INTERVENTION STATUS
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private AttendanceInterventionStatus status =
            AttendanceInterventionStatus.OPEN;

    /* =====================================================
       REVIEW INFORMATION
    ===================================================== */

    /*
     * Keep this as a String user ID instead of a User entity
     * relationship for now.
     *
     * This avoids unnecessarily coupling the intervention
     * domain to the authentication/User entity graph.
     */
    @Column(
            name = "reviewed_by_user_id"
    )
    private String reviewedByUserId;

    private LocalDateTime reviewedAt;

    /* =====================================================
       RESOLUTION
    ===================================================== */

    private LocalDateTime resolvedAt;

    /* =====================================================
       TRIGGER TIME
    ===================================================== */

    @Column(
            nullable = false
    )
    private LocalDateTime triggeredAt;

    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @Column(
            nullable = false
    )
    private LocalDateTime updatedAt;

    /* =====================================================
       CONSTRUCTORS
    ===================================================== */

    public AttendanceIntervention() {
    }

    public AttendanceIntervention(
            Student student,
            Section section,
            AttendanceRiskLevel riskLevel,
            LocalDate periodStart,
            LocalDate periodEnd,
            int thresholdAbsenceCount,
            int actualAbsenceCount,
            AttendanceSession triggerSession
    ) {

        this.student =
                student;

        this.section =
                section;

        this.riskLevel =
                riskLevel;

        this.periodStart =
                periodStart;

        this.periodEnd =
                periodEnd;

        this.thresholdAbsenceCount =
                thresholdAbsenceCount;

        this.actualAbsenceCount =
                actualAbsenceCount;

        this.triggerSession =
                triggerSession;

        this.status =
                AttendanceInterventionStatus.OPEN;

        this.triggeredAt =
                AppTime.now();
    }

    /* =====================================================
       JPA LIFECYCLE
    ===================================================== */

    @PrePersist
    public void prePersist() {

        LocalDateTime now =
                AppTime.now();

        if (triggeredAt == null) {

            triggeredAt =
                    now;
        }

        if (status == null) {

            status =
                    AttendanceInterventionStatus.OPEN;
        }

        if (createdAt == null) {

            createdAt =
                    now;
        }

        if (updatedAt == null) {

            updatedAt =
                    now;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt =
                AppTime.now();
    }

    /* =====================================================
       GETTERS / SETTERS
    ===================================================== */

    public String getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(
            Student student
    ) {
        this.student =
                student;
    }

    public Section getSection() {
        return section;
    }

    public void setSection(
            Section section
    ) {
        this.section =
                section;
    }

    public AttendanceRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(
            AttendanceRiskLevel riskLevel
    ) {
        this.riskLevel =
                riskLevel;
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

    public int getThresholdAbsenceCount() {
        return thresholdAbsenceCount;
    }

    public void setThresholdAbsenceCount(
            int thresholdAbsenceCount
    ) {
        this.thresholdAbsenceCount =
                thresholdAbsenceCount;
    }

    public int getActualAbsenceCount() {
        return actualAbsenceCount;
    }

    public void setActualAbsenceCount(
            int actualAbsenceCount
    ) {
        this.actualAbsenceCount =
                actualAbsenceCount;
    }

    public AttendanceSession getTriggerSession() {
        return triggerSession;
    }

    public void setTriggerSession(
            AttendanceSession triggerSession
    ) {
        this.triggerSession =
                triggerSession;
    }

    public AttendanceInterventionStatus getStatus() {
        return status;
    }

    public void setStatus(
            AttendanceInterventionStatus status
    ) {
        this.status =
                status;
    }

    public String getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(
            String reviewedByUserId
    ) {
        this.reviewedByUserId =
                reviewedByUserId;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(
            LocalDateTime reviewedAt
    ) {
        this.reviewedAt =
                reviewedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(
            LocalDateTime resolvedAt
    ) {
        this.resolvedAt =
                resolvedAt;
    }

    public LocalDateTime getTriggeredAt() {
        return triggeredAt;
    }

    public void setTriggeredAt(
            LocalDateTime triggeredAt
    ) {
        this.triggeredAt =
                triggeredAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}