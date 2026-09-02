package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "student_transfer_requests",
        indexes = {
                @Index(
                        name = "idx_student_transfer_student",
                        columnList = "student_id"
                ),
                @Index(
                        name = "idx_student_transfer_destination",
                        columnList = "destination_section_id"
                ),
                @Index(
                        name = "idx_student_transfer_status",
                        columnList = "status"
                )
        }
)
public class StudentTransferRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_section_id", nullable = false)
    private Section sourceSection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_section_id", nullable = false)
    private Section destinationSection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by_adviser_id", nullable = false)
    private User requestedByAdviser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_adviser_id")
    private User reviewedByAdviser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudentTransferRequestStatus status =
            StudentTransferRequestStatus.PENDING;

    @Column(length = 500)
    private String reason;

    @Column(length = 500)
    private String reviewNote;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime reviewedAt;

    public StudentTransferRequest() {
    }

    public StudentTransferRequest(
            Student student,
            Section sourceSection,
            Section destinationSection,
            User requestedByAdviser,
            String reason
    ) {
        this.student = student;
        this.sourceSection = sourceSection;
        this.destinationSection = destinationSection;
        this.requestedByAdviser = requestedByAdviser;
        this.reason = reason;
        this.status = StudentTransferRequestStatus.PENDING;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public Section getSourceSection() {
        return sourceSection;
    }

    public Section getDestinationSection() {
        return destinationSection;
    }

    public User getRequestedByAdviser() {
        return requestedByAdviser;
    }

    public User getReviewedByAdviser() {
        return reviewedByAdviser;
    }

    public void setReviewedByAdviser(User reviewedByAdviser) {
        this.reviewedByAdviser = reviewedByAdviser;
    }

    public StudentTransferRequestStatus getStatus() {
        return status;
    }

    public void setStatus(StudentTransferRequestStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }
}
