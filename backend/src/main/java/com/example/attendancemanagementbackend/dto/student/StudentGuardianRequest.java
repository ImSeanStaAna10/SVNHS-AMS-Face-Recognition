package com.example.attendancemanagementbackend.dto.student;

import com.example.attendancemanagementbackend.entity.GuardianRelationship;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class StudentGuardianRequest {

    @NotBlank(
            message = "Guardian name is required"
    )
    @Size(
            max = 150,
            message = "Guardian name must not exceed 150 characters"
    )
    private String name;

    @NotNull(
            message = "Guardian relationship is required"
    )
    private GuardianRelationship relationship;

    @NotBlank(
            message = "Guardian email is required"
    )
    @Email(
            message = "Guardian email must be a valid email address"
    )
    @Size(
            max = 255,
            message = "Guardian email must not exceed 255 characters"
    )
    private String email;

    private boolean receiveAttendanceNotifications = true;

    public StudentGuardianRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }

    public GuardianRelationship getRelationship() {
        return relationship;
    }

    public void setRelationship(
            GuardianRelationship relationship
    ) {
        this.relationship =
                relationship;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(
            String email
    ) {
        this.email = email;
    }

    public boolean isReceiveAttendanceNotifications() {
        return receiveAttendanceNotifications;
    }

    public void setReceiveAttendanceNotifications(
            boolean receiveAttendanceNotifications
    ) {
        this.receiveAttendanceNotifications =
                receiveAttendanceNotifications;
    }
}