package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.ParentCommunicationResponse;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionRepository;

import jakarta.persistence.EntityManager;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ParentCommunicationService {

    private static final int MAX_HISTORY_ITEMS =
            50;

    private final AttendanceInterventionRepository
            interventionRepository;

    private final EntityManager
            entityManager;

    public ParentCommunicationService(
            AttendanceInterventionRepository interventionRepository,
            EntityManager entityManager
    ) {

        this.interventionRepository =
                interventionRepository;

        this.entityManager =
                entityManager;
    }

    /* =====================================================
       ADVISER COMMUNICATION HISTORY

       Returns newest first so the frontend can immediately
       display the latest delivery state while still retaining
       older acknowledged / responded notices.

       We intentionally keep this endpoint read-only and do
       not expose acknowledgement tokens.
    ===================================================== */

    @Transactional(readOnly = true)
    public List<ParentCommunicationResponse> getByIntervention(
            String interventionId
    ) {

        String adviserId =
                getAuthenticatedUserId();

        AttendanceIntervention intervention =
                getOwnedIntervention(
                        interventionId,
                        adviserId
                );

        List<ParentNotification> notifications =
                entityManager
                        .createQuery(
                                """
                                SELECT notification
                                FROM ParentNotification notification
                                WHERE notification.intervention.id = :interventionId
                                ORDER BY notification.createdAt DESC
                                """,
                                ParentNotification.class
                        )
                        .setParameter(
                                "interventionId",
                                intervention.getId()
                        )
                        .setMaxResults(
                                MAX_HISTORY_ITEMS
                        )
                        .getResultList();

        return notifications
                .stream()
                .map(
                        this::mapResponse
                )
                .toList();
    }

    /* =====================================================
       MAP RESPONSE
    ===================================================== */

    private ParentCommunicationResponse mapResponse(
            ParentNotification notification
    ) {

        String interventionId =
                notification.getIntervention() != null
                        ? notification
                        .getIntervention()
                        .getId()
                        : null;

        String studentId =
                notification.getStudent() != null
                        ? notification
                        .getStudent()
                        .getId()
                        : null;

        String guardianId =
                notification.getGuardian() != null
                        ? notification
                        .getGuardian()
                        .getId()
                        : null;

        return new ParentCommunicationResponse(
                notification.getId(),
                interventionId,
                studentId,
                guardianId,
                notification.getSendMode(),
                notification.getStatus(),
                notification.getRecipientName(),
                notification.getRecipientEmail(),
                notification.getStudentNumberAtSend(),
                notification.getStudentNameAtSend(),
                notification.getSubject(),
                notification.getAdviserNote(),
                notification.getAbsenceCountAtSend(),
                notification.getRiskLevelAtSend(),
                notification.getQueuedAt(),
                notification.getSentAt(),
                notification.getFailedAt(),
                notification.getFailureReason(),
                notification.getAcknowledgedAt(),
                notification.getRespondedAt(),
                notification.getParentResponse(),
                notification.getCreatedAt(),
                notification.getUpdatedAt()
        );
    }

    /* =====================================================
       INTERVENTION OWNERSHIP

       This intentionally mirrors the ownership rule already
       used by ParentNotificationPreparationService.
    ===================================================== */

    private AttendanceIntervention getOwnedIntervention(
            String interventionId,
            String adviserId
    ) {

        if (interventionId == null ||
                interventionId.isBlank()) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Attendance intervention ID is required"
            );
        }

        AttendanceIntervention intervention =
                interventionRepository
                        .findById(
                                interventionId.trim()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance intervention not found"
                                )
                        );

        Section section =
                intervention.getSection();

        if (section == null ||
                section.getAdviser() == null ||
                section
                        .getAdviser()
                        .getId() == null ||
                !section
                        .getAdviser()
                        .getId()
                        .equals(
                                adviserId
                        )) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to view this attendance intervention"
            );
        }

        return intervention;
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
                "anonymousUser"
                        .equalsIgnoreCase(
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
