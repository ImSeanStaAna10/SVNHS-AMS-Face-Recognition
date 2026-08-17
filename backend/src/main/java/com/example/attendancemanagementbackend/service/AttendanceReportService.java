package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.attendance.AttendanceReportResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceReportSummaryResponse;
import com.example.attendancemanagementbackend.dto.attendance.AttendanceSectionCardResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSectionCardProjection;
import com.example.attendancemanagementbackend.repository.AttendanceSummaryProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Locale;

@Service
public class AttendanceReportService {

    private static final int DEFAULT_PAGE_SIZE = 9;
    private static final int MAX_PAGE_SIZE = 50;

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    public AttendanceReportService(
            AttendanceRecordRepository attendanceRecordRepository
    ) {
        this.attendanceRecordRepository =
                attendanceRecordRepository;
    }

    /* =========================================================
       SECTION ATTENDANCE REPORT
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceReportResponse getSectionAttendanceReport(
            LocalDate fromDate,
            LocalDate toDate,
            String sectionId,
            String adviserId,
            String search,
            int page,
            int size
    ) {

        /* =====================================================
           DATE RANGE
        ===================================================== */

        LocalDate resolvedFrom =
                fromDate != null
                        ? fromDate
                        : LocalDate.now();

        LocalDate resolvedTo =
                toDate != null
                        ? toDate
                        : resolvedFrom;

        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "From date cannot be after to date"
            );
        }

        /* =====================================================
           PAGINATION
        ===================================================== */

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

        if (resolvedSize > MAX_PAGE_SIZE) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Page size cannot exceed "
                            + MAX_PAGE_SIZE
            );
        }

        /* =====================================================
           FILTER NORMALIZATION

           IMPORTANT:
           Native repository query expects "" instead of null.
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
        ===================================================== */

        Page<AttendanceSectionCardProjection>
                projectionPage =
                attendanceRecordRepository
                        .findSectionAttendanceReport(
                                resolvedFrom,
                                resolvedTo,
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
           SCHOOL SUMMARY
        ===================================================== */

        AttendanceSummaryProjection
                summaryProjection =
                attendanceRecordRepository
                        .findAttendanceSummary(
                                resolvedFrom,
                                resolvedTo,
                                normalizedSectionId,
                                normalizedAdviserId,
                                normalizedSearch
                        );

        AttendanceReportSummaryResponse summary =
                mapSummary(
                        summaryProjection
                );

        /* =====================================================
           RESPONSE
        ===================================================== */

        return new AttendanceReportResponse(
                resolvedFrom,
                resolvedTo,
                summary,
                PagedResponse.from(
                        responsePage
                )
        );
    }

    /* =========================================================
       SECTION CARD MAPPER
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

        double presentRate =
                percentage(
                        present,
                        totalRecords
                );

        double lateRate =
                percentage(
                        late,
                        totalRecords
                );

        double attendanceRate =
                percentage(
                        present + late,
                        totalRecords
                );

        double absenceRate =
                percentage(
                        absent,
                        totalRecords
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
                presentRate,
                lateRate,
                attendanceRate,
                absenceRate
        );
    }

    /* =========================================================
       SUMMARY MAPPER
    ========================================================= */

    private AttendanceReportSummaryResponse mapSummary(
            AttendanceSummaryProjection projection
    ) {

        if (projection == null) {
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
       EMPTY SUMMARY
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
       SAFE LONG
    ========================================================= */

    private long safeLong(
            Long value
    ) {

        return value != null
                ? value
                : 0L;
    }

    /* =========================================================
       NORMALIZE ID FILTER

       null    -> ""
       "   "   -> ""
       "abc"   -> "abc"
    ========================================================= */

    private String normalizeFilter(
            String value
    ) {

        if (value == null) {
            return "";
        }

        return value.trim();
    }

    /* =========================================================
       NORMALIZE SEARCH

       null    -> ""
       "   "   -> ""
       "STEM"  -> "stem"
    ========================================================= */

    private String normalizeSearch(
            String value
    ) {

        if (value == null) {
            return "";
        }

        return value
                .trim()
                .toLowerCase(
                        Locale.ROOT
                );
    }

    /* =========================================================
       PERCENTAGE
    ========================================================= */

    private double percentage(
            long value,
            long total
    ) {

        if (total <= 0) {
            return 0.0;
        }

        double result =
                ((double) value / total)
                        * 100.0;

        return Math.round(
                result * 100.0
        ) / 100.0;
    }
}