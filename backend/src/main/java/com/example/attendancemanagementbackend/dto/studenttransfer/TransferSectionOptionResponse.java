package com.example.attendancemanagementbackend.dto.studenttransfer;

public record TransferSectionOptionResponse(
        String id,
        String name,
        String adviserId,
        String adviserName,
        String departmentId,
        String departmentCode,
        String departmentName
) {
}
