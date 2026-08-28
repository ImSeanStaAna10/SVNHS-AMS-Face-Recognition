package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import java.util.Objects;

@Service
public class AttendanceReportAccessService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final SectionRepository
            sectionRepository;

    private final UserRepository
            userRepository;

    private final AttendanceReportAggregationService
            attendanceReportAggregationService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportAccessService(

            SectionRepository sectionRepository,

            UserRepository userRepository,

            AttendanceReportAggregationService
                    attendanceReportAggregationService
    ) {

        this.sectionRepository =
                sectionRepository;

        this.userRepository =
                userRepository;

        this.attendanceReportAggregationService =
                attendanceReportAggregationService;
    }

    /* =========================================================
       PREVIEW REPORT

       COUNCILOR:
       - Own Department only

       ADVISER:
       - Assigned Section only
    ========================================================= */

    @Transactional(readOnly = true)
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

       COUNCILOR:
       - Requested Section must belong to own Department

       ADVISER:
       - Requested Section must currently be assigned
         to authenticated Adviser
    ========================================================= */

    @Transactional(readOnly = true)
    public void validateSectionAccess(

            String sectionId,

            Authentication authentication
    ) {

        validateAuthentication(
                authentication
        );

        if (
                sectionId == null ||
                        sectionId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Section id is required"
            );
        }

        /* =====================================================
           COUNCILOR
        ===================================================== */

        if (
                hasRole(
                        authentication,
                        "ROLE_COUNCILOR"
                )
        ) {

            String departmentId =
                    getCouncilorDepartmentId(
                            authentication
                    );

            sectionRepository
                    .findByIdAndDepartment_Id(
                            sectionId,
                            departmentId
                    )
                    .orElseThrow(
                            () ->
                                    new ApiException(
                                            HttpStatus.NOT_FOUND,
                                            "Section not found in your department"
                                    )
                    );

            return;
        }

        /* =====================================================
           ADVISER ROLE CHECK
        ===================================================== */

        if (
                !hasRole(
                        authentication,
                        "ROLE_ADVISER"
                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to access attendance reports"
            );
        }

        /* =====================================================
           AUTHENTICATED ADVISER
        ===================================================== */

        String authenticatedAdviserId =
                authentication
                        .getPrincipal()
                        .toString();

        /* =====================================================
           REQUESTED SECTION
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

    /* =========================================================
       GET COUNCILOR DEPARTMENT ID

       Central helper used by:

       - Attendance overview
       - Attendance archive
       - Manual report generation
       - Manual batch generation
       - Other Councilor reporting operations
    ========================================================= */

    @Transactional(readOnly = true)
    public String getCouncilorDepartmentId(
            Authentication authentication
    ) {

        validateAuthentication(
                authentication
        );

        /* =====================================================
           ROLE CHECK
        ===================================================== */

        if (
                !hasRole(
                        authentication,
                        "ROLE_COUNCILOR"
                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Councilor access is required"
            );
        }

        /* =====================================================
           AUTHENTICATED COUNCILOR ID
        ===================================================== */

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        /* =====================================================
           FIND COUNCILOR
        ===================================================== */

        User councilor =
                userRepository
                        .findById(
                                councilorId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Councilor not found"
                                        )
                        );

        /* =====================================================
           VERIFY ROLE
        ===================================================== */

        if (
                councilor.getRole() !=
                        Role.COUNCILOR
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Councilor access is required"
            );
        }

        /* =====================================================
           ACTIVE ACCOUNT REQUIRED
        ===================================================== */

        if (!councilor.isActive()) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Councilor account is inactive"
            );
        }

        /* =====================================================
           DEPARTMENT REQUIRED
        ===================================================== */

        if (
                councilor.getDepartment() ==
                        null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Councilor is not assigned to a department"
            );
        }

        return councilor
                .getDepartment()
                .getId();
    }

    /* =========================================================
       ROLE CHECK
    ========================================================= */

    private boolean hasRole(

            Authentication authentication,

            String role
    ) {

        return authentication
                .getAuthorities()
                .stream()
                .anyMatch(
                        authority ->
                                role.equals(
                                        authority
                                                .getAuthority()
                                )
                );
    }

    /* =========================================================
       AUTHENTICATION VALIDATION
    ========================================================= */

    private void validateAuthentication(
            Authentication authentication
    ) {

        if (
                authentication == null ||
                        !authentication
                                .isAuthenticated()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }
    }
}