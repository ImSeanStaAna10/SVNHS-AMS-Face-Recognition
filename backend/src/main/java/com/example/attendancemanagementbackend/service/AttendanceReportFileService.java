package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportArchiveResponse;
import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceReportArchiveRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;

import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

import java.time.LocalDate;
import java.time.LocalDateTime;

import java.time.format.DateTimeFormatter;

import java.util.Locale;

@Service
public class AttendanceReportFileService {

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

    private final Path storageRoot;

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

            @Value(
                    "${attendance.reports.storage-path:storage/attendance-reports}"
            )
            String storagePath
    ) {

        this.attendanceReportAggregationService =
                attendanceReportAggregationService;

        this.attendanceReportPdfGenerator =
                attendanceReportPdfGenerator;

        this.attendanceReportExcelGenerator =
                attendanceReportExcelGenerator;

        this.attendanceReportArchiveRepository =
                attendanceReportArchiveRepository;

        this.storageRoot =
                Paths
                        .get(storagePath)
                        .toAbsolutePath()
                        .normalize();
    }

    /* =========================================================
       GENERATE / REGENERATE REPORT
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
           2. BUILD STORAGE DIRECTORY
        ===================================================== */

        String safeSectionName =
                sanitize(
                        report.sectionName()
                );

        String directoryPeriod =
                buildDirectoryPeriod(
                        report
                );

        Path targetDirectory =
                storageRoot

                        .resolve(
                                String.valueOf(
                                        report
                                                .periodStart()
                                                .getYear()
                                )
                        )

                        .resolve(
                                report
                                        .reportType()
                                        .name()
                                        .toLowerCase(
                                                Locale.ROOT
                                        )
                        )

                        .resolve(
                                directoryPeriod
                        )

                        .resolve(
                                safeSectionName
                        )

                        .normalize();

        ensureInsideStorage(
                targetDirectory
        );

        /* =====================================================
           3. BUILD FILE NAMES
        ===================================================== */

        String baseFileName =
                buildBaseFileName(
                        report
                );

        String pdfFileName =
                baseFileName +
                        ".pdf";

        String excelFileName =
                baseFileName +
                        ".xlsx";

        Path pdfPath =
                targetDirectory
                        .resolve(
                                pdfFileName
                        )
                        .normalize();

        Path excelPath =
                targetDirectory
                        .resolve(
                                excelFileName
                        )
                        .normalize();

        ensureInsideStorage(
                pdfPath
        );

        ensureInsideStorage(
                excelPath
        );

        /* =====================================================
           4. TEMPORARY FILES

           Generate to temp first so we don't expose
           partially-written reports.
        ===================================================== */

        Path temporaryPdf =
                targetDirectory
                        .resolve(
                                pdfFileName +
                                        ".tmp"
                        )
                        .normalize();

        Path temporaryExcel =
                targetDirectory
                        .resolve(
                                excelFileName +
                                        ".tmp"
                        )
                        .normalize();

        try {

            /* =================================================
               CREATE DIRECTORY
            ================================================= */

            Files.createDirectories(
                    targetDirectory
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
               MOVE TEMP FILES TO FINAL LOCATION
            ================================================= */

            moveReplacing(
                    temporaryPdf,
                    pdfPath
            );

            moveReplacing(
                    temporaryExcel,
                    excelPath
            );

        } catch (IOException exception) {

            deleteQuietly(
                    temporaryPdf
            );

            deleteQuietly(
                    temporaryExcel
            );

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to generate attendance report files"
            );
        }

        /* =====================================================
           5. FIND EXISTING ARCHIVE

           Same:
           - section
           - report type
           - period start
           - period end

           means regenerate/update instead of duplicate.
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
           6. SNAPSHOT INFORMATION
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
           7. SUMMARY VALUES
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
           8. PDF INFORMATION
        ===================================================== */

        archive.setPdfFileName(
                pdfFileName
        );

        archive.setPdfRelativePath(
                relativePath(
                        pdfPath
                )
        );

        /* =====================================================
           9. EXCEL INFORMATION
        ===================================================== */

        archive.setExcelFileName(
                excelFileName
        );

        archive.setExcelRelativePath(
                relativePath(
                        excelPath
                )
        );

        /* =====================================================
           10. GENERATION TIME
        ===================================================== */

        archive.setGeneratedAt(
                LocalDateTime.now()
        );

        /* =====================================================
           11. SAVE ARCHIVE
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
                report.reportType() ==
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

            return sectionName +
                    "_Monthly_" +
                    month;
        }

        /* =====================================================
           WEEKLY

           Example:
           BSCS_3-B_Weekly_2026-08-17_to_2026-08-21
        ===================================================== */

        return sectionName +
                "_Weekly_" +
                report.periodStart() +
                "_to_" +
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

           storage/
           attendance-reports/
           2026/
           monthly/
           08/
        ===================================================== */

        if (
                report.reportType() ==
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

           storage/
           attendance-reports/
           2026/
           weekly/
           2026-08-17_to_2026-08-21/
        ===================================================== */

        return report.periodStart() +
                "_to_" +
                report.periodEnd();
    }

    /* =========================================================
       DATABASE RELATIVE PATH

       We store relative paths instead of machine-specific
       absolute paths.
    ========================================================= */

    private String relativePath(
            Path file
    ) {

        return storageRoot

                .relativize(
                        file
                )

                .toString()

                .replace(
                        '\\',
                        '/'
                );
    }

    /* =========================================================
       PATH SECURITY

       Prevent generated paths from escaping the configured
       report storage directory.
    ========================================================= */

    private void ensureInsideStorage(
            Path path
    ) {

        Path normalizedPath =
                path
                        .toAbsolutePath()
                        .normalize();

        if (
                !normalizedPath.startsWith(
                        storageRoot
                )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid attendance report storage path"
            );
        }
    }

    /* =========================================================
       SAFE FILE MOVE
    ========================================================= */

    private void moveReplacing(

            Path source,

            Path target

    ) throws IOException {

        try {

            Files.move(

                    source,

                    target,

                    StandardCopyOption.REPLACE_EXISTING,

                    StandardCopyOption.ATOMIC_MOVE
            );

        } catch (
                AtomicMoveNotSupportedException exception
        ) {

            Files.move(

                    source,

                    target,

                    StandardCopyOption.REPLACE_EXISTING
            );
        }
    }

    /* =========================================================
       TEMP FILE CLEANUP
    ========================================================= */

    private void deleteQuietly(
            Path path
    ) {

        try {

            Files.deleteIfExists(
                    path
            );

        } catch (IOException ignored) {

            /*
             * Best-effort cleanup only.
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
                value == null ||
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
                String character :
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