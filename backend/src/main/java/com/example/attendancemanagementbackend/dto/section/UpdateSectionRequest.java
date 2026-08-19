package com.example.attendancemanagementbackend.dto.section;

import jakarta.validation.constraints.NotBlank;

public class UpdateSectionRequest {

    @NotBlank(message = "Section name is required")
    private String name;

    @NotBlank(message = "Adviser is required")
    private String adviserId;

    public UpdateSectionRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
    }

    public String getAdviserId() {
        return adviserId;
    }

    public void setAdviserId(
            String adviserId
    ) {
        this.adviserId = adviserId;
    }
}