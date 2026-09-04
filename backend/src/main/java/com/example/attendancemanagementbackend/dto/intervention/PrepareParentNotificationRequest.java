package com.example.attendancemanagementbackend.dto.intervention;

import jakarta.validation.constraints.Size;

public class PrepareParentNotificationRequest {

    @Size(
            max = 2000,
            message = "Adviser note must not exceed 2000 characters"
    )
    private String adviserNote;

    public PrepareParentNotificationRequest() {
    }

    public String getAdviserNote() {
        return adviserNote;
    }

    public void setAdviserNote(
            String adviserNote
    ) {
        this.adviserNote =
                adviserNote;
    }
}