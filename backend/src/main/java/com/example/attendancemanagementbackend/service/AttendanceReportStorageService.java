package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.exception.ApiException;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class AttendanceReportStorageService {

    private final Path storageRoot;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportStorageService(

            @Value(
                    "${attendance.reports.storage-path:storage/attendance-reports}"
            )
            String storagePath
    ) {

        this.storageRoot =
                Paths
                        .get(
                                storagePath
                        )
                        .toAbsolutePath()
                        .normalize();
    }

    /* =========================================================
       PDF
    ========================================================= */

    public Path getPdfFile(
            AttendanceReportArchive archive
    ) {

        return resolveStoredFile(
                archive.getPdfRelativePath(),
                "PDF"
        );
    }

    /* =========================================================
       EXCEL
    ========================================================= */

    public Path getExcelFile(
            AttendanceReportArchive archive
    ) {

        return resolveStoredFile(
                archive.getExcelRelativePath(),
                "Excel"
        );
    }

    /* =========================================================
       RESOLVE STORED FILE
    ========================================================= */

    private Path resolveStoredFile(

            String relativePath,

            String fileType
    ) {

        if (
                relativePath == null
                        ||
                        relativePath.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    fileType
                            +
                            " report file is not available"
            );
        }

        Path resolved =
                storageRoot
                        .resolve(
                                relativePath
                        )
                        .toAbsolutePath()
                        .normalize();

        /* =====================================================
           PATH TRAVERSAL PROTECTION
        ===================================================== */

        if (
                !resolved.startsWith(
                        storageRoot
                )
        ) {

            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Invalid stored attendance report path"
            );
        }

        /* =====================================================
           PHYSICAL FILE CHECK
        ===================================================== */

        if (
                !Files.exists(
                        resolved
                )
                        ||
                        !Files.isRegularFile(
                                resolved
                        )
        ) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    fileType
                            +
                            " attendance report file was not found"
            );
        }

        return resolved;
    }
}