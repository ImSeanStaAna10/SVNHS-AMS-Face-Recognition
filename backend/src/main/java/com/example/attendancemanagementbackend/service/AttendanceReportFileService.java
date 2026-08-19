package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportArchiveResponse;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceReportArchiveRepository;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import java.io.IOException;

import java.nio.file.Files;
import java.nio.file.Path;

import java.time.LocalDate;
import java.time.LocalDateTime;

import java.time.format.DateTimeFormatter;

import java.util.Locale;

@Service
public class AttendanceReportFileService {

    /* =========================================================
       CONTENT TYPES
    ========================================================= */

    private static final String PDF_CONTENT_TYPE =
            "application/pdf";

    private static final String EXCEL_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceReportAggregationService
            attendanceReportAggregationService;

    private final AttendanceReportPdfGenerator
            attendanceReportPdfGenerator;

    private final AttendanceReportExcelGenerator
            attendanceReportExcelGenerator;

    private final AttendanceReportArchiveRepository
            attendanceReportArchiveRepository;

    private final SupabaseStorageService
            supabaseStorageService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportFileService(

            AttendanceReportAggregationService
                    attendanceReportAggregationService,

            AttendanceReportPdfGenerator
                    attendanceReportPdfGenerator,

            AttendanceReportExcelGenerator
                    attendanceReportExcelGenerator,

            AttendanceReportArchiveRepository
                    attendanceReportArchiveRepository,

            SupabaseStorageService
                    supabaseStorageService
    ) {

        this.attendanceReportAggregationService =
                attendanceReportAggregationService;

        this.attendanceReportPdfGenerator =
                attendanceReportPdfGenerator;

        this.attendanceReportExcelGenerator =
                attendanceReportExcelGenerator;

        this.attendanceReportArchiveRepository =
                attendanceReportArchiveRepository;

        this.supabaseStorageService =
                supabaseStorageService;
    }

    /* =========================================================
       GENERATE / REGENERATE REPORT

       Flow:

       Database attendance records
                ↓
       Aggregation
                ↓
       Temporary PDF / Excel
                ↓
       Supabase Storage
                ↓
       Archive metadata saved to PostgreSQL
                ↓
       Temporary local files deleted
    ========================================================= */

    public AttendanceReportArchiveResponse generate(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    ) {

        /* =====================================================
           1. AGGREGATE ATTENDANCE DATA
        ===================================================== */

        AttendanceReportAggregationResponse report =
                attendanceReportAggregationService
                        .aggregate(
                                sectionId,
                                reportType,
                                periodStart,
                                periodEnd
                        );

        /* =====================================================
           2. BUILD SAFE SECTION NAME
        ===================================================== */

        String safeSectionName =
                sanitize(
                        report.sectionName()
                );

        /* =====================================================
           3. BUILD STORAGE PERIOD DIRECTORY
        ===================================================== */

        String directoryPeriod =
                buildDirectoryPeriod(
                        report
                );

        /* =====================================================
           4. BUILD FILE NAMES
        ===================================================== */

        String baseFileName =
                buildBaseFileName(
                        report
                );

        String pdfFileName =
                baseFileName
                        +
                        ".pdf";

        String excelFileName =
                baseFileName
                        +
                        ".xlsx";

        /* =====================================================
           5. BUILD SUPABASE OBJECT DIRECTORY

           Example:

           2026/
           weekly/
           2026-08-17_to_2026-08-21/
           BSCS_3-B/
        ===================================================== */

        String objectDirectory =
                buildObjectDirectory(
                        report,
                        directoryPeriod,
                        safeSectionName
                );

        /* =====================================================
           6. FINAL SUPABASE OBJECT KEYS

           These values are stored in the DB fields:

           pdfRelativePath
           excelRelativePath

           They are now Supabase object keys rather
           than local filesystem paths.
        ===================================================== */

        String pdfObjectKey =
                objectDirectory
                        +
                        "/"
                        +
                        pdfFileName;

        String excelObjectKey =
                objectDirectory
                        +
                        "/"
                        +
                        excelFileName;

        /* =====================================================
           7. TEMPORARY LOCAL FILES

           The generators currently write to Path objects.

           We therefore generate into OS temporary files,
           upload them to Supabase, then delete them.

           These are NOT permanent report storage.
        ===================================================== */

        Path temporaryPdf =
                null;

        Path temporaryExcel =
                null;

        try {

            temporaryPdf =
                    Files.createTempFile(
                            "attendance-report-",
                            ".pdf"
                    );

            temporaryExcel =
                    Files.createTempFile(
                            "attendance-report-",
                            ".xlsx"
                    );

            /* =================================================
               GENERATE PDF
            ================================================= */

            attendanceReportPdfGenerator
                    .generate(
                            report,
                            temporaryPdf
                    );

            /* =================================================
               GENERATE EXCEL
            ================================================= */

            attendanceReportExcelGenerator
                    .generate(
                            report,
                            temporaryExcel
                    );

            /* =================================================
               UPLOAD PDF TO SUPABASE STORAGE

               putObject on the same key replaces the
               previous object, making regeneration
               idempotent.
            ================================================= */

            supabaseStorageService
                    .upload(
                            pdfObjectKey,
                            temporaryPdf,
                            PDF_CONTENT_TYPE
                    );

            /* =================================================
               UPLOAD EXCEL TO SUPABASE STORAGE
            ================================================= */

            supabaseStorageService
                    .upload(
                            excelObjectKey,
                            temporaryExcel,
                            EXCEL_CONTENT_TYPE
                    );

        } catch (IOException exception) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to generate temporary attendance report files"
            );

        } finally {

            /* =================================================
               ALWAYS REMOVE TEMPORARY FILES
            ================================================= */

            deleteQuietly(
                    temporaryPdf
            );

            deleteQuietly(
                    temporaryExcel
            );
        }

        /* =====================================================
           8. FIND EXISTING ARCHIVE

           Same:
           section
           + type
           + start
           + end

           → update existing record instead of duplicate.
        ===================================================== */

        AttendanceReportArchive archive =
                attendanceReportArchiveRepository

                        .findBySectionIdAndReportTypeAndPeriodStartAndPeriodEnd(

                                report.sectionId(),

                                report.reportType(),

                                report.periodStart(),

                                report.periodEnd()
                        )

                        .orElseGet(
                                AttendanceReportArchive::new
                        );

        /* =====================================================
           9. SECTION / ADVISER SNAPSHOT
        ===================================================== */

        archive.setSectionId(
                report.sectionId()
        );

        archive.setSectionName(
                report.sectionName()
        );

        archive.setAdviserId(
                report.adviserId()
        );

        archive.setAdviserName(
                report.adviserName()
        );

        archive.setReportType(
                report.reportType()
        );

        archive.setPeriodStart(
                report.periodStart()
        );

        archive.setPeriodEnd(
                report.periodEnd()
        );

        /* =====================================================
           10. SUMMARY COUNTS
        ===================================================== */

        archive.setStudentCount(
                Math.toIntExact(
                        report.studentCount()
                )
        );

        archive.setSessionCount(
                Math.toIntExact(
                        report.sessionCount()
                )
        );

        archive.setPresentCount(
                Math.toIntExact(
                        report.presentCount()
                )
        );

        archive.setLateCount(
                Math.toIntExact(
                        report.lateCount()
                )
        );

        archive.setAbsentCount(
                Math.toIntExact(
                        report.absentCount()
                )
        );

        archive.setAttendanceRate(
                report.attendanceRate()
        );

        /* =====================================================
           11. PDF STORAGE INFORMATION
        ===================================================== */

        archive.setPdfFileName(
                pdfFileName
        );

        archive.setPdfRelativePath(
                pdfObjectKey
        );

        /* =====================================================
           12. EXCEL STORAGE INFORMATION
        ===================================================== */

        archive.setExcelFileName(
                excelFileName
        );

        archive.setExcelRelativePath(
                excelObjectKey
        );

        /* =====================================================
           13. GENERATION TIME
        ===================================================== */

        archive.setGeneratedAt(
                LocalDateTime.now()
        );

        /* =====================================================
           14. SAVE DATABASE ARCHIVE
        ===================================================== */

        AttendanceReportArchive savedArchive =
                attendanceReportArchiveRepository
                        .save(
                                archive
                        );

        return AttendanceReportArchiveResponse
                .from(
                        savedArchive
                );
    }

    /* =========================================================
       BUILD SUPABASE OBJECT DIRECTORY
    ========================================================= */

    private String buildObjectDirectory(

            AttendanceReportAggregationResponse report,

            String directoryPeriod,

            String safeSectionName
    ) {

        return report
                .periodStart()
                .getYear()

                +
                "/"

                +
                report
                        .reportType()
                        .name()
                        .toLowerCase(
                                Locale.ROOT
                        )

                +
                "/"

                +
                directoryPeriod

                +
                "/"

                +
                safeSectionName;
    }

    /* =========================================================
       BUILD FILE NAME
    ========================================================= */

    private String buildBaseFileName(
            AttendanceReportAggregationResponse report
    ) {

        String sectionName =
                sanitize(
                        report.sectionName()
                );

        /* =====================================================
           MONTHLY

           Example:

           BSCS_3-B_Monthly_August_2026
        ===================================================== */

        if (
                report.reportType()
                        ==
                        AttendanceReportType.MONTHLY
        ) {

            String month =
                    report
                            .periodStart()
                            .format(
                                    DateTimeFormatter
                                            .ofPattern(
                                                    "MMMM_uuuu",
                                                    Locale.ENGLISH
                                            )
                            );

            return sectionName
                    +
                    "_Monthly_"
                    +
                    month;
        }

        /* =====================================================
           WEEKLY

           Example:

           BSCS_3-B_Weekly_2026-08-17_to_2026-08-21
        ===================================================== */

        return sectionName
                +
                "_Weekly_"
                +
                report.periodStart()
                +
                "_to_"
                +
                report.periodEnd();
    }

    /* =========================================================
       BUILD DIRECTORY PERIOD
    ========================================================= */

    private String buildDirectoryPeriod(
            AttendanceReportAggregationResponse report
    ) {

        /* =====================================================
           MONTHLY

           2026/
           monthly/
           08/
        ===================================================== */

        if (
                report.reportType()
                        ==
                        AttendanceReportType.MONTHLY
        ) {

            return report
                    .periodStart()
                    .format(
                            DateTimeFormatter
                                    .ofPattern(
                                            "MM"
                                    )
                    );
        }

        /* =====================================================
           WEEKLY

           2026/
           weekly/
           2026-08-17_to_2026-08-21/
        ===================================================== */

        return report.periodStart()
                +
                "_to_"
                +
                report.periodEnd();
    }

    /* =========================================================
       TEMP FILE CLEANUP
    ========================================================= */

    private void deleteQuietly(
            Path path
    ) {

        if (
                path == null
        ) {

            return;
        }

        try {

            Files.deleteIfExists(
                    path
            );

        } catch (IOException ignored) {

            /*
             * Best-effort cleanup.
             *
             * The operating system temporary directory
             * must never prevent report generation from
             * completing.
             */
        }
    }

    /* =========================================================
       SANITIZE FILE / DIRECTORY NAME
    ========================================================= */

    private String sanitize(
            String value
    ) {

        if (
                value == null
                        ||
                        value.isBlank()
        ) {

            return "attendance-report";
        }

        String sanitized =
                value.trim();

        String[] invalidCharacters = {

                "<",
                ">",
                ":",
                "\"",
                "/",
                "\\",
                "|",
                "?",
                "*"
        };

        for (
                String character
                :
                invalidCharacters
        ) {

            sanitized =
                    sanitized.replace(
                            character,
                            "-"
                    );
        }

        sanitized =
                sanitized

                        .replaceAll(
                                "\\s+",
                                "_"
                        )

                        .replaceAll(
                                "_+",
                                "_"
                        );

        return sanitized.substring(
                0,
                Math.min(
                        sanitized.length(),
                        100
                )
        );
    }
}