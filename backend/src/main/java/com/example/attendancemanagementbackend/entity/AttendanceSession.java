package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_sessions")
public class AttendanceSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "section_id",
            nullable = false
    )
    private Section section;

    @Column(nullable = false)
    private LocalDate attendanceDate;

    @Column(nullable = false)
    private LocalDateTime startedAt;

    /*
     * Number of minutes after the session starts
     * before students are considered LATE.
     *
     * Nullable for compatibility with older
     * attendance session records.
     */
    private Integer lateAfterMinutes;

    /*
     * Exact date and time when attendance
     * changes from PRESENT to LATE.
     *
     * Example:
     * startedAt = 7:30 AM
     * lateAfterMinutes = 15
     * lateCutoffAt = 7:45 AM
     */
    private LocalDateTime lateCutoffAt;

    /*
     * Optional automatic session end.
     *
     * null:
     * Session must be ended manually.
     *
     * non-null:
     * Session automatically expires at this time.
     */
    private LocalDateTime scheduledEndAt;

    private LocalDateTime endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttendanceSessionStatus status;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public AttendanceSession() {
    }

    /**
     * Legacy/basic constructor.
     *
     * Kept for compatibility, but new attendance
     * sessions should preferably use the constructor
     * containing the late and scheduled-end settings.
     */
    public AttendanceSession(
            Section section
    ) {

        LocalDateTime now =
                AppTime.now();

        this.section =
                section;

        this.attendanceDate =
                now.toLocalDate();

        this.startedAt =
                now;

        this.status =
                AttendanceSessionStatus.ACTIVE;
    }

    /**
     * Creates an attendance session with:
     *
     * - late attendance policy
     * - optional automatic ending
     */
    public AttendanceSession(
            Section section,
            Integer lateAfterMinutes,
            LocalDateTime scheduledEndAt
    ) {

        /*
         * Capture the start time once so all
         * derived timestamps use exactly the
         * same source timestamp.
         */
        LocalDateTime now =
                AppTime.now();

        this.section =
                section;

        this.attendanceDate =
                now.toLocalDate();

        this.startedAt =
                now;

        this.lateAfterMinutes =
                lateAfterMinutes;

        /*
         * Calculate the exact late cutoff
         * from the session start time.
         */
        if (lateAfterMinutes != null) {

            this.lateCutoffAt =
                    now.plusMinutes(
                            lateAfterMinutes
                    );
        }

        this.scheduledEndAt =
                scheduledEndAt;

        this.status =
                AttendanceSessionStatus.ACTIVE;
    }

    /* =========================================================
       GETTERS / SETTERS
    ========================================================= */

    public String getId() {
        return id;
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

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public Integer getLateAfterMinutes() {
        return lateAfterMinutes;
    }

    public void setLateAfterMinutes(
            Integer lateAfterMinutes
    ) {
        this.lateAfterMinutes =
                lateAfterMinutes;
    }

    public LocalDateTime getLateCutoffAt() {
        return lateCutoffAt;
    }

    public void setLateCutoffAt(
            LocalDateTime lateCutoffAt
    ) {
        this.lateCutoffAt =
                lateCutoffAt;
    }

    public LocalDateTime getScheduledEndAt() {
        return scheduledEndAt;
    }

    public void setScheduledEndAt(
            LocalDateTime scheduledEndAt
    ) {
        this.scheduledEndAt =
                scheduledEndAt;
    }

    public LocalDateTime getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(
            LocalDateTime endedAt
    ) {
        this.endedAt =
                endedAt;
    }

    public AttendanceSessionStatus getStatus() {
        return status;
    }

    public void setStatus(
            AttendanceSessionStatus status
    ) {
        this.status =
                status;
    }

    /* =========================================================
       SESSION HELPERS
    ========================================================= */

    /**
     * Returns true when this session
     * has automatic ending configured.
     */
    public boolean hasScheduledEnd() {

        return scheduledEndAt != null;
    }

    /**
     * Returns true when the configured
     * automatic end time has been reached.
     */
    public boolean isScheduledEndReached(
            LocalDateTime currentTime
    ) {

        return scheduledEndAt != null &&
                !currentTime.isBefore(
                        scheduledEndAt
                );
    }
}