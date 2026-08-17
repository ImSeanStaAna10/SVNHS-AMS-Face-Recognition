package com.example.attendancemanagementbackend.service;

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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    ========================================================= */

    @Transactional
    public AttendanceSession startSession(
            String sectionId,
            String adviserId
    ) {

        Section section =
                sectionRepository
                        .findById(sectionId)
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
           PREVENT MULTIPLE ACTIVE SESSIONS
        ===================================================== */

        attendanceSessionRepository
                .findBySectionIdAndStatus(
                        sectionId,
                        AttendanceSessionStatus.ACTIVE
                )
                .ifPresent(session -> {
                    throw new ApiException(
                            HttpStatus.CONFLICT,
                            "This section already has an active attendance session"
                    );
                });

        /* =====================================================
           PREVENT MULTIPLE DAILY SESSIONS
        ===================================================== */

        LocalDate attendanceDate =
                LocalDate.now();

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
           CREATE SESSION
        ===================================================== */

        AttendanceSession session =
                new AttendanceSession(
                        section
                );

        return attendanceSessionRepository
                .save(session);
    }

    /* =========================================================
       END ATTENDANCE SESSION
    ========================================================= */

    @Transactional
    public AttendanceSession endSession(
            String sessionId,
            String adviserId
    ) {

        AttendanceSession session =
                attendanceSessionRepository
                        .findById(sessionId)
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

        /* =====================================================
           FINALIZE ABSENT STUDENTS
        ===================================================== */

        finalizeAbsentStudents(
                session
        );

        /* =====================================================
           END SESSION
        ===================================================== */

        session.setStatus(
                AttendanceSessionStatus.ENDED
        );

        session.setEndedAt(
                LocalDateTime.now()
        );

        return attendanceSessionRepository
                .save(session);
    }

    /* =========================================================
       FINALIZE ABSENT STUDENTS
    ========================================================= */

    private void finalizeAbsentStudents(
            AttendanceSession session
    ) {

        String sectionId =
                session.getSection().getId();

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

            if (alreadyRecorded) {
                continue;
            }

            AttendanceRecord absentRecord =
                    new AttendanceRecord(
                            session,
                            student,
                            AttendanceStatus.ABSENT
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

        return attendanceSessionRepository
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
    }
}