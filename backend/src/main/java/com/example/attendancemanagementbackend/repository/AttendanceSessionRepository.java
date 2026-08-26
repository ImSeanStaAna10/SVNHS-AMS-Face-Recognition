package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

    /* =========================================================
       EXPIRED AUTOMATIC SESSIONS
    ========================================================= */

    /**
     * Finds ACTIVE attendance sessions that:
     *
     * 1. Have an automatic end time configured.
     * 2. Have already reached or passed that end time.
     *
     * Example:
     *
     * scheduledEndAt = 09:00
     * currentTime    = 09:01
     *
     * The session will be returned so it can
     * automatically be finalized.
     */
    List<AttendanceSession>
    findByStatusAndScheduledEndAtIsNotNullAndScheduledEndAtLessThanEqual(
            AttendanceSessionStatus status,
            LocalDateTime currentTime
    );
}