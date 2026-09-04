package com.example.attendancemanagementbackend.service;

public record NotificationOutboxClaim(
        String outboxId,
        String parentNotificationId,
        int attemptNumber
) {
}