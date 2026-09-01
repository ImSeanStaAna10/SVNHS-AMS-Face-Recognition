package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.LivenessChallenge;
import com.example.attendancemanagementbackend.entity.LivenessChallengeStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LivenessChallengeRepository
        extends JpaRepository<LivenessChallenge, String> {

    /* =========================================================
       FIND CHALLENGE BY ID + CREATOR

       Existing non-locking lookup.

       Retained because it may still be useful for normal
       read-only challenge operations.
    ========================================================= */

    Optional<LivenessChallenge>
    findByIdAndCreatedByUserId(
            String id,
            String createdByUserId
    );

    /* =========================================================
       FIND CHALLENGE WITH DATABASE WRITE LOCK

       Used when a challenge is about to be consumed for
       verification.

       PESSIMISTIC_WRITE prevents two concurrent verification
       requests from successfully consuming the same challenge.

       Example:

       Request A
           ↓
       locks challenge
           ↓
       PENDING → VERIFYING

       Request B
           ↓
       waits for Request A
           ↓
       sees VERIFYING
           ↓
       rejected

       IMPORTANT:
       This method must be called inside an active
       @Transactional service method.
    ========================================================= */

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT challenge
            FROM LivenessChallenge challenge
            WHERE challenge.id = :id
              AND challenge.createdByUserId = :createdByUserId
            """)
    Optional<LivenessChallenge>
    findByIdAndCreatedByUserIdForUpdate(

            @Param("id")
            String id,

            @Param("createdByUserId")
            String createdByUserId
    );

    /* =========================================================
       FIND EXPIRED CHALLENGES BY STATUS

       Existing method retained.
    ========================================================= */

    List<LivenessChallenge>
    findByStatusAndExpiresAtBefore(
            LivenessChallengeStatus status,
            LocalDateTime expiresAt
    );
}