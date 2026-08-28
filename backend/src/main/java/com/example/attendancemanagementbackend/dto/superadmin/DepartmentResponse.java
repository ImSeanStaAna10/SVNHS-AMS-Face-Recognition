package com.example.attendancemanagementbackend.dto.superadmin;

public record DepartmentResponse(

        String id,

        String code,

        String name,

        boolean active

) {
}