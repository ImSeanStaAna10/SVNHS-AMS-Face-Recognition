package com.example.attendancemanagementbackend.dto.student;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class CreateStudentRequest {

    @NotBlank(message = "Student number is required")
    @Pattern(
            regexp = "^\\d{12}$",
            message = "Student number must contain exactly 12 digits"
    )
    private String studentNumber;

    @NotBlank(message = "Student name is required")
    private String name;

    @NotBlank(message = "Section ID is required")
    private String sectionId;

    public CreateStudentRequest() {
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public void setStudentNumber(
            String studentNumber
    ) {
        this.studentNumber = studentNumber;
    }

    public String getName() {
        return name;
    }

    public void setName(
            String name
    ) {
        this.name = name;
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