package com.example.attendancemanagementbackend.repository;

public interface AttendanceSectionDetailSummaryProjection {

    Long getSessionCount();

    Long getStudentCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();

    Long getTotalRecords();
}