package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.intervention.AttendanceRiskSectionResponse;
import com.example.attendancemanagementbackend.dto.intervention.StudentAttendanceRiskResponse;

import com.example.attendancemanagementbackend.dto.student.StudentGuardianResponse;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.AttendanceInterventionRepository;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentAttendanceRiskProjection;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AttendanceRiskService {

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final AttendanceInterventionConfigRepository
            configRepository;

    private final AttendanceInterventionRepository
            interventionRepository;

    private final SectionRepository
            sectionRepository;

    private final StudentGuardianService
            studentGuardianService;

    public AttendanceRiskService(
            AttendanceRecordRepository attendanceRecordRepository,
            AttendanceInterventionConfigRepository configRepository,
            AttendanceInterventionRepository interventionRepository,
            SectionRepository sectionRepository,
            StudentGuardianService studentGuardianService
    ) {
        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.configRepository =
                configRepository;

        this.interventionRepository =
                interventionRepository;

        this.sectionRepository =
                sectionRepository;

        this.studentGuardianService =
                studentGuardianService;
    }

    /* =====================================================
       SECTION RISK SUMMARY
    ===================================================== */

    @Transactional(readOnly = true)
    public AttendanceRiskSectionResponse getSectionRiskSummary(
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
                        .findBySection_Id(
                                section.getId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance intervention configuration not found"
                                )
                        );

        /* =================================================
           ATTENDANCE RISK PROJECTION

           This remains the single attendance aggregation
           query for all current students in the section.
        ================================================= */

        List<StudentAttendanceRiskProjection> projections =
                attendanceRecordRepository
                        .findCurrentSectionStudentRiskSummary(
                                section.getId(),
                                config.getPeriodStart(),
                                config.getPeriodEnd()
                        );

        /* =================================================
           INTERVENTION LOOKUP

           We intentionally batch-load interventions instead
           of performing one DB query for every student.

           Also note:
           this lookup is student + period based, NOT section
           based, because attendance risk follows a student
           across a section transfer during the same period.
        ================================================= */

        Map<String, AttendanceIntervention> interventionMap =
                loadPeriodInterventions(
                        projections,
                        config
                );

        /* =================================================
           RESPONSE MAPPING
        ================================================= */

        List<StudentAttendanceRiskResponse> students =
                projections
                        .stream()
                        .map(projection ->
                                mapStudentRisk(
                                        projection,
                                        config,
                                        interventionMap
                                )
                        )
                        /*
                         * Show the most urgent students first.
                         *
                         * CRITICAL
                         * AT_RISK
                         * WARNING
                         * NORMAL
                         */
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                (
                                                        StudentAttendanceRiskResponse response
                                                ) ->
                                                        riskPriority(
                                                                response.getRiskLevel()
                                                        )
                                        )
                                        .reversed()
                                        .thenComparing(
                                                StudentAttendanceRiskResponse::getStudentName,
                                                Comparator.nullsLast(
                                                        String.CASE_INSENSITIVE_ORDER
                                                )
                                        )
                        )
                        .toList();

        /* =================================================
           SECTION COUNTS
        ================================================= */

        long normalCount =
                students
                        .stream()
                        .filter(student ->
                                student.getRiskLevel() ==
                                        AttendanceRiskLevel.NORMAL
                        )
                        .count();

        long warningCount =
                students
                        .stream()
                        .filter(student ->
                                student.getRiskLevel() ==
                                        AttendanceRiskLevel.WARNING
                        )
                        .count();

        long atRiskCount =
                students
                        .stream()
                        .filter(student ->
                                student.getRiskLevel() ==
                                        AttendanceRiskLevel.AT_RISK
                        )
                        .count();

        long criticalCount =
                students
                        .stream()
                        .filter(student ->
                                student.getRiskLevel() ==
                                        AttendanceRiskLevel.CRITICAL
                        )
                        .count();

        return new AttendanceRiskSectionResponse(
                section.getId(),
                section.getName(),
                config.isEnabled(),
                config.getPeriodStart(),
                config.getPeriodEnd(),
                config.getWarningAbsenceCount(),
                config.getAtRiskAbsenceCount(),
                config.getCriticalAbsenceCount(),
                students.size(),
                normalCount,
                warningCount,
                atRiskCount,
                criticalCount,
                students
        );
    }

    /* =====================================================
       PERIOD INTERVENTION BATCH LOOKUP
    ===================================================== */

    private Map<String, AttendanceIntervention> loadPeriodInterventions(
            List<StudentAttendanceRiskProjection> projections,
            AttendanceInterventionConfig config
    ) {

        Map<String, AttendanceIntervention> interventionMap =
                new HashMap<>();

        if (projections == null ||
                projections.isEmpty()) {

            return interventionMap;
        }

        List<String> studentIds =
                projections
                        .stream()
                        .map(
                                StudentAttendanceRiskProjection::getStudentId
                        )
                        .filter(studentId ->
                                studentId != null &&
                                        !studentId.isBlank()
                        )
                        .distinct()
                        .toList();

        if (studentIds.isEmpty()) {
            return interventionMap;
        }

        List<AttendanceIntervention> interventions =
                interventionRepository
                        .findByStudent_IdInAndPeriodStartAndPeriodEnd(
                                studentIds,
                                config.getPeriodStart(),
                                config.getPeriodEnd()
                        );

        for (AttendanceIntervention intervention : interventions) {

            if (intervention == null ||
                    intervention.getStudent() == null ||
                    intervention.getStudent().getId() == null ||
                    intervention.getRiskLevel() == null) {

                continue;
            }

            String key =
                    interventionKey(
                            intervention
                                    .getStudent()
                                    .getId(),
                            intervention
                                    .getRiskLevel()
                    );

            /*
             * student + period + risk level is expected
             * to be unique.
             *
             * putIfAbsent provides an additional defensive
             * safeguard if legacy data somehow contains a
             * duplicate.
             */
            interventionMap.putIfAbsent(
                    key,
                    intervention
            );
        }

        return interventionMap;
    }

    /* =====================================================
       STUDENT RISK MAPPING
    ===================================================== */

    private StudentAttendanceRiskResponse mapStudentRisk(
            StudentAttendanceRiskProjection projection,
            AttendanceInterventionConfig config,
            Map<String, AttendanceIntervention> interventionMap
    ) {

        long absentCount =
                projection.getAbsentCount();

        AttendanceRiskLevel riskLevel =
                calculateRiskLevel(
                        absentCount,
                        config
                );

        /* =================================================
           CURRENT RISK INTERVENTION

           NORMAL students have no threshold intervention.

           For WARNING / AT_RISK / CRITICAL we resolve the
           intervention created for this exact risk level
           during the current intervention period.
        ================================================= */

        AttendanceIntervention intervention =
                null;

        if (riskLevel !=
                AttendanceRiskLevel.NORMAL) {

            intervention =
                    interventionMap.get(
                            interventionKey(
                                    projection.getStudentId(),
                                    riskLevel
                            )
                    );
        }

        /* =================================================
           GUARDIAN

           Existing Guardian behavior remains unchanged.
        ================================================= */

        StudentGuardianResponse guardian =
                studentGuardianService
                        .getPrimaryGuardian(
                                projection.getStudentId()
                        );

        return new StudentAttendanceRiskResponse(
                projection.getStudentId(),
                projection.getStudentNumber(),
                projection.getStudentName(),
                projection.getSessionCount(),
                projection.getPresentCount(),
                projection.getLateCount(),
                absentCount,
                projection.getTotalRecords(),
                riskLevel,

                intervention != null
                        ? intervention.getId()
                        : null,

                intervention != null
                        ? intervention.getStatus()
                        : null,

                guardian
        );
    }

    /* =====================================================
       INTERVENTION MAP KEY
    ===================================================== */

    private String interventionKey(
            String studentId,
            AttendanceRiskLevel riskLevel
    ) {

        if (studentId == null ||
                studentId.isBlank() ||
                riskLevel == null) {

            return "";
        }

        return studentId +
                "::" +
                riskLevel.name();
    }

    /* =====================================================
       RISK CALCULATION
    ===================================================== */

    private AttendanceRiskLevel calculateRiskLevel(
            long absentCount,
            AttendanceInterventionConfig config
    ) {

        if (absentCount >=
                config.getCriticalAbsenceCount()) {

            return AttendanceRiskLevel.CRITICAL;
        }

        if (absentCount >=
                config.getAtRiskAbsenceCount()) {

            return AttendanceRiskLevel.AT_RISK;
        }

        if (absentCount >=
                config.getWarningAbsenceCount()) {

            return AttendanceRiskLevel.WARNING;
        }

        return AttendanceRiskLevel.NORMAL;
    }

    /* =====================================================
       RISK PRIORITY
    ===================================================== */

    private int riskPriority(
            AttendanceRiskLevel riskLevel
    ) {

        if (riskLevel == null) {
            return 0;
        }

        return switch (riskLevel) {

            case CRITICAL ->
                    3;

            case AT_RISK ->
                    2;

            case WARNING ->
                    1;

            case NORMAL ->
                    0;
        };
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
                        .findById(
                                sectionId
                        )
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