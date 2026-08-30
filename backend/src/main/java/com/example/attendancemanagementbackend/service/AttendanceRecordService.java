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
import com.example.attendancemanagementbackend.exception.AmbiguousFaceMatchException;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceRecordRepository;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.util.AppTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

    private static final Logger log =
            LoggerFactory.getLogger(
                    AttendanceRecordService.class
            );

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
     *
     * SECURITY:
     * The authenticated Adviser must own the
     * Section of the requested attendance session.
     */
    @Transactional
    public AttendanceRecord markPresent(
            String sessionId,
            String studentId,
            String adviserId
    ) {

        AttendanceSession session =
                getActiveSession(
                        sessionId,
                        adviserId
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
     *
     * SECURITY:
     * The authenticated Adviser must own the
     * Section of the requested attendance session.
     *
     * FACE MATCHING:
     * Recognition candidates are restricted to
     * ACTIVE students inside the attendance
     * session's Section.
     *
     * The repository returns up to the two closest
     * registered faces.
     *
     * Decision rules:
     *
     * NO_MATCH:
     * Top-1 distance > 0.50
     *
     * MATCH:
     * Top-1 distance <= 0.50 and there is no
     * second distinct candidate inside the same
     * accepted 0.50 threshold.
     *
     * AMBIGUOUS:
     * Top-1 and Top-2 are different students and
     * BOTH distances are <= 0.50.
     *
     * IMPORTANT:
     * AMBIGUOUS exits before createAttendanceRecord(),
     * so no automatic attendance record is saved.
     */
    @Transactional
    public AttendanceRecord markPresentByFace(
            String sessionId,
            MultipartFile image,
            String adviserId
    ) throws IOException {

        AttendanceSession session =
                getActiveSession(
                        sessionId,
                        adviserId
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
           GENERATE FACE EMBEDDING
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
           GET ATTENDANCE SESSION SECTION

           getActiveSession() already verifies that the session
           belongs to the authenticated Adviser and has a valid
           Section. This Section becomes the recognition scope.
        ===================================================== */

        String sectionId =
                session.getSection()
                        .getId();

        /* =====================================================
           FIND TOP TWO REGISTERED FACES IN THIS SECTION

           Repository rules:

           - same Section only
           - active students only
           - registered faces only
           - closest cosine distance first
           - maximum of two candidates

           This prevents a student from another Section from
           becoming the global nearest match.
        ===================================================== */

        List<FaceMatchResult> matches =
                studentFaceService
                        .findTopSimilarFacesBySection(
                                result.embedding(),
                                sectionId
                        );

        /* =====================================================
           NO REGISTERED CANDIDATE IN SECTION
        ===================================================== */

        if (matches == null ||
                matches.isEmpty()) {

            log.info(
                    "FACE_MATCH_DIAGNOSTIC | sectionId={} | candidates=0",
                    sectionId
            );

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        /* =====================================================
           TOP-1 CANDIDATE

           The query is ordered by cosine distance ASC, so
           index 0 is always the closest registered face.
        ===================================================== */

        FaceMatchResult bestMatch =
                matches.get(0);

        if (bestMatch == null) {

            log.warn(
                    "FACE_MATCH_DIAGNOSTIC | sectionId={} | top1=NULL",
                    sectionId
            );

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        /* =====================================================
           TOP-2 DIAGNOSTIC DATA
        ===================================================== */

        FaceMatchResult secondMatch =
                matches.size() > 1
                        ? matches.get(1)
                        : null;

        if (secondMatch != null) {

            double gap =
                    secondMatch.distance() -
                            bestMatch.distance();

            log.info(
                    "FACE_MATCH_DIAGNOSTIC | sectionId={} | top1StudentId={} | top1Distance={} | top2StudentId={} | top2Distance={} | gap={}",
                    sectionId,
                    bestMatch.studentId(),
                    bestMatch.distance(),
                    secondMatch.studentId(),
                    secondMatch.distance(),
                    gap
            );

        } else {

            log.info(
                    "FACE_MATCH_DIAGNOSTIC | sectionId={} | top1StudentId={} | top1Distance={} | top2=NONE",
                    sectionId,
                    bestMatch.studentId(),
                    bestMatch.distance()
            );
        }

        /* =====================================================
           TOP-1 MATCH THRESHOLD

           If even the closest candidate is outside
           the accepted 0.50 threshold, this is a
           NO_MATCH outcome.
        ===================================================== */

        if (bestMatch.distance() >
                FACE_MATCH_THRESHOLD) {

            log.info(
                    "FACE_MATCH_DECISION | sectionId={} | outcome=NO_MATCH | top1StudentId={} | top1Distance={}",
                    sectionId,
                    bestMatch.studentId(),
                    bestMatch.distance()
            );

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Face not recognized"
            );
        }

        /* =====================================================
           AMBIGUITY CHECK

           Conservative V1 rule:

           - Top-1 is already inside <= 0.50
           - Top-2 exists
           - Top-2 belongs to a DIFFERENT Student
           - Top-2 is also inside <= 0.50

           If all conditions are true, the system does
           NOT guess between the two Students.

           IMPORTANT:
           This block runs BEFORE createAttendanceRecord(),
           therefore an AMBIGUOUS result cannot create
           PRESENT or LATE attendance automatically.
        ===================================================== */

        boolean ambiguous =
                secondMatch != null &&
                        secondMatch.studentId() != null &&
                        bestMatch.studentId() != null &&
                        !secondMatch.studentId()
                                .equals(
                                        bestMatch.studentId()
                                ) &&
                        secondMatch.distance() <=
                                FACE_MATCH_THRESHOLD;

        if (ambiguous) {

            Student topCandidateStudent =
                    studentRepository
                            .findById(
                                    bestMatch.studentId()
                            )
                            .orElseThrow(() ->
                                    new ApiException(
                                            HttpStatus.NOT_FOUND,
                                            "Top face candidate student not found"
                                    )
                            );

            Student secondCandidateStudent =
                    studentRepository
                            .findById(
                                    secondMatch.studentId()
                            )
                            .orElseThrow(() ->
                                    new ApiException(
                                            HttpStatus.NOT_FOUND,
                                            "Second face candidate student not found"
                                    )
                            );

            double gap =
                    secondMatch.distance() -
                            bestMatch.distance();

            log.warn(
                    "FACE_MATCH_DECISION | sectionId={} | outcome=AMBIGUOUS | top1StudentId={} | top1Distance={} | top2StudentId={} | top2Distance={} | gap={}",
                    sectionId,
                    bestMatch.studentId(),
                    bestMatch.distance(),
                    secondMatch.studentId(),
                    secondMatch.distance(),
                    gap
            );

            throw new AmbiguousFaceMatchException(
                    topCandidateStudent.getId(),
                    topCandidateStudent.getStudentNumber(),
                    topCandidateStudent.getName(),
                    bestMatch.distance(),
                    secondCandidateStudent.getId(),
                    secondCandidateStudent.getStudentNumber(),
                    secondCandidateStudent.getName(),
                    secondMatch.distance()
            );
        }

        /* =====================================================
           SAFE MATCH

           At this point:

           - Top-1 is inside <= 0.50
           - there is no second DISTINCT candidate that is
             also inside <= 0.50

           The Top-1 candidate may now be used.
        ===================================================== */

        log.info(
                "FACE_MATCH_DECISION | sectionId={} | outcome=MATCH | studentId={} | distance={}",
                sectionId,
                bestMatch.studentId(),
                bestMatch.distance()
        );

        /* =====================================================
           LOAD MATCHED STUDENT
        ===================================================== */

        Student student =
                studentRepository
                        .findById(
                                bestMatch.studentId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        /*
         * Defense in depth:
         *
         * The face query is already Section-scoped, but
         * createAttendanceRecord() still verifies Section
         * ownership, student active status, duplicate
         * attendance, and session expiration.
         */
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
     * 2. Belong to the authenticated Adviser
     * 3. Have ACTIVE database status
     * 4. Not have reached its scheduled end time
     */
    private AttendanceSession getActiveSession(
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

        /* =====================================================
           VERIFY ADVISER OWNERSHIP
        ===================================================== */

        validateAdviserOwnsSession(
                session,
                adviserId
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
     */
    private void validateSessionNotExpired(
            AttendanceSession session,
            LocalDateTime attendanceTime
    ) {

        LocalDateTime scheduledEndAt =
                session.getScheduledEndAt();

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
        ===================================================== */

        LocalDateTime attendanceTime =
                AppTime.now();

        /* =====================================================
           RE-CHECK SCHEDULED END
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

    private AttendanceStatus determineAttendanceStatus(
            AttendanceSession session,
            LocalDateTime attendanceTime
    ) {

        LocalDateTime lateCutoffAt =
                session.getLateCutoffAt();

        if (lateCutoffAt == null) {

            return AttendanceStatus.PRESENT;
        }

        if (attendanceTime.isBefore(
                lateCutoffAt
        )) {

            return AttendanceStatus.PRESENT;
        }

        return AttendanceStatus.LATE;
    }

    /* =========================================================
       GET SESSION ATTENDANCE
    ========================================================= */

    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> getSessionRecords(
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

        validateAdviserOwnsSession(
                session,
                adviserId
        );

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
       ADVISER ATTENDANCE OVERVIEW
    ========================================================= */

    @Transactional(readOnly = true)
    public List<AttendanceOverviewResponse>
    getAttendanceOverview(
            String adviserId
    ) {

        List<AttendanceOverviewResponse> overview =
                new ArrayList<>();

        List<Section> sections =
                sectionRepository
                        .findByAdviserId(
                                adviserId
                        );

        for (Section section : sections) {

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

                int present =
                        (int) records.stream()
                                .filter(record ->
                                        record.getStudent() != null &&
                                                record.getStudent().isActive() &&
                                                record.getStatus() ==
                                                        AttendanceStatus.PRESENT
                                )
                                .count();

                int late =
                        (int) records.stream()
                                .filter(record ->
                                        record.getStudent() != null &&
                                                record.getStudent().isActive() &&
                                                record.getStatus() ==
                                                        AttendanceStatus.LATE
                                )
                                .count();

                int attended =
                        present +
                                late;

                int absent =
                        Math.max(
                                totalStudents -
                                        attended,
                                0
                        );

                double attendanceRate =
                        totalStudents == 0
                                ? 0.0
                                : ((double) attended /
                                totalStudents) * 100.0;

                String sectionAdviserId =
                        null;

                String adviserName =
                        null;

                if (section.getAdviser() != null) {

                    sectionAdviserId =
                            section.getAdviser()
                                    .getId();

                    adviserName =
                            section.getAdviser()
                                    .getName();
                }

                overview.add(
                        new AttendanceOverviewResponse(
                                session.getId(),
                                section.getId(),
                                section.getName(),
                                sectionAdviserId,
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

    @Transactional
    public void deleteAttendanceRecord(
            String sessionId,
            String studentId,
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

        validateAdviserOwnsSession(
                session,
                adviserId
        );

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

    /* =========================================================
       ADVISER SESSION OWNERSHIP
    ========================================================= */

    private void validateAdviserOwnsSession(
            AttendanceSession session,
            String adviserId
    ) {

        if (
                session == null ||
                        session.getSection() == null ||
                        session.getSection()
                                .getAdviser() == null ||
                        !session.getSection()
                                .getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this section"
            );
        }
    }
}
