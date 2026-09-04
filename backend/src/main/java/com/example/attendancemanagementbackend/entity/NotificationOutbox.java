package com.example.attendancemanagementbackend.entity;

import com.example.attendancemanagementbackend.util.AppTime;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "notification_outbox",

        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_notification_outbox_parent_notification",
                        columnNames = {
                                "parent_notification_id"
                        }
                )
        },

        indexes = {
                @Index(
                        name = "idx_notification_outbox_parent_notification_id",
                        columnList = "parent_notification_id"
                ),

                @Index(
                        name = "idx_notification_outbox_status",
                        columnList = "status"
                ),

                @Index(
                        name = "idx_notification_outbox_next_attempt_at",
                        columnList = "next_attempt_at"
                ),

                @Index(
                        name = "idx_notification_outbox_status_next_attempt",
                        columnList = "status,next_attempt_at"
                )
        }
)
public class NotificationOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /* =====================================================
       PARENT NOTIFICATION
    ===================================================== */

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "parent_notification_id",
            nullable = false
    )
    private ParentNotification parentNotification;

    /* =====================================================
       JOB TYPE
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "type",
            nullable = false,
            length = 50
    )
    private NotificationOutboxType type;

    /* =====================================================
       PROCESSING STATUS
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private NotificationOutboxStatus status =
            NotificationOutboxStatus.PENDING;

    /* =====================================================
       RETRY STATE
    ===================================================== */

    @Column(
            name = "attempt_count",
            nullable = false
    )
    private int attemptCount =
            0;

    @Column(
            name = "last_attempt_at"
    )
    private LocalDateTime lastAttemptAt;

    @Column(
            name = "next_attempt_at"
    )
    private LocalDateTime nextAttemptAt;

    @Column(
            name = "last_error",
            columnDefinition = "TEXT"
    )
    private String lastError;

    /* =====================================================
       COMPLETION
    ===================================================== */

    @Column(
            name = "processed_at"
    )
    private LocalDateTime processedAt;

    /* =====================================================
       TIMESTAMPS
    ===================================================== */

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

    /* =====================================================
       CONSTRUCTORS
    ===================================================== */

    public NotificationOutbox() {
    }

    public NotificationOutbox(
            ParentNotification parentNotification,
            NotificationOutboxType type
    ) {

        this.parentNotification =
                parentNotification;

        this.type =
                type;

        this.status =
                NotificationOutboxStatus.PENDING;

        this.attemptCount =
                0;
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
                    NotificationOutboxStatus.PENDING;
        }

        if (attemptCount < 0) {

            attemptCount =
                    0;
        }

        /*
         * Newly queued work is immediately eligible
         * for delivery.
         */
        if (nextAttemptAt == null) {

            nextAttemptAt =
                    now;
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

    public ParentNotification getParentNotification() {
        return parentNotification;
    }

    public void setParentNotification(
            ParentNotification parentNotification
    ) {
        this.parentNotification =
                parentNotification;
    }

    public NotificationOutboxType getType() {
        return type;
    }

    public void setType(
            NotificationOutboxType type
    ) {
        this.type =
                type;
    }

    public NotificationOutboxStatus getStatus() {
        return status;
    }

    public void setStatus(
            NotificationOutboxStatus status
    ) {
        this.status =
                status;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public void setAttemptCount(
            int attemptCount
    ) {
        this.attemptCount =
                attemptCount;
    }

    public LocalDateTime getLastAttemptAt() {
        return lastAttemptAt;
    }

    public void setLastAttemptAt(
            LocalDateTime lastAttemptAt
    ) {
        this.lastAttemptAt =
                lastAttemptAt;
    }

    public LocalDateTime getNextAttemptAt() {
        return nextAttemptAt;
    }

    public void setNextAttemptAt(
            LocalDateTime nextAttemptAt
    ) {
        this.nextAttemptAt =
                nextAttemptAt;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(
            String lastError
    ) {
        this.lastError =
                lastError;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(
            LocalDateTime processedAt
    ) {
        this.processedAt =
                processedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}