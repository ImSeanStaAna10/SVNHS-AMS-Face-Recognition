package com.example.attendancemanagementbackend.dto.superadmin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateDepartmentRequest {

    @NotBlank(message = "Department code is required")
    @Size(
            max = 50,
            message = "Department code must not exceed 50 characters"
    )
    private String code;

    @NotBlank(message = "Department name is required")
    @Size(
            max = 150,
            message = "Department name must not exceed 150 characters"
    )
    private String name;

    public CreateDepartmentRequest() {
    }

    public String getCode() {
        return code;
    }

    public void setCode(
            String code
    ) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }
}