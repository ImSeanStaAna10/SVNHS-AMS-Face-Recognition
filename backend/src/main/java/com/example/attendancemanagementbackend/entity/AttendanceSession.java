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

    private LocalDateTime endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttendanceSessionStatus status;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public AttendanceSession() {
    }

    public AttendanceSession(
            Section section
    ) {
        this.section =
                section;

        this.attendanceDate =
                AppTime.today();

        this.startedAt =
                AppTime.now();

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
}