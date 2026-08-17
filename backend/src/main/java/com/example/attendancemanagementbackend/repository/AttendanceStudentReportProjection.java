package com.example.attendancemanagementbackend.repository;

public interface AttendanceStudentReportProjection {

    String getStudentId();

    String getStudentNumber();

    String getStudentName();

    Long getSessionCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();

    Long getTotalRecords();
}