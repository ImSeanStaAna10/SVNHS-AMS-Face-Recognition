package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceSessionRepository
        extends JpaRepository<AttendanceSession, String> {

    /* =========================================================
       SECTION SESSIONS
    ========================================================= */

    List<AttendanceSession> findBySectionId(
            String sectionId
    );

    /* =========================================================
       ACTIVE SESSION
    ========================================================= */

    Optional<AttendanceSession> findBySectionIdAndStatus(
            String sectionId,
            AttendanceSessionStatus status
    );

    /* =========================================================
       DAILY SESSION CHECK
    ========================================================= */

    boolean existsBySectionIdAndAttendanceDate(
            String sectionId,
            LocalDate attendanceDate
    );
}