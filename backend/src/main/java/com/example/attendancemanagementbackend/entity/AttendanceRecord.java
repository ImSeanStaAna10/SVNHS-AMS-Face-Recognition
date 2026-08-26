package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "attendance_records",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_attendance_session_student",
                        columnNames = {
                                "session_id",
                                "student_id"
                        }
                )
        }
)
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "session_id",
            nullable = false
    )
    private AttendanceSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "student_id",
            nullable = false
    )
    private Student student;

    @Column(nullable = false)
    private LocalDateTime recordedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttendanceStatus status;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public AttendanceRecord() {
    }

    /**
     * Backward-compatible constructor.
     *
     * Existing code that creates attendance using:
     *
     * new AttendanceRecord(session, student)
     *
     * will continue to mark the student PRESENT.
     *
     * New attendance logic will later determine
     * PRESENT or LATE before creating the record.
     */
    public AttendanceRecord(
            AttendanceSession session,
            Student student
    ) {
        this(
                session,
                student,
                AttendanceStatus.PRESENT,
                AppTime.now()
        );
    }

    /**
     * Attendance record with an explicit status.
     *
     * Currently useful for:
     *
     * - PRESENT
     * - LATE
     * - ABSENT
     *
     * The record timestamp is generated using
     * the application's Philippine timezone.
     */
    public AttendanceRecord(
            AttendanceSession session,
            Student student,
            AttendanceStatus status
    ) {
        this(
                session,
                student,
                status,
                AppTime.now()
        );
    }

    /**
     * Attendance record with an explicit:
     *
     * - status
     * - recorded timestamp
     *
     * This is useful when the exact same timestamp
     * must be used both for determining attendance
     * status and saving the attendance record.
     *
     * Example:
     *
     * 7:44:59 -> PRESENT
     * 7:45:00 -> LATE
     *
     * Using one timestamp prevents tiny differences
     * between status calculation and recordedAt.
     */
    public AttendanceRecord(
            AttendanceSession session,
            Student student,
            AttendanceStatus status,
            LocalDateTime recordedAt
    ) {
        this.session =
                session;

        this.student =
                student;

        this.status =
                status;

        this.recordedAt =
                recordedAt;
    }

    /* =========================================================
       GETTERS / SETTERS
    ========================================================= */

    public String getId() {
        return id;
    }

    public AttendanceSession getSession() {
        return session;
    }

    public void setSession(
            AttendanceSession session
    ) {
        this.session =
                session;
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

    public LocalDateTime getRecordedAt() {
        return recordedAt;
    }

    public AttendanceStatus getStatus() {
        return status;
    }

    public void setStatus(
            AttendanceStatus status
    ) {
        this.status =
                status;
    }
}