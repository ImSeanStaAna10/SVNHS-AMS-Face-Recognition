package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "parent_notification_absences",

        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_parent_notification_absence_record",
                        columnNames = {
                                "notification_id",
                                "attendance_record_id"
                        }
                )
        },

        indexes = {
                @Index(
                        name = "idx_parent_notification_absences_notification_id",
                        columnList = "notification_id"
                ),

                @Index(
                        name = "idx_parent_notification_absences_record_id",
                        columnList = "attendance_record_id"
                )
        }
)
public class ParentNotificationAbsence {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =====================================================
       PARENT NOTIFICATION
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "notification_id",
            nullable = false
    )
    private ParentNotification notification;

    /* =====================================================
       ORIGINAL ATTENDANCE REFERENCE
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "attendance_record_id",
            nullable = false
    )
    private AttendanceRecord attendanceRecord;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "attendance_session_id",
            nullable = false
    )
    private AttendanceSession attendanceSession;

    /* =====================================================
       FROZEN SNAPSHOT
    ===================================================== */

    @Column(
            name = "attendance_date",
            nullable = false
    )
    private LocalDate attendanceDate;

    @Column(
            name = "session_started_at",
            nullable = false
    )
    private LocalDateTime sessionStartedAt;

    @Column(
            name = "session_ended_at",
            nullable = false
    )
    private LocalDateTime sessionEndedAt;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status_at_send",
            nullable = false,
            length = 30
    )
    private AttendanceStatus statusAtSend;

    /* =====================================================
       TIMESTAMP
    ===================================================== */

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    /* =====================================================
       CONSTRUCTORS
    ===================================================== */

    public ParentNotificationAbsence() {
    }

    public ParentNotificationAbsence(
            ParentNotification notification,
            AttendanceRecord attendanceRecord,
            AttendanceSession attendanceSession,
            LocalDate attendanceDate,
            LocalDateTime sessionStartedAt,
            LocalDateTime sessionEndedAt,
            AttendanceStatus statusAtSend
    ) {

        this.notification =
                notification;

        this.attendanceRecord =
                attendanceRecord;

        this.attendanceSession =
                attendanceSession;

        this.attendanceDate =
                attendanceDate;

        this.sessionStartedAt =
                sessionStartedAt;

        this.sessionEndedAt =
                sessionEndedAt;

        this.statusAtSend =
                statusAtSend;
    }

    @PrePersist
    public void prePersist() {

        if (createdAt == null) {

            createdAt =
                    AppTime.now();
        }
    }

    /* =====================================================
       GETTERS / SETTERS
    ===================================================== */

    public String getId() {
        return id;
    }

    public ParentNotification getNotification() {
        return notification;
    }

    public void setNotification(
            ParentNotification notification
    ) {
        this.notification =
                notification;
    }

    public AttendanceRecord getAttendanceRecord() {
        return attendanceRecord;
    }

    public void setAttendanceRecord(
            AttendanceRecord attendanceRecord
    ) {
        this.attendanceRecord =
                attendanceRecord;
    }

    public AttendanceSession getAttendanceSession() {
        return attendanceSession;
    }

    public void setAttendanceSession(
            AttendanceSession attendanceSession
    ) {
        this.attendanceSession =
                attendanceSession;
    }

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public void setAttendanceDate(
            LocalDate attendanceDate
    ) {
        this.attendanceDate =
                attendanceDate;
    }

    public LocalDateTime getSessionStartedAt() {
        return sessionStartedAt;
    }

    public void setSessionStartedAt(
            LocalDateTime sessionStartedAt
    ) {
        this.sessionStartedAt =
                sessionStartedAt;
    }

    public LocalDateTime getSessionEndedAt() {
        return sessionEndedAt;
    }

    public void setSessionEndedAt(
            LocalDateTime sessionEndedAt
    ) {
        this.sessionEndedAt =
                sessionEndedAt;
    }

    public AttendanceStatus getStatusAtSend() {
        return statusAtSend;
    }

    public void setStatusAtSend(
            AttendanceStatus statusAtSend
    ) {
        this.statusAtSend =
                statusAtSend;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}