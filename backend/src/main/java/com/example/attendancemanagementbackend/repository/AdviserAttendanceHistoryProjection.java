package com.example.attendancemanagementbackend.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;

public interface AdviserAttendanceHistoryProjection {

    String getSessionId();

    String getSectionId();

    String getSectionName();

    LocalDate getAttendanceDate();

    LocalDateTime getStartedAt();

    LocalDateTime getEndedAt();

    Long getStudentCount();

    Long getPresentCount();

    Long getLateCount();

    Long getAbsentCount();
}