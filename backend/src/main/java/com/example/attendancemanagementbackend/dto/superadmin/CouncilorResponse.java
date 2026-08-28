package com.example.attendancemanagementbackend.dto.superadmin;

public record CouncilorResponse(

        String id,

        String name,

        String email,

        boolean active,

        String departmentId,

        String departmentCode,

        String departmentName

) {
}