package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportDownloadFormat;
import com.example.attendancemanagementbackend.dto.AttendanceReportZipFile;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import java.nio.file.Files;
import java.nio.file.Path;

import java.time.LocalDateTime;

import java.time.format.DateTimeFormatter;

import java.util.List;
import java.util.Locale;

import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class AttendanceReportZipService {

    private final AttendanceReportStorageService
            attendanceReportStorageService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportZipService(
            AttendanceReportStorageService attendanceReportStorageService
    ) {

        this.attendanceReportStorageService =
                attendanceReportStorageService;
    }

    /* =========================================================
       CREATE ZIP
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
                    : reports
            ) {

                if (
                        resolvedFormat ==
                                AttendanceReportDownloadFormat.PDF
                                ||
                                resolvedFormat ==
                                        AttendanceReportDownloadFormat.BOTH
                ) {

                    Path pdf =
                            attendanceReportStorageService
                                    .getPdfFile(
                                            archive
                                    );

                    addFile(
                            zip,
                            archive,
                            pdf,
                            archive.getPdfFileName()
                    );
                }

                if (
                        resolvedFormat ==
                                AttendanceReportDownloadFormat.EXCEL
                                ||
                                resolvedFormat ==
                                        AttendanceReportDownloadFormat.BOTH
                ) {

                    Path excel =
                            attendanceReportStorageService
                                    .getExcelFile(
                                            archive
                                    );

                    addFile(
                            zip,
                            archive,
                            excel,
                            archive.getExcelFileName()
                    );
                }
            }

            zip.finish();

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
       ADD FILE
    ========================================================= */

    private void addFile(

            ZipOutputStream zip,

            AttendanceReportArchive archive,

            Path file,

            String fileName

    ) throws IOException {

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
                                fileName
                );

        zip.putNextEntry(
                entry
        );

        Files.copy(
                file,
                zip
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
}