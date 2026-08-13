package com.example.attendancemanagementbackend.dto.section;

public class SectionResponse {

    private String id;
    private String name;
    private String adviserId;
    private String adviserName;
    private boolean active;

    public SectionResponse(
            String id,
            String name,
            String adviserId,
            String adviserName,
            boolean active
    ) {
        this.id = id;
        this.name = name;
        this.adviserId = adviserId;
        this.adviserName = adviserName;
        this.active = active;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAdviserId() {
        return adviserId;
    }

    public String getAdviserName() {
        return adviserName;
    }

    public boolean isActive() {
        return active;
    }
}