package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportArchiveResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceReportArchiveRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import java.util.List;
import java.util.UUID;

@Service
public class AttendanceReportArchiveService {

    private static final int DEFAULT_PAGE_SIZE =
            12;

    private static final int MAX_PAGE_SIZE =
            50;

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceReportArchiveRepository
            attendanceReportArchiveRepository;

    private final AttendanceReportAccessService
            attendanceReportAccessService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportArchiveService(

            AttendanceReportArchiveRepository
                    attendanceReportArchiveRepository,

            AttendanceReportAccessService
                    attendanceReportAccessService
    ) {

        this.attendanceReportArchiveRepository =
                attendanceReportArchiveRepository;

        this.attendanceReportAccessService =
                attendanceReportAccessService;
    }

    /* =========================================================
       GET PAGINATED ARCHIVE
    ========================================================= */

    @Transactional(readOnly = true)
    public PagedResponse<AttendanceReportArchiveResponse>
    getArchive(

            AttendanceReportType reportType,

            String sectionId,

            LocalDate fromDate,

            LocalDate toDate,

            int page,

            int size,

            Authentication authentication
    ) {

        validateAuthentication(
                authentication
        );

        validateDateRange(
                fromDate,
                toDate
        );

        if (page < 0) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Page cannot be negative"
            );
        }

        int resolvedSize =
                size <= 0
                        ? DEFAULT_PAGE_SIZE
                        : size;

        if (
                resolvedSize >
                        MAX_PAGE_SIZE
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Page size cannot exceed "
                            +
                            MAX_PAGE_SIZE
            );
        }

        String normalizedSectionId =
                normalize(
                        sectionId
                );

        /*
         * If an Adviser explicitly requests a section,
         * return 403 instead of simply returning an
         * empty result.
         */
        if (
                normalizedSectionId != null
                        &&
                        !isCouncilor(
                                authentication
                        )
        ) {

            attendanceReportAccessService
                    .validateSectionAccess(
                            normalizedSectionId,
                            authentication
                    );
        }

        PageRequest pageable =
                PageRequest.of(
                        page,
                        resolvedSize
                );

        Page<AttendanceReportArchive> archivePage =
                attendanceReportArchiveRepository
                        .searchAccessibleReports(

                                isCouncilor(
                                        authentication
                                ),

                                getUserId(
                                        authentication
                                ),

                                reportType,

                                normalizedSectionId,

                                fromDate,

                                toDate,

                                pageable
                        );

        Page<AttendanceReportArchiveResponse> responsePage =
                archivePage.map(
                        AttendanceReportArchiveResponse::from
                );

        return PagedResponse.from(
                responsePage
        );
    }

    /* =========================================================
       GET ONE AUTHORIZED ARCHIVE
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceReportArchive getAuthorizedReport(

            UUID reportId,

            Authentication authentication
    ) {

        validateAuthentication(
                authentication
        );

        AttendanceReportArchive archive =
                attendanceReportArchiveRepository
                        .findById(
                                reportId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Attendance report was not found"
                                        )
                        );

        /*
         * Re-check current section ownership before
         * returning physical files.
         */
        attendanceReportAccessService
                .validateSectionAccess(
                        archive.getSectionId(),
                        authentication
                );

        return archive;
    }

    /* =========================================================
       GET ALL AUTHORIZED REPORTS FOR ZIP
    ========================================================= */

    @Transactional(readOnly = true)
    public List<AttendanceReportArchive>
    getReportsForDownload(

            AttendanceReportType reportType,

            String sectionId,

            LocalDate fromDate,

            LocalDate toDate,

            Authentication authentication
    ) {

        validateAuthentication(
                authentication
        );

        validateDateRange(
                fromDate,
                toDate
        );

        String normalizedSectionId =
                normalize(
                        sectionId
                );

        if (
                normalizedSectionId != null
                        &&
                        !isCouncilor(
                                authentication
                        )
        ) {

            attendanceReportAccessService
                    .validateSectionAccess(
                            normalizedSectionId,
                            authentication
                    );
        }

        return attendanceReportArchiveRepository
                .findAccessibleReportsForDownload(

                        isCouncilor(
                                authentication
                        ),

                        getUserId(
                                authentication
                        ),

                        reportType,

                        normalizedSectionId,

                        fromDate,

                        toDate
                );
    }

    /* =========================================================
       ROLE
    ========================================================= */

    private boolean isCouncilor(
            Authentication authentication
    ) {

        return authentication
                .getAuthorities()
                .stream()
                .anyMatch(
                        authority ->
                                "ROLE_COUNCILOR"
                                        .equals(
                                                authority
                                                        .getAuthority()
                                        )
                );
    }

    /* =========================================================
       USER ID
    ========================================================= */

    private String getUserId(
            Authentication authentication
    ) {

        return authentication
                .getPrincipal()
                .toString();
    }

    /* =========================================================
       AUTHENTICATION VALIDATION
    ========================================================= */

    private void validateAuthentication(
            Authentication authentication
    ) {

        if (
                authentication == null
                        ||
                        !authentication
                                .isAuthenticated()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }
    }

    /* =========================================================
       DATE VALIDATION
    ========================================================= */

    private void validateDateRange(

            LocalDate fromDate,

            LocalDate toDate
    ) {

        if (
                fromDate != null
                        &&
                        toDate != null
                        &&
                        fromDate.isAfter(
                                toDate
                        )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "From date cannot be after to date"
            );
        }
    }

    /* =========================================================
       NORMALIZE
    ========================================================= */

    private String normalize(
            String value
    ) {

        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}