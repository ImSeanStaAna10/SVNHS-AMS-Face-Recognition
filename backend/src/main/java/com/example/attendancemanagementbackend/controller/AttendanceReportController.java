package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportArchiveResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportBatchGenerationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportDownloadFormat;
import com.example.attendancemanagementbackend.dto.AttendanceReportZipFile;
import com.example.attendancemanagementbackend.dto.SupabaseStorageTestResponse;

import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import com.example.attendancemanagementbackend.service.AttendanceReportAccessService;
import com.example.attendancemanagementbackend.service.AttendanceReportArchiveService;
import com.example.attendancemanagementbackend.service.AttendanceReportFileService;
import com.example.attendancemanagementbackend.service.AttendanceReportScheduler;
import com.example.attendancemanagementbackend.service.AttendanceReportStorageService;
import com.example.attendancemanagementbackend.service.AttendanceReportZipService;
import com.example.attendancemanagementbackend.service.SupabaseStorageService;

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

    private final SupabaseStorageService
            supabaseStorageService;

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
                    attendanceReportScheduler,

            SupabaseStorageService
                    supabaseStorageService
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

        this.supabaseStorageService =
                supabaseStorageService;
    }

    /* =========================================================
       PREVIEW REPORT
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
       GENERATE / REGENERATE SINGLE REPORT

       COUNCILOR ONLY.

       Actual PDF / XLSX files are uploaded to the
       private Supabase Storage bucket.
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

       COUNCILOR ONLY.

       Scheduler uses the same generation pipeline,
       therefore scheduled reports are also uploaded
       to Supabase Storage.
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
       SUPABASE STORAGE SMOKE TEST

       TEMPORARY.

       Remove after full production storage migration
       has been verified.
    ========================================================= */

    @PostMapping("/storage-test")
    public ResponseEntity<SupabaseStorageTestResponse>
    testSupabaseStorage() {

        SupabaseStorageTestResponse response =
                supabaseStorageService
                        .smokeTest();

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       ARCHIVE LIST
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

       Security:
       getAuthorizedReport(...) checks that:

       COUNCILOR
       → may access allowed reports

       ADVISER
       → may access assigned section only

       Storage:
       actual PDF bytes come from Supabase Storage.

       download=false
       → inline browser preview

       download=true
       → attachment
    ========================================================= */

    @GetMapping("/{reportId}/pdf")
    public ResponseEntity<byte[]>
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

        byte[] content =
                attendanceReportStorageService
                        .getPdfContent(
                                archive
                        );

        ContentDisposition disposition;

        if (
                download
        ) {

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
                        content.length
                )

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .body(
                        content
                );
    }

    /* =========================================================
       DOWNLOAD EXCEL

       Actual XLSX bytes come from Supabase Storage.
    ========================================================= */

    @GetMapping("/{reportId}/excel")
    public ResponseEntity<byte[]>
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

        byte[] content =
                attendanceReportStorageService
                        .getExcelContent(
                                archive
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
                        content.length
                )

                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )

                .body(
                        content
                );
    }

    /* =========================================================
       DOWNLOAD ALL ZIP

       Individual PDF/XLSX files are fetched from
       Supabase Storage and assembled into ZIP bytes.

       format:
       PDF
       EXCEL
       BOTH
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