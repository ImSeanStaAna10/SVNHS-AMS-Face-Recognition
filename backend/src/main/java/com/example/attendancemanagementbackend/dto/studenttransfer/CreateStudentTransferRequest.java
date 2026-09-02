package com.example.attendancemanagementbackend.dto.studenttransfer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateStudentTransferRequest {

    @NotBlank(message = "Student ID is required")
    private String studentId;

    @NotBlank(message = "Destination section ID is required")
    private String destinationSectionId;

    @Size(
            max = 500,
            message = "Transfer reason must not exceed 500 characters"
    )
    private String reason;

    public CreateStudentTransferRequest() {
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getDestinationSectionId() {
        return destinationSectionId;
    }

    public void setDestinationSectionId(String destinationSectionId) {
        this.destinationSectionId = destinationSectionId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
