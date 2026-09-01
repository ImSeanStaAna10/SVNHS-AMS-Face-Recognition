package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "liveness_challenges",
        indexes = {
                @Index(
                        name = "idx_liveness_challenge_status_expiry",
                        columnList = "status, expires_at"
                ),
                @Index(
                        name = "idx_liveness_challenge_student",
                        columnList = "student_id"
                ),
                @Index(
                        name = "idx_liveness_challenge_session",
                        columnList = "attendance_session_id"
                ),
                @Index(
                        name = "idx_liveness_challenge_face_conflict",
                        columnList = "face_conflict_id"
                )
        }
)
public class LivenessChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "challenge_type",
            nullable = false,
            length = 32
    )
    private LivenessChallengeType challengeType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "purpose",
            nullable = false,
            length = 48
    )
    private LivenessChallengePurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 24
    )
    private LivenessChallengeStatus status;

    /*
     * Student may be known immediately:
     *
     * - ENROLLMENT
     * - FACE_CONFLICT_VERIFICATION
     *
     * For ATTENDANCE, the Student will be the preliminary
     * section-scoped candidate selected before the challenge.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "student_id"
    )
    private Student student;

    /*
     * Required for ATTENDANCE challenges.
     *
     * Nullable for enrollment / conflict verification.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "attendance_session_id"
    )
    private AttendanceSession attendanceSession;

    /*
     * Required for FACE_CONFLICT_VERIFICATION challenges.
     *
     * This is intentionally stored SERVER-SIDE.
     *
     * Once the challenge is created, Spring does not trust
     * React to decide which face conflict the challenge belongs
     * to.
     *
     * Nullable for:
     *
     * - ENROLLMENT
     * - ATTENDANCE
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "face_conflict_id"
    )
    private StudentFaceConflict faceConflict;

    /*
     * Authenticated User ID that created the challenge.
     *
     * Stored as an immutable audit reference instead of
     * trusting the browser when the challenge is verified.
     */
    @Column(
            name = "created_by_user_id",
            nullable = false
    )
    private String createdByUserId;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @Column(
            name = "expires_at",
            nullable = false
    )
    private LocalDateTime expiresAt;

    @Column(
            name = "verified_at"
    )
    private LocalDateTime verifiedAt;

    @Column(
            name = "failure_reason",
            length = 120
    )
    private String failureReason;

    public LivenessChallenge() {
    }

    /* =========================================================
       EXISTING CONSTRUCTOR

       Retained for compatibility with existing enrollment and
       future attendance code.

       faceConflict defaults to null.
    ========================================================= */

    public LivenessChallenge(
            LivenessChallengeType challengeType,
            LivenessChallengePurpose purpose,
            Student student,
            AttendanceSession attendanceSession,
            String createdByUserId,
            LocalDateTime expiresAt
    ) {

        this(
                challengeType,
                purpose,
                student,
                attendanceSession,
                null,
                createdByUserId,
                expiresAt
        );
    }

    /* =========================================================
       FULL CONSTRUCTOR

       Used when a challenge needs an authoritative
       face-conflict binding.
    ========================================================= */

    public LivenessChallenge(
            LivenessChallengeType challengeType,
            LivenessChallengePurpose purpose,
            Student student,
            AttendanceSession attendanceSession,
            StudentFaceConflict faceConflict,
            String createdByUserId,
            LocalDateTime expiresAt
    ) {

        this.challengeType =
                challengeType;

        this.purpose =
                purpose;

        this.student =
                student;

        this.attendanceSession =
                attendanceSession;

        this.faceConflict =
                faceConflict;

        this.createdByUserId =
                createdByUserId;

        this.status =
                LivenessChallengeStatus.PENDING;

        this.createdAt =
                AppTime.now();

        this.expiresAt =
                expiresAt;
    }

    public String getId() {
        return id;
    }

    public LivenessChallengeType getChallengeType() {
        return challengeType;
    }

    public LivenessChallengePurpose getPurpose() {
        return purpose;
    }

    public LivenessChallengeStatus getStatus() {
        return status;
    }

    public Student getStudent() {
        return student;
    }

    public AttendanceSession getAttendanceSession() {
        return attendanceSession;
    }

    public StudentFaceConflict getFaceConflict() {
        return faceConflict;
    }

    public String getCreatedByUserId() {
        return createdByUserId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public boolean isExpired(
            LocalDateTime currentTime
    ) {

        return expiresAt != null &&
                !currentTime.isBefore(
                        expiresAt
                );
    }

    public void markVerifying() {

        this.status =
                LivenessChallengeStatus.VERIFYING;

        this.failureReason =
                null;
    }

    public void markPassed() {

        this.status =
                LivenessChallengeStatus.PASSED;

        this.verifiedAt =
                AppTime.now();

        this.failureReason =
                null;
    }

    public void markFailed(
            String failureReason
    ) {

        this.status =
                LivenessChallengeStatus.FAILED;

        this.verifiedAt =
                AppTime.now();

        this.failureReason =
                failureReason;
    }

    public void markExpired() {

        this.status =
                LivenessChallengeStatus.EXPIRED;

        this.failureReason =
                "CHALLENGE_EXPIRED";
    }
}