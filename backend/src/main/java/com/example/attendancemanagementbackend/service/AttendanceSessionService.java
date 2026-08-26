package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AdviserAttendanceHistoryResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceStatus;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AdviserAttendanceHistoryProjection;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class AttendanceSessionService {

    private final AttendanceSessionRepository
            attendanceSessionRepository;

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final SectionRepository
            sectionRepository;

    private final StudentRepository
            studentRepository;

    public AttendanceSessionService(
            AttendanceSessionRepository attendanceSessionRepository,
            AttendanceRecordRepository attendanceRecordRepository,
            SectionRepository sectionRepository,
            StudentRepository studentRepository
    ) {
        this.attendanceSessionRepository =
                attendanceSessionRepository;

        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.sectionRepository =
                sectionRepository;

        this.studentRepository =
                studentRepository;
    }

    /* =========================================================
       START ATTENDANCE SESSION
       LEGACY / CURRENT FRONTEND COMPATIBILITY
    ========================================================= */

    /**
     * Keeps the existing frontend/controller flow working.
     *
     * Old behavior:
     *
     * - no late cutoff
     * - no scheduled automatic end
     * - manual ending only
     */
    @Transactional
    public AttendanceSession startSession(
            String sectionId,
            String adviserId
    ) {

        return createSession(
                sectionId,
                adviserId,
                null,
                null,
                false
        );
    }

    /* =========================================================
       START ATTENDANCE SESSION
       WITH LATE + AUTO-END POLICY
    ========================================================= */

    /**
     * Starts a configured attendance session.
     *
     * lateAfterMinutes:
     * Required.
     *
     * scheduledEndTime:
     * Optional.
     *
     * null:
     * Manual ending only.
     *
     * non-null:
     * Automatic ending is configured.
     */
    @Transactional
    public AttendanceSession startSession(
            String sectionId,
            Integer lateAfterMinutes,
            LocalTime scheduledEndTime,
            String adviserId
    ) {

        /* =====================================================
           VALIDATE LATE ALLOWANCE
        ===================================================== */

        if (lateAfterMinutes == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Late allowance is required"
            );
        }

        if (lateAfterMinutes < 1) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Late allowance must be at least 1 minute"
            );
        }

        return createSession(
                sectionId,
                adviserId,
                lateAfterMinutes,
                scheduledEndTime,
                true
        );
    }

    /* =========================================================
       CREATE SESSION
    ========================================================= */

    private AttendanceSession createSession(
            String sectionId,
            String adviserId,
            Integer lateAfterMinutes,
            LocalTime scheduledEndTime,
            boolean configurePolicy
    ) {

        Section section =
                sectionRepository
                        .findById(
                                sectionId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Section not found"
                                )
                        );

        /* =====================================================
           VERIFY ADVISER OWNERSHIP
        ===================================================== */

        if (section.getAdviser() == null ||
                !section.getAdviser()
                        .getId()
                        .equals(adviserId)) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this section"
            );
        }

        /* =====================================================
           VERIFY SECTION STATUS
        ===================================================== */

        if (!section.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Section is inactive"
            );
        }

        /* =====================================================
           CHECK EXISTING ACTIVE SESSION
        ===================================================== */

        Optional<AttendanceSession>
                existingActiveSession =
                attendanceSessionRepository
                        .findBySectionIdAndStatus(
                                sectionId,
                                AttendanceSessionStatus.ACTIVE
                        );

        if (existingActiveSession.isPresent()) {

            AttendanceSession activeSession =
                    existingActiveSession.get();

            LocalDateTime now =
                    AppTime.now();

            /*
             * If an old ACTIVE session has already
             * reached its configured automatic end,
             * finalize it before continuing.
             *
             * This also protects the system after
             * a backend restart where the scheduler
             * may not have run yet.
             */
            if (isSessionExpired(
                    activeSession,
                    now
            )) {

                finalizeSession(
                        activeSession,
                        activeSession.getScheduledEndAt()
                );
            }

            /*
             * Otherwise there is genuinely still
             * an active attendance session.
             */
            else {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "This section already has an active attendance session"
                );
            }
        }

        /* =====================================================
           PREVENT MULTIPLE DAILY SESSIONS
        ===================================================== */

        LocalDate attendanceDate =
                AppTime.today();

        if (attendanceSessionRepository
                .existsBySectionIdAndAttendanceDate(
                        sectionId,
                        attendanceDate
                )) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance has already been recorded for this section today"
            );
        }

        /* =====================================================
           CREATE BASE SESSION
        ===================================================== */

        AttendanceSession session =
                new AttendanceSession(
                        section
                );

        /* =====================================================
           CONFIGURE NEW SESSION POLICY
        ===================================================== */

        if (configurePolicy) {

            configureSessionPolicy(
                    session,
                    lateAfterMinutes,
                    scheduledEndTime
            );
        }

        return attendanceSessionRepository
                .save(
                        session
                );
    }

    /* =========================================================
       CONFIGURE SESSION POLICY
    ========================================================= */

    private void configureSessionPolicy(
            AttendanceSession session,
            Integer lateAfterMinutes,
            LocalTime scheduledEndTime
    ) {

        LocalDateTime startedAt =
                session.getStartedAt();

        /* =====================================================
           CALCULATE LATE CUTOFF
        ===================================================== */

        LocalDateTime lateCutoffAt =
                startedAt.plusMinutes(
                        lateAfterMinutes
                );

        session.setLateAfterMinutes(
                lateAfterMinutes
        );

        session.setLateCutoffAt(
                lateCutoffAt
        );

        /* =====================================================
           MANUAL END ONLY
        ===================================================== */

        if (scheduledEndTime == null) {

            session.setScheduledEndAt(
                    null
            );

            return;
        }

        /* =====================================================
           RESOLVE AUTOMATIC END DATETIME
        ===================================================== */

        LocalDateTime scheduledEndAt =
                LocalDateTime.of(
                        session.getAttendanceDate(),
                        scheduledEndTime
                );

        /* =====================================================
           VALIDATE END TIME
        ===================================================== */

        if (!scheduledEndAt.isAfter(
                startedAt
        )) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Scheduled end time must be after the session start time"
            );
        }

        /* =====================================================
           VALIDATE LATE CUTOFF
        ===================================================== */

        if (!lateCutoffAt.isBefore(
                scheduledEndAt
        )) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Late cutoff must be before the scheduled session end"
            );
        }

        session.setScheduledEndAt(
                scheduledEndAt
        );
    }

    /* =========================================================
       MANUALLY END ATTENDANCE SESSION
    ========================================================= */

    @Transactional
    public AttendanceSession endSession(
            String sessionId,
            String adviserId
    ) {

        AttendanceSession session =
                attendanceSessionRepository
                        .findById(
                                sessionId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance session not found"
                                )
                        );

        Section section =
                session.getSection();

        /* =====================================================
           VERIFY ADVISER OWNERSHIP
        ===================================================== */

        if (section == null ||
                section.getAdviser() == null ||
                !section.getAdviser()
                        .getId()
                        .equals(adviserId)) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this section"
            );
        }

        /* =====================================================
           VERIFY SESSION STATUS
        ===================================================== */

        if (session.getStatus() ==
                AttendanceSessionStatus.ENDED) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session has already ended"
            );
        }

        LocalDateTime now =
                AppTime.now();

        /* =====================================================
           AUTO-END ALREADY REACHED
        ===================================================== */

        /*
         * Example:
         *
         * scheduledEndAt = 9:00 AM
         *
         * Adviser presses manual End at 9:02 AM
         * before the scheduler happened to execute.
         *
         * Official endedAt should still be 9:00 AM,
         * not 9:02 AM.
         */
        if (isSessionExpired(
                session,
                now
        )) {

            return finalizeSession(
                    session,
                    session.getScheduledEndAt()
            );
        }

        /* =====================================================
           NORMAL MANUAL END
        ===================================================== */

        return finalizeSession(
                session,
                now
        );
    }

    /* =========================================================
       AUTOMATICALLY FINALIZE EXPIRED SESSIONS
    ========================================================= */

    /**
     * Finds all ACTIVE sessions whose scheduled
     * automatic end time has already been reached
     * and finalizes them.
     *
     * This method will be called by the scheduler.
     *
     * Returns the number of sessions finalized.
     */
    @Transactional
    public int finalizeExpiredSessions() {

        LocalDateTime now =
                AppTime.now();

        List<AttendanceSession> expiredSessions =
                attendanceSessionRepository
                        .findByStatusAndScheduledEndAtIsNotNullAndScheduledEndAtLessThanEqual(
                                AttendanceSessionStatus.ACTIVE,
                                now
                        );

        int finalizedCount =
                0;

        for (AttendanceSession session :
                expiredSessions) {

            /*
             * Defensive checks in case a session
             * changed state after the repository
             * query.
             */
            if (session.getStatus() !=
                    AttendanceSessionStatus.ACTIVE) {

                continue;
            }

            if (!isSessionExpired(
                    session,
                    now
            )) {

                continue;
            }

            /*
             * Use the configured scheduled end
             * as the official end timestamp.
             */
            finalizeSession(
                    session,
                    session.getScheduledEndAt()
            );

            finalizedCount++;
        }

        return finalizedCount;
    }

    /* =========================================================
       CHECK WHETHER SESSION IS EXPIRED
    ========================================================= */

    private boolean isSessionExpired(
            AttendanceSession session,
            LocalDateTime currentTime
    ) {

        if (session == null) {
            return false;
        }

        if (session.getStatus() !=
                AttendanceSessionStatus.ACTIVE) {

            return false;
        }

        LocalDateTime scheduledEndAt =
                session.getScheduledEndAt();

        /*
         * null means manual ending only.
         */
        if (scheduledEndAt == null) {
            return false;
        }

        /*
         * currentTime >= scheduledEndAt
         */
        return !currentTime.isBefore(
                scheduledEndAt
        );
    }

    /* =========================================================
       FINALIZE SESSION
       SHARED BY MANUAL + AUTOMATIC END
    ========================================================= */

    private AttendanceSession finalizeSession(
            AttendanceSession session,
            LocalDateTime endedAt
    ) {

        /*
         * Defensive idempotency protection.
         *
         * If the session was already finalized,
         * don't create duplicate ABSENT records.
         */
        if (session.getStatus() ==
                AttendanceSessionStatus.ENDED) {

            return session;
        }

        /* =====================================================
           FINALIZE ABSENT STUDENTS
        ===================================================== */

        finalizeAbsentStudents(
                session,
                endedAt
        );

        /* =====================================================
           END SESSION
        ===================================================== */

        session.setStatus(
                AttendanceSessionStatus.ENDED
        );

        session.setEndedAt(
                endedAt
        );

        return attendanceSessionRepository
                .save(
                        session
                );
    }

    /* =========================================================
       FINALIZE ABSENT STUDENTS
    ========================================================= */

    private void finalizeAbsentStudents(
            AttendanceSession session,
            LocalDateTime finalizationTime
    ) {

        String sectionId =
                session.getSection()
                        .getId();

        String sessionId =
                session.getId();

        List<Student> students =
                studentRepository
                        .findBySectionId(
                                sectionId
                        );

        List<AttendanceRecord> absentRecords =
                new ArrayList<>();

        for (Student student : students) {

            /*
             * Ignore inactive students.
             */
            if (!student.isActive()) {
                continue;
            }

            boolean alreadyRecorded =
                    attendanceRecordRepository
                            .existsBySessionIdAndStudentId(
                                    sessionId,
                                    student.getId()
                            );

            /*
             * PRESENT or LATE already exists.
             */
            if (alreadyRecorded) {
                continue;
            }

            AttendanceRecord absentRecord =
                    new AttendanceRecord(
                            session,
                            student,
                            AttendanceStatus.ABSENT,
                            finalizationTime
                    );

            absentRecords.add(
                    absentRecord
            );
        }

        if (!absentRecords.isEmpty()) {

            attendanceRecordRepository
                    .saveAll(
                            absentRecords
                    );
        }
    }

    /* =========================================================
       GET ACTIVE SESSION
    ========================================================= */

    @Transactional(readOnly = true)
    public AttendanceSession getActiveSession(
            String sectionId
    ) {

        AttendanceSession session =
                attendanceSessionRepository
                        .findBySectionIdAndStatus(
                                sectionId,
                                AttendanceSessionStatus.ACTIVE
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "No active attendance session found"
                                )
                        );

        /*
         * The database may still say ACTIVE for a few
         * seconds while waiting for the scheduler.
         *
         * Do not expose an already-expired session
         * as usable to the frontend.
         */
        if (isSessionExpired(
                session,
                AppTime.now()
        )) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "No active attendance session found"
            );
        }

        return session;
    }

    /* =========================================================
       GET ADVISER ATTENDANCE HISTORY
    ========================================================= */

    @Transactional(readOnly = true)
    public PagedResponse<AdviserAttendanceHistoryResponse>
    getAttendanceHistory(
            String adviserId,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int size
    ) {

        /* =====================================================
           RESOLVE DATE RANGE

           Default:
           Current month until today.
        ===================================================== */

        LocalDate today =
                AppTime.today();

        LocalDate resolvedFromDate =
                fromDate != null
                        ? fromDate
                        : today.withDayOfMonth(
                        1
                );

        LocalDate resolvedToDate =
                toDate != null
                        ? toDate
                        : today;

        /* =====================================================
           VALIDATE DATE RANGE
        ===================================================== */

        if (resolvedFromDate.isAfter(
                resolvedToDate
        )) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "From date cannot be after to date"
            );
        }

        /* =====================================================
           VALIDATE PAGINATION
        ===================================================== */

        if (page < 0) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Page cannot be negative"
            );
        }

        int resolvedSize =
                size <= 0
                        ? 10
                        : Math.min(
                        size,
                        50
                );

        PageRequest pageable =
                PageRequest.of(
                        page,
                        resolvedSize
                );

        /* =====================================================
           QUERY HISTORY
        ===================================================== */

        Page<AdviserAttendanceHistoryProjection>
                historyPage =
                attendanceRecordRepository
                        .findAdviserAttendanceHistory(
                                adviserId,
                                resolvedFromDate,
                                resolvedToDate,
                                pageable
                        );

        /* =====================================================
           MAP RESPONSE
        ===================================================== */

        Page<AdviserAttendanceHistoryResponse>
                responsePage =
                historyPage.map(
                        this::mapAttendanceHistory
                );

        return PagedResponse.from(
                responsePage
        );
    }

    /* =========================================================
       MAP ADVISER ATTENDANCE HISTORY
    ========================================================= */

    private AdviserAttendanceHistoryResponse
    mapAttendanceHistory(
            AdviserAttendanceHistoryProjection projection
    ) {

        long studentCount =
                safeLong(
                        projection.getStudentCount()
                );

        long presentCount =
                safeLong(
                        projection.getPresentCount()
                );

        long lateCount =
                safeLong(
                        projection.getLateCount()
                );

        long absentCount =
                safeLong(
                        projection.getAbsentCount()
                );

        /*
         * PRESENT + LATE are considered attended.
         */
        long attendedCount =
                presentCount +
                        lateCount;

        double attendanceRate =
                studentCount == 0
                        ? 0.0
                        : ((double) attendedCount /
                        studentCount) * 100.0;

        attendanceRate =
                Math.round(
                        attendanceRate * 100.0
                ) / 100.0;

        return new AdviserAttendanceHistoryResponse(
                projection.getSessionId(),
                projection.getSectionId(),
                projection.getSectionName(),
                projection.getAttendanceDate(),
                projection.getStartedAt(),
                projection.getEndedAt(),
                AttendanceSessionStatus.ENDED.name(),
                studentCount,
                presentCount,
                lateCount,
                absentCount,
                attendanceRate
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
}