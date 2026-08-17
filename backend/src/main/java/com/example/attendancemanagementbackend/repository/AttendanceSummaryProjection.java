package com.example.attendancemanagementbackend.repository;

public interface AttendanceSummaryProjection {

    Long getSectionCount();

    Long getSessionCount();

    Long getStudentCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();

    Long getTotalRecords();
}