package com.example.attendancemanagementbackend.dto.student;

import jakarta.validation.constraints.NotBlank;

public class TransferStudentRequest {

    @NotBlank(
            message = "Destination section ID is required"
    )
    private String sectionId;

    public TransferStudentRequest() {
    }

    public String getSectionId() {
        return sectionId;
    }

    public void setSectionId(
            String sectionId
    ) {
        this.sectionId = sectionId;
    }
}
