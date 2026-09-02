package com.example.attendancemanagementbackend.dto.studenttransfer;

import jakarta.validation.constraints.Size;

public class ReviewStudentTransferRequest {

    @Size(
            max = 500,
            message = "Review note must not exceed 500 characters"
    )
    private String note;

    public ReviewStudentTransferRequest() {
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
