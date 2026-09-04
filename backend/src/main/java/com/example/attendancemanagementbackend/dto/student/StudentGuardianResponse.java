package com.example.attendancemanagementbackend.dto.student;

import com.example.attendancemanagementbackend.entity.GuardianRelationship;

public class StudentGuardianResponse {

    private String id;

    private String name;

    private GuardianRelationship relationship;

    private String email;

    private boolean primaryGuardian;

    private boolean receiveAttendanceNotifications;

    private boolean active;

    public StudentGuardianResponse(
            String id,
            String name,
            GuardianRelationship relationship,
            String email,
            boolean primaryGuardian,
            boolean receiveAttendanceNotifications,
            boolean active
    ) {
        this.id = id;
        this.name = name;
        this.relationship = relationship;
        this.email = email;
        this.primaryGuardian = primaryGuardian;
        this.receiveAttendanceNotifications =
                receiveAttendanceNotifications;
        this.active = active;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public GuardianRelationship getRelationship() {
        return relationship;
    }

    public String getEmail() {
        return email;
    }

    public boolean isPrimaryGuardian() {
        return primaryGuardian;
    }

    public boolean isReceiveAttendanceNotifications() {
        return receiveAttendanceNotifications;
    }

    public boolean isActive() {
        return active;
    }
}