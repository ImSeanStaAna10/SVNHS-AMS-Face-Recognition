package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "student_guardians",
        indexes = {
                @Index(
                        name = "idx_student_guardians_student_id",
                        columnList = "student_id"
                ),
                @Index(
                        name = "idx_student_guardians_email",
                        columnList = "email"
                )
        }
)
public class StudentGuardian {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "student_id",
            nullable = false
    )
    private Student student;

    @Column(
            nullable = false,
            length = 150
    )
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private GuardianRelationship relationship;

    @Column(
            nullable = false,
            length = 255
    )
    private String email;

    /**
     * V1 uses one primary guardian from Student Management,
     * but the data model already supports multiple guardians
     * per student later.
     */
    @Column(nullable = false)
    private boolean primaryGuardian = true;

    /**
     * Controls whether this guardian can receive attendance
     * risk / absence notifications.
     */
    @Column(nullable = false)
    private boolean receiveAttendanceNotifications = true;

    @Column(nullable = false)
    private boolean active = true;

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public StudentGuardian() {
    }

    public StudentGuardian(
            Student student,
            String name,
            GuardianRelationship relationship,
            String email,
            boolean receiveAttendanceNotifications
    ) {
        this.student = student;
        this.name = name;
        this.relationship = relationship;
        this.email = email;
        this.primaryGuardian = true;
        this.receiveAttendanceNotifications =
                receiveAttendanceNotifications;
        this.active = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
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

    public Student getStudent() {
        return student;
    }

    public void setStudent(
            Student student
    ) {
        this.student = student;
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }

    public GuardianRelationship getRelationship() {
        return relationship;
    }

    public void setRelationship(
            GuardianRelationship relationship
    ) {
        this.relationship = relationship;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(
            String email
    ) {
        this.email = email;
    }

    public boolean isPrimaryGuardian() {
        return primaryGuardian;
    }

    public void setPrimaryGuardian(
            boolean primaryGuardian
    ) {
        this.primaryGuardian =
                primaryGuardian;
    }

    public boolean isReceiveAttendanceNotifications() {
        return receiveAttendanceNotifications;
    }

    public void setReceiveAttendanceNotifications(
            boolean receiveAttendanceNotifications
    ) {
        this.receiveAttendanceNotifications =
                receiveAttendanceNotifications;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(
            boolean active
    ) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(
            LocalDateTime updatedAt
    ) {
        this.updatedAt = updatedAt;
    }
}