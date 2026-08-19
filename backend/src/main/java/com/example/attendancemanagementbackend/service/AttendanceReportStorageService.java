package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;

import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

@Service
public class AttendanceReportStorageService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final SupabaseStorageService
            supabaseStorageService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportStorageService(

            SupabaseStorageService
                    supabaseStorageService
    ) {

        this.supabaseStorageService =
                supabaseStorageService;
    }

    /* =========================================================
       PDF CONTENT
    ========================================================= */

    public byte[] getPdfContent(
            AttendanceReportArchive archive
    ) {

        if (
                archive == null
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance report archive was not found"
            );
        }

        return downloadStoredFile(

                archive.getPdfRelativePath(),

                "PDF"
        );
    }

    /* =========================================================
       EXCEL CONTENT
    ========================================================= */

    public byte[] getExcelContent(
            AttendanceReportArchive archive
    ) {

        if (
                archive == null
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance report archive was not found"
            );
        }

        return downloadStoredFile(

                archive.getExcelRelativePath(),

                "Excel"
        );
    }

    /* =========================================================
       DOWNLOAD STORED FILE

       relativePath now represents a Supabase Storage
       object key.

       Example:

       2026/weekly/
       2026-08-17_to_2026-08-21/
       BSCS_3-B/
       report.pdf
    ========================================================= */

    private byte[] downloadStoredFile(

            String objectKey,

            String fileType
    ) {

        String normalizedObjectKey =
                validateObjectKey(
                        objectKey,
                        fileType
                );

        return supabaseStorageService
                .download(
                        normalizedObjectKey
                );
    }

    /* =========================================================
       OBJECT KEY VALIDATION

       Database paths are internal values, but we still
       validate them defensively before sending them to
       Supabase Storage.
    ========================================================= */

    private String validateObjectKey(

            String objectKey,

            String fileType
    ) {

        if (
                objectKey == null
                        ||
                        objectKey.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    fileType
                            +
                            " report file is not available"
            );
        }

        String normalized =
                objectKey
                        .trim()
                        .replace(
                                '\\',
                                '/'
                        );

        /* =====================================================
           OBJECT KEYS MUST BE RELATIVE
        ===================================================== */

        while (
                normalized.startsWith(
                        "/"
                )
        ) {

            normalized =
                    normalized.substring(
                            1
                    );
        }

        /* =====================================================
           DEFENSIVE PATH VALIDATION
        ===================================================== */

        String[] segments =
                normalized.split(
                        "/"
                );

        for (
                String segment
                :
                segments
        ) {

            if (
                    "..".equals(
                            segment
                    )
            ) {

                throw new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Invalid stored attendance report object key"
                );
            }
        }

        if (
                normalized.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    fileType
                            +
                            " report file is not available"
            );
        }

        return normalized;
    }
}