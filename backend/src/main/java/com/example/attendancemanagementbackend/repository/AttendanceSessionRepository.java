package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceSessionRepository
        extends JpaRepository<AttendanceSession, String> {

    List<AttendanceSession> findBySectionId(String sectionId);

    Optional<AttendanceSession> findBySectionIdAndStatus(
            String sectionId,
            AttendanceSessionStatus status
    );
}