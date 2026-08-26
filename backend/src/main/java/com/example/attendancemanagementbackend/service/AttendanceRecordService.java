package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceOverviewResponse;
import com.example.attendancemanagementbackend.dto.AttendanceRecordResponse;
import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceStatus;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AttendanceRecordService {

    private static final double FACE_MATCH_THRESHOLD =
            0.50;

    private final AttendanceRecordRepository
            attendanceRecordRepository;

    private final AttendanceSessionRepository
            attendanceSessionRepository;

    private final StudentRepository
            studentRepository;

    private final SectionRepository
            sectionRepository;

    private final StudentFaceService
            studentFaceService;

    private final FaceRecognitionClient
            faceRecognitionClient;

    public AttendanceRecordService(
            AttendanceRecordRepository attendanceRecordRepository,
            AttendanceSessionRepository attendanceSessionRepository,
            StudentRepository studentRepository,
            SectionRepository sectionRepository,
            StudentFaceService studentFaceService,
            FaceRecognitionClient faceRecognitionClient
    ) {
        this.attendanceRecordRepository =
                attendanceRecordRepository;

        this.attendanceSessionRepository =
                attendanceSessionRepository;

        this.studentRepository =
                studentRepository;

        this.sectionRepository =
                sectionRepository;

        this.studentFaceService =
                studentFaceService;

        this.faceRecognitionClient =
                faceRecognitionClient;
    }

    /* =========================================================
       MANUAL ATTENDANCE
    ========================================================= */

    /**
     * Records attendance manually.
     *
     * The backend automatically determines
     * whether the student is:
     *
     * PRESENT
     * or
     * LATE
     *
     * based on the session's late cutoff.
     */
    @Transactional
    public AttendanceRecord markPresent(
            String sessionId,
            String studentId
    ) {

        AttendanceSession session =
                getActiveSession(
                        sessionId
                );

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        return createAttendanceRecord(
                session,
                student
        );
    }

    /* =========================================================
       FACE RECOGNITION ATTENDANCE
    ========================================================= */

    /**
     * Recognizes a student's face and records
     * attendance.
     *
     * The backend automatically determines
     * PRESENT or LATE.
     */
    @Transactional
    public AttendanceRecord markPresentByFace(
            String sessionId,
            MultipartFile image
    ) throws IOException {

        AttendanceSession session =
                getActiveSession(
                        sessionId
                );

        /* =====================================================
           VALIDATE IMAGE
        ===================================================== */

        if (image == null ||
                image.isEmpty()) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        /* =====================================================
           FACE RECOGNITION
        ===================================================== */

        FaceRecognitionClient.FaceRecognitionResult result =
                faceRecognitionClient
                        .recognizeFace(
                                image.getBytes(),
                                image.getOriginalFilename()
                        );

        if (result == null ||
                !result.success() ||
                result.embedding() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face recognition failed"
            );
        }

        /* =====================================================
           FIND CLOSEST REGISTERED FACE
        ===================================================== */

        FaceMatchResult match =
                studentFaceService
                        .findMostSimilarFace(
                                result.embedding()
                        );

        if (match == null) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        if (match.distance() >
                FACE_MATCH_THRESHOLD) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        /* =====================================================
           LOAD MATCHED STUDENT
        ===================================================== */

        Student student =
                studentRepository
                        .findById(
                                match.studentId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        return createAttendanceRecord(
                session,
                student
        );
    }

    /* =========================================================
       GET ACTIVE SESSION
    ========================================================= */

    /**
     * Loads and validates the requested
     * attendance session.
     *
     * A session must:
     *
     * 1. Exist
     * 2. Have ACTIVE database status
     * 3. Not have reached its scheduled end time
     */
    private AttendanceSession getActiveSession(
            String sessionId
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

        /* =====================================================
           VERIFY DATABASE STATUS
        ===================================================== */

        if (session.getStatus() !=
                AttendanceSessionStatus.ACTIVE) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session is not active"
            );
        }

        /* =====================================================
           VERIFY SCHEDULED END

           This protects the session even if the
           automatic scheduler has not yet updated
           the database status.

           Example:

           scheduledEndAt = 09:00:00
           request time   = 09:00:02

           Attendance is rejected.
        ===================================================== */

        LocalDateTime currentTime =
                AppTime.now();

        validateSessionNotExpired(
                session,
                currentTime
        );

        return session;
    }

    /* =========================================================
       VALIDATE SESSION TIME
    ========================================================= */

    /**
     * Prevents attendance from being recorded
     * once the configured automatic end time
     * has been reached.
     *
     * Exact boundary:
     *
     * attendanceTime < scheduledEndAt
     *     allowed
     *
     * attendanceTime >= scheduledEndAt
     *     rejected
     */
    private void validateSessionNotExpired(
            AttendanceSession session,
            LocalDateTime attendanceTime
    ) {

        LocalDateTime scheduledEndAt =
                session.getScheduledEndAt();

        /*
         * null means this session uses
         * manual ending only.
         */
        if (scheduledEndAt == null) {
            return;
        }

        if (!attendanceTime.isBefore(
                scheduledEndAt
        )) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session has reached its scheduled end time"
            );
        }
    }

    /* =========================================================
       CREATE ATTENDANCE RECORD
    ========================================================= */

    /**
     * Creates an attendance record after validating:
     *
     * 1. Student belongs to the session section.
     * 2. Student is active.
     * 3. Student has not already been recorded.
     * 4. Session has not reached scheduled end.
     *
     * The status is automatically determined:
     *
     * PRESENT
     * or
     * LATE.
     */
    private AttendanceRecord createAttendanceRecord(
            AttendanceSession session,
            Student student
    ) {

        /* =====================================================
           VERIFY STUDENT SECTION
        ===================================================== */

        if (student.getSection() == null ||
                session.getSection() == null ||
                !student.getSection()
                        .getId()
                        .equals(
                                session.getSection()
                                        .getId()
                        )) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Student does not belong to this section"
            );
        }

        /* =====================================================
           VERIFY STUDENT STATUS
        ===================================================== */

        if (!student.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive"
            );
        }

        /* =====================================================
           PREVENT DUPLICATE ATTENDANCE
        ===================================================== */

        if (attendanceRecordRepository
                .existsBySessionIdAndStudentId(
                        session.getId(),
                        student.getId()
                )) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student already has an attendance record for this session"
            );
        }

        /* =====================================================
           CAPTURE ATTENDANCE TIME ONCE

           This timestamp will be used for BOTH:

           - checking session expiration
           - determining PRESENT/LATE
           - saved recordedAt value

           This prevents boundary inconsistencies.
        ===================================================== */

        LocalDateTime attendanceTime =
                AppTime.now();

        /* =====================================================
           RE-CHECK SCHEDULED END

           We already checked when loading the session,
           but we check again here because time may have
           crossed the scheduled boundary while processing
           the request.
        ===================================================== */

        validateSessionNotExpired(
                session,
                attendanceTime
        );

        /* =====================================================
           DETERMINE ATTENDANCE STATUS
        ===================================================== */

        AttendanceStatus attendanceStatus =
                determineAttendanceStatus(
                        session,
                        attendanceTime
                );

        /* =====================================================
           CREATE ATTENDANCE RECORD
        ===================================================== */

        AttendanceRecord record =
                new AttendanceRecord(
                        session,
                        student,
                        attendanceStatus,
                        attendanceTime
                );

        return attendanceRecordRepository
                .save(
                        record
                );
    }

    /* =========================================================
       DETERMINE ATTENDANCE STATUS
    ========================================================= */

    /**
     * Determines PRESENT or LATE.
     *
     * Example:
     *
     * Session started:
     * 07:30
     *
     * Late cutoff:
     * 07:45
     *
     *
     * 07:44:59 -> PRESENT
     *
     * 07:45:00 -> LATE
     *
     * 07:45:01 -> LATE
     *
     *
     * Legacy sessions that do not have
     * lateCutoffAt remain PRESENT.
     */
    private AttendanceStatus determineAttendanceStatus(
            AttendanceSession session,
            LocalDateTime attendanceTime
    ) {

        LocalDateTime lateCutoffAt =
                session.getLateCutoffAt();

        /* =====================================================
           LEGACY SESSION SUPPORT

           Older sessions may not have a late cutoff.
           Preserve their original behavior.
        ===================================================== */

        if (lateCutoffAt == null) {

            return AttendanceStatus.PRESENT;
        }

        /* =====================================================
           BEFORE CUTOFF
        ===================================================== */

        if (attendanceTime.isBefore(
                lateCutoffAt
        )) {

            return AttendanceStatus.PRESENT;
        }

        /* =====================================================
           AT OR AFTER CUTOFF
        ===================================================== */

        return AttendanceStatus.LATE;
    }

    /* =========================================================
       GET SESSION ATTENDANCE
    ========================================================= */

    /**
     * Returns all attendance records
     * for a specific session.
     *
     * Status may now be:
     *
     * PRESENT
     * LATE
     * ABSENT
     */
    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> getSessionRecords(
            String sessionId
    ) {

        if (!attendanceSessionRepository
                .existsById(
                        sessionId
                )) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Attendance session not found"
            );
        }

        return attendanceRecordRepository
                .findBySessionId(
                        sessionId
                )
                .stream()
                .map(record ->
                        new AttendanceRecordResponse(
                                record.getId(),
                                record.getSession()
                                        .getId(),
                                record.getStudent()
                                        .getId(),
                                record.getStudent()
                                        .getStudentNumber(),
                                record.getStudent()
                                        .getName(),
                                record.getRecordedAt(),
                                record.getStatus()
                                        .name()
                        )
                )
                .toList();
    }

    /* =========================================================
       COUNCILOR ATTENDANCE OVERVIEW
    ========================================================= */

    /**
     * Returns attendance summaries
     * for all sections and sessions.
     *
     * PRESENT and LATE are both considered
     * attended when calculating:
     *
     * - attended students
     * - absent students
     * - attendance rate
     */
    @Transactional(readOnly = true)
    public List<AttendanceOverviewResponse>
    getAttendanceOverview() {

        List<AttendanceOverviewResponse> overview =
                new ArrayList<>();

        List<Section> sections =
                sectionRepository
                        .findAll();

        for (Section section : sections) {

            /* =================================================
               ACTIVE STUDENTS
            ================================================= */

            List<Student> students =
                    studentRepository
                            .findBySectionId(
                                    section.getId()
                            );

            int totalStudents =
                    (int) students.stream()
                            .filter(
                                    Student::isActive
                            )
                            .count();

            /* =================================================
               SECTION SESSIONS
            ================================================= */

            List<AttendanceSession> sessions =
                    attendanceSessionRepository
                            .findBySectionId(
                                    section.getId()
                            );

            for (AttendanceSession session : sessions) {

                List<AttendanceRecord> records =
                        attendanceRecordRepository
                                .findBySessionId(
                                        session.getId()
                                );

                /* =============================================
                   PRESENT
                ============================================= */

                int present =
                        (int) records.stream()
                                .filter(record ->
                                        record.getStudent() != null &&
                                                record.getStudent().isActive() &&
                                                record.getStatus() ==
                                                        AttendanceStatus.PRESENT
                                )
                                .count();

                /* =============================================
                   LATE
                ============================================= */

                int late =
                        (int) records.stream()
                                .filter(record ->
                                        record.getStudent() != null &&
                                                record.getStudent().isActive() &&
                                                record.getStatus() ==
                                                        AttendanceStatus.LATE
                                )
                                .count();

                /* =============================================
                   ATTENDED

                   Both PRESENT and LATE count
                   as attendance.
                ============================================= */

                int attended =
                        present +
                                late;

                /* =============================================
                   ABSENT
                ============================================= */

                int absent =
                        Math.max(
                                totalStudents -
                                        attended,
                                0
                        );

                /* =============================================
                   ATTENDANCE RATE

                   PRESENT + LATE are both
                   considered attended.
                ============================================= */

                double attendanceRate =
                        totalStudents == 0
                                ? 0.0
                                : ((double) attended /
                                totalStudents) * 100.0;

                /* =============================================
                   ADVISER INFORMATION
                ============================================= */

                String adviserId =
                        null;

                String adviserName =
                        null;

                if (section.getAdviser() != null) {

                    adviserId =
                            section.getAdviser()
                                    .getId();

                    adviserName =
                            section.getAdviser()
                                    .getName();
                }

                /* =============================================
                   BUILD RESPONSE

                   AttendanceOverviewResponse currently has
                   one attendance-count field called present.

                   To preserve the existing response structure
                   and prevent breaking the frontend, we send
                   total attended students here:

                   PRESENT + LATE

                   Later, if we add a dedicated late field to
                   AttendanceOverviewResponse, we can expose
                   PRESENT and LATE separately.
                ============================================= */

                overview.add(
                        new AttendanceOverviewResponse(
                                session.getId(),
                                section.getId(),
                                section.getName(),
                                adviserId,
                                adviserName,
                                session.getAttendanceDate()
                                        .toString(),
                                totalStudents,
                                attended,
                                absent,
                                attendanceRate
                        )
                );
            }
        }

        return overview;
    }

    /* =========================================================
       DELETE ATTENDANCE RECORD
    ========================================================= */

    /**
     * Deletes an attendance record
     * for a specific session and student.
     */
    @Transactional
    public void deleteAttendanceRecord(
            String sessionId,
            String studentId
    ) {

        AttendanceRecord record =
                attendanceRecordRepository
                        .findBySessionIdAndStudentId(
                                sessionId,
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance record not found"
                                )
                        );

        attendanceRecordRepository
                .delete(
                        record
                );
    }
}