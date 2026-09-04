package com.example.attendancemanagementbackend.repository;

public interface StudentAttendanceRiskProjection {

    String getStudentId();

    String getStudentNumber();

    String getStudentName();

    long getSessionCount();

    long getPresentCount();

    long getLateCount();

    long getAbsentCount();

    long getTotalRecords();
}