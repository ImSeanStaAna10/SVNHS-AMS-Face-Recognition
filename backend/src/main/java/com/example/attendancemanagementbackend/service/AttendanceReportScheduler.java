package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportBatchGenerationResponse;

import com.example.attendancemanagementbackend.entity.AttendanceReportType;
import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.SectionRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.scheduling.annotation.Scheduled;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;

import java.time.temporal.TemporalAdjusters;

import java.util.List;

@Service
public class AttendanceReportScheduler {

    /* =========================================================
       LOGGER
    ========================================================= */

    private static final Logger LOGGER =
            LoggerFactory.getLogger(
                    AttendanceReportScheduler.class
            );

    /* =========================================================
       TIMEZONE

       All automatic report periods are calculated
       using Philippine time.
    ========================================================= */

    private static final ZoneId MANILA_ZONE =
            ZoneId.of(
                    "Asia/Manila"
            );

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final SectionRepository
            sectionRepository;

    private final AttendanceReportFileService
            attendanceReportFileService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportScheduler(

            SectionRepository sectionRepository,

            AttendanceReportFileService
                    attendanceReportFileService
    ) {

        this.sectionRepository =
                sectionRepository;

        this.attendanceReportFileService =
                attendanceReportFileService;
    }

    /* =========================================================
       WEEKLY AUTOMATIC REPORT

       Runs:
       Saturday
       12:10 AM
       Asia/Manila

       Generates the most recently completed
       Monday-Friday school week.

       Example:

       Saturday: August 22, 2026

       Period:
       August 17, 2026
       to
       August 21, 2026
    ========================================================= */

    @Scheduled(
            cron = "0 10 0 * * SAT",
            zone = "Asia/Manila"
    )
    public void generateAutomaticWeeklyReports() {

        LocalDate today =
                LocalDate.now(
                        MANILA_ZONE
                );

        /*
         * previous(FRIDAY) is deliberate.
         *
         * It guarantees that we use a fully completed
         * Friday rather than accidentally using an
         * unfinished current Friday.
         */
        LocalDate periodEnd =
                today.with(
                        TemporalAdjusters.previous(
                                DayOfWeek.FRIDAY
                        )
                );

        LocalDate periodStart =
                periodEnd.with(
                        TemporalAdjusters.previousOrSame(
                                DayOfWeek.MONDAY
                        )
                );

        LOGGER.info(
                "Starting automatic WEEKLY attendance report generation for {} to {}",
                periodStart,
                periodEnd
        );

        AttendanceReportBatchGenerationResponse result =
                generateForPeriod(
                        AttendanceReportType.WEEKLY,
                        periodStart,
                        periodEnd
                );

        LOGGER.info(
                "Weekly attendance report generation completed. Total sections={}, generated={}, notGenerated={}",
                result.totalSections(),
                result.generatedCount(),
                result.notGeneratedCount()
        );
    }

    /* =========================================================
       MONTHLY AUTOMATIC REPORT

       Runs:
       1st day of every month
       12:20 AM
       Asia/Manila

       Generates the entire PREVIOUS month.

       Example:

       September 1, 2026
       ↓
       August 1-31, 2026
    ========================================================= */

    @Scheduled(
            cron = "0 20 0 1 * *",
            zone = "Asia/Manila"
    )
    public void generateAutomaticMonthlyReports() {

        LocalDate today =
                LocalDate.now(
                        MANILA_ZONE
                );

        YearMonth previousMonth =
                YearMonth
                        .from(
                                today
                        )
                        .minusMonths(
                                1
                        );

        LocalDate periodStart =
                previousMonth
                        .atDay(
                                1
                        );

        LocalDate periodEnd =
                previousMonth
                        .atEndOfMonth();

        LOGGER.info(
                "Starting automatic MONTHLY attendance report generation for {} to {}",
                periodStart,
                periodEnd
        );

        AttendanceReportBatchGenerationResponse result =
                generateForPeriod(
                        AttendanceReportType.MONTHLY,
                        periodStart,
                        periodEnd
                );

        LOGGER.info(
                "Monthly attendance report generation completed. Total sections={}, generated={}, notGenerated={}",
                result.totalSections(),
                result.generatedCount(),
                result.notGeneratedCount()
        );
    }

    /* =========================================================
       BATCH GENERATION

       Shared by:
       - Weekly scheduler
       - Monthly scheduler
       - Manual Councilor batch regeneration

       This keeps generation logic DRY.
    ========================================================= */

    public AttendanceReportBatchGenerationResponse generateForPeriod(

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        validatePeriod(
                reportType,
                periodStart,
                periodEnd
        );

        List<Section> sections =
                sectionRepository
                        .findAll();

        int generatedCount =
                0;

        int notGeneratedCount =
                0;

        for (
                Section section
                : sections
        ) {

            try {

                attendanceReportFileService
                        .generate(
                                section.getId(),
                                reportType,
                                periodStart,
                                periodEnd
                        );

                generatedCount++;

                LOGGER.info(
                        "{} attendance report generated for section '{}' ({})",
                        reportType,
                        section.getName(),
                        section.getId()
                );

            } catch (
                    ApiException exception
            ) {

                /*
                 * Most commonly:
                 *
                 * No completed attendance records exist
                 * for this section and period.
                 *
                 * One section must never stop report
                 * generation for every other section.
                 */

                notGeneratedCount++;

                LOGGER.info(
                        "{} attendance report was not generated for section '{}' ({}): {}",
                        reportType,
                        section.getName(),
                        section.getId(),
                        exception.getMessage()
                );

            } catch (
                    Exception exception
            ) {

                /*
                 * Unexpected error isolation.
                 *
                 * Continue processing the other sections.
                 */

                notGeneratedCount++;

                LOGGER.error(
                        "Unexpected error generating {} attendance report for section '{}' ({})",
                        reportType,
                        section.getName(),
                        section.getId(),
                        exception
                );
            }
        }

        return new AttendanceReportBatchGenerationResponse(

                reportType,

                periodStart,

                periodEnd,

                sections.size(),

                generatedCount,

                notGeneratedCount,

                LocalDateTime.now(
                        MANILA_ZONE
                )
        );
    }

    /* =========================================================
       VALIDATION
    ========================================================= */

    private void validatePeriod(

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        if (
                reportType == null
        ) {

            throw new IllegalArgumentException(
                    "Report type is required"
            );
        }

        if (
                periodStart == null
                        ||
                        periodEnd == null
        ) {

            throw new IllegalArgumentException(
                    "Report period is required"
            );
        }

        if (
                periodStart.isAfter(
                        periodEnd
                )
        ) {

            throw new IllegalArgumentException(
                    "Report period start cannot be after report period end"
            );
        }
    }
}