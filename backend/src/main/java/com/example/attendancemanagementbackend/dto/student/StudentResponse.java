package com.example.attendancemanagementbackend.dto.student;

public class StudentResponse {

    private String id;
    private String studentNumber;
    private String name;
    private String sectionId;
    private String sectionName;
    private boolean active;

    public StudentResponse(
            String id,
            String studentNumber,
            String name,
            String sectionId,
            String sectionName,
            boolean active
    ) {
        this.id = id;
        this.studentNumber = studentNumber;
        this.name = name;
        this.sectionId = sectionId;
        this.sectionName = sectionName;
        this.active = active;
    }

    public String getId() {
        return id;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public String getName() {
        return name;
    }

    public String getSectionId() {
        return sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public boolean isActive() {
        return active;
    }
}