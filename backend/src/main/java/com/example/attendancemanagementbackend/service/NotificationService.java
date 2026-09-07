package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.notification.NotificationPageResponse;
import com.example.attendancemanagementbackend.dto.notification.NotificationResponse;

import com.example.attendancemanagementbackend.entity.Notification;
import com.example.attendancemanagementbackend.entity.NotificationReferenceType;
import com.example.attendancemanagementbackend.entity.NotificationType;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.NotificationRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import org.springframework.data.jpa.domain.Specification;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class NotificationService {

    /* =========================================================
       TIME
    ========================================================= */

    private static final ZoneId SCHOOL_TIME_ZONE =
            ZoneId.of("Asia/Manila");

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final NotificationRepository notificationRepository;

    private final UserRepository userRepository;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public NotificationService(
            NotificationRepository notificationRepository,
            UserRepository userRepository
    ) {
        this.notificationRepository =
                notificationRepository;

        this.userRepository =
                userRepository;
    }

    /* =========================================================
       CREATE NOTIFICATION USING USER ENTITY

       Recommended when the calling service already has
       the recipient User entity.

       Example:
       StudentTransferRequestService already knows the
       destination Adviser.
    ========================================================= */

    @Transactional
    public Notification createForUser(
            User recipient,
            NotificationType type,
            String title,
            String message,
            NotificationReferenceType referenceType,
            String referenceId,
            String deduplicationKey
    ) {

        if (recipient == null) {
            throw new IllegalArgumentException(
                    "Notification recipient is required"
            );
        }

        if (recipient.getId() == null) {
            throw new IllegalArgumentException(
                    "Notification recipient must have a valid user ID"
            );
        }

        if (type == null) {
            throw new IllegalArgumentException(
                    "Notification type is required"
            );
        }

        String normalizedTitle =
                normalizeRequiredText(
                        title,
                        "Notification title is required"
                );

        String normalizedMessage =
                normalizeRequiredText(
                        message,
                        "Notification message is required"
                );

        String normalizedReferenceId =
                normalizeOptionalText(
                        referenceId
                );

        String normalizedDeduplicationKey =
                normalizeOptionalText(
                        deduplicationKey
                );

        /* =====================================================
           DEDUPLICATION

           Prevents the exact same business event from creating
           duplicate notifications.

           Example:

           student-transfer:<requestId>:requested
        ===================================================== */

        if (
                normalizedDeduplicationKey != null &&
                        notificationRepository
                                .existsByRecipient_IdAndDeduplicationKey(
                                        recipient.getId(),
                                        normalizedDeduplicationKey
                                )
        ) {
            return null;
        }

        Notification notification =
                new Notification(
                        recipient,
                        type,
                        normalizedTitle,
                        normalizedMessage,
                        referenceType,
                        normalizedReferenceId,
                        normalizedDeduplicationKey
                );

        return notificationRepository.save(
                notification
        );
    }

    /* =========================================================
       CREATE NOTIFICATION USING USER ID

       Useful for:
       - schedulers
       - report generation
       - background jobs
       - services that only know the recipient ID
    ========================================================= */

    @Transactional
    public Notification createForUserId(
            String recipientUserId,
            NotificationType type,
            String title,
            String message,
            NotificationReferenceType referenceType,
            String referenceId,
            String deduplicationKey
    ) {

        String normalizedRecipientId =
                normalizeOptionalText(
                        recipientUserId
                );

        if (normalizedRecipientId == null) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Notification recipient ID is required"
            );
        }

        User recipient =
                userRepository
                        .findById(
                                normalizedRecipientId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Notification recipient not found"
                                        )
                        );

        return createForUser(
                recipient,
                type,
                title,
                message,
                referenceType,
                referenceId,
                deduplicationKey
        );
    }

    /* =========================================================
       GET CURRENT USER NOTIFICATIONS

       Supports:

       - pagination
       - all/read/unread
       - type
       - fromDate
       - toDate

       IMPORTANT:

       We intentionally use Specification instead of:

       (:fromAt IS NULL OR createdAt >= :fromAt)

       because PostgreSQL may fail to infer the SQL type
       of a nullable parameter when Hibernate generates
       "? IS NULL".

       Dynamic Specifications completely omit filters that
       are not being used.
    ========================================================= */

    @Transactional(readOnly = true)
    public NotificationPageResponse getNotifications(
            int page,
            int size,
            Boolean read,
            NotificationType type,
            LocalDate fromDate,
            LocalDate toDate
    ) {

        String userId =
                getAuthenticatedUserId();

        /* =====================================================
           VALIDATE DATE RANGE
        ===================================================== */

        if (
                fromDate != null &&
                        toDate != null &&
                        fromDate.isAfter(
                                toDate
                        )
        ) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "fromDate cannot be after toDate"
            );
        }

        /* =====================================================
           SAFE PAGINATION
        ===================================================== */

        int safePage =
                Math.max(
                        page,
                        0
                );

        int safeSize =
                Math.max(
                        1,
                        Math.min(
                                size,
                                100
                        )
                );

        PageRequest pageable =
                PageRequest.of(
                        safePage,
                        safeSize,
                        Sort.by(
                                        Sort.Direction.DESC,
                                        "createdAt"
                                )
                                .and(
                                        Sort.by(
                                                Sort.Direction.DESC,
                                                "id"
                                        )
                                )
                );

        /* =====================================================
           BASE SPECIFICATION:
           CURRENT USER ONLY
        ===================================================== */

        Specification<Notification> specification =
                (root, query, criteriaBuilder) ->
                        criteriaBuilder.equal(
                                root
                                        .get("recipient")
                                        .get("id"),
                                userId
                        );

        /* =====================================================
           EXCLUDE SOFT-DELETED NOTIFICATIONS
        ===================================================== */

        specification =
                specification.and(
                        (root, query, criteriaBuilder) ->
                                criteriaBuilder.isNull(
                                        root.get(
                                                "deletedAt"
                                        )
                                )
                );

        /* =====================================================
           READ / UNREAD FILTER

           read == null
           → all

           read == true
           → read only

           read == false
           → unread only
        ===================================================== */

        if (read != null) {

            if (read) {

                specification =
                        specification.and(
                                (root, query, criteriaBuilder) ->
                                        criteriaBuilder.isNotNull(
                                                root.get(
                                                        "readAt"
                                                )
                                        )
                        );

            } else {

                specification =
                        specification.and(
                                (root, query, criteriaBuilder) ->
                                        criteriaBuilder.isNull(
                                                root.get(
                                                        "readAt"
                                                )
                                        )
                        );
            }
        }

        /* =====================================================
           NOTIFICATION TYPE FILTER
        ===================================================== */

        if (type != null) {

            specification =
                    specification.and(
                            (root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(
                                            root
                                                    .<NotificationType>get(
                                                            "type"
                                                    ),
                                            type
                                    )
                    );
        }

        /* =====================================================
           FROM DATE

           Inclusive.

           Example:

           fromDate = 2026-09-01

           createdAt >=
           2026-09-01 00:00:00
        ===================================================== */

        if (fromDate != null) {

            LocalDateTime fromAt =
                    schoolDateStartAsUtc(
                            fromDate
                    );

            specification =
                    specification.and(
                            (root, query, criteriaBuilder) ->
                                    criteriaBuilder
                                            .greaterThanOrEqualTo(
                                                    root
                                                            .<LocalDateTime>get(
                                                                    "createdAt"
                                                            ),
                                                    fromAt
                                            )
                    );
        }

        /* =====================================================
           TO DATE

           Inclusive from the user's perspective.

           We implement this using an exclusive next-day
           boundary.

           Example:

           toDate = 2026-09-02

           SQL logic becomes:

           createdAt < 2026-09-03 00:00:00

           This safely includes the entire September 2.
        ===================================================== */

        if (toDate != null) {

            LocalDateTime toAtExclusive =
                    schoolDateStartAsUtc(
                            toDate.plusDays(1)
                    );

            specification =
                    specification.and(
                            (root, query, criteriaBuilder) ->
                                    criteriaBuilder.lessThan(
                                            root
                                                    .<LocalDateTime>get(
                                                            "createdAt"
                                                    ),
                                            toAtExclusive
                                    )
                    );
        }

        /* =====================================================
           EXECUTE QUERY
        ===================================================== */

        Page<Notification> result =
                notificationRepository.findAll(
                        specification,
                        pageable
                );

        /* =====================================================
           MAP RESPONSE
        ===================================================== */

        List<NotificationResponse> content =
                result
                        .getContent()
                        .stream()
                        .map(
                                this::mapResponse
                        )
                        .toList();

        return new NotificationPageResponse(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isFirst(),
                result.isLast()
        );
    }

    /* =========================================================
       UNREAD COUNT
    ========================================================= */

    @Transactional(readOnly = true)
    public long getUnreadCount() {

        String userId =
                getAuthenticatedUserId();

        return notificationRepository
                .countByRecipient_IdAndReadAtIsNullAndDeletedAtIsNull(
                        userId
                );
    }

    /* =========================================================
       MARK SINGLE NOTIFICATION READ
    ========================================================= */

    @Transactional
    public NotificationResponse markRead(
            String notificationId
    ) {

        String userId =
                getAuthenticatedUserId();

        Notification notification =
                getOwnedVisibleNotification(
                        notificationId,
                        userId
                );

        notification.markRead(
                utcNow()
        );

        Notification savedNotification =
                notificationRepository.save(
                        notification
                );

        return mapResponse(
                savedNotification
        );
    }

    /* =========================================================
       MARK SINGLE NOTIFICATION UNREAD
    ========================================================= */

    @Transactional
    public NotificationResponse markUnread(
            String notificationId
    ) {

        String userId =
                getAuthenticatedUserId();

        Notification notification =
                getOwnedVisibleNotification(
                        notificationId,
                        userId
                );

        notification.markUnread();

        Notification savedNotification =
                notificationRepository.save(
                        notification
                );

        return mapResponse(
                savedNotification
        );
    }

    /* =========================================================
       BULK MARK READ
    ========================================================= */

    @Transactional
    public int markSelectedRead(
            Collection<String> notificationIds
    ) {

        String userId =
                getAuthenticatedUserId();

        List<String> ids =
                normalizeIds(
                        notificationIds
                );

        return notificationRepository
                .markSelectedRead(
                        userId,
                        ids,
                        utcNow()
                );
    }

    /* =========================================================
       BULK MARK UNREAD
    ========================================================= */

    @Transactional
    public int markSelectedUnread(
            Collection<String> notificationIds
    ) {

        String userId =
                getAuthenticatedUserId();

        List<String> ids =
                normalizeIds(
                        notificationIds
                );

        return notificationRepository
                .markSelectedUnread(
                        userId,
                        ids
                );
    }

    /* =========================================================
       MARK ALL READ
    ========================================================= */

    @Transactional
    public int markAllRead() {

        String userId =
                getAuthenticatedUserId();

        return notificationRepository
                .markAllRead(
                        userId,
                        utcNow()
                );
    }

    /* =========================================================
       MARK BUSINESS EVENT READ

       This is an internal helper for feature services.

       Example:

       Destination Adviser approves a transfer directly
       from the Transfers page without clicking the bell.

       The original STUDENT_TRANSFER_REQUESTED notification
       should no longer remain unread.
    ========================================================= */

    @Transactional
    public void markBusinessEventRead(
            String recipientUserId,
            String deduplicationKey
    ) {

        String normalizedRecipientId =
                normalizeOptionalText(
                        recipientUserId
                );

        String normalizedDeduplicationKey =
                normalizeOptionalText(
                        deduplicationKey
                );

        if (
                normalizedRecipientId == null ||
                        normalizedDeduplicationKey == null
        ) {
            return;
        }

        notificationRepository
                .markReadByDeduplicationKey(
                        normalizedRecipientId,
                        normalizedDeduplicationKey,
                        utcNow()
                );
    }

    /* =========================================================
       DELETE SINGLE NOTIFICATION

       SOFT DELETE
    ========================================================= */

    @Transactional
    public void deleteNotification(
            String notificationId
    ) {

        String userId =
                getAuthenticatedUserId();

        Notification notification =
                getOwnedVisibleNotification(
                        notificationId,
                        userId
                );

        notification.softDelete(
                utcNow()
        );

        notificationRepository.save(
                notification
        );
    }

    /* =========================================================
       BULK DELETE SELECTED

       SOFT DELETE
    ========================================================= */

    @Transactional
    public int deleteSelected(
            Collection<String> notificationIds
    ) {

        String userId =
                getAuthenticatedUserId();

        List<String> ids =
                normalizeIds(
                        notificationIds
                );

        return notificationRepository
                .softDeleteSelected(
                        userId,
                        ids,
                        utcNow()
                );
    }

    /* =========================================================
       DELETE ALL READ NOTIFICATIONS

       SOFT DELETE
    ========================================================= */

    @Transactional
    public int deleteAllRead() {

        String userId =
                getAuthenticatedUserId();

        return notificationRepository
                .softDeleteAllRead(
                        userId,
                        utcNow()
                );
    }

    /* =========================================================
       DELETE ALL NOTIFICATIONS

       SOFT DELETE
    ========================================================= */

    @Transactional
    public int deleteAll() {

        String userId =
                getAuthenticatedUserId();

        return notificationRepository
                .softDeleteAll(
                        userId,
                        utcNow()
                );
    }

    /* =========================================================
       DELETE NOTIFICATIONS BEFORE DATE

       Example:

       date = 2026-08-01

       Deletes notifications where:

       createdAt < 2026-08-01 00:00
    ========================================================= */

    @Transactional
    public int deleteBefore(
            LocalDate date
    ) {

        if (date == null) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Date is required"
            );
        }

        String userId =
                getAuthenticatedUserId();

        LocalDateTime beforeAt =
                schoolDateStartAsUtc(
                        date
                );

        return notificationRepository
                .softDeleteBefore(
                        userId,
                        beforeAt,
                        utcNow()
                );
    }

    /* =========================================================
       GET OWNED VISIBLE NOTIFICATION

       Prevents one user from reading/deleting another
       user's notification.
    ========================================================= */

    private Notification getOwnedVisibleNotification(
            String notificationId,
            String userId
    ) {

        String normalizedNotificationId =
                normalizeOptionalText(
                        notificationId
                );

        if (normalizedNotificationId == null) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Notification ID is required"
            );
        }

        return notificationRepository
                .findByIdAndRecipient_IdAndDeletedAtIsNull(
                        normalizedNotificationId,
                        userId
                )
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Notification not found"
                                )
                );
    }

    /* =========================================================
       AUTHENTICATED USER ID
    ========================================================= */

    private String getAuthenticatedUserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null ||
                        !authentication.isAuthenticated() ||
                        authentication.getName() == null ||
                        authentication
                                .getName()
                                .isBlank()
        ) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        return authentication
                .getName()
                .trim();
    }

    /* =========================================================
       RESPONSE MAPPER
    ========================================================= */

    private NotificationResponse mapResponse(
            Notification notification
    ) {

        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getReadAt() != null,
                toUtcInstant(
                        notification.getReadAt()
                ),
                toUtcInstant(
                        notification.getCreatedAt()
                )
        );
    }

    /* =========================================================
       UTC / SCHOOL DATE HELPERS
    ========================================================= */

    private LocalDateTime utcNow() {

        return LocalDateTime.now(
                ZoneOffset.UTC
        );
    }

    private Instant toUtcInstant(
            LocalDateTime value
    ) {

        if (value == null) {
            return null;
        }

        return value.toInstant(
                ZoneOffset.UTC
        );
    }

    private LocalDateTime schoolDateStartAsUtc(
            LocalDate date
    ) {

        return date
                .atStartOfDay(
                        SCHOOL_TIME_ZONE
                )
                .withZoneSameInstant(
                        ZoneOffset.UTC
                )
                .toLocalDateTime();
    }

    /* =========================================================
       BULK ID NORMALIZATION
    ========================================================= */

    private List<String> normalizeIds(
            Collection<String> values
    ) {

        if (
                values == null ||
                        values.isEmpty()
        ) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "At least one notification ID is required"
            );
        }

        LinkedHashSet<String> normalized =
                new LinkedHashSet<>();

        for (String value : values) {

            String id =
                    normalizeOptionalText(
                            value
                    );

            if (id != null) {
                normalized.add(
                        id
                );
            }
        }

        if (normalized.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "At least one valid notification ID is required"
            );
        }

        /*
         * Protect the API/database against accidentally
         * huge bulk requests.
         */
        if (normalized.size() > 200) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of 200 notifications may be updated at once"
            );
        }

        return List.copyOf(
                normalized
        );
    }

    /* =========================================================
       REQUIRED TEXT NORMALIZATION
    ========================================================= */

    private String normalizeRequiredText(
            String value,
            String errorMessage
    ) {

        String normalized =
                normalizeOptionalText(
                        value
                );

        if (normalized == null) {
            throw new IllegalArgumentException(
                    errorMessage
            );
        }

        return normalized;
    }

    /* =========================================================
       OPTIONAL TEXT NORMALIZATION
    ========================================================= */

    private String normalizeOptionalText(
            String value
    ) {

        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}
