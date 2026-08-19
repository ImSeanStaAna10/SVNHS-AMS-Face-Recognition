package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportDownloadFormat;
import com.example.attendancemanagementbackend.dto.AttendanceReportZipFile;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import java.time.LocalDateTime;

import java.time.format.DateTimeFormatter;

import java.util.List;
import java.util.Locale;

import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class AttendanceReportZipService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceReportStorageService
            attendanceReportStorageService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportZipService(

            AttendanceReportStorageService
                    attendanceReportStorageService
    ) {

        this.attendanceReportStorageService =
                attendanceReportStorageService;
    }

    /* =========================================================
       CREATE ZIP

       Files are retrieved from Supabase Storage and
       written directly into the ZIP in memory.

       No permanent local files are required.
    ========================================================= */

    public AttendanceReportZipFile createZip(

            List<AttendanceReportArchive> reports,

            AttendanceReportDownloadFormat format
    ) {

        if (
                reports == null
                        ||
                        reports.isEmpty()
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "No archived attendance reports matched the selected filters"
            );
        }

        AttendanceReportDownloadFormat resolvedFormat =
                format != null

                        ? format

                        : AttendanceReportDownloadFormat.BOTH;

        try (
                ByteArrayOutputStream output =
                        new ByteArrayOutputStream();

                ZipOutputStream zip =
                        new ZipOutputStream(
                                output
                        )
        ) {

            for (
                    AttendanceReportArchive archive
                    :
                    reports
            ) {

                /* =================================================
                   PDF
                ================================================= */

                if (
                        resolvedFormat
                                ==
                                AttendanceReportDownloadFormat.PDF

                                ||

                                resolvedFormat
                                        ==
                                        AttendanceReportDownloadFormat.BOTH
                ) {

                    byte[] pdfContent =
                            attendanceReportStorageService
                                    .getPdfContent(
                                            archive
                                    );

                    addFile(
                            zip,
                            archive,
                            pdfContent,
                            archive.getPdfFileName()
                    );
                }

                /* =================================================
                   EXCEL
                ================================================= */

                if (
                        resolvedFormat
                                ==
                                AttendanceReportDownloadFormat.EXCEL

                                ||

                                resolvedFormat
                                        ==
                                        AttendanceReportDownloadFormat.BOTH
                ) {

                    byte[] excelContent =
                            attendanceReportStorageService
                                    .getExcelContent(
                                            archive
                                    );

                    addFile(
                            zip,
                            archive,
                            excelContent,
                            archive.getExcelFileName()
                    );
                }
            }

            zip.finish();

            /* =====================================================
               ZIP FILE NAME
            ===================================================== */

            String timestamp =
                    LocalDateTime
                            .now()
                            .format(
                                    DateTimeFormatter
                                            .ofPattern(
                                                    "yyyyMMdd_HHmmss"
                                            )
                            );

            String fileName =
                    "attendance_reports_"

                            +
                            resolvedFormat
                                    .name()
                                    .toLowerCase(
                                            Locale.ROOT
                                    )

                            +
                            "_"

                            +
                            timestamp

                            +
                            ".zip";

            return new AttendanceReportZipFile(
                    fileName,
                    output.toByteArray()
            );

        } catch (IOException exception) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to create attendance report ZIP file"
            );
        }
    }

    /* =========================================================
       ADD FILE TO ZIP
    ========================================================= */

    private void addFile(

            ZipOutputStream zip,

            AttendanceReportArchive archive,

            byte[] content,

            String fileName

    ) throws IOException {

        if (
                content == null
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance report file content is not available"
            );
        }

        String safeFileName =
                sanitizeFileName(
                        fileName
                );

        String folder =
                archive
                        .getReportType()
                        .name()
                        .toLowerCase(
                                Locale.ROOT
                        )

                        +
                        "/"

                        +
                        archive.getPeriodStart()

                        +
                        "_to_"

                        +
                        archive.getPeriodEnd()

                        +
                        "/"

                        +
                        sanitize(
                                archive.getSectionName()
                        )

                        +
                        "/";

        ZipEntry entry =
                new ZipEntry(
                        folder
                                +
                                safeFileName
                );

        zip.putNextEntry(
                entry
        );

        zip.write(
                content
        );

        zip.closeEntry();
    }

    /* =========================================================
       SANITIZE ZIP DIRECTORY
    ========================================================= */

    private String sanitize(
            String value
    ) {

        if (
                value == null
                        ||
                        value.isBlank()
        ) {

            return "section";
        }

        return value
                .trim()

                .replaceAll(
                        "[\\\\/:*?\"<>|]",
                        "-"
                )

                .replaceAll(
                        "\\s+",
                        "_"
                );
    }

    /* =========================================================
       SANITIZE FILE NAME

       Additional ZIP safety in case archive metadata
       has unexpected characters.
    ========================================================= */

    private String sanitizeFileName(
            String value
    ) {

        if (
                value == null
                        ||
                        value.isBlank()
        ) {

            return "attendance-report";
        }

        return value
                .trim()

                .replaceAll(
                        "[\\\\/:*?\"<>|]",
                        "-"
                )

                .replace(
                        "..",
                        "-"
                );
    }
}