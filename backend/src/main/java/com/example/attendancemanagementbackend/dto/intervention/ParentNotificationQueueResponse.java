package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.NotificationOutboxStatus;
import com.example.attendancemanagementbackend.entity.NotificationOutboxType;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import java.time.LocalDateTime;

public class ParentNotificationQueueResponse {

    private final String notificationId;

    private final ParentNotificationStatus notificationStatus;

    private final String outboxId;

    private final NotificationOutboxType outboxType;

    private final NotificationOutboxStatus outboxStatus;

    private final int attemptCount;

    private final LocalDateTime queuedAt;

    private final LocalDateTime nextAttemptAt;

    public ParentNotificationQueueResponse(
            String notificationId,
            ParentNotificationStatus notificationStatus,
            String outboxId,
            NotificationOutboxType outboxType,
            NotificationOutboxStatus outboxStatus,
            int attemptCount,
            LocalDateTime queuedAt,
            LocalDateTime nextAttemptAt
    ) {

        this.notificationId =
                notificationId;

        this.notificationStatus =
                notificationStatus;

        this.outboxId =
                outboxId;

        this.outboxType =
                outboxType;

        this.outboxStatus =
                outboxStatus;

        this.attemptCount =
                attemptCount;

        this.queuedAt =
                queuedAt;

        this.nextAttemptAt =
                nextAttemptAt;
    }

    public String getNotificationId() {
        return notificationId;
    }

    public ParentNotificationStatus getNotificationStatus() {
        return notificationStatus;
    }

    public String getOutboxId() {
        return outboxId;
    }

    public NotificationOutboxType getOutboxType() {
        return outboxType;
    }

    public NotificationOutboxStatus getOutboxStatus() {
        return outboxStatus;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public LocalDateTime getQueuedAt() {
        return queuedAt;
    }

    public LocalDateTime getNextAttemptAt() {
        return nextAttemptAt;
    }
}