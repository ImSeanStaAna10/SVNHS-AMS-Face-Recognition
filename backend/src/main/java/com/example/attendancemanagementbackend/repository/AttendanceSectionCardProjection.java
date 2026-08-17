package com.example.attendancemanagementbackend.repository;

public interface AttendanceSectionCardProjection {

    String getSectionId();

    String getSectionName();

    String getAdviserId();

    String getAdviserName();

    Long getSessionCount();

    Long getStudentCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();

    Long getTotalRecords();
}