package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceStatus;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.repository.AttendanceInterventionConfigRepository;
import com.example.attendancemanagementbackend.repository.AttendanceInterventionRepository;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.StudentAbsenceCountProjection;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AttendanceInterventionEngineService {

    private final AttendanceSessionRepository
            attendanceSessionRepository;

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final AttendanceInterventionConfigRepository
            configRepository;

    private final AttendanceInterventionRepository
            interventionRepository;

    public AttendanceInterventionEngineService(
            AttendanceSessionRepository attendanceSessionRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            AttendanceInterventionConfigRepository configRepository,
            AttendanceInterventionRepository interventionRepository
    ) {
        this.attendanceSessionRepository =
                attendanceSessionRepository;

        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.configRepository =
                configRepository;

        this.interventionRepository =
                interventionRepository;
    }

    /* =====================================================
       EVALUATE FINALIZED SESSION
    ===================================================== */

    /**
     * Evaluates students who were finalized as ABSENT
     * in an ENDED attendance session.
     *
     * This method runs inside its OWN transaction.
     *
     * It is intended to be called AFTER the official
     * attendance transaction has successfully committed.
     *
     * Therefore:
     *
     * - Attendance session is already ENDED.
     * - ABSENT records are already committed.
     * - Intervention failures cannot roll back
     *   official attendance data.
     *
     * Returns the number of NEW intervention records created.
     *
     * Example thresholds:
     *
     * WARNING   = 2
     * AT_RISK   = 4
     * CRITICAL  = 6
     *
     * Progression:
     *
     * 1 absence  -> NORMAL
     * 2 absences -> WARNING intervention
     * 3 absences -> no new intervention
     * 4 absences -> AT_RISK intervention
     * 5 absences -> no new intervention
     * 6 absences -> CRITICAL intervention
     */
    @Transactional(
            propagation = Propagation.REQUIRES_NEW
    )
    public int evaluateFinalizedSession(
            String sessionId
    ) {

        /* =====================================================
           LOAD SESSION
        ===================================================== */

        AttendanceSession session =
                attendanceSessionRepository
                        .findById(
                                sessionId
                        )
                        .orElse(null);

        /*
         * This is an internal/background operation.
         *
         * If the session no longer exists,
         * simply skip processing.
         */
        if (session == null) {
            return 0;
        }

        /* =====================================================
           ONLY PROCESS ENDED SESSIONS
        ===================================================== */

        if (session.getStatus() !=
                AttendanceSessionStatus.ENDED) {

            return 0;
        }

        /* =====================================================
           LOAD SECTION
        ===================================================== */

        Section section =
                session.getSection();

        if (section == null ||
                section.getId() == null) {

            return 0;
        }

        /* =====================================================
           LOAD INTERVENTION CONFIGURATION
        ===================================================== */

        AttendanceInterventionConfig config =
                configRepository
                        .findBySection_Id(
                                section.getId()
                        )
                        .orElse(null);

        /*
         * Attendance remains functional even when
         * intervention configuration is not available.
         */
        if (config == null) {
            return 0;
        }

        /*
         * Risk/intervention processing can be disabled
         * without affecting normal attendance.
         */
        if (!config.isEnabled()) {
            return 0;
        }

        /* =====================================================
           VALIDATE CONFIG PERIOD
        ===================================================== */

        if (config.getPeriodStart() == null ||
                config.getPeriodEnd() == null) {

            return 0;
        }

        /* =====================================================
           CHECK SESSION DATE AGAINST RISK PERIOD
        ===================================================== */

        LocalDate attendanceDate =
                session.getAttendanceDate();

        if (attendanceDate == null) {
            return 0;
        }

        if (attendanceDate.isBefore(
                config.getPeriodStart()
        )) {

            return 0;
        }

        if (attendanceDate.isAfter(
                config.getPeriodEnd()
        )) {

            return 0;
        }

        /* =====================================================
           LOAD ATTENDANCE RECORDS FOR SESSION
        ===================================================== */

        List<AttendanceRecord> sessionRecords =
                attendanceRecordRepository
                        .findBySessionId(
                                session.getId()
                        );

        if (sessionRecords == null ||
                sessionRecords.isEmpty()) {

            return 0;
        }

        /* =====================================================
           FILTER ABSENT STUDENTS
        ===================================================== */

        List<AttendanceRecord> absentRecords =
                sessionRecords
                        .stream()
                        .filter(record ->
                                record != null &&
                                        record.getStatus() ==
                                                AttendanceStatus.ABSENT
                        )
                        .toList();

        /*
         * Everyone attended.
         *
         * No intervention evaluation required.
         */
        if (absentRecords.isEmpty()) {
            return 0;
        }

        /* =====================================================
           COLLECT UNIQUE ABSENT STUDENT IDS
        ===================================================== */

        Set<String> studentIds =
                new LinkedHashSet<>();

        for (AttendanceRecord record :
                absentRecords) {

            if (record.getStudent() == null) {
                continue;
            }

            String studentId =
                    record.getStudent()
                            .getId();

            if (studentId == null ||
                    studentId.isBlank()) {

                continue;
            }

            studentIds.add(
                    studentId
            );
        }

        if (studentIds.isEmpty()) {
            return 0;
        }

        /* =====================================================
           CONVERT SET -> LIST

           The repository accepts List<String>.

           LinkedHashSet first removes duplicate IDs.
           Then ArrayList gives the repository the
           exact expected parameter type.
        ===================================================== */

        List<String> studentIdList =
                new ArrayList<>(
                        studentIds
                );

        /* =====================================================
           COUNT ABSENCES ACROSS ENTIRE RISK PERIOD

           IMPORTANT:

           This query intentionally does NOT restrict
           historical attendance to the student's current
           section.

           Therefore, if a student transfers sections
           during the same intervention period, their
           finalized absence history follows them.
        ===================================================== */

        List<StudentAbsenceCountProjection> counts =
                attendanceRecordRepository
                        .findStudentAbsenceCountsForRisk(
                                studentIdList,
                                config.getPeriodStart(),
                                config.getPeriodEnd()
                        );

        /* =====================================================
           BUILD STUDENT -> ABSENCE COUNT MAP
        ===================================================== */

        Map<String, Long> absenceCountByStudent =
                new HashMap<>();

        if (counts != null) {

            for (StudentAbsenceCountProjection count :
                    counts) {

                if (count == null ||
                        count.getStudentId() == null) {

                    continue;
                }

                long absentCount =
                        count.getAbsentCount();

                absenceCountByStudent.put(
                        count.getStudentId(),
                        absentCount
                );
            }
        }

        /* =====================================================
           BUILD NEW INTERVENTIONS
        ===================================================== */

        List<AttendanceIntervention> newInterventions =
                new ArrayList<>();

        for (AttendanceRecord absentRecord :
                absentRecords) {

            if (absentRecord == null ||
                    absentRecord.getStudent() == null) {

                continue;
            }

            String studentId =
                    absentRecord
                            .getStudent()
                            .getId();

            if (studentId == null ||
                    studentId.isBlank()) {

                continue;
            }

            /* =================================================
               CURRENT ABSENCE COUNT
            ================================================= */

            long absentCount =
                    absenceCountByStudent
                            .getOrDefault(
                                    studentId,
                                    0L
                            );

            /* =================================================
               CALCULATE CURRENT RISK LEVEL
            ================================================= */

            AttendanceRiskLevel riskLevel =
                    calculateRiskLevel(
                            absentCount,
                            config
                    );

            /*
             * NORMAL students do not need an
             * intervention record.
             */
            if (riskLevel ==
                    AttendanceRiskLevel.NORMAL) {

                continue;
            }

            /* =================================================
               IDEMPOTENCY CHECK

               Maximum one intervention per:

               student
               + risk period
               + risk level

               Example:

               WARNING created at 2 absences.

               At 3 absences:
               current risk is still WARNING.

               Existing WARNING is found,
               therefore another WARNING record
               is NOT created.
            ================================================= */

            boolean alreadyExists =
                    interventionRepository
                            .existsByStudent_IdAndPeriodStartAndPeriodEndAndRiskLevel(
                                    studentId,
                                    config.getPeriodStart(),
                                    config.getPeriodEnd(),
                                    riskLevel
                            );

            if (alreadyExists) {
                continue;
            }

            /* =================================================
               THRESHOLD SNAPSHOT
            ================================================= */

            int threshold =
                    getThresholdForRiskLevel(
                            riskLevel,
                            config
                    );

            /* =================================================
               ACTUAL ABSENCE SNAPSHOT
            ================================================= */

            int actualAbsenceCount =
                    Math.toIntExact(
                            absentCount
                    );

            /* =================================================
               CREATE INTERVENTION
            ================================================= */

            AttendanceIntervention intervention =
                    new AttendanceIntervention(
                            absentRecord.getStudent(),
                            section,
                            riskLevel,
                            config.getPeriodStart(),
                            config.getPeriodEnd(),
                            threshold,
                            actualAbsenceCount,
                            session
                    );

            newInterventions.add(
                    intervention
            );
        }

        /* =====================================================
           NOTHING NEW TO SAVE
        ===================================================== */

        if (newInterventions.isEmpty()) {
            return 0;
        }

        /* =====================================================
           SAVE NEW INTERVENTIONS
        ===================================================== */

        interventionRepository
                .saveAll(
                        newInterventions
                );

        return newInterventions.size();
    }

    /* =====================================================
       CALCULATE CURRENT RISK LEVEL
    ===================================================== */

    private AttendanceRiskLevel calculateRiskLevel(
            long absentCount,
            AttendanceInterventionConfig config
    ) {

        /*
         * Highest severity must always be checked first.
         */

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
       GET CONFIGURED THRESHOLD FOR RISK LEVEL
    ===================================================== */

    private int getThresholdForRiskLevel(
            AttendanceRiskLevel riskLevel,
            AttendanceInterventionConfig config
    ) {

        return switch (riskLevel) {

            case WARNING ->
                    config.getWarningAbsenceCount();

            case AT_RISK ->
                    config.getAtRiskAbsenceCount();

            case CRITICAL ->
                    config.getCriticalAbsenceCount();

            case NORMAL ->
                    0;
        };
    }
}