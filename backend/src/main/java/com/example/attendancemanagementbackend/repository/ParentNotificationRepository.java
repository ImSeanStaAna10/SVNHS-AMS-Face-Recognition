package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ParentNotificationRepository
        extends JpaRepository<ParentNotification, String> {

    /* =====================================================
       INTERVENTION HISTORY
    ===================================================== */

    List<ParentNotification>
    findByIntervention_IdOrderByCreatedAtDesc(
            String interventionId
    );

    /* =====================================================
       STUDENT HISTORY
    ===================================================== */

    List<ParentNotification>
    findByStudent_IdOrderByCreatedAtDesc(
            String studentId
    );

    /* =====================================================
       STATUS LOOKUP
    ===================================================== */

    List<ParentNotification>
    findByStatusOrderByCreatedAtAsc(
            ParentNotificationStatus status
    );

    /* =====================================================
       SECURE PARENT REVIEW TOKEN LOOKUP

       The public API will receive the raw secure token.

       ParentNotificationSecureTokenService will hash it
       using SHA-256.

       We then search using the stored hash only.

       The raw token is NEVER stored in PostgreSQL.
    ===================================================== */

    Optional<ParentNotification>
    findByAcknowledgementTokenHash(
            String acknowledgementTokenHash
    );

    /* =====================================================
       INTERVENTION STATUS CHECK
    ===================================================== */

    boolean existsByIntervention_IdAndStatus(
            String interventionId,
            ParentNotificationStatus status
    );
}