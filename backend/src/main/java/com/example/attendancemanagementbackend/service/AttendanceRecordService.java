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

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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
     * Marks a student as PRESENT
     * for an active attendance session.
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
     * Recognizes a student's face and
     * marks the matched student as PRESENT.
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
     * Gets and validates an active
     * attendance session.
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

        if (session.getStatus() !=
                AttendanceSessionStatus.ACTIVE) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session is not active"
            );
        }

        return session;
    }

    /* =========================================================
       CREATE ATTENDANCE RECORD
    ========================================================= */

    /**
     * Creates a PRESENT attendance record
     * after validating:
     *
     * 1. Student belongs to the session's section.
     * 2. Student is active.
     * 3. Student does not already have an
     *    attendance record for this session.
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
           CREATE PRESENT RECORD

           recordedAt is generated inside
           AttendanceRecord using AppTime.now().
        ===================================================== */

        AttendanceRecord record =
                new AttendanceRecord(
                        session,
                        student
                );

        return attendanceRecordRepository
                .save(
                        record
                );
    }

    /* =========================================================
       GET SESSION ATTENDANCE
    ========================================================= */

    /**
     * Returns all attendance records
     * for a specific session.
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
     * for all sections and their sessions.
     *
     * Includes:
     *
     * - Total students
     * - Present
     * - Absent
     * - Attendance rate
     * - Section
     * - Adviser
     * - Attendance date
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

                   IMPORTANT:
                   Only PRESENT records are counted as present.

                   ABSENT records created when ending a session
                   must NOT be counted here.
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
                   ABSENT
                ============================================= */

                int absent =
                        Math.max(
                                totalStudents -
                                        present,
                                0
                        );

                /* =============================================
                   ATTENDANCE RATE
                ============================================= */

                double attendanceRate =
                        totalStudents == 0
                                ? 0.0
                                : ((double) present /
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
                                present,
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