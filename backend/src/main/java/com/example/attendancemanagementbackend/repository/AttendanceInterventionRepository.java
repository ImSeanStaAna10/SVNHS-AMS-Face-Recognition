package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceIntervention;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttendanceInterventionRepository
        extends JpaRepository<
        AttendanceIntervention,
        String
        > {

    /* =====================================================
       IDEMPOTENCY
    ===================================================== */

    /*
     * Critical protection against duplicate
     * threshold interventions.
     *
     * Example:
     *
     * Juan reaches WARNING = 2 absences.
     *
     * First evaluation:
     * → creates WARNING.
     *
     * Next evaluation at 3 absences:
     * → this returns true.
     * → no second WARNING is created.
     */
    boolean existsByStudent_IdAndPeriodStartAndPeriodEndAndRiskLevel(
            String studentId,
            LocalDate periodStart,
            LocalDate periodEnd,
            AttendanceRiskLevel riskLevel
    );

    Optional<AttendanceIntervention>
    findByStudent_IdAndPeriodStartAndPeriodEndAndRiskLevel(
            String studentId,
            LocalDate periodStart,
            LocalDate periodEnd,
            AttendanceRiskLevel riskLevel
    );

    /* =====================================================
       BATCH CURRENT-PERIOD LOOKUP

       Used by the Students at Risk read-side.

       Important:
       We intentionally do NOT filter by section here.

       Risk follows the student through a section transfer
       during the same intervention period, while the
       intervention's section remains the trigger snapshot.
    ===================================================== */

    List<AttendanceIntervention>
    findByStudent_IdInAndPeriodStartAndPeriodEnd(
            Collection<String> studentIds,
            LocalDate periodStart,
            LocalDate periodEnd
    );

    /* =====================================================
       STUDENT INTERVENTION HISTORY
    ===================================================== */

    List<AttendanceIntervention>
    findByStudent_IdOrderByTriggeredAtDesc(
            String studentId
    );

    /* =====================================================
       SECTION INTERVENTIONS
    ===================================================== */

    List<AttendanceIntervention>
    findBySection_IdOrderByTriggeredAtDesc(
            String sectionId
    );

    List<AttendanceIntervention>
    findBySection_IdAndStatusOrderByTriggeredAtDesc(
            String sectionId,
            AttendanceInterventionStatus status
    );

    /* =====================================================
       PERIOD INTERVENTIONS
    ===================================================== */

    List<AttendanceIntervention>
    findBySection_IdAndPeriodStartAndPeriodEndOrderByTriggeredAtDesc(
            String sectionId,
            LocalDate periodStart,
            LocalDate periodEnd
    );

    /* =====================================================
       TRIGGER SESSION
    ===================================================== */

    List<AttendanceIntervention>
    findByTriggerSession_Id(
            String sessionId
    );
}