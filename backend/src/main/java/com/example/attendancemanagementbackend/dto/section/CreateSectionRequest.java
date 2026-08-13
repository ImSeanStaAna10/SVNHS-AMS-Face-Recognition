package com.example.attendancemanagementbackend.dto.section;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateSectionRequest {

    @NotBlank(message = "Section name is required")
    private String name;

    @NotNull(message = "Adviser ID is required")
    private String adviserId;

    public CreateSectionRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAdviserId() {
        return adviserId;
    }

    public void setAdviserId(String adviserId) {
        this.adviserId = adviserId;
    }
}