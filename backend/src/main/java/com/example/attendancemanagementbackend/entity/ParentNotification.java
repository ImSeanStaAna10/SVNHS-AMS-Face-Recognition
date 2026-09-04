package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "parent_notifications",

        indexes = {
                @Index(
                        name = "idx_parent_notifications_intervention_id",
                        columnList = "intervention_id"
                ),

                @Index(
                        name = "idx_parent_notifications_student_id",
                        columnList = "student_id"
                ),

                @Index(
                        name = "idx_parent_notifications_guardian_id",
                        columnList = "guardian_id"
                ),

                @Index(
                        name = "idx_parent_notifications_status",
                        columnList = "status"
                ),

                @Index(
                        name = "idx_parent_notifications_token_hash",
                        columnList = "acknowledgement_token_hash"
                )
        }
)
public class ParentNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =====================================================
       SOURCE INTERVENTION
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "intervention_id",
            nullable = false
    )
    private AttendanceIntervention intervention;

    /* =====================================================
       STUDENT
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "student_id",
            nullable = false
    )
    private Student student;

    /* =====================================================
       GUARDIAN
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "guardian_id",
            nullable = false
    )
    private StudentGuardian guardian;

    /* =====================================================
       SEND MODE
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "send_mode",
            nullable = false,
            length = 20
    )
    private ParentNotificationSendMode sendMode;

    /* =====================================================
       STATUS
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private ParentNotificationStatus status =
            ParentNotificationStatus.PENDING;

    /* =====================================================
       RECIPIENT SNAPSHOT

       These values are frozen.

       If guardian information changes later,
       historical notification data remains unchanged.
    ===================================================== */

    @Column(
            name = "recipient_name",
            nullable = false,
            length = 150
    )
    private String recipientName;

    @Column(
            name = "recipient_email",
            nullable = false,
            length = 255
    )
    private String recipientEmail;

    /* =====================================================
       STUDENT SNAPSHOT
    ===================================================== */

    @Column(
            name = "student_number_at_send",
            nullable = false,
            length = 50
    )
    private String studentNumberAtSend;

    @Column(
            name = "student_name_at_send",
            nullable = false,
            length = 150
    )
    private String studentNameAtSend;

    /* =====================================================
       EMAIL CONTENT
    ===================================================== */

    @Column(
            nullable = false,
            length = 255
    )
    private String subject;

    @Column(
            name = "adviser_note",
            columnDefinition = "TEXT"
    )
    private String adviserNote;

    /* =====================================================
       ATTENDANCE SNAPSHOT
    ===================================================== */

    @Column(
            name = "absence_count_at_send",
            nullable = false
    )
    private int absenceCountAtSend;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "risk_level_at_send",
            nullable = false,
            length = 30
    )
    private AttendanceRiskLevel riskLevelAtSend;

    /* =====================================================
       DELIVERY STATE
    ===================================================== */

    private LocalDateTime queuedAt;

    private LocalDateTime sentAt;

    private LocalDateTime failedAt;

    @Column(
            name = "failure_reason",
            columnDefinition = "TEXT"
    )
    private String failureReason;

    /* =====================================================
       SECURE PARENT ACCESS

       The raw token will NEVER be stored.

       Later:
       raw random token
            ↓
       SHA-256
            ↓
       store only hash here.
    ===================================================== */

    @Column(
            name = "acknowledgement_token_hash",
            length = 64,
            unique = true
    )
    private String acknowledgementTokenHash;

    private LocalDateTime tokenExpiresAt;

    private LocalDateTime acknowledgedAt;

    /* =====================================================
       PARENT RESPONSE
    ===================================================== */

    @Column(
            name = "parent_response",
            columnDefinition = "TEXT"
    )
    private String parentResponse;

    private LocalDateTime respondedAt;

    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    @Column(
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    /* =====================================================
       CONSTRUCTORS
    ===================================================== */

    public ParentNotification() {
    }

    public ParentNotification(
            AttendanceIntervention intervention,
            Student student,
            StudentGuardian guardian,
            ParentNotificationSendMode sendMode,
            String recipientName,
            String recipientEmail,
            String studentNumberAtSend,
            String studentNameAtSend,
            String subject,
            String adviserNote,
            int absenceCountAtSend,
            AttendanceRiskLevel riskLevelAtSend
    ) {

        this.intervention =
                intervention;

        this.student =
                student;

        this.guardian =
                guardian;

        this.sendMode =
                sendMode;

        this.recipientName =
                recipientName;

        this.recipientEmail =
                recipientEmail;

        this.studentNumberAtSend =
                studentNumberAtSend;

        this.studentNameAtSend =
                studentNameAtSend;

        this.subject =
                subject;

        this.adviserNote =
                adviserNote;

        this.absenceCountAtSend =
                absenceCountAtSend;

        this.riskLevelAtSend =
                riskLevelAtSend;

        this.status =
                ParentNotificationStatus.PENDING;
    }

    /* =====================================================
       JPA LIFECYCLE
    ===================================================== */

    @PrePersist
    public void prePersist() {

        LocalDateTime now =
                AppTime.now();

        if (status == null) {
            status =
                    ParentNotificationStatus.PENDING;
        }

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
    public void preUpdate() {

        updatedAt =
                AppTime.now();
    }

    /* =====================================================
       GETTERS / SETTERS
    ===================================================== */

    public String getId() {
        return id;
    }

    public AttendanceIntervention getIntervention() {
        return intervention;
    }

    public void setIntervention(
            AttendanceIntervention intervention
    ) {
        this.intervention =
                intervention;
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

    public StudentGuardian getGuardian() {
        return guardian;
    }

    public void setGuardian(
            StudentGuardian guardian
    ) {
        this.guardian =
                guardian;
    }

    public ParentNotificationSendMode getSendMode() {
        return sendMode;
    }

    public void setSendMode(
            ParentNotificationSendMode sendMode
    ) {
        this.sendMode =
                sendMode;
    }

    public ParentNotificationStatus getStatus() {
        return status;
    }

    public void setStatus(
            ParentNotificationStatus status
    ) {
        this.status =
                status;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(
            String recipientName
    ) {
        this.recipientName =
                recipientName;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public void setRecipientEmail(
            String recipientEmail
    ) {
        this.recipientEmail =
                recipientEmail;
    }

    public String getStudentNumberAtSend() {
        return studentNumberAtSend;
    }

    public void setStudentNumberAtSend(
            String studentNumberAtSend
    ) {
        this.studentNumberAtSend =
                studentNumberAtSend;
    }

    public String getStudentNameAtSend() {
        return studentNameAtSend;
    }

    public void setStudentNameAtSend(
            String studentNameAtSend
    ) {
        this.studentNameAtSend =
                studentNameAtSend;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(
            String subject
    ) {
        this.subject =
                subject;
    }

    public String getAdviserNote() {
        return adviserNote;
    }

    public void setAdviserNote(
            String adviserNote
    ) {
        this.adviserNote =
                adviserNote;
    }

    public int getAbsenceCountAtSend() {
        return absenceCountAtSend;
    }

    public void setAbsenceCountAtSend(
            int absenceCountAtSend
    ) {
        this.absenceCountAtSend =
                absenceCountAtSend;
    }

    public AttendanceRiskLevel getRiskLevelAtSend() {
        return riskLevelAtSend;
    }

    public void setRiskLevelAtSend(
            AttendanceRiskLevel riskLevelAtSend
    ) {
        this.riskLevelAtSend =
                riskLevelAtSend;
    }

    public LocalDateTime getQueuedAt() {
        return queuedAt;
    }

    public void setQueuedAt(
            LocalDateTime queuedAt
    ) {
        this.queuedAt =
                queuedAt;
    }

    public LocalDateTime getSentAt() {
        return sentAt;
    }

    public void setSentAt(
            LocalDateTime sentAt
    ) {
        this.sentAt =
                sentAt;
    }

    public LocalDateTime getFailedAt() {
        return failedAt;
    }

    public void setFailedAt(
            LocalDateTime failedAt
    ) {
        this.failedAt =
                failedAt;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(
            String failureReason
    ) {
        this.failureReason =
                failureReason;
    }

    public String getAcknowledgementTokenHash() {
        return acknowledgementTokenHash;
    }

    public void setAcknowledgementTokenHash(
            String acknowledgementTokenHash
    ) {
        this.acknowledgementTokenHash =
                acknowledgementTokenHash;
    }

    public LocalDateTime getTokenExpiresAt() {
        return tokenExpiresAt;
    }

    public void setTokenExpiresAt(
            LocalDateTime tokenExpiresAt
    ) {
        this.tokenExpiresAt =
                tokenExpiresAt;
    }

    public LocalDateTime getAcknowledgedAt() {
        return acknowledgedAt;
    }

    public void setAcknowledgedAt(
            LocalDateTime acknowledgedAt
    ) {
        this.acknowledgedAt =
                acknowledgedAt;
    }

    public String getParentResponse() {
        return parentResponse;
    }

    public void setParentResponse(
            String parentResponse
    ) {
        this.parentResponse =
                parentResponse;
    }

    public LocalDateTime getRespondedAt() {
        return respondedAt;
    }

    public void setRespondedAt(
            LocalDateTime respondedAt
    ) {
        this.respondedAt =
                respondedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}