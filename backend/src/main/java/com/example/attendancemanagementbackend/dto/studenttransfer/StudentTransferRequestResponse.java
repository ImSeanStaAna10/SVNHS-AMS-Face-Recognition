package com.example.attendancemanagementbackend.dto.studenttransfer;

import java.time.LocalDateTime;

public record StudentTransferRequestResponse(
        String id,
        String status,
        String studentId,
        String studentNumber,
        String studentName,
        String sourceSectionId,
        String sourceSectionName,
        String destinationSectionId,
        String destinationSectionName,
        String destinationAdviserId,
        String destinationAdviserName,
        String requestedByAdviserId,
        String requestedByAdviserName,
        String reason,
        String reviewNote,
        LocalDateTime createdAt,
        LocalDateTime reviewedAt
) {
}
