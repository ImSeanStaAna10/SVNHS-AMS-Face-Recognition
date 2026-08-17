package com.example.attendancemanagementbackend.entity;

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

    public AttendanceRecord() {
    }

    /**
     * Default attendance record.
     * Manual and face recognition attendance
     * automatically mark the student PRESENT.
     */
    public AttendanceRecord(
            AttendanceSession session,
            Student student
    ) {
        this(
                session,
                student,
                AttendanceStatus.PRESENT
        );
    }

    /**
     * Attendance record with explicit status.
     * Used when finalizing a session and marking
     * students without attendance as ABSENT.
     */
    public AttendanceRecord(
            AttendanceSession session,
            Student student,
            AttendanceStatus status
    ) {
        this.session = session;
        this.student = student;
        this.status = status;
        this.recordedAt = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public AttendanceSession getSession() {
        return session;
    }

    public void setSession(
            AttendanceSession session
    ) {
        this.session = session;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(
            Student student
    ) {
        this.student = student;
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
        this.status = status;
    }
}