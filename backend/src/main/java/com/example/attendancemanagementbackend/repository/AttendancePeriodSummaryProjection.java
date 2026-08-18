package com.example.attendancemanagementbackend.repository;

public interface AttendancePeriodSummaryProjection {

    Long getSessionCount();

    Long getStudentCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();

    Long getTotalRecords();
}