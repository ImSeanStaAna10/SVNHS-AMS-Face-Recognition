package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceReportArchive;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceReportArchiveRepository
        extends JpaRepository<AttendanceReportArchive, UUID>,
        JpaSpecificationExecutor<AttendanceReportArchive> {

    /* =========================================================
       EXACT REPORT
    ========================================================= */

    Optional<AttendanceReportArchive>
    findBySectionIdAndReportTypeAndPeriodStartAndPeriodEnd(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    );

    /* =========================================================
       DUPLICATE CHECK
    ========================================================= */

    boolean
    existsBySectionIdAndReportTypeAndPeriodStartAndPeriodEnd(

            String sectionId,

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    );

    /* =========================================================
       ARCHIVE SEARCH — PAGINATED

       COUNCILOR:
       - Sections from own Department only

       ADVISER:
       - Sections currently assigned to Adviser
    ========================================================= */

    @Query(
            value = """
                    SELECT archive
                    FROM AttendanceReportArchive archive
                    WHERE
                    (
                        (
                            :isCouncilor = true
                            AND archive.sectionId IN (
                                SELECT section.id
                                FROM Section section
                                WHERE section.department.id = :departmentId
                            )
                        )
                        OR
                        (
                            :isCouncilor = false
                            AND archive.sectionId IN (
                                SELECT section.id
                                FROM Section section
                                WHERE section.adviser.id = :userId
                            )
                        )
                    )
                    AND (
                        :reportType IS NULL
                        OR archive.reportType = :reportType
                    )
                    AND (
                        :sectionId IS NULL
                        OR archive.sectionId = :sectionId
                    )
                    AND (
                        :fromDate IS NULL
                        OR archive.periodEnd >= :fromDate
                    )
                    AND (
                        :toDate IS NULL
                        OR archive.periodStart <= :toDate
                    )
                    ORDER BY
                        archive.periodStart DESC,
                        archive.generatedAt DESC
                    """,

            countQuery = """
                    SELECT COUNT(archive)
                    FROM AttendanceReportArchive archive
                    WHERE
                    (
                        (
                            :isCouncilor = true
                            AND archive.sectionId IN (
                                SELECT section.id
                                FROM Section section
                                WHERE section.department.id = :departmentId
                            )
                        )
                        OR
                        (
                            :isCouncilor = false
                            AND archive.sectionId IN (
                                SELECT section.id
                                FROM Section section
                                WHERE section.adviser.id = :userId
                            )
                        )
                    )
                    AND (
                        :reportType IS NULL
                        OR archive.reportType = :reportType
                    )
                    AND (
                        :sectionId IS NULL
                        OR archive.sectionId = :sectionId
                    )
                    AND (
                        :fromDate IS NULL
                        OR archive.periodEnd >= :fromDate
                    )
                    AND (
                        :toDate IS NULL
                        OR archive.periodStart <= :toDate
                    )
                    """
    )
    Page<AttendanceReportArchive> searchAccessibleReports(

            @Param("isCouncilor")
            boolean isCouncilor,

            @Param("userId")
            String userId,

            @Param("departmentId")
            String departmentId,

            @Param("reportType")
            AttendanceReportType reportType,

            @Param("sectionId")
            String sectionId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate,

            Pageable pageable
    );

    /* =========================================================
       ARCHIVE SEARCH — DOWNLOAD ALL
    ========================================================= */

    @Query("""
            SELECT archive
            FROM AttendanceReportArchive archive
            WHERE
            (
                (
                    :isCouncilor = true
                    AND archive.sectionId IN (
                        SELECT section.id
                        FROM Section section
                        WHERE section.department.id = :departmentId
                    )
                )
                OR
                (
                    :isCouncilor = false
                    AND archive.sectionId IN (
                        SELECT section.id
                        FROM Section section
                        WHERE section.adviser.id = :userId
                    )
                )
            )
            AND (
                :reportType IS NULL
                OR archive.reportType = :reportType
            )
            AND (
                :sectionId IS NULL
                OR archive.sectionId = :sectionId
            )
            AND (
                :fromDate IS NULL
                OR archive.periodEnd >= :fromDate
            )
            AND (
                :toDate IS NULL
                OR archive.periodStart <= :toDate
            )
            ORDER BY
                archive.periodStart DESC,
                archive.sectionName ASC
            """)
    List<AttendanceReportArchive> findAccessibleReportsForDownload(

            @Param("isCouncilor")
            boolean isCouncilor,

            @Param("userId")
            String userId,

            @Param("departmentId")
            String departmentId,

            @Param("reportType")
            AttendanceReportType reportType,

            @Param("sectionId")
            String sectionId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate
    );

    /* =========================================================
       EXISTING HISTORY METHODS
    ========================================================= */

    List<AttendanceReportArchive>
    findByReportTypeAndPeriodStartAndPeriodEndOrderBySectionNameAsc(

            AttendanceReportType reportType,

            LocalDate periodStart,

            LocalDate periodEnd
    );

    List<AttendanceReportArchive>
    findBySectionIdOrderByPeriodStartDesc(
            String sectionId
    );

    List<AttendanceReportArchive>
    findBySectionIdAndReportTypeOrderByPeriodStartDesc(

            String sectionId,

            AttendanceReportType reportType
    );

    List<AttendanceReportArchive>
    findByReportTypeOrderByPeriodStartDesc(
            AttendanceReportType reportType
    );
}