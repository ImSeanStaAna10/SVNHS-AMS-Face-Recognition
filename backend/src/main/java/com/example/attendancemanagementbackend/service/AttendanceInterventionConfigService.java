package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.AttendanceInterventionConfigRequest;
import com.example.attendancemanagementbackend.dto.intervention.AttendanceInterventionConfigResponse;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.event.AttendanceInterventionConfigUpdatedEvent;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class AttendanceInterventionConfigService {

    private final AttendanceInterventionConfigRepository
            configRepository;

    private final SectionRepository
            sectionRepository;

    private final ApplicationEventPublisher
            eventPublisher;

    public AttendanceInterventionConfigService(
            AttendanceInterventionConfigRepository configRepository,
            SectionRepository sectionRepository,
            ApplicationEventPublisher eventPublisher
    ) {
        this.configRepository =
                configRepository;

        this.sectionRepository =
                sectionRepository;

        this.eventPublisher =
                eventPublisher;
    }

    /* =====================================================
       GET CONFIG
    ===================================================== */

    @Transactional(readOnly = true)
    public AttendanceInterventionConfigResponse getConfig(
            String sectionId
    ) {

        String adviserId =
                getAuthenticatedUserId();

        Section section =
                getOwnedSection(
                        sectionId,
                        adviserId
                );

        AttendanceInterventionConfig config =
                configRepository
                        .findBySection_Id(section.getId())
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance intervention configuration not found"
                                )
                        );

        return mapToResponse(
                config
        );
    }

    /* =====================================================
       CREATE OR UPDATE CONFIG
    ===================================================== */

    @Transactional
    public AttendanceInterventionConfigResponse saveConfig(
            String sectionId,
            AttendanceInterventionConfigRequest request
    ) {

        String adviserId =
                getAuthenticatedUserId();

        Section section =
                getOwnedSection(
                        sectionId,
                        adviserId
                );

        if (!section.isActive()) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Attendance intervention configuration cannot be changed for an inactive section"
            );
        }

        validateRequest(
                request
        );

        AttendanceInterventionConfig config =
                configRepository
                        .findBySection_Id(section.getId())
                        .orElseGet(() ->
                                new AttendanceInterventionConfig(
                                        section,
                                        request.getPeriodStart(),
                                        request.getPeriodEnd(),
                                        request.getWarningAbsenceCount(),
                                        request.getAtRiskAbsenceCount(),
                                        request.getCriticalAbsenceCount()
                                )
                        );

        /*
         * Always set every configurable field.
         *
         * This means PUT behaves as a complete
         * replacement of the section's settings.
         */
        config.setSection(
                section
        );

        config.setEnabled(
                request.isEnabled()
        );

        config.setPeriodStart(
                request.getPeriodStart()
        );

        config.setPeriodEnd(
                request.getPeriodEnd()
        );

        config.setWarningAbsenceCount(
                request.getWarningAbsenceCount()
        );

        config.setAtRiskAbsenceCount(
                request.getAtRiskAbsenceCount()
        );

        config.setCriticalAbsenceCount(
                request.getCriticalAbsenceCount()
        );

        config.setParentNotificationEnabled(
                request.isParentNotificationEnabled()
        );

        config.setWarningNotificationMode(
                request.getWarningNotificationMode()
        );

        config.setAtRiskNotificationMode(
                request.getAtRiskNotificationMode()
        );

        config.setCriticalNotificationMode(
                request.getCriticalNotificationMode()
        );

        config.setAllowParentAcknowledgement(
                request.isAllowParentAcknowledgement()
        );

        config.setAllowParentResponse(
                request.isAllowParentResponse()
        );

        config.setDefaultAdviserMessage(
                normalizeMessage(
                        request.getDefaultAdviserMessage()
                )
        );

        AttendanceInterventionConfig savedConfig =
                configRepository.save(
                        config
                );

        /* =================================================
           PUBLISH CONFIGURATION UPDATED EVENT

           IMPORTANT:

           This event is published while the current
           configuration transaction is still active.

           The corresponding listener uses:

           TransactionPhase.AFTER_COMMIT

           Therefore reconciliation will only run after
           the new configuration has successfully
           committed.

           If this transaction rolls back, the
           reconciliation listener will not run.
        ================================================= */

        eventPublisher.publishEvent(
                new AttendanceInterventionConfigUpdatedEvent(
                        section.getId()
                )
        );

        return mapToResponse(
                savedConfig
        );
    }

    /* =====================================================
       VALIDATION
    ===================================================== */

    private void validateRequest(
            AttendanceInterventionConfigRequest request
    ) {

        validatePeriod(
                request.getPeriodStart(),
                request.getPeriodEnd()
        );

        validateThresholds(
                request.getWarningAbsenceCount(),
                request.getAtRiskAbsenceCount(),
                request.getCriticalAbsenceCount()
        );
    }

    private void validatePeriod(
            LocalDate periodStart,
            LocalDate periodEnd
    ) {

        if (periodStart == null ||
                periodEnd == null) {

            /*
             * Normally handled already by @NotNull,
             * but kept here as defensive validation.
             */
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Risk period start and end dates are required"
            );
        }

        if (periodStart.isAfter(periodEnd)) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Risk period start date must not be after the end date"
            );
        }
    }

    private void validateThresholds(
            int warning,
            int atRisk,
            int critical
    ) {

        if (warning < 1 ||
                atRisk < 1 ||
                critical < 1) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Attendance risk thresholds must be at least 1 absence"
            );
        }

        if (warning >= atRisk) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Warning absence threshold must be lower than the at-risk threshold"
            );
        }

        if (atRisk >= critical) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "At-risk absence threshold must be lower than the critical threshold"
            );
        }
    }

    /* =====================================================
       SECTION OWNERSHIP
    ===================================================== */

    private Section getOwnedSection(
            String sectionId,
            String adviserId
    ) {

        Section section =
                sectionRepository
                        .findById(sectionId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Section not found"
                                )
                        );

        if (section.getAdviser() == null ||
                section.getAdviser().getId() == null ||
                !section.getAdviser()
                        .getId()
                        .equals(adviserId)) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this section"
            );
        }

        return section;
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
                "anonymousUser".equalsIgnoreCase(userId)) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        return userId;
    }

    /* =====================================================
       NORMALIZATION
    ===================================================== */

    private String normalizeMessage(
            String message
    ) {

        if (message == null) {
            return null;
        }

        String normalized =
                message.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    /* =====================================================
       RESPONSE MAPPING
    ===================================================== */

    private AttendanceInterventionConfigResponse mapToResponse(
            AttendanceInterventionConfig config
    ) {

        Section section =
                config.getSection();

        return new AttendanceInterventionConfigResponse(
                config.getId(),
                section != null
                        ? section.getId()
                        : null,
                section != null
                        ? section.getName()
                        : null,
                config.isEnabled(),
                config.getPeriodStart(),
                config.getPeriodEnd(),
                config.getWarningAbsenceCount(),
                config.getAtRiskAbsenceCount(),
                config.getCriticalAbsenceCount(),
                config.isParentNotificationEnabled(),
                config.getWarningNotificationMode(),
                config.getAtRiskNotificationMode(),
                config.getCriticalNotificationMode(),
                config.isAllowParentAcknowledgement(),
                config.isAllowParentResponse(),
                config.getDefaultAdviserMessage(),
                config.getCreatedAt(),
                config.getUpdatedAt()
        );
    }
}
