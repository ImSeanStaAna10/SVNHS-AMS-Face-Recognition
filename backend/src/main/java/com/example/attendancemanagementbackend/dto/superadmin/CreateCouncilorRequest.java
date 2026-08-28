package com.example.attendancemanagementbackend.dto.superadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateCouncilorRequest {

    @NotBlank(message = "Councilor name is required")
    @Size(
            max = 150,
            message = "Councilor name must not exceed 150 characters"
    )
    private String name;

    @NotBlank(message = "Councilor email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(
            min = 8,
            message = "Password must be at least 8 characters"
    )
    private String password;

    @NotBlank(message = "Department ID is required")
    private String departmentId;

    public CreateCouncilorRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(
            String email
    ) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(
            String password
    ) {
        this.password = password;
    }

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(
            String departmentId
    ) {
        this.departmentId = departmentId;
    }
}