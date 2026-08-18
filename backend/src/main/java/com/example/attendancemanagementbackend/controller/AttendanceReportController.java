package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportArchiveResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportBatchGenerationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportDownloadFormat;
import com.example.attendancemanagementbackend.dto.AttendanceReportZipFile;

import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import com.example.attendancemanagementbackend.service.AttendanceReportAccessService;
import com.example.attendancemanagementbackend.service.AttendanceReportArchiveService;
import com.example.attendancemanagementbackend.service.AttendanceReportFileService;
import com.example.attendancemanagementbackend.service.AttendanceReportScheduler;
import com.example.attendancemanagementbackend.service.AttendanceReportStorageService;
import com.example.attendancemanagementbackend.service.AttendanceReportZipService;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

import org.springframework.format.annotation.DateTimeFormat;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;

import java.time.LocalDate;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attendance-reports")
public class AttendanceReportController {

    /* =========================================================
       MEDIA TYPES
    ========================================================= */

    private static final MediaType EXCEL_MEDIA_TYPE =
            MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

    private static final MediaType ZIP_MEDIA_TYPE =
            MediaType.parseMediaType(
                    "application/zip"
            );

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceReportAccessService
            attendanceReportAccessService;

    private final AttendanceReportFileService
            attendanceReportFileService;

    private final AttendanceReportArchiveService
            attendanceReportArchiveService;

    private final AttendanceReportStorageService
            attendanceReportStorageService;

    private final AttendanceReportZipService
            attendanceReportZipService;

    private final AttendanceReportScheduler
            attendanceReportScheduler;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportController(

            AttendanceReportAccessService
                    attendanceReportAccessService,

            AttendanceReportFileService
                    attendanceReportFileService,

            AttendanceReportArchiveService
                    attendanceReportArchiveService,

            AttendanceReportStorageService
                    attendanceReportStorageService,

            AttendanceReportZipService
                    attendanceReportZipService,

            AttendanceReportScheduler
                    attendanceReportScheduler
    ) {

        this.attendanceReportAccessService =
                attendanceReportAccessService;

        this.attendanceReportFileService =
                attendanceReportFileService;

        this.attendanceReportArchiveService =
                attendanceReportArchiveService;

        this.attendanceReportStorageService =
                attendanceReportStorageService;

        this.attendanceReportZipService =
                attendanceReportZipService;

        this.attendanceReportScheduler =
                attendanceReportScheduler;
    }

    /* =========================================================
       PREVIEW REPORT

       COUNCILOR:
       - Any section

       ADVISER:
       - Assigned section only

       Does NOT create files.
    ========================================================= */

    @GetMapping("/preview")
    public ResponseEntity<AttendanceReportAggregationResponse>
    previewReport(

            @RequestParam
            String sectionId,

            @RequestParam
            AttendanceReportType type,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to,

            Authentication authentication
    ) {

        AttendanceReportAggregationResponse response =
                attendanceReportAccessService
                        .preview(
                                sectionId,
                                type,
                                from,
                                to,
                                authentication
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       MANUAL GENERATE / REGENERATE SINGLE REPORT

       COUNCILOR ONLY via SecurityConfig.

       Creates:
       - PDF
       - Excel
       - Archive row

       Same section/type/period:
       - Existing archive is updated
       - No duplicate archive row
    ========================================================= */

    @PostMapping("/generate")
    public ResponseEntity<AttendanceReportArchiveResponse>
    generateReport(

            @RequestParam
            String sectionId,

            @RequestParam
            AttendanceReportType type,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to
    ) {

        AttendanceReportArchiveResponse response =
                attendanceReportFileService
                        .generate(
                                sectionId,
                                type,
                                from,
                                to
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       MANUAL BATCH GENERATION

       COUNCILOR ONLY via SecurityConfig.

       Generates reports for ALL sections for the
       selected period.

       Used for:
       - Testing scheduler logic
       - Catch-up generation
       - Manual batch regeneration

       Automatic weekly/monthly schedulers reuse the
       same generateForPeriod(...) logic internally.
    ========================================================= */

    @PostMapping("/generate-batch")
    public ResponseEntity<AttendanceReportBatchGenerationResponse>
    generateBatch(

            @RequestParam
            AttendanceReportType type,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to
    ) {

        AttendanceReportBatchGenerationResponse response =
                attendanceReportScheduler
                        .generateForPeriod(
                                type,
                                from,
                                to
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       ARCHIVE LIST

       COUNCILOR:
       - Can see all accessible reports

       ADVISER:
       - Can only see assigned section reports

       Example:

       GET /api/attendance-reports/archive
           ?type=WEEKLY
           &sectionId=...
           &from=2026-08-01
           &to=2026-08-31
           &page=0
           &size=12
    ========================================================= */

    @GetMapping("/archive")
    public ResponseEntity<
            PagedResponse<AttendanceReportArchiveResponse>
            >
    getArchive(

            @RequestParam(required = false)
            AttendanceReportType type,

            @RequestParam(required = false)
            String sectionId,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to,

            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "12")
            int size,

            Authentication authentication
    ) {

        PagedResponse<AttendanceReportArchiveResponse> response =
                attendanceReportArchiveService
                        .getArchive(
                                type,
                                sectionId,
                                from,
                                to,
                                page,
                                size,
                                authentication
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       VIEW / DOWNLOAD PDF

       download=false
       → Browser inline preview

       download=true
       → Attachment download
    ========================================================= */

    @GetMapping("/{reportId}/pdf")
    public ResponseEntity<Resource>
    getPdf(

            @PathVariable
            UUID reportId,

            @RequestParam(defaultValue = "false")
            boolean download,

            Authentication authentication
    ) {

        AttendanceReportArchive archive =
                attendanceReportArchiveService
                        .getAuthorizedReport(
                                reportId,
                                authentication
                        );

        Path file =
                attendanceReportStorageService
                        .getPdfFile(
                                archive
                        );

        Resource resource =
                new FileSystemResource(
                        file
                );

        ContentDisposition disposition;

        if (download) {

            disposition =
                    ContentDisposition
                            .attachment()
                            .filename(
                                    archive.getPdfFileName()
                            )
                            .build();

        } else {

            disposition =
                    ContentDisposition
                            .inline()
                            .filename(
                                    archive.getPdfFileName()
                            )
                            .build();
        }

        return ResponseEntity
                .ok()

                .contentType(
                        MediaType.APPLICATION_PDF
                )

                .contentLength(
                        file
                                .toFile()
                                .length()
                )

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .body(
                        resource
                );
    }

    /* =========================================================
       DOWNLOAD EXCEL

       Always returned as attachment.
    ========================================================= */

    @GetMapping("/{reportId}/excel")
    public ResponseEntity<Resource>
    getExcel(

            @PathVariable
            UUID reportId,

            Authentication authentication
    ) {

        AttendanceReportArchive archive =
                attendanceReportArchiveService
                        .getAuthorizedReport(
                                reportId,
                                authentication
                        );

        Path file =
                attendanceReportStorageService
                        .getExcelFile(
                                archive
                        );

        Resource resource =
                new FileSystemResource(
                        file
                );

        ContentDisposition disposition =
                ContentDisposition
                        .attachment()
                        .filename(
                                archive.getExcelFileName()
                        )
                        .build();

        return ResponseEntity
                .ok()

                .contentType(
                        EXCEL_MEDIA_TYPE
                )

                .contentLength(
                        file
                                .toFile()
                                .length()
                )

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .body(
                        resource
                );
    }

    /* =========================================================
       DOWNLOAD ALL ZIP

       Supports:

       format=PDF
       format=EXCEL
       format=BOTH

       COUNCILOR:
       - All matching authorized reports

       ADVISER:
       - Assigned section reports only
    ========================================================= */

    @GetMapping("/archive/download-all")
    public ResponseEntity<byte[]>
    downloadAll(

            @RequestParam(required = false)
            AttendanceReportType type,

            @RequestParam(required = false)
            String sectionId,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to,

            @RequestParam(defaultValue = "BOTH")
            AttendanceReportDownloadFormat format,

            Authentication authentication
    ) {

        List<AttendanceReportArchive> reports =
                attendanceReportArchiveService
                        .getReportsForDownload(
                                type,
                                sectionId,
                                from,
                                to,
                                authentication
                        );

        AttendanceReportZipFile zipFile =
                attendanceReportZipService
                        .createZip(
                                reports,
                                format
                        );

        ContentDisposition disposition =
                ContentDisposition
                        .attachment()
                        .filename(
                                zipFile.fileName()
                        )
                        .build();

        return ResponseEntity
                .ok()

                .contentType(
                        ZIP_MEDIA_TYPE
                )

                .contentLength(
                        zipFile
                                .content()
                                .length
                )

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .body(
                        zipFile.content()
                );
    }
}