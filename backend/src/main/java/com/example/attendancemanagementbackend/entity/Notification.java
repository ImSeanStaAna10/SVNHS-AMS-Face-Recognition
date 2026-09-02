package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "notifications",

        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_notification_recipient_dedup",
                        columnNames = {
                                "recipient_user_id",
                                "deduplication_key"
                        }
                )
        },

        indexes = {
                @Index(
                        name = "idx_notification_recipient_created",
                        columnList = "recipient_user_id, created_at"
                ),

                @Index(
                        name = "idx_notification_recipient_read",
                        columnList = "recipient_user_id, read_at"
                ),

                @Index(
                        name = "idx_notification_recipient_deleted",
                        columnList = "recipient_user_id, deleted_at"
                ),

                @Index(
                        name = "idx_notification_type",
                        columnList = "type"
                ),

                @Index(
                        name = "idx_notification_reference",
                        columnList = "reference_type, reference_id"
                )
        }
)
public class Notification {

    /* =========================================================
       ID
    ========================================================= */

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =========================================================
       RECIPIENT
    ========================================================= */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "recipient_user_id",
            nullable = false
    )
    private User recipient;

    /* =========================================================
       TYPE
    ========================================================= */

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 80
    )
    private NotificationType type;

    /* =========================================================
       CONTENT
    ========================================================= */

    @Column(
            nullable = false,
            length = 160
    )
    private String title;

    @Column(
            nullable = false,
            length = 1000
    )
    private String message;

    /* =========================================================
       REFERENCE

       Backend stores business references only.

       Example:

       referenceType = STUDENT_TRANSFER
       referenceId   = transfer UUID

       Frontend decides which route should open.
    ========================================================= */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "reference_type",
            length = 80
    )
    private NotificationReferenceType referenceType;

    @Column(
            name = "reference_id",
            length = 128
    )
    private String referenceId;

    /* =========================================================
       DEDUPLICATION

       Example:

       student-transfer:<id>:requested
       student-transfer:<id>:approved

       This prevents the same business event from accidentally
       creating the same notification more than once.
    ========================================================= */

    @Column(
            name = "deduplication_key",
            length = 255
    )
    private String deduplicationKey;

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
            name = "read_at"
    )
    private LocalDateTime readAt;

    /*
     * Soft delete.
     *
     * We retain the database row so notification events
     * remain auditable and deduplication remains reliable.
     */
    @Column(
            name = "deleted_at"
    )
    private LocalDateTime deletedAt;

    /* =========================================================
       CONSTRUCTORS
    ========================================================= */

    public Notification() {
    }

    public Notification(
            User recipient,
            NotificationType type,
            String title,
            String message,
            NotificationReferenceType referenceType,
            String referenceId,
            String deduplicationKey
    ) {
        this.recipient =
                recipient;

        this.type =
                type;

        this.title =
                title;

        this.message =
                message;

        this.referenceType =
                referenceType;

        this.referenceId =
                referenceId;

        this.deduplicationKey =
                deduplicationKey;
    }

    /* =========================================================
       LIFECYCLE
    ========================================================= */

    @PrePersist
    public void prePersist() {

        if (createdAt == null) {
            createdAt =
                    LocalDateTime.now();
        }
    }

    /* =========================================================
       READ / UNREAD
    ========================================================= */

    public void markRead(
            LocalDateTime now
    ) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public void markUnread() {
        readAt = null;
    }

    /* =========================================================
       SOFT DELETE
    ========================================================= */

    public void softDelete(
            LocalDateTime now
    ) {
        if (deletedAt == null) {
            deletedAt = now;
        }
    }

    /* =========================================================
       GETTERS
    ========================================================= */

    public String getId() {
        return id;
    }

    public User getRecipient() {
        return recipient;
    }

    public NotificationType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public NotificationReferenceType getReferenceType() {
        return referenceType;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public String getDeduplicationKey() {
        return deduplicationKey;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getReadAt() {
        return readAt;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }
}