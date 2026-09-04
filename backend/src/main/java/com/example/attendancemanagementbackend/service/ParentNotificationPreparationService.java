package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationAbsenceResponse;
import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationPreviewResponse;
import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationResponse;
import com.example.attendancemanagementbackend.dto.intervention.PrepareParentNotificationRequest;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationAbsence;
import com.example.attendancemanagementbackend.entity.ParentNotificationSendMode;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentGuardian;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.AttendanceInterventionRepository;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationAbsenceRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationRepository;
import com.example.attendancemanagementbackend.repository.StudentGuardianRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class ParentNotificationPreparationService {

    private final AttendanceInterventionRepository
            interventionRepository;

    private final AttendanceInterventionConfigRepository
            configRepository;

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final StudentGuardianRepository
            studentGuardianRepository;

    private final ParentNotificationRepository
            parentNotificationRepository;

    private final ParentNotificationAbsenceRepository
            parentNotificationAbsenceRepository;

    /*
     * Secure parent-review token service.
     *
     * This generates the opaque token deterministically
     * from the notification UUID + server secret,
     * but only the SHA-256 token hash is persisted.
     */
    private final ParentNotificationSecureTokenService
            secureTokenService;

    public ParentNotificationPreparationService(
            AttendanceInterventionRepository interventionRepository,
            AttendanceInterventionConfigRepository configRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            StudentGuardianRepository studentGuardianRepository,
            ParentNotificationRepository parentNotificationRepository,
            ParentNotificationAbsenceRepository parentNotificationAbsenceRepository,
            ParentNotificationSecureTokenService secureTokenService
    ) {

        this.interventionRepository =
                interventionRepository;

        this.configRepository =
                configRepository;

        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.studentGuardianRepository =
                studentGuardianRepository;

        this.parentNotificationRepository =
                parentNotificationRepository;

        this.parentNotificationAbsenceRepository =
                parentNotificationAbsenceRepository;

        this.secureTokenService =
                secureTokenService;
    }

    /* =====================================================
       PREVIEW
    ===================================================== */

    @Transactional(readOnly = true)
    public ParentNotificationPreviewResponse preview(
            String interventionId
    ) {

        String adviserId =
                getAuthenticatedUserId();

        AttendanceIntervention intervention =
                getOwnedIntervention(
                        interventionId,
                        adviserId
                );

        Student student =
                intervention.getStudent();

        StudentGuardian guardian =
                getNotificationGuardian(
                        student.getId()
                );

        List<AttendanceRecord> absenceRecords =
                getCurrentAbsences(
                        intervention
                );

        AttendanceInterventionConfig config =
                configRepository
                        .findBySection_Id(
                                intervention
                                        .getSection()
                                        .getId()
                        )
                        .orElse(null);

        String defaultMessage =
                config != null
                        ? config.getDefaultAdviserMessage()
                        : null;

        List<ParentNotificationAbsenceResponse> absences =
                absenceRecords
                        .stream()
                        .map(
                                this::mapCurrentAbsence
                        )
                        .toList();

        int currentAbsenceCount =
                absenceRecords.size();

        boolean attendanceChanged =
                currentAbsenceCount !=
                        intervention.getActualAbsenceCount();

        return new ParentNotificationPreviewResponse(
                intervention.getId(),
                student.getId(),
                student.getStudentNumber(),
                student.getName(),
                guardian.getId(),
                guardian.getName(),
                guardian.getEmail(),
                intervention.getRiskLevel(),
                intervention.getThresholdAbsenceCount(),
                intervention.getActualAbsenceCount(),
                currentAbsenceCount,
                attendanceChanged,
                intervention.getPeriodStart(),
                intervention.getPeriodEnd(),
                buildSubject(
                        student.getName(),
                        intervention
                                .getRiskLevel()
                                .name()
                ),
                defaultMessage,
                absences
        );
    }

    /* =====================================================
       PREPARE MANUAL NOTIFICATION
    ===================================================== */

    @Transactional
    public ParentNotificationResponse prepareManualNotification(
            String interventionId,
            PrepareParentNotificationRequest request
    ) {

        String adviserId =
                getAuthenticatedUserId();

        AttendanceIntervention intervention =
                getOwnedIntervention(
                        interventionId,
                        adviserId
                );

        Student student =
                intervention.getStudent();

        StudentGuardian guardian =
                getNotificationGuardian(
                        student.getId()
                );

        List<AttendanceRecord> absenceRecords =
                getCurrentAbsences(
                        intervention
                );

        int currentAbsenceCount =
                absenceRecords.size();

        /*
         * Do not prepare a notice claiming that the
         * student currently meets this risk threshold
         * when attendance corrections have already
         * lowered the absence count below it.
         */
        if (currentAbsenceCount <
                intervention.getThresholdAbsenceCount()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance was updated after this intervention and the student no longer meets this risk threshold"
            );
        }

        String adviserNote =
                normalizeNote(
                        request != null
                                ? request.getAdviserNote()
                                : null
                );

        /*
         * Use section default message when Adviser
         * did not provide their own note.
         */
        if (adviserNote == null) {

            AttendanceInterventionConfig config =
                    configRepository
                            .findBySection_Id(
                                    intervention
                                            .getSection()
                                            .getId()
                            )
                            .orElse(null);

            if (config != null) {

                adviserNote =
                        normalizeNote(
                                config
                                        .getDefaultAdviserMessage()
                        );
            }
        }

        String subject =
                buildSubject(
                        student.getName(),
                        intervention
                                .getRiskLevel()
                                .name()
                );

        /* =====================================================
           FREEZE NOTIFICATION HEADER
        ===================================================== */

        ParentNotification notification =
                new ParentNotification(
                        intervention,
                        student,
                        guardian,
                        ParentNotificationSendMode.MANUAL,
                        guardian.getName(),
                        guardian.getEmail(),
                        student.getStudentNumber(),
                        student.getName(),
                        subject,
                        adviserNote,
                        currentAbsenceCount,
                        intervention.getRiskLevel()
                );

        /*
         * Save first so the notification receives its UUID.
         *
         * The secure token is derived from this UUID,
         * therefore token generation must happen after
         * the initial save.
         */
        ParentNotification savedNotification =
                parentNotificationRepository
                        .save(
                                notification
                        );

        /* =====================================================
           INITIALIZE SECURE PARENT-REVIEW TOKEN

           Raw token:
           - never stored in the database
           - never returned by this API

           Database stores:
           - SHA-256 token hash
           - expiration timestamp
        ===================================================== */

        secureTokenService
                .initializeTokenMetadata(
                        savedNotification
                );

        /*
         * Explicitly save the updated secure-token metadata.
         *
         * Because this whole method is transactional,
         * notification + token metadata + absence snapshots
         * still commit atomically.
         */
        savedNotification =
                parentNotificationRepository
                        .save(
                                savedNotification
                        );

        /* =====================================================
           FREEZE EXACT ABSENCE ROWS
        ===================================================== */

        List<ParentNotificationAbsence> snapshots =
                new ArrayList<>();

        for (AttendanceRecord record :
                absenceRecords) {

            AttendanceSession session =
                    record.getSession();

            ParentNotificationAbsence snapshot =
                    new ParentNotificationAbsence(
                            savedNotification,
                            record,
                            session,
                            session.getAttendanceDate(),
                            session.getStartedAt(),
                            session.getEndedAt(),
                            record.getStatus()
                    );

            snapshots.add(
                    snapshot
            );
        }

        List<ParentNotificationAbsence> savedSnapshots =
                parentNotificationAbsenceRepository
                        .saveAll(
                                snapshots
                        );

        return mapPreparedNotification(
                savedNotification,
                savedSnapshots
        );
    }

    /* =====================================================
       LOAD CURRENT ABSENCES
    ===================================================== */

    private List<AttendanceRecord> getCurrentAbsences(
            AttendanceIntervention intervention
    ) {

        return attendanceRecordRepository
                .findFinalizedStudentAbsencesForNotification(
                        intervention
                                .getStudent()
                                .getId(),
                        intervention.getPeriodStart(),
                        intervention.getPeriodEnd()
                );
    }

    /* =====================================================
       GUARDIAN
    ===================================================== */

    private StudentGuardian getNotificationGuardian(
            String studentId
    ) {

        StudentGuardian guardian =
                studentGuardianRepository
                        .findFirstByStudent_IdAndPrimaryGuardianTrueAndActiveTrue(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.BAD_REQUEST,
                                        "Student does not have an active primary guardian"
                                )
                        );

        if (!guardian.isReceiveAttendanceNotifications()) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "The student's primary guardian has attendance notifications disabled"
            );
        }

        if (guardian.getEmail() == null ||
                guardian
                        .getEmail()
                        .isBlank()) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "The student's primary guardian does not have an email address"
            );
        }

        return guardian;
    }

    /* =====================================================
       INTERVENTION OWNERSHIP
    ===================================================== */

    private AttendanceIntervention getOwnedIntervention(
            String interventionId,
            String adviserId
    ) {

        AttendanceIntervention intervention =
                interventionRepository
                        .findById(
                                interventionId
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
                    "You are not allowed to manage this attendance intervention"
            );
        }

        return intervention;
    }

    /* =====================================================
       SUBJECT
    ===================================================== */

    private String buildSubject(
            String studentName,
            String riskLevel
    ) {

        String readableRisk =
                riskLevel
                        .replace(
                                "_",
                                " "
                        );

        return "Attendance Notice - " +
                studentName +
                " - " +
                readableRisk;
    }

    /* =====================================================
       NOTE NORMALIZATION
    ===================================================== */

    private String normalizeNote(
            String note
    ) {

        if (note == null) {

            return null;
        }

        String normalized =
                note.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    /* =====================================================
       CURRENT ABSENCE RESPONSE
    ===================================================== */

    private ParentNotificationAbsenceResponse mapCurrentAbsence(
            AttendanceRecord record
    ) {

        AttendanceSession session =
                record.getSession();

        return new ParentNotificationAbsenceResponse(
                record.getId(),
                session.getId(),
                session.getAttendanceDate(),
                session.getStartedAt(),
                session.getEndedAt(),
                record.getStatus()
        );
    }

    /* =====================================================
       PREPARED RESPONSE
    ===================================================== */

    private ParentNotificationResponse mapPreparedNotification(
            ParentNotification notification,
            List<ParentNotificationAbsence> snapshots
    ) {

        List<ParentNotificationAbsenceResponse> absences =
                snapshots
                        .stream()
                        .map(snapshot ->
                                new ParentNotificationAbsenceResponse(
                                        snapshot
                                                .getAttendanceRecord()
                                                .getId(),

                                        snapshot
                                                .getAttendanceSession()
                                                .getId(),

                                        snapshot
                                                .getAttendanceDate(),

                                        snapshot
                                                .getSessionStartedAt(),

                                        snapshot
                                                .getSessionEndedAt(),

                                        snapshot
                                                .getStatusAtSend()
                                )
                        )
                        .toList();

        return new ParentNotificationResponse(
                notification.getId(),

                notification
                        .getIntervention()
                        .getId(),

                notification
                        .getStudent()
                        .getId(),

                notification
                        .getGuardian()
                        .getId(),

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

                notification.getCreatedAt(),

                absences
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