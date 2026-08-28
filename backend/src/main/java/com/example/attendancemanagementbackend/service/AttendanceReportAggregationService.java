package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportStudentSummary;

import com.example.attendancemanagementbackend.entity.AttendanceReportType;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSectionCardProjection;
import com.example.attendancemanagementbackend.repository.AttendanceSectionDetailSummaryProjection;
import com.example.attendancemanagementbackend.repository.AttendanceStudentReportProjection;
import com.example.attendancemanagementbackend.repository.SectionRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.time.LocalDate;

import java.util.Collections;
import java.util.List;

@Service
public class AttendanceReportAggregationService {

    /* =========================================================
       CONSTANTS
    ========================================================= */

    private static final int RATE_SCALE = 2;

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final SectionRepository
            sectionRepository;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportAggregationService(

            AttendanceRecordRepository
                    attendanceRecordRepository,

            SectionRepository
                    sectionRepository
    ) {

        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.sectionRepository =
                sectionRepository;
    }

    /* =========================================================
       AGGREGATE REPORT
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceReportAggregationResponse aggregate(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        /* =====================================================
           VALIDATION
        ===================================================== */

        validateRequest(
                sectionId,
                reportType,
                periodStart,
                periodEnd
        );

        /* =====================================================
           SECTION METADATA

           We reuse the existing Section attendance query.

           Department is resolved internally from the
           requested Section.

           This keeps aggregate(...) usable by both:

           - authenticated report preview
           - system-level automatic report generation
        ===================================================== */

        AttendanceSectionCardProjection section =
                findSectionMetadata(
                        sectionId,
                        periodStart,
                        periodEnd
                );

        /* =====================================================
           OVERALL SUMMARY
        ===================================================== */

        AttendanceSectionDetailSummaryProjection summary =
                attendanceRecordRepository
                        .findSectionDetailSummary(
                                sectionId,
                                periodStart,
                                periodEnd
                        );

        long sessionCount =
                summary != null
                        ? safeLong(
                        summary.getSessionCount()
                )
                        : 0L;

        long studentCount =
                summary != null
                        ? safeLong(
                        summary.getStudentCount()
                )
                        : 0L;

        long presentCount =
                summary != null
                        ? safeLong(
                        summary.getPresentCount()
                )
                        : 0L;

        long lateCount =
                summary != null
                        ? safeLong(
                        summary.getLateCount()
                )
                        : 0L;

        long absentCount =
                summary != null
                        ? safeLong(
                        summary.getAbsentCount()
                )
                        : 0L;

        long totalRecords =
                summary != null
                        ? safeLong(
                        summary.getTotalRecords()
                )
                        : 0L;

        /* =====================================================
           NO COMPLETED ATTENDANCE
        ===================================================== */

        if (
                sessionCount <= 0 ||
                        totalRecords <= 0
        ) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No completed attendance records were found for the selected report period"
            );
        }

        /* =====================================================
           OVERALL RATES
        ===================================================== */

        BigDecimal presentRate =
                percentage(
                        presentCount,
                        totalRecords
                );

        BigDecimal lateRate =
                percentage(
                        lateCount,
                        totalRecords
                );

        BigDecimal absenceRate =
                percentage(
                        absentCount,
                        totalRecords
                );

        /*
         * Attendance means the student attended.
         *
         * PRESENT = attended on time
         * LATE    = attended, but late
         * ABSENT  = did not attend
         */
        BigDecimal attendanceRate =
                percentage(
                        presentCount + lateCount,
                        totalRecords
                );

        /* =====================================================
           COMPLETE STUDENT BREAKDOWN

           No pagination here because official report files
           must contain every student in the selected period.
        ===================================================== */

        List<AttendanceStudentReportProjection> studentRows =
                attendanceRecordRepository
                        .findStudentPeriodSummary(
                                sectionId,
                                periodStart,
                                periodEnd
                        );

        if (studentRows == null) {

            studentRows =
                    Collections.emptyList();
        }

        List<AttendanceReportStudentSummary> students =
                studentRows
                        .stream()
                        .map(
                                this::mapStudent
                        )
                        .toList();

        /* =====================================================
           RESPONSE
        ===================================================== */

        return new AttendanceReportAggregationResponse(

                section.getSectionId(),

                section.getSectionName(),

                section.getAdviserId(),

                section.getAdviserName(),

                reportType,

                periodStart,

                periodEnd,

                sessionCount,

                studentCount,

                presentCount,

                lateCount,

                absentCount,

                totalRecords,

                presentRate,

                lateRate,

                absenceRate,

                attendanceRate,

                students
        );
    }

    /* =========================================================
       SECTION METADATA

       AttendanceRecordRepository now requires departmentId
       for the Section attendance report query.

       Instead of adding departmentId to aggregate(...),
       resolve it here from the requested Section.

       This is important because aggregate(...) is also
       called by automatic system report generation.
    ========================================================= */

    private AttendanceSectionCardProjection findSectionMetadata(

            String sectionId,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        /* =====================================================
           FIND SECTION
        ===================================================== */

        Section requestedSection =
                sectionRepository
                        .findById(
                                sectionId
                        )
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Section not found"
                                        )
                        );

        /* =====================================================
           DEPARTMENT REQUIRED
        ===================================================== */

        if (
                requestedSection.getDepartment() ==
                        null
        ) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Section is not assigned to a department"
            );
        }

        String departmentId =
                requestedSection
                        .getDepartment()
                        .getId();

        /* =====================================================
           EXISTING ATTENDANCE REPORT QUERY

           NEW parameter order:

           fromDate
           toDate
           departmentId
           sectionId
           adviserId
           search
           pageable
        ===================================================== */

        Page<AttendanceSectionCardProjection> page =
                attendanceRecordRepository
                        .findSectionAttendanceReport(

                                periodStart,

                                periodEnd,

                                departmentId,

                                sectionId,

                                "",

                                "",

                                PageRequest.of(
                                        0,
                                        1
                                )
                        );

        if (
                page == null ||
                        page.isEmpty()
        ) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No completed attendance records were found for this section and period"
            );
        }

        return page
                .getContent()
                .getFirst();
    }

    /* =========================================================
       MAP STUDENT
    ========================================================= */

    private AttendanceReportStudentSummary mapStudent(
            AttendanceStudentReportProjection row
    ) {

        long sessionCount =
                safeLong(
                        row.getSessionCount()
                );

        long presentCount =
                safeLong(
                        row.getPresentCount()
                );

        long lateCount =
                safeLong(
                        row.getLateCount()
                );

        long absentCount =
                safeLong(
                        row.getAbsentCount()
                );

        long totalRecords =
                safeLong(
                        row.getTotalRecords()
                );

        BigDecimal presentRate =
                percentage(
                        presentCount,
                        totalRecords
                );

        BigDecimal lateRate =
                percentage(
                        lateCount,
                        totalRecords
                );

        BigDecimal absenceRate =
                percentage(
                        absentCount,
                        totalRecords
                );

        BigDecimal attendanceRate =
                percentage(
                        presentCount +
                                lateCount,
                        totalRecords
                );

        return new AttendanceReportStudentSummary(

                row.getStudentId(),

                row.getStudentNumber(),

                row.getStudentName(),

                sessionCount,

                presentCount,

                lateCount,

                absentCount,

                totalRecords,

                presentRate,

                lateRate,

                absenceRate,

                attendanceRate
        );
    }

    /* =========================================================
       VALIDATION
    ========================================================= */

    private void validateRequest(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        if (
                sectionId == null ||
                        sectionId.isBlank()
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Section ID is required"
            );
        }

        if (
                reportType == null
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Report type is required"
            );
        }

        if (
                periodStart == null ||
                        periodEnd == null
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Report period is required"
            );
        }

        if (
                periodStart.isAfter(
                        periodEnd
                )
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Report period start cannot be after report period end"
            );
        }

        validateReportPeriod(
                reportType,
                periodStart,
                periodEnd
        );
    }

    /* =========================================================
       REPORT PERIOD VALIDATION
    ========================================================= */

    private void validateReportPeriod(

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        if (
                reportType ==
                        AttendanceReportType.MONTHLY
        ) {

            /*
             * Monthly archive must represent exactly one
             * calendar month.
             */
            LocalDate expectedStart =
                    periodStart
                            .withDayOfMonth(
                                    1
                            );

            LocalDate expectedEnd =
                    expectedStart
                            .withDayOfMonth(
                                    expectedStart
                                            .lengthOfMonth()
                            );

            if (
                    !periodStart.equals(
                            expectedStart
                    ) ||
                            !periodEnd.equals(
                                    expectedEnd
                            )
            ) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Monthly report period must cover one complete calendar month"
                );
            }
        }

        if (
                reportType ==
                        AttendanceReportType.WEEKLY
        ) {

            /*
             * The exact school-week scheduling policy
             * is handled by the scheduler.
             *
             * For aggregation preview we only ensure
             * the selected period does not exceed
             * seven calendar days.
             */

            long inclusiveDays =
                    periodEnd
                            .toEpochDay()
                            -
                            periodStart
                                    .toEpochDay()
                            +
                            1;

            if (
                    inclusiveDays <= 0 ||
                            inclusiveDays > 7
            ) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Weekly report period must contain between 1 and 7 calendar days"
                );
            }
        }
    }

    /* =========================================================
       PERCENTAGE
    ========================================================= */

    private BigDecimal percentage(

            long numerator,

            long denominator
    ) {

        if (
                denominator <= 0
        ) {

            return BigDecimal.ZERO
                    .setScale(
                            RATE_SCALE,
                            RoundingMode.HALF_UP
                    );
        }

        return BigDecimal
                .valueOf(
                        numerator
                )
                .multiply(
                        BigDecimal.valueOf(
                                100
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                denominator
                        ),
                        RATE_SCALE,
                        RoundingMode.HALF_UP
                );
    }

    /* =========================================================
       SAFE NUMBER
    ========================================================= */

    private long safeLong(
            Number value
    ) {

        if (
                value == null
        ) {

            return 0L;
        }

        return value.longValue();
    }
}