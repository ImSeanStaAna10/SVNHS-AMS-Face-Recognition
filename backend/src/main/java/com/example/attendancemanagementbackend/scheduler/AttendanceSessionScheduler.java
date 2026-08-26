package com.example.attendancemanagementbackend.scheduler;

import com.example.attendancemanagementbackend.service.AttendanceSessionService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AttendanceSessionScheduler {

    private final AttendanceSessionService
            attendanceSessionService;

    public AttendanceSessionScheduler(
            AttendanceSessionService attendanceSessionService
    ) {
        this.attendanceSessionService =
                attendanceSessionService;
    }

    /* =========================================================
       AUTOMATIC ATTENDANCE SESSION FINALIZATION
    ========================================================= */

    /**
     * Checks every minute for attendance sessions
     * whose configured automatic end time has
     * already been reached.
     *
     * The actual business logic stays inside
     * AttendanceSessionService.
     */
    @Scheduled(fixedDelay = 60000)
    public void finalizeExpiredSessions() {

        attendanceSessionService
                .finalizeExpiredSessions();
    }
}