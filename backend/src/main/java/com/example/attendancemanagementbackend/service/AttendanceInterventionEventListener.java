package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.event.AttendanceSessionFinalizedEvent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
public class AttendanceInterventionEventListener {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    AttendanceInterventionEventListener.class
            );

    private final AttendanceInterventionEngineService
            attendanceInterventionEngineService;

    public AttendanceInterventionEventListener(
            AttendanceInterventionEngineService attendanceInterventionEngineService
    ) {
        this.attendanceInterventionEngineService =
                attendanceInterventionEngineService;
    }

    /* =====================================================
       ATTENDANCE SESSION FINALIZED
    ===================================================== */

    /**
     * Runs ONLY after the attendance transaction
     * has successfully committed.
     *
     * This means:
     *
     * - ABSENT records are already committed.
     * - Session is already ENDED.
     * - Attendance itself cannot be rolled back by
     *   intervention processing.
     */
    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT
    )
    public void handleAttendanceSessionFinalized(
            AttendanceSessionFinalizedEvent event
    ) {

        if (event == null ||
                event.sessionId() == null ||
                event.sessionId().isBlank()) {

            return;
        }

        try {

            int createdCount =
                    attendanceInterventionEngineService
                            .evaluateFinalizedSession(
                                    event.sessionId()
                            );

            if (createdCount > 0) {

                logger.info(
                        "Attendance intervention evaluation completed: sessionId={}, createdInterventions={}",
                        event.sessionId(),
                        createdCount
                );
            }

        } catch (Exception exception) {

            /*
             * IMPORTANT:
             *
             * Attendance has ALREADY been committed.
             *
             * Intervention processing must never make
             * the attendance request appear to have
             * failed after the official attendance
             * data was successfully saved.
             */
            logger.error(
                    "Attendance intervention evaluation failed after attendance session finalization: sessionId={}",
                    event.sessionId(),
                    exception
            );
        }
    }
}