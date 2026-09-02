package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;

public interface NotificationRepository
        extends JpaRepository<Notification, String>,
        JpaSpecificationExecutor<Notification> {

    /* =========================================================
       DEDUPLICATION
    ========================================================= */

    boolean existsByRecipient_IdAndDeduplicationKey(
            String recipientUserId,
            String deduplicationKey
    );

    /* =========================================================
       SINGLE VISIBLE NOTIFICATION
    ========================================================= */

    Optional<Notification>
    findByIdAndRecipient_IdAndDeletedAtIsNull(
            String notificationId,
            String recipientUserId
    );

    /* =========================================================
       UNREAD COUNT
    ========================================================= */

    long countByRecipient_IdAndReadAtIsNullAndDeletedAtIsNull(
            String recipientUserId
    );

    /* =========================================================
       MARK SELECTED READ
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.readAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.id IN :notificationIds
              AND n.deletedAt IS NULL
              AND n.readAt IS NULL
            """)
    int markSelectedRead(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("notificationIds")
            Collection<String> notificationIds,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       MARK SELECTED UNREAD
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.readAt = NULL
            WHERE n.recipient.id = :recipientUserId
              AND n.id IN :notificationIds
              AND n.deletedAt IS NULL
              AND n.readAt IS NOT NULL
            """)
    int markSelectedUnread(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("notificationIds")
            Collection<String> notificationIds
    );

    /* =========================================================
       MARK ALL READ
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.readAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.deletedAt IS NULL
              AND n.readAt IS NULL
            """)
    int markAllRead(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       MARK BUSINESS EVENT READ

       Used when an Adviser resolves the underlying feature
       directly instead of opening the notification first.

       IMPORTANT:
       Do NOT clear the persistence context here because this
       method can execute inside another service transaction,
       such as StudentTransferRequestService.
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.readAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.deduplicationKey = :deduplicationKey
              AND n.deletedAt IS NULL
              AND n.readAt IS NULL
            """)
    int markReadByDeduplicationKey(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("deduplicationKey")
            String deduplicationKey,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       SOFT DELETE SELECTED
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.deletedAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.id IN :notificationIds
              AND n.deletedAt IS NULL
            """)
    int softDeleteSelected(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("notificationIds")
            Collection<String> notificationIds,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       DELETE ALL READ
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.deletedAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.deletedAt IS NULL
              AND n.readAt IS NOT NULL
            """)
    int softDeleteAllRead(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       DELETE ALL
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.deletedAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.deletedAt IS NULL
            """)
    int softDeleteAll(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("now")
            LocalDateTime now
    );

    /* =========================================================
       DELETE BEFORE DATE
    ========================================================= */

    @Modifying(
            flushAutomatically = true
    )
    @Query("""
            UPDATE Notification n
            SET n.deletedAt = :now
            WHERE n.recipient.id = :recipientUserId
              AND n.deletedAt IS NULL
              AND n.createdAt < :beforeAt
            """)
    int softDeleteBefore(
            @Param("recipientUserId")
            String recipientUserId,

            @Param("beforeAt")
            LocalDateTime beforeAt,

            @Param("now")
            LocalDateTime now
    );
}