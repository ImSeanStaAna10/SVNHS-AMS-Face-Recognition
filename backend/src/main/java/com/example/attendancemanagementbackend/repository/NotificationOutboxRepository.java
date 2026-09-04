package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.NotificationOutbox;
import com.example.attendancemanagementbackend.entity.NotificationOutboxStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

import java.util.List;
import java.util.Optional;

public interface NotificationOutboxRepository
        extends JpaRepository<NotificationOutbox, String> {

    /* =====================================================
       FIND BY PARENT NOTIFICATION

       Used for idempotency.
    ===================================================== */

    Optional<NotificationOutbox>
    findByParentNotification_Id(
            String parentNotificationId
    );

    boolean existsByParentNotification_Id(
            String parentNotificationId
    );

    /* =====================================================
       GENERAL DUE ITEMS

       Existing helper retained.
    ===================================================== */

    @Query("""
           SELECT o

           FROM NotificationOutbox o

           WHERE o.status IN :statuses

             AND (
                    o.nextAttemptAt IS NULL
                    OR o.nextAttemptAt <= :now
                 )

           ORDER BY
               o.createdAt ASC
           """)
    List<NotificationOutbox>
    findDueOutboxItems(

            @Param("statuses")
            List<NotificationOutboxStatus> statuses,

            @Param("now")
            LocalDateTime now,

            Pageable pageable
    );

    /* =====================================================
       CLAIM NEXT DELIVERY JOB

       IMPORTANT:

       Pessimistic locking prevents another database
       worker transaction from claiming the exact same
       row while this transaction is selecting it.

       Eligible:
       - PENDING and due now
       - FAILED and retry time reached
       - below maximum attempts
    ===================================================== */

    @Lock(
            LockModeType.PESSIMISTIC_WRITE
    )
    @Query("""
           SELECT o

           FROM NotificationOutbox o

           WHERE o.attemptCount < :maxAttempts

             AND (

                    (
                        o.status =
                        com.example.attendancemanagementbackend.entity.NotificationOutboxStatus.PENDING

                        AND (
                               o.nextAttemptAt IS NULL
                               OR o.nextAttemptAt <= :now
                            )
                    )

                    OR

                    (
                        o.status =
                        com.example.attendancemanagementbackend.entity.NotificationOutboxStatus.FAILED

                        AND o.nextAttemptAt IS NOT NULL

                        AND o.nextAttemptAt <= :now
                    )

                 )

           ORDER BY
               o.createdAt ASC
           """)
    List<NotificationOutbox>
    findDueOutboxItemsForUpdate(

            @Param("now")
            LocalDateTime now,

            @Param("maxAttempts")
            int maxAttempts,

            Pageable pageable
    );
}