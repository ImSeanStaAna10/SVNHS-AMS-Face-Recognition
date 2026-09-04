package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationResponseRequest;
import com.example.attendancemanagementbackend.dto.intervention.PublicParentNotificationAbsenceResponse;
import com.example.attendancemanagementbackend.dto.intervention.PublicParentNotificationResponse;

import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.NotificationType;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationAbsence;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationAbsenceRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationRepository;

import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.util.List;

@Service
public class ParentNotificationPublicService {

    /* =====================================================
       DEPENDENCIES
    ===================================================== */

    private final ParentNotificationRepository
            parentNotificationRepository;

    private final ParentNotificationAbsenceRepository
            parentNotificationAbsenceRepository;

    private final AttendanceInterventionConfigRepository
            configRepository;

    private final ParentNotificationSecureTokenService
            secureTokenService;

    private final NotificationService
            notificationService;

    /* =====================================================
       CONSTRUCTOR
    ===================================================== */

    public ParentNotificationPublicService(
            ParentNotificationRepository parentNotificationRepository,
            ParentNotificationAbsenceRepository parentNotificationAbsenceRepository,
            AttendanceInterventionConfigRepository configRepository,
            ParentNotificationSecureTokenService secureTokenService,
            NotificationService notificationService
    ) {

        this.parentNotificationRepository =
                parentNotificationRepository;

        this.parentNotificationAbsenceRepository =
                parentNotificationAbsenceRepository;

        this.configRepository =
                configRepository;

        this.secureTokenService =
                secureTokenService;

        this.notificationService =
                notificationService;
    }

    /* =====================================================
       PUBLIC NOTICE VIEW
    ===================================================== */

    @Transactional(readOnly = true)
    public PublicParentNotificationResponse getNotice(
            String rawToken
    ) {

        ParentNotification notification =
                getAccessibleNotification(
                        rawToken
                );

        return mapToResponse(
                notification
        );
    }

    /* =====================================================
       ACKNOWLEDGE NOTICE
    ===================================================== */

    @Transactional
    public PublicParentNotificationResponse acknowledge(
            String rawToken
    ) {

        ParentNotification notification =
                getAccessibleNotification(
                        rawToken
                );

        AttendanceInterventionConfig config =
                getCurrentConfig(
                        notification
                );

        if (
                config == null ||
                        !config.isAllowParentAcknowledgement()
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Parent acknowledgement is not enabled for this attendance notice"
            );
        }

        /*
         * Remember whether this is the FIRST acknowledgement.
         *
         * We only create an adviser notification on the
         * actual state transition.
         *
         * Repeated clicks / browser refreshes must not
         * create duplicate adviser notifications.
         */
        boolean firstAcknowledgement =
                notification.getAcknowledgedAt() == null;

        /*
         * Idempotent acknowledgement.
         */
        if (firstAcknowledgement) {

            notification.setAcknowledgedAt(
                    AppTime.now()
            );
        }

        /*
         * A RESPONDED notification is already considered
         * acknowledged.
         *
         * Never downgrade RESPONDED back to ACKNOWLEDGED.
         */
        if (
                notification.getStatus() !=
                        ParentNotificationStatus.RESPONDED
        ) {

            notification.setStatus(
                    ParentNotificationStatus.ACKNOWLEDGED
            );
        }

        ParentNotification saved =
                parentNotificationRepository.save(
                        notification
                );

        /*
         * Only notify the Adviser when the parent actually
         * acknowledged the notice for the first time.
         *
         * NotificationService also has its own database-backed
         * deduplication protection.
         */
        if (firstAcknowledgement) {

            createParentAcknowledgedAdviserNotification(
                    saved
            );
        }

        return mapToResponse(
                saved
        );
    }

    /* =====================================================
       SUBMIT PARENT RESPONSE
    ===================================================== */

    @Transactional
    public PublicParentNotificationResponse respond(
            String rawToken,
            ParentNotificationResponseRequest request
    ) {

        ParentNotification notification =
                getAccessibleNotification(
                        rawToken
                );

        AttendanceInterventionConfig config =
                getCurrentConfig(
                        notification
                );

        if (
                config == null ||
                        !config.isAllowParentResponse()
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Parent response is not enabled for this attendance notice"
            );
        }

        String response =
                normalizeResponse(
                        request != null
                                ? request.response()
                                : null
                );

        if (response == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Parent response is required"
            );
        }

        /* =================================================
           RESPONSE IDEMPOTENCY

           Same response submitted twice:
           return existing state.

           Different response after final submission:
           reject instead of silently modifying audit history.
        ================================================= */

        if (
                notification.getRespondedAt() != null
        ) {

            String existingResponse =
                    normalizeResponse(
                            notification.getParentResponse()
                    );

            if (
                    response.equals(
                            existingResponse
                    )
            ) {

                /*
                 * Important:
                 *
                 * No adviser notification is created here.
                 *
                 * This is the same response being submitted
                 * again, so it is not a new business event.
                 */
                return mapToResponse(
                        notification
                );
            }

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "A parent response has already been submitted for this attendance notice"
            );
        }

        LocalDateTime now =
                AppTime.now();

        /*
         * Responding also means the parent has seen /
         * acknowledged the notice.
         *
         * If the parent responds directly without pressing
         * the separate acknowledgement action first, we set
         * acknowledgedAt here.
         *
         * We intentionally do NOT create a separate
         * acknowledgement bell notification in this path.
         *
         * The stronger "Parent response received" notification
         * is enough and avoids showing two notifications for
         * one parent action.
         */
        if (
                notification.getAcknowledgedAt() == null
        ) {

            notification.setAcknowledgedAt(
                    now
            );
        }

        notification.setParentResponse(
                response
        );

        notification.setRespondedAt(
                now
        );

        notification.setStatus(
                ParentNotificationStatus.RESPONDED
        );

        ParentNotification saved =
                parentNotificationRepository.save(
                        notification
                );

        /*
         * This code is only reached for the FIRST response.
         *
         * The idempotency block above returns immediately
         * for repeated identical submissions.
         */
        createParentRespondedAdviserNotification(
                saved
        );

        return mapToResponse(
                saved
        );
    }

    /* =====================================================
       ADVISER NOTIFICATION:
       PARENT ACKNOWLEDGED
    ===================================================== */

    private void createParentAcknowledgedAdviserNotification(
            ParentNotification parentNotification
    ) {

        User adviser =
                getInterventionAdviser(
                        parentNotification
                );

        /*
         * If an intervention somehow no longer has an Adviser,
         * the public parent action must still succeed.
         *
         * We simply skip the in-app notification.
         */
        if (adviser == null) {
            return;
        }

        String parentName =
                safeDisplayText(
                        parentNotification.getRecipientName(),
                        "Parent or guardian"
                );

        String studentName =
                safeDisplayText(
                        parentNotification.getStudentNameAtSend(),
                        "the student"
                );

        String notificationId =
                parentNotification.getId();

        String interventionId =
                getInterventionId(
                        parentNotification
                );

        String title =
                "Parent acknowledged attendance notice";

        String message =
                parentName +
                        " acknowledged the attendance notice for " +
                        studentName +
                        ".";

        /*
         * We deliberately leave referenceType null for now.
         *
         * The current request is only for an in-app Adviser
         * notification.
         *
         * We still store the intervention ID as referenceId
         * so we can make the notification clickable later
         * without changing the notification record.
         */
        notificationService.createForUser(
                adviser,
                NotificationType.PARENT_ATTENDANCE_ACKNOWLEDGED,
                title,
                message,
                null,
                interventionId,
                buildAcknowledgedDeduplicationKey(
                        notificationId
                )
        );
    }

    /* =====================================================
       ADVISER NOTIFICATION:
       PARENT RESPONDED
    ===================================================== */

    private void createParentRespondedAdviserNotification(
            ParentNotification parentNotification
    ) {

        User adviser =
                getInterventionAdviser(
                        parentNotification
                );

        if (adviser == null) {
            return;
        }

        String parentName =
                safeDisplayText(
                        parentNotification.getRecipientName(),
                        "Parent or guardian"
                );

        String studentName =
                safeDisplayText(
                        parentNotification.getStudentNameAtSend(),
                        "the student"
                );

        String notificationId =
                parentNotification.getId();

        String interventionId =
                getInterventionId(
                        parentNotification
                );

        String title =
                "Parent response received";

        String message =
                parentName +
                        " responded to the attendance notice for " +
                        studentName +
                        ".";

        /*
         * We do NOT put the parent's actual written response
         * inside the bell notification.
         *
         * That content stays in ParentNotification and can
         * later be shown in a dedicated response/details UI.
         */
        notificationService.createForUser(
                adviser,
                NotificationType.PARENT_ATTENDANCE_RESPONDED,
                title,
                message,
                null,
                interventionId,
                buildRespondedDeduplicationKey(
                        notificationId
                )
        );
    }

    /* =====================================================
       INTERVENTION ADVISER
    ===================================================== */

    private User getInterventionAdviser(
            ParentNotification notification
    ) {

        if (
                notification == null ||
                        notification.getIntervention() == null ||
                        notification
                                .getIntervention()
                                .getSection() == null
        ) {

            return null;
        }

        return notification
                .getIntervention()
                .getSection()
                .getAdviser();
    }

    /* =====================================================
       INTERVENTION ID
    ===================================================== */

    private String getInterventionId(
            ParentNotification notification
    ) {

        if (
                notification == null ||
                        notification.getIntervention() == null ||
                        notification
                                .getIntervention()
                                .getId() == null
        ) {

            return null;
        }

        String interventionId =
                notification
                        .getIntervention()
                        .getId()
                        .trim();

        return interventionId.isEmpty()
                ? null
                : interventionId;
    }

    /* =====================================================
       NOTIFICATION DEDUPLICATION KEYS
    ===================================================== */

    private String buildAcknowledgedDeduplicationKey(
            String parentNotificationId
    ) {

        return "parent-attendance-notification:" +
                parentNotificationId +
                ":acknowledged";
    }

    private String buildRespondedDeduplicationKey(
            String parentNotificationId
    ) {

        return "parent-attendance-notification:" +
                parentNotificationId +
                ":responded";
    }

    /* =====================================================
       SAFE DISPLAY TEXT
    ===================================================== */

    private String safeDisplayText(
            String value,
            String fallback
    ) {

        if (value == null) {
            return fallback;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? fallback
                : normalized;
    }

    /* =====================================================
       LOAD TOKEN-PROTECTED NOTIFICATION
    ===================================================== */

    private ParentNotification getAccessibleNotification(
            String rawToken
    ) {

        String tokenHash;

        try {

            tokenHash =
                    secureTokenService
                            .hashIncomingToken(
                                    rawToken
                            );
        }

        catch (IllegalArgumentException exception) {

            /*
             * Do not expose token-validation details.
             */
            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance notice not found"
            );
        }

        ParentNotification notification =
                parentNotificationRepository
                        .findByAcknowledgementTokenHash(
                                tokenHash
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance notice not found"
                                )
                        );

        /* =================================================
           TOKEN EXPIRATION
        ================================================= */

        if (
                secureTokenService.isExpired(
                        notification
                )
        ) {

            throw new ApiException(
                    HttpStatus.GONE,
                    "This attendance notice link has expired"
            );
        }

        /* =================================================
           DELIVERY STATE

           Parent-access links should represent notices
           that were actually delivered successfully.

           Do not expose:
           PENDING
           QUEUED
           FAILED
        ================================================= */

        ParentNotificationStatus status =
                notification.getStatus();

        boolean accessible =
                status ==
                        ParentNotificationStatus.SENT
                        ||
                        status ==
                                ParentNotificationStatus.ACKNOWLEDGED
                        ||
                        status ==
                                ParentNotificationStatus.RESPONDED;

        if (!accessible) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance notice not found"
            );
        }

        return notification;
    }

    /* =====================================================
       LOAD INTERVENTION CONFIG
    ===================================================== */

    private AttendanceInterventionConfig getCurrentConfig(
            ParentNotification notification
    ) {

        if (
                notification == null ||
                        notification.getIntervention() == null ||
                        notification
                                .getIntervention()
                                .getSection() == null ||
                        notification
                                .getIntervention()
                                .getSection()
                                .getId() == null
        ) {

            return null;
        }

        String sectionId =
                notification
                        .getIntervention()
                        .getSection()
                        .getId();

        return configRepository
                .findBySection_Id(
                        sectionId
                )
                .orElse(
                        null
                );
    }

    /* =====================================================
       MAP PUBLIC RESPONSE
    ===================================================== */

    private PublicParentNotificationResponse mapToResponse(
            ParentNotification notification
    ) {

        AttendanceInterventionConfig config =
                getCurrentConfig(
                        notification
                );

        boolean acknowledgementAllowed =
                config != null &&
                        config.isAllowParentAcknowledgement();

        boolean responseAllowed =
                config != null &&
                        config.isAllowParentResponse();

        List<ParentNotificationAbsence> snapshots =
                parentNotificationAbsenceRepository
                        .findByNotification_IdOrderByAttendanceDateAsc(
                                notification.getId()
                        );

        List<PublicParentNotificationAbsenceResponse> absences =
                snapshots
                        .stream()
                        .map(snapshot ->
                                new PublicParentNotificationAbsenceResponse(
                                        snapshot.getAttendanceDate(),
                                        snapshot.getSessionStartedAt(),
                                        snapshot.getSessionEndedAt(),
                                        snapshot.getStatusAtSend()
                                )
                        )
                        .toList();

        return new PublicParentNotificationResponse(
                notification.getRecipientName(),
                notification.getStudentNumberAtSend(),
                notification.getStudentNameAtSend(),
                notification.getSubject(),
                notification.getAdviserNote(),
                notification.getAbsenceCountAtSend(),
                notification.getRiskLevelAtSend(),
                notification.getStatus(),
                notification.getTokenExpiresAt(),
                acknowledgementAllowed,
                responseAllowed,
                notification.getAcknowledgedAt(),
                notification.getRespondedAt(),
                notification.getParentResponse(),
                absences
        );
    }

    /* =====================================================
       NORMALIZE RESPONSE
    ===================================================== */

    private String normalizeResponse(
            String value
    ) {

        if (value == null) {

            return null;
        }

        String normalized =
                value.trim();

        if (
                normalized.isEmpty()
        ) {

            return null;
        }

        /*
         * @Size handles this at controller level,
         * but keep service-level validation as defense
         * in depth.
         */
        if (
                normalized.length() >
                        2000
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Parent response must not exceed 2000 characters"
            );
        }

        return normalized;
    }
}