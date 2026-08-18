package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.SectionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Objects;

@Service
public class AttendanceReportAccessService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final SectionRepository sectionRepository;

    private final AttendanceReportAggregationService
            attendanceReportAggregationService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportAccessService(
            SectionRepository sectionRepository,
            AttendanceReportAggregationService attendanceReportAggregationService
    ) {

        this.sectionRepository =
                sectionRepository;

        this.attendanceReportAggregationService =
                attendanceReportAggregationService;
    }

    /* =========================================================
       PREVIEW REPORT

       COUNCILOR
       - Any section

       ADVISER
       - Assigned section only
    ========================================================= */

    public AttendanceReportAggregationResponse preview(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd,

            Authentication authentication
    ) {

        validateSectionAccess(
                sectionId,
                authentication
        );

        return attendanceReportAggregationService
                .aggregate(
                        sectionId,
                        reportType,
                        periodStart,
                        periodEnd
                );
    }

    /* =========================================================
       SECTION ACCESS VALIDATION
    ========================================================= */

    public void validateSectionAccess(

            String sectionId,

            Authentication authentication
    ) {

        /* =====================================================
           AUTHENTICATION REQUIRED
        ===================================================== */

        if (
                authentication == null ||
                        !authentication.isAuthenticated()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        /* =====================================================
           COUNCILOR

           Councilor can access attendance reports
           from any section.
        ===================================================== */

        boolean isCouncilor =
                authentication
                        .getAuthorities()
                        .stream()
                        .anyMatch(
                                authority ->
                                        "ROLE_COUNCILOR".equals(
                                                authority.getAuthority()
                                        )
                        );

        if (isCouncilor) {
            return;
        }

        /* =====================================================
           ADVISER ROLE CHECK
        ===================================================== */

        boolean isAdviser =
                authentication
                        .getAuthorities()
                        .stream()
                        .anyMatch(
                                authority ->
                                        "ROLE_ADVISER".equals(
                                                authority.getAuthority()
                                        )
                        );

        if (!isAdviser) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to access attendance reports"
            );
        }

        /* =====================================================
           GET AUTHENTICATED ADVISER ID

           Your JWT setup currently stores the authenticated
           user's ID as the Authentication principal.
        ===================================================== */

        String authenticatedAdviserId =
                authentication
                        .getPrincipal()
                        .toString();

        /* =====================================================
           FIND REQUESTED SECTION
        ===================================================== */

        Section section =
                sectionRepository
                        .findById(
                                sectionId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Section not found"
                                        )
                        );

        /* =====================================================
           ADVISER OWNERSHIP CHECK
        ===================================================== */

        if (
                section.getAdviser() == null ||
                        !Objects.equals(
                                section
                                        .getAdviser()
                                        .getId(),

                                authenticatedAdviserId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You can only access attendance reports for your assigned section"
            );
        }
    }
}