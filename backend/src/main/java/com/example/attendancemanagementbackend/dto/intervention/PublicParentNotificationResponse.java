package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import java.time.LocalDateTime;

import java.util.List;

public record PublicParentNotificationResponse(

        String recipientName,

        String studentNumber,

        String studentName,

        String subject,

        String adviserNote,

        int absenceCount,

        AttendanceRiskLevel riskLevel,

        ParentNotificationStatus status,

        LocalDateTime tokenExpiresAt,

        boolean acknowledgementAllowed,

        boolean responseAllowed,

        LocalDateTime acknowledgedAt,

        LocalDateTime respondedAt,

        String parentResponse,

        List<PublicParentNotificationAbsenceResponse> absences

) {
}