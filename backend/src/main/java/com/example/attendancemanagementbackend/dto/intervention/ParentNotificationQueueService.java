package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationQueueResponse;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceNotificationMode;
import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.NotificationOutbox;
import com.example.attendancemanagementbackend.entity.NotificationOutboxType;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationSendMode;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.NotificationOutboxRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationRepository;

import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.util.Optional;

@Service
public class ParentNotificationQueueService {

    private final ParentNotificationRepository
            parentNotificationRepository;

    private final NotificationOutboxRepository
            notificationOutboxRepository;

    private final AttendanceInterventionConfigRepository
            configRepository;

    public ParentNotificationQueueService(
            ParentNotificationRepository parentNotificationRepository,
            NotificationOutboxRepository notificationOutboxRepository,
            AttendanceInterventionConfigRepository configRepository
    ) {

        this.parentNotificationRepository =
                parentNotificationRepository;

        this.notificationOutboxRepository =
                notificationOutboxRepository;

        this.configRepository =
                configRepository;
    }

    /* =====================================================
       QUEUE MANUAL PARENT NOTIFICATION
    ===================================================== */

    /**
     * Queues a previously prepared manual ParentNotification.
     *
     * IMPORTANT:
     *
     * This method does NOT call Gmail.
     *
     * It only performs a single database transaction:
     *
     * ParentNotification:
     * PENDING -> QUEUED
     *
     * NotificationOutbox:
     * new PENDING delivery job
     *
     * If either database operation fails,
     * the whole transaction rolls back.
     */
    @Transactional
    public ParentNotificationQueueResponse queueForDelivery(
            String notificationId
    ) {

        String adviserId =
                getAuthenticatedUserId();

        /* =====================================================
           LOAD PARENT NOTIFICATION
        ===================================================== */

        ParentNotification notification =
                parentNotificationRepository
                        .findById(
                                notificationId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Parent notification not found"
                                )
                        );

        /* =====================================================
           VERIFY OWNERSHIP
        ===================================================== */

        verifyOwnership(
                notification,
                adviserId
        );

        /* =====================================================
           IDEMPOTENCY

           If an outbox item already exists,
           NEVER create a duplicate.

           This protects against:
           - double clicks
           - frontend retries
           - temporary network retries
        ===================================================== */

        Optional<NotificationOutbox>
                existingOutbox =
                notificationOutboxRepository
                        .findByParentNotification_Id(
                                notification.getId()
                        );

        if (existingOutbox.isPresent()) {

            NotificationOutbox outbox =
                    existingOutbox.get();

            return mapResponse(
                    notification,
                    outbox
            );
        }

        /* =====================================================
           VALIDATE CURRENT NOTIFICATION STATE
        ===================================================== */

        if (notification.getStatus() !=
                ParentNotificationStatus.PENDING) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Only a pending parent notification can be queued for delivery"
            );
        }

        /* =====================================================
           MANUAL SEND ONLY

           Automatic mode will be connected later
           directly from threshold intervention events.
        ===================================================== */

        if (notification.getSendMode() !=
                ParentNotificationSendMode.MANUAL) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This endpoint can only queue manually prepared parent notifications"
            );
        }

        /* =====================================================
           VALIDATE INTERVENTION
        ===================================================== */

        AttendanceIntervention intervention =
                notification.getIntervention();

        if (intervention == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Parent notification is not linked to an attendance intervention"
            );
        }

        /*
         * Do not send a brand-new notice for an
         * intervention that was already resolved.
         */
        if (intervention.getStatus() ==
                AttendanceInterventionStatus.RESOLVED) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This attendance intervention has already been resolved"
            );
        }

        /* =====================================================
           VALIDATE CURRENT CONFIGURATION
        ===================================================== */

        Section section =
                intervention.getSection();

        if (section == null ||
                section.getId() == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance intervention does not have a valid section"
            );
        }

        AttendanceInterventionConfig config =
                configRepository
                        .findBySection_Id(
                                section.getId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.CONFLICT,
                                        "Attendance intervention configuration was not found"
                                )
                        );

        if (!config.isEnabled()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance intervention is currently disabled for this section"
            );
        }

        if (!config.isParentNotificationEnabled()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Parent attendance notifications are currently disabled for this section"
            );
        }

        AttendanceNotificationMode notificationMode =
                resolveNotificationMode(
                        intervention.getRiskLevel(),
                        config
                );

        if (notificationMode ==
                AttendanceNotificationMode.DISABLED) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Parent notification is disabled for this risk level"
            );
        }

        /*
         * Phase 5C handles the manual workflow.
         *
         * AUTOMATIC will be connected separately so
         * automatic threshold notifications do not
         * depend on an Adviser clicking this endpoint.
         */
        if (notificationMode !=
                AttendanceNotificationMode.MANUAL) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This risk level is configured for automatic parent notification"
            );
        }

        /* =====================================================
           CREATE OUTBOX JOB
        ===================================================== */

        NotificationOutbox outbox =
                new NotificationOutbox(
                        notification,
                        NotificationOutboxType.PARENT_ATTENDANCE_EMAIL
                );

        NotificationOutbox savedOutbox =
                notificationOutboxRepository
                        .save(
                                outbox
                        );

        /* =====================================================
           UPDATE PARENT NOTIFICATION
        ===================================================== */

        LocalDateTime now =
                AppTime.now();

        notification.setStatus(
                ParentNotificationStatus.QUEUED
        );

        notification.setQueuedAt(
                now
        );

        ParentNotification savedNotification =
                parentNotificationRepository
                        .save(
                                notification
                        );

        return mapResponse(
                savedNotification,
                savedOutbox
        );
    }

    /* =====================================================
       RESOLVE CONFIGURED MODE
    ===================================================== */

    private AttendanceNotificationMode resolveNotificationMode(
            AttendanceRiskLevel riskLevel,
            AttendanceInterventionConfig config
    ) {

        if (riskLevel == null) {

            return AttendanceNotificationMode.DISABLED;
        }

        return switch (riskLevel) {

            case WARNING ->
                    config.getWarningNotificationMode();

            case AT_RISK ->
                    config.getAtRiskNotificationMode();

            case CRITICAL ->
                    config.getCriticalNotificationMode();

            case NORMAL ->
                    AttendanceNotificationMode.DISABLED;
        };
    }

    /* =====================================================
       VERIFY ADVISER OWNERSHIP
    ===================================================== */

    private void verifyOwnership(
            ParentNotification notification,
            String adviserId
    ) {

        if (notification.getIntervention() == null) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this parent notification"
            );
        }

        Section section =
                notification
                        .getIntervention()
                        .getSection();

        if (section == null ||
                section.getAdviser() == null ||
                section.getAdviser().getId() == null ||
                !section.getAdviser()
                        .getId()
                        .equals(adviserId)) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this parent notification"
            );
        }
    }

    /* =====================================================
       MAP RESPONSE
    ===================================================== */

    private ParentNotificationQueueResponse mapResponse(
            ParentNotification notification,
            NotificationOutbox outbox
    ) {

        return new ParentNotificationQueueResponse(
                notification.getId(),
                notification.getStatus(),
                outbox.getId(),
                outbox.getType(),
                outbox.getStatus(),
                outbox.getAttemptCount(),
                notification.getQueuedAt(),
                outbox.getNextAttemptAt()
        );
    }

    /* =====================================================
       AUTHENTICATED USER
    ===================================================== */

    private String getAuthenticatedUserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        String userId =
                authentication.getName();

        if (userId == null ||
                userId.isBlank() ||
                "anonymousUser".equalsIgnoreCase(
                        userId
                )) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        return userId;
    }
}