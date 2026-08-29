package com.example.attendancemanagementbackend.dto.superadmin;

import jakarta.validation.constraints.NotNull;

public class UpdateActiveStatusRequest {

    @NotNull(message = "Active status is required")
    private Boolean active;

    public UpdateActiveStatusRequest() {
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(
            Boolean active
    ) {
        this.active = active;
    }
}