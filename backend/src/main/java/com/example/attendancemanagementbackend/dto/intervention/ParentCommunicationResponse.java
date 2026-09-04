package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.ParentNotificationSendMode;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import java.time.LocalDateTime;

/**
 * Adviser-facing read model for one parent attendance notice.
 *
 * This intentionally exposes only the already-frozen notification
 * snapshot and its delivery / acknowledgement / response lifecycle.
 * The secure raw parent token is never returned here.
 */
public record ParentCommunicationResponse(
        String notificationId,
        String interventionId,
        String studentId,
        String guardianId,
        ParentNotificationSendMode sendMode,
        ParentNotificationStatus status,
        String recipientName,
        String recipientEmail,
        String studentNumberAtSend,
        String studentNameAtSend,
        String subject,
        String adviserNote,
        int absenceCountAtSend,
        AttendanceRiskLevel riskLevelAtSend,
        LocalDateTime queuedAt,
        LocalDateTime sentAt,
        LocalDateTime failedAt,
        String failureReason,
        LocalDateTime acknowledgedAt,
        LocalDateTime respondedAt,
        String parentResponse,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
