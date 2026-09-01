package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "student_verification_settings",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_student_verification_settings_student",
                        columnNames = "student_id"
                )
        }
)
public class StudentVerificationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /*
     * IMPORTANT:
     *
     * This table stores only which verification actions
     * are appropriate for the Student.
     *
     * It intentionally does NOT store:
     * - disability status
     * - diagnosis
     * - medical condition
     * - reason for an accommodation
     */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "student_id",
            nullable = false,
            unique = true
    )
    private Student student;

    /*
     * Default behavior:
     *
     * A Student with no special verification accommodation
     * may receive any of the three active-liveness challenges.
     */
    @Column(nullable = false)
    private boolean blinkAllowed = true;

    @Column(nullable = false)
    private boolean turnLeftAllowed = true;

    @Column(nullable = false)
    private boolean turnRightAllowed = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public StudentVerificationSettings() {
    }

    public StudentVerificationSettings(
            Student student
    ) {
        this.student =
                student;

        this.blinkAllowed =
                true;

        this.turnLeftAllowed =
                true;

        this.turnRightAllowed =
                true;

        LocalDateTime now =
                AppTime.now();

        this.createdAt =
                now;

        this.updatedAt =
                now;
    }

    @PrePersist
    private void onCreate() {

        LocalDateTime now =
                AppTime.now();

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
    private void onUpdate() {

        updatedAt =
                AppTime.now();
    }

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

    public boolean isBlinkAllowed() {
        return blinkAllowed;
    }

    public void setBlinkAllowed(
            boolean blinkAllowed
    ) {
        this.blinkAllowed =
                blinkAllowed;
    }

    public boolean isTurnLeftAllowed() {
        return turnLeftAllowed;
    }

    public void setTurnLeftAllowed(
            boolean turnLeftAllowed
    ) {
        this.turnLeftAllowed =
                turnLeftAllowed;
    }

    public boolean isTurnRightAllowed() {
        return turnRightAllowed;
    }

    public void setTurnRightAllowed(
            boolean turnRightAllowed
    ) {
        this.turnRightAllowed =
                turnRightAllowed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
