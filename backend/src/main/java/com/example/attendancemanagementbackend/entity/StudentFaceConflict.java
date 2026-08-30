package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "student_face_conflicts",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_student_face_conflict_pair",
                        columnNames = {
                                "student_a_id",
                                "student_b_id"
                        }
                )
        }
)
public class StudentFaceConflict {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =========================================================
       STUDENT A
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "student_a_id",
            nullable = false
    )
    private Student studentA;

    /* =========================================================
       STUDENT B
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "student_b_id",
            nullable = false
    )
    private Student studentB;

    /* =========================================================
       INITIAL CONFLICT DISTANCE
    ========================================================= */

    @Column(
            name = "distance_at_detection",
            nullable = false
    )
    private double distanceAtDetection;

    /* =========================================================
       VERIFICATION STATUS
    ========================================================= */

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 50
    )
    private StudentFaceConflictStatus status =
            StudentFaceConflictStatus.PENDING;

    /* =========================================================
       SECOND CAPTURE VERIFICATION

       Set only when the second capture reproduces the
       original conflict and manual review becomes required.
    ========================================================= */

    @Column(
            name = "verification_distance"
    )
    private Double verificationDistance;

    @Column(
            name = "manual_review_required_at"
    )
    private LocalDateTime manualReviewRequiredAt;

    /* =========================================================
       VERIFIED BY
    ========================================================= */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "verified_by"
    )
    private User verifiedBy;

    /* =========================================================
       VERIFIED AT
    ========================================================= */

    @Column(
            name = "verified_at"
    )
    private LocalDateTime verifiedAt;

    /* =========================================================
       TIMESTAMPS
    ========================================================= */

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private LocalDateTime updatedAt;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public StudentFaceConflict() {
    }

    public StudentFaceConflict(
            Student studentA,
            Student studentB,
            double distanceAtDetection
    ) {

        this.studentA =
                studentA;

        this.studentB =
                studentB;

        this.distanceAtDetection =
                distanceAtDetection;

        this.status =
                StudentFaceConflictStatus.PENDING;

        this.createdAt =
                LocalDateTime.now();

        this.updatedAt =
                LocalDateTime.now();
    }

    /* =========================================================
       GETTERS / SETTERS
    ========================================================= */

    public String getId() {
        return id;
    }

    public Student getStudentA() {
        return studentA;
    }

    public void setStudentA(
            Student studentA
    ) {
        this.studentA = studentA;
    }

    public Student getStudentB() {
        return studentB;
    }

    public void setStudentB(
            Student studentB
    ) {
        this.studentB = studentB;
    }

    public double getDistanceAtDetection() {
        return distanceAtDetection;
    }

    public void setDistanceAtDetection(
            double distanceAtDetection
    ) {
        this.distanceAtDetection =
                distanceAtDetection;
    }

    public StudentFaceConflictStatus getStatus() {
        return status;
    }

    public void setStatus(
            StudentFaceConflictStatus status
    ) {
        this.status = status;
    }

    public Double getVerificationDistance() {
        return verificationDistance;
    }

    public void setVerificationDistance(
            Double verificationDistance
    ) {
        this.verificationDistance =
                verificationDistance;
    }

    public LocalDateTime getManualReviewRequiredAt() {
        return manualReviewRequiredAt;
    }

    public void setManualReviewRequiredAt(
            LocalDateTime manualReviewRequiredAt
    ) {
        this.manualReviewRequiredAt =
                manualReviewRequiredAt;
    }

    public User getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(
            User verifiedBy
    ) {
        this.verifiedBy = verifiedBy;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(
            LocalDateTime verifiedAt
    ) {
        this.verifiedAt = verifiedAt;
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