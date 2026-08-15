package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AttendanceSessionService {

    private final AttendanceSessionRepository attendanceSessionRepository;
    private final SectionRepository sectionRepository;

    public AttendanceSessionService(
            AttendanceSessionRepository attendanceSessionRepository,
            SectionRepository sectionRepository
    ) {
        this.attendanceSessionRepository = attendanceSessionRepository;
        this.sectionRepository = sectionRepository;
    }

    /**
     * Start a new attendance session.
     *
     * sectionId + adviserId
     *        ↓
     * validate section
     *        ↓
     * validate adviser ownership
     *        ↓
     * ensure no active session exists
     *        ↓
     * create attendance session
     */
    @Transactional
    public AttendanceSession startSession(
            String sectionId,
            String adviserId
    ) {

        // 1. Find section
        Section section =
                sectionRepository.findById(sectionId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Section not found"
                                )
                        );

        // 2. Verify adviser owns this section
        if (section.getAdviser() == null ||
                !section.getAdviser()
                        .getId()
                        .equals(adviserId)) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this section"
            );
        }

        // 3. Prevent multiple active sessions
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

        // 4. Create attendance session
        AttendanceSession session =
                new AttendanceSession(section);

        // 5. Save
        return attendanceSessionRepository.save(session);
    }

    /**
     * End an active attendance session.
     *
     * sessionId + adviserId
     *        ↓
     * validate session
     *        ↓
     * validate adviser ownership
     *        ↓
     * ensure session has not already ended
     *        ↓
     * mark session as ended
     */
    @Transactional
    public AttendanceSession endSession(
            String sessionId,
            String adviserId
    ) {

        // 1. Find attendance session
        AttendanceSession session =
                attendanceSessionRepository.findById(sessionId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Attendance session not found"
                                )
                        );

        Section section = session.getSection();

        // 2. Verify adviser owns this section
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

        // 3. Prevent ending an already-ended session
        if (session.getStatus() ==
                AttendanceSessionStatus.ENDED) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Attendance session has already ended"
            );
        }

        // 4. End session
        session.setStatus(
                AttendanceSessionStatus.ENDED
        );

        session.setEndedAt(
                LocalDateTime.now()
        );

        // 5. Save changes
        return attendanceSessionRepository.save(session);
    }

    /**
     * Get the currently active attendance session
     * for a section.
     */
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