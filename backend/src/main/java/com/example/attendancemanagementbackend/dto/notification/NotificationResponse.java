package com.example.attendancemanagementbackend.dto.notification;

import com.example.attendancemanagementbackend.entity.NotificationReferenceType;
import com.example.attendancemanagementbackend.entity.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponse(

        String id,

        NotificationType type,

        String title,

        String message,

        NotificationReferenceType referenceType,

        String referenceId,

        boolean read,

        LocalDateTime readAt,

        LocalDateTime createdAt

) {
}