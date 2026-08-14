package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.entity.AttendanceSessionStatus;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.repository.AttendanceSessionRepository;
import com.example.attendancemanagementbackend.repository.SectionRepository;
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

    @Transactional
    public AttendanceSession startSession(
            String sectionId,
            String adviserId
    ) {

        Section section = sectionRepository.findById(sectionId)
                .orElseThrow(() ->
                        new RuntimeException("Section not found")
                );

        // Verify that this adviser owns the section
        if (section.getAdviser() == null ||
                !section.getAdviser().getId().equals(adviserId)) {

            throw new RuntimeException(
                    "You are not assigned to this section"
            );
        }

        // Prevent multiple active sessions
        attendanceSessionRepository
                .findBySectionIdAndStatus(
                        sectionId,
                        AttendanceSessionStatus.ACTIVE
                )
                .ifPresent(session -> {
                    throw new RuntimeException(
                            "This section already has an active attendance session"
                    );
                });

        AttendanceSession session =
                new AttendanceSession(section);

        return attendanceSessionRepository.save(session);
    }

    @Transactional
    public AttendanceSession endSession(
            String sessionId,
            String adviserId
    ) {

        AttendanceSession session =
                attendanceSessionRepository.findById(sessionId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Attendance session not found"
                                )
                        );

        Section section = session.getSection();

        // Verify that this adviser owns the section
        if (section.getAdviser() == null ||
                !section.getAdviser().getId().equals(adviserId)) {

            throw new RuntimeException(
                    "You are not assigned to this section"
            );
        }

        if (session.getStatus() ==
                AttendanceSessionStatus.ENDED) {

            throw new RuntimeException(
                    "Attendance session has already ended"
            );
        }

        session.setStatus(
                AttendanceSessionStatus.ENDED
        );

        session.setEndedAt(
                LocalDateTime.now()
        );

        return attendanceSessionRepository.save(session);
    }

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
                        new RuntimeException(
                                "No active attendance session found"
                        )
                );
    }
}