package com.example.attendancemanagementbackend.dto.student;

import jakarta.validation.constraints.NotBlank;

public class CreateStudentRequest {

    @NotBlank(message = "Student number is required")
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

    public void setStudentNumber(String studentNumber) {
        this.studentNumber = studentNumber;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSectionId() {
        return sectionId;
    }

    public void setSectionId(String sectionId) {
        this.sectionId = sectionId;
    }
}