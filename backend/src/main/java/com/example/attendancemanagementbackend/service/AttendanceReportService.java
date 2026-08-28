package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.attendance.AttendanceReportResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceReportSummaryResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceSectionCardResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceSectionDetailResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceSectionDetailSummaryResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceSectionInfoResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceStudentReportResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;

import com.example.attendancemanagementbackend.entity.Section;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSectionCardProjection;
import com.example.attendancemanagementbackend.repository.AttendanceSectionDetailSummaryProjection;
import com.example.attendancemanagementbackend.repository.AttendanceStudentReportProjection;
import com.example.attendancemanagementbackend.repository.AttendanceSummaryProjection;
import com.example.attendancemanagementbackend.repository.SectionRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import java.util.Locale;

@Service
public class AttendanceReportService {

    /* =========================================================
       PAGINATION
    ========================================================= */

    private static final int DEFAULT_SECTION_PAGE_SIZE =
            9;

    private static final int DEFAULT_STUDENT_PAGE_SIZE =
            25;

    private static final int MAX_PAGE_SIZE =
            100;

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final SectionRepository
            sectionRepository;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public AttendanceReportService(

            AttendanceRecordRepository
                    attendanceRecordRepository,

            SectionRepository
                    sectionRepository
    ) {

        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.sectionRepository =
                sectionRepository;
    }

    /* =========================================================
       DEPARTMENT / SECTION CARD REPORT

       COUNCILOR ONLY through Controller.

       IMPORTANT:

       departmentId comes from the authenticated Councilor,
       NOT from the frontend.

       Therefore:

       ICT Councilor
       → ICT attendance only

       TVL Councilor
       → TVL attendance only
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceReportResponse
    getSectionAttendanceReport(

            LocalDate fromDate,

            LocalDate toDate,

            String departmentId,

            String sectionId,

            String adviserId,

            String search,

            int page,

            int size
    ) {

        /* =====================================================
           DEPARTMENT REQUIRED
        ===================================================== */

        if (
                departmentId == null ||
                        departmentId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Department id is required"
            );
        }

        /* =====================================================
           DATE RANGE
        ===================================================== */

        DateRange dateRange =
                resolveDateRange(
                        fromDate,
                        toDate
                );

        /* =====================================================
           PAGE SIZE
        ===================================================== */

        int resolvedSize =
                resolvePageSize(
                        size,
                        DEFAULT_SECTION_PAGE_SIZE
                );

        validatePage(
                page
        );

        /* =====================================================
           FILTER NORMALIZATION
        ===================================================== */

        String normalizedSectionId =
                normalizeFilter(
                        sectionId
                );

        String normalizedAdviserId =
                normalizeFilter(
                        adviserId
                );

        String normalizedSearch =
                normalizeSearch(
                        search
                );

        PageRequest pageable =
                PageRequest.of(
                        page,
                        resolvedSize
                );

        /* =====================================================
           SECTION CARDS

           Department filter is enforced in
           AttendanceRecordRepository.
        ===================================================== */

        Page<AttendanceSectionCardProjection>
                projectionPage =
                attendanceRecordRepository
                        .findSectionAttendanceReport(

                                dateRange.fromDate(),

                                dateRange.toDate(),

                                departmentId,

                                normalizedSectionId,

                                normalizedAdviserId,

                                normalizedSearch,

                                pageable
                        );

        Page<AttendanceSectionCardResponse>
                responsePage =
                projectionPage.map(
                        this::mapSectionCard
                );

        /* =====================================================
           DEPARTMENT SUMMARY

           Uses the same authenticated Councilor Department.
        ===================================================== */

        AttendanceSummaryProjection
                summaryProjection =
                attendanceRecordRepository
                        .findAttendanceSummary(

                                dateRange.fromDate(),

                                dateRange.toDate(),

                                departmentId,

                                normalizedSectionId,

                                normalizedAdviserId,

                                normalizedSearch
                        );

        AttendanceReportSummaryResponse summary =
                mapSummary(
                        summaryProjection
                );

        return new AttendanceReportResponse(

                dateRange.fromDate(),

                dateRange.toDate(),

                summary,

                PagedResponse.from(
                        responsePage
                )
        );
    }

    /* =========================================================
       DETAILED SECTION STUDENT REPORT

       COUNCILOR ONLY through Controller.

       Security:

       Section must belong to the authenticated
       Councilor's Department.

       Knowing another Department's Section UUID
       does not grant access.
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceSectionDetailResponse
    getSectionStudentAttendanceReport(

            String sectionId,

            String departmentId,

            LocalDate fromDate,

            LocalDate toDate,

            String search,

            int page,

            int size
    ) {

        /* =====================================================
           SECTION REQUIRED
        ===================================================== */

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
           DEPARTMENT REQUIRED
        ===================================================== */

        if (
                departmentId == null ||
                        departmentId.isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Department id is required"
            );
        }

        /* =====================================================
           VALIDATE SECTION OWNERSHIP

           BEFORE:

           findById(sectionId)

           → any Department could potentially resolve

           NOW:

           findByIdAndDepartment_Id(...)

           → only authenticated Councilor Department
        ===================================================== */

        Section section =
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

        /* =====================================================
           DATE RANGE
        ===================================================== */

        DateRange dateRange =
                resolveDateRange(
                        fromDate,
                        toDate
                );

        /* =====================================================
           PAGINATION
        ===================================================== */

        validatePage(
                page
        );

        int resolvedSize =
                resolvePageSize(
                        size,
                        DEFAULT_STUDENT_PAGE_SIZE
                );

        PageRequest pageable =
                PageRequest.of(
                        page,
                        resolvedSize
                );

        /* =====================================================
           SEARCH
        ===================================================== */

        String normalizedSearch =
                normalizeSearch(
                        search
                );

        /* =====================================================
           STUDENT REPORT QUERY

           Safe because Section ownership has already been
           validated above.
        ===================================================== */

        Page<AttendanceStudentReportProjection>
                studentProjectionPage =
                attendanceRecordRepository
                        .findStudentAttendanceReport(

                                sectionId,

                                dateRange.fromDate(),

                                dateRange.toDate(),

                                normalizedSearch,

                                pageable
                        );

        Page<AttendanceStudentReportResponse>
                studentResponsePage =
                studentProjectionPage.map(
                        this::mapStudentReport
                );

        /* =====================================================
           SUMMARY
        ===================================================== */

        AttendanceSectionDetailSummaryProjection
                summaryProjection =
                attendanceRecordRepository
                        .findSectionDetailSummary(

                                sectionId,

                                dateRange.fromDate(),

                                dateRange.toDate()
                        );

        AttendanceSectionDetailSummaryResponse
                summary =
                mapSectionDetailSummary(
                        summaryProjection
                );

        /* =====================================================
           SECTION INFORMATION
        ===================================================== */

        String adviserId =
                null;

        String adviserName =
                null;

        if (
                section.getAdviser() !=
                        null
        ) {

            adviserId =
                    section
                            .getAdviser()
                            .getId();

            adviserName =
                    section
                            .getAdviser()
                            .getName();
        }

        AttendanceSectionInfoResponse
                sectionInfo =
                new AttendanceSectionInfoResponse(

                        section.getId(),

                        section.getName(),

                        adviserId,

                        adviserName
                );

        /* =====================================================
           RESPONSE
        ===================================================== */

        return new AttendanceSectionDetailResponse(

                dateRange.fromDate(),

                dateRange.toDate(),

                sectionInfo,

                summary,

                PagedResponse.from(
                        studentResponsePage
                )
        );
    }

    /* =========================================================
       MAP SECTION CARD

       EXISTING CALCULATION RETAINED
    ========================================================= */

    private AttendanceSectionCardResponse mapSectionCard(
            AttendanceSectionCardProjection projection
    ) {

        long sessions =
                safeLong(
                        projection.getSessionCount()
                );

        long students =
                safeLong(
                        projection.getStudentCount()
                );

        long present =
                safeLong(
                        projection.getPresentCount()
                );

        long late =
                safeLong(
                        projection.getLateCount()
                );

        long absent =
                safeLong(
                        projection.getAbsentCount()
                );

        long totalRecords =
                safeLong(
                        projection.getTotalRecords()
                );

        return new AttendanceSectionCardResponse(

                projection.getSectionId(),

                projection.getSectionName(),

                projection.getAdviserId(),

                projection.getAdviserName(),

                sessions,

                students,

                present,

                late,

                absent,

                totalRecords,

                percentage(
                        present,
                        totalRecords
                ),

                percentage(
                        late,
                        totalRecords
                ),

                percentage(
                        present + late,
                        totalRecords
                ),

                percentage(
                        absent,
                        totalRecords
                )
        );
    }

    /* =========================================================
       MAP DEPARTMENT SUMMARY

       Existing calculation retained.
    ========================================================= */

    private AttendanceReportSummaryResponse mapSummary(
            AttendanceSummaryProjection projection
    ) {

        if (
                projection ==
                        null
        ) {

            return emptySummary();
        }

        long sections =
                safeLong(
                        projection.getSectionCount()
                );

        long sessions =
                safeLong(
                        projection.getSessionCount()
                );

        long students =
                safeLong(
                        projection.getStudentCount()
                );

        long present =
                safeLong(
                        projection.getPresentCount()
                );

        long late =
                safeLong(
                        projection.getLateCount()
                );

        long absent =
                safeLong(
                        projection.getAbsentCount()
                );

        long totalRecords =
                safeLong(
                        projection.getTotalRecords()
                );

        return new AttendanceReportSummaryResponse(

                sections,

                sessions,

                students,

                present,

                late,

                absent,

                totalRecords,

                percentage(
                        present,
                        totalRecords
                ),

                percentage(
                        late,
                        totalRecords
                ),

                percentage(
                        present + late,
                        totalRecords
                ),

                percentage(
                        absent,
                        totalRecords
                )
        );
    }

    /* =========================================================
       MAP DETAILED STUDENT REPORT

       Existing calculation retained.
    ========================================================= */

    private AttendanceStudentReportResponse mapStudentReport(
            AttendanceStudentReportProjection projection
    ) {

        long sessions =
                safeLong(
                        projection.getSessionCount()
                );

        long present =
                safeLong(
                        projection.getPresentCount()
                );

        long late =
                safeLong(
                        projection.getLateCount()
                );

        long absent =
                safeLong(
                        projection.getAbsentCount()
                );

        long totalRecords =
                safeLong(
                        projection.getTotalRecords()
                );

        return new AttendanceStudentReportResponse(

                projection.getStudentId(),

                projection.getStudentNumber(),

                projection.getStudentName(),

                sessions,

                present,

                late,

                absent,

                percentage(
                        present,
                        totalRecords
                ),

                percentage(
                        late,
                        totalRecords
                ),

                percentage(
                        present + late,
                        totalRecords
                ),

                percentage(
                        absent,
                        totalRecords
                )
        );
    }

    /* =========================================================
       MAP SECTION DETAIL SUMMARY

       Existing calculation retained.
    ========================================================= */

    private AttendanceSectionDetailSummaryResponse
    mapSectionDetailSummary(
            AttendanceSectionDetailSummaryProjection projection
    ) {

        if (
                projection ==
                        null
        ) {

            return emptySectionDetailSummary();
        }

        long sessions =
                safeLong(
                        projection.getSessionCount()
                );

        long students =
                safeLong(
                        projection.getStudentCount()
                );

        long present =
                safeLong(
                        projection.getPresentCount()
                );

        long late =
                safeLong(
                        projection.getLateCount()
                );

        long absent =
                safeLong(
                        projection.getAbsentCount()
                );

        long totalRecords =
                safeLong(
                        projection.getTotalRecords()
                );

        return new AttendanceSectionDetailSummaryResponse(

                students,

                sessions,

                present,

                late,

                absent,

                totalRecords,

                percentage(
                        present,
                        totalRecords
                ),

                percentage(
                        late,
                        totalRecords
                ),

                percentage(
                        present + late,
                        totalRecords
                ),

                percentage(
                        absent,
                        totalRecords
                )
        );
    }

    /* =========================================================
       EMPTY DEPARTMENT SUMMARY

       Existing structure retained.
    ========================================================= */

    private AttendanceReportSummaryResponse emptySummary() {

        return new AttendanceReportSummaryResponse(
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0.0,
                0.0,
                0.0,
                0.0
        );
    }

    /* =========================================================
       EMPTY SECTION DETAIL SUMMARY

       Existing structure retained.
    ========================================================= */

    private AttendanceSectionDetailSummaryResponse
    emptySectionDetailSummary() {

        return new AttendanceSectionDetailSummaryResponse(
                0,
                0,
                0,
                0,
                0,
                0,
                0.0,
                0.0,
                0.0,
                0.0
        );
    }

    /* =========================================================
       DATE RANGE

       Existing behavior retained.
    ========================================================= */

    private DateRange resolveDateRange(

            LocalDate fromDate,

            LocalDate toDate
    ) {

        LocalDate resolvedFrom =
                fromDate != null
                        ? fromDate
                        : LocalDate.now();

        LocalDate resolvedTo =
                toDate != null
                        ? toDate
                        : resolvedFrom;

        if (
                resolvedFrom.isAfter(
                        resolvedTo
                )
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "From date cannot be after to date"
            );
        }

        return new DateRange(
                resolvedFrom,
                resolvedTo
        );
    }

    /* =========================================================
       PAGINATION

       Existing behavior retained.
    ========================================================= */

    private void validatePage(
            int page
    ) {

        if (
                page < 0
        ) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Page cannot be negative"
            );
        }
    }

    private int resolvePageSize(

            int size,

            int defaultSize
    ) {

        int resolvedSize =
                size <= 0
                        ? defaultSize
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

        return resolvedSize;
    }

    /* =========================================================
       FILTER NORMALIZATION

       Existing behavior retained.
    ========================================================= */

    private String normalizeFilter(
            String value
    ) {

        if (
                value ==
                        null
        ) {

            return "";
        }

        return value.trim();
    }

    private String normalizeSearch(
            String value
    ) {

        if (
                value ==
                        null
        ) {

            return "";
        }

        return value
                .trim()
                .toLowerCase(
                        Locale.ROOT
                );
    }

    /* =========================================================
       SAFE LONG

       Existing behavior retained.
    ========================================================= */

    private long safeLong(
            Long value
    ) {

        return value != null
                ? value
                : 0L;
    }

    /* =========================================================
       PERCENTAGE

       Existing calculations retained exactly.

       PRESENT
       LATE
       PRESENT + LATE attendance
       ABSENT
    ========================================================= */

    private double percentage(

            long value,

            long total
    ) {

        if (
                total <= 0
        ) {

            return 0.0;
        }

        double result =
                (
                        (double) value
                                /
                                total
                )
                        *
                        100.0;

        return Math.round(
                result
                        *
                        100.0
        )
                /
                100.0;
    }

    /* =========================================================
       INTERNAL DATE RANGE
    ========================================================= */

    private record DateRange(

            LocalDate fromDate,

            LocalDate toDate
    ) {
    }
}