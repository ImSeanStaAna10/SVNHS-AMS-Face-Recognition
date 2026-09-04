package com.example.attendancemanagementbackend.repository;

public interface StudentAbsenceCountProjection {

    String getStudentId();

    long getAbsentCount();
}