package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceRecord;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

import java.util.List;
import java.util.Optional;

public interface AttendanceRecordRepository
        extends JpaRepository<AttendanceRecord, String> {

    /* =========================================================
       BASIC ATTENDANCE OPERATIONS
    ========================================================= */

    Optional<AttendanceRecord> findBySessionIdAndStudentId(
            String sessionId,
            String studentId
    );

    List<AttendanceRecord> findBySessionId(
            String sessionId
    );

    boolean existsBySessionIdAndStudentId(
            String sessionId,
            String studentId
    );

    long countBySessionId(
            String sessionId
    );

    /* =========================================================
       COUNCILOR DEPARTMENT ATTENDANCE REPORT

       Returns one aggregated row per Section.

       Security:
       - Results are restricted to the authenticated
         Councilor's Department.
       - departmentId comes from the backend authentication
         flow, never from a client-controlled filter.

       Supports:
       - Date range
       - Section filter
       - Adviser filter
       - Search
       - Server-side pagination

       Only ENDED attendance sessions are included.
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        s.id AS "sectionId",

                        s.name AS "sectionName",

                        u.id AS "adviserId",

                        u.name AS "adviserName",

                        COUNT(
                            DISTINCT ats.id
                        ) AS "sessionCount",

                        COUNT(
                            DISTINCT st.id
                        ) AS "studentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount",

                        COUNT(
                            ar.id
                        ) AS "totalRecords"

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.sections s
                        ON s.id = ats.section_id

                    LEFT JOIN public.users u
                        ON u.id = s.adviser_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND s.department_id = :departmentId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                        AND (
                            :sectionId = ''
                            OR s.id = :sectionId
                        )

                        AND (
                            :adviserId = ''
                            OR u.id = :adviserId
                        )

                        AND (
                            :search = ''

                            OR LOWER(s.name)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )

                            OR LOWER(
                                COALESCE(
                                    u.name,
                                    ''
                                )
                            )
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )
                        )

                    GROUP BY
                        s.id,
                        s.name,
                        u.id,
                        u.name

                    ORDER BY
                        s.name ASC
                    """,

            countQuery = """
                    SELECT
                        COUNT(
                            DISTINCT s.id
                        )

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.sections s
                        ON s.id = ats.section_id

                    LEFT JOIN public.users u
                        ON u.id = s.adviser_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND s.department_id = :departmentId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                        AND (
                            :sectionId = ''
                            OR s.id = :sectionId
                        )

                        AND (
                            :adviserId = ''
                            OR u.id = :adviserId
                        )

                        AND (
                            :search = ''

                            OR LOWER(s.name)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )

                            OR LOWER(
                                COALESCE(
                                    u.name,
                                    ''
                                )
                            )
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )
                        )
                    """,

            nativeQuery = true
    )
    Page<AttendanceSectionCardProjection>
    findSectionAttendanceReport(

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate,

            @Param("departmentId")
            String departmentId,

            @Param("sectionId")
            String sectionId,

            @Param("adviserId")
            String adviserId,

            @Param("search")
            String search,

            Pageable pageable
    );

    /* =========================================================
       DEPARTMENT ATTENDANCE SUMMARY

       Used by the Councilor Attendance dashboard.

       Security:
       - Aggregates completed attendance records only from
         Sections belonging to the authenticated Councilor's
         Department.
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        COUNT(
                            DISTINCT s.id
                        ) AS "sectionCount",

                        COUNT(
                            DISTINCT ats.id
                        ) AS "sessionCount",

                        COUNT(
                            DISTINCT st.id
                        ) AS "studentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount",

                        COUNT(
                            ar.id
                        ) AS "totalRecords"

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.sections s
                        ON s.id = ats.section_id

                    LEFT JOIN public.users u
                        ON u.id = s.adviser_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND s.department_id = :departmentId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                        AND (
                            :sectionId = ''
                            OR s.id = :sectionId
                        )

                        AND (
                            :adviserId = ''
                            OR u.id = :adviserId
                        )

                        AND (
                            :search = ''

                            OR LOWER(s.name)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )

                            OR LOWER(
                                COALESCE(
                                    u.name,
                                    ''
                                )
                            )
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )
                        )
                    """,

            nativeQuery = true
    )
    AttendanceSummaryProjection
    findAttendanceSummary(

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate,

            @Param("departmentId")
            String departmentId,

            @Param("sectionId")
            String sectionId,

            @Param("adviserId")
            String adviserId,

            @Param("search")
            String search
    );

    /* =========================================================
       DETAILED STUDENT ATTENDANCE REPORT

       EXISTING BEHAVIOR RETAINED.

       Security is enforced before reaching this query by
       validating that the requested Section belongs to the
       authenticated Councilor's Department.

       Supports:
       - Section
       - Date range
       - Student name / number search
       - Server-side pagination
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        st.id AS "studentId",

                        st.student_number AS "studentNumber",

                        st.name AS "studentName",

                        COUNT(
                            DISTINCT ats.id
                        ) AS "sessionCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount",

                        COUNT(
                            ar.id
                        ) AS "totalRecords"

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND ats.section_id = :sectionId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                        AND (
                            :search = ''

                            OR LOWER(st.name)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )

                            OR LOWER(st.student_number)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )
                        )

                    GROUP BY
                        st.id,
                        st.student_number,
                        st.name

                    ORDER BY
                        LOWER(st.name) ASC,
                        st.student_number ASC
                    """,

            countQuery = """
                    SELECT
                        COUNT(
                            DISTINCT st.id
                        )

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND ats.section_id = :sectionId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                        AND (
                            :search = ''

                            OR LOWER(st.name)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )

                            OR LOWER(st.student_number)
                                LIKE CONCAT(
                                    '%',
                                    :search,
                                    '%'
                                )
                        )
                    """,

            nativeQuery = true
    )
    Page<AttendanceStudentReportProjection>
    findStudentAttendanceReport(

            @Param("sectionId")
            String sectionId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate,

            @Param("search")
            String search,

            Pageable pageable
    );

    /* =========================================================
       SECTION DETAIL SUMMARY

       Existing behavior retained.

       This projection is also reusable by the automated
       Weekly / Monthly report aggregation service.
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        COUNT(
                            DISTINCT ats.id
                        ) AS "sessionCount",

                        COUNT(
                            DISTINCT st.id
                        ) AS "studentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount",

                        COUNT(
                            ar.id
                        ) AS "totalRecords"

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND ats.section_id = :sectionId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate
                    """,

            nativeQuery = true
    )
    AttendanceSectionDetailSummaryProjection
    findSectionDetailSummary(

            @Param("sectionId")
            String sectionId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate
    );

    /* =========================================================
       AUTOMATED REPORT ARCHIVE
       COMPLETE STUDENT PERIOD SUMMARY

       EXISTING BEHAVIOR RETAINED.

       Unlike findStudentAttendanceReport(), this query has
       no pagination and no search filter.

       Weekly / Monthly PDF and Excel files contain the
       COMPLETE official Section record.

       Used by:
       - Weekly report generator
       - Monthly report generator
       - Automatic report archive
       - Server-side PDF generation
       - Server-side Excel generation

       Only ENDED sessions are included.
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        st.id AS "studentId",

                        st.student_number AS "studentNumber",

                        st.name AS "studentName",

                        COUNT(
                            DISTINCT ats.id
                        ) AS "sessionCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(*) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount",

                        COUNT(
                            ar.id
                        ) AS "totalRecords"

                    FROM public.attendance_records ar

                    INNER JOIN public.attendance_sessions ats
                        ON ats.id = ar.session_id

                    INNER JOIN public.students st
                        ON st.id = ar.student_id

                    WHERE
                        ats.status = 'ENDED'

                        AND ats.section_id = :sectionId

                        AND ats.attendance_date
                            BETWEEN :fromDate AND :toDate

                    GROUP BY
                        st.id,
                        st.student_number,
                        st.name

                    ORDER BY
                        LOWER(st.name) ASC,
                        st.student_number ASC
                    """,

            nativeQuery = true
    )
    List<AttendanceStudentReportProjection>
    findStudentPeriodSummary(

            @Param("sectionId")
            String sectionId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate
    );

    /* =========================================================
       ADVISER ATTENDANCE HISTORY

       EXISTING BEHAVIOR RETAINED.

       Returns one historical row per ENDED attendance session.

       Security:
       - Adviser ID comes from authenticated user
       - Adviser only sees sessions belonging to their
         assigned Section

       Supports:
       - Date range
       - Pagination
       - Newest sessions first
    ========================================================= */

    @Query(
            value = """
                    SELECT
                        ats.id AS "sessionId",

                        s.id AS "sectionId",

                        s.name AS "sectionName",

                        ats.attendance_date
                            AS "attendanceDate",

                        ats.started_at
                            AS "startedAt",

                        ats.ended_at
                            AS "endedAt",

                        COUNT(
                            ar.id
                        ) AS "studentCount",

                        COUNT(
                            ar.id
                        ) FILTER (
                            WHERE ar.status = 'PRESENT'
                        ) AS "presentCount",

                        COUNT(
                            ar.id
                        ) FILTER (
                            WHERE ar.status = 'LATE'
                        ) AS "lateCount",

                        COUNT(
                            ar.id
                        ) FILTER (
                            WHERE ar.status = 'ABSENT'
                        ) AS "absentCount"

                    FROM public.attendance_sessions ats

                    INNER JOIN public.sections s
                        ON s.id = ats.section_id

                    LEFT JOIN public.users u
                        ON u.id = s.adviser_id

                    LEFT JOIN public.attendance_records ar
                        ON ar.session_id = ats.id

                    WHERE
                        ats.status = 'ENDED'

                        AND u.id = :adviserId

                        AND ats.attendance_date
                            BETWEEN :fromDate
                            AND :toDate

                    GROUP BY
                        ats.id,
                        s.id,
                        s.name,
                        ats.attendance_date,
                        ats.started_at,
                        ats.ended_at

                    ORDER BY
                        ats.attendance_date DESC,
                        ats.ended_at DESC
                    """,

            countQuery = """
                    SELECT
                        COUNT(*)

                    FROM public.attendance_sessions ats

                    INNER JOIN public.sections s
                        ON s.id = ats.section_id

                    LEFT JOIN public.users u
                        ON u.id = s.adviser_id

                    WHERE
                        ats.status = 'ENDED'

                        AND u.id = :adviserId

                        AND ats.attendance_date
                            BETWEEN :fromDate
                            AND :toDate
                    """,

            nativeQuery = true
    )
    Page<AdviserAttendanceHistoryProjection>
    findAdviserAttendanceHistory(

            @Param("adviserId")
            String adviserId,

            @Param("fromDate")
            LocalDate fromDate,

            @Param("toDate")
            LocalDate toDate,

            Pageable pageable
    );
}