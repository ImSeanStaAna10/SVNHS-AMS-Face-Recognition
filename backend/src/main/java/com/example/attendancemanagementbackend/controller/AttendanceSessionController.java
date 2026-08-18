package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.service.AttendanceSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.attendancemanagementbackend.dto.AdviserAttendanceHistoryResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

import java.util.Map;

@RestController
@RequestMapping("/api/attendance-sessions")
public class AttendanceSessionController {

    private final AttendanceSessionService attendanceSessionService;

    public AttendanceSessionController(
            AttendanceSessionService attendanceSessionService
    ) {
        this.attendanceSessionService = attendanceSessionService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> startSession(
            @RequestParam String sectionId,
            Authentication authentication
    ) {

        String adviserId =
                authentication.getPrincipal().toString();

        AttendanceSession session =
                attendanceSessionService.startSession(
                        sectionId,
                        adviserId
                );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Attendance session started",
                        "sessionId", session.getId(),
                        "sectionId", session.getSection().getId(),
                        "attendanceDate", session.getAttendanceDate(),
                        "startedAt", session.getStartedAt(),
                        "status", session.getStatus()
                )
        );
    }

    @GetMapping("/section/{sectionId}/active")
    public ResponseEntity<Map<String, Object>> getActiveSession(
            @PathVariable String sectionId
    ) {

        AttendanceSession session =
                attendanceSessionService.getActiveSession(
                        sectionId
                );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "sessionId", session.getId(),
                        "sectionId", session.getSection().getId(),
                        "attendanceDate", session.getAttendanceDate(),
                        "startedAt", session.getStartedAt(),
                        "status", session.getStatus()
                )
        );
    }

    @PatchMapping("/{sessionId}/end")
    public ResponseEntity<Map<String, Object>> endSession(
            @PathVariable String sessionId,
            Authentication authentication
    ) {

        String adviserId =
                authentication.getPrincipal().toString();

        AttendanceSession session =
                attendanceSessionService.endSession(
                        sessionId,
                        adviserId
                );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Attendance session ended",
                        "sessionId", session.getId(),
                        "endedAt", session.getEndedAt(),
                        "status", session.getStatus()
                )
        );
    }

    /* =========================================================
   ADVISER ATTENDANCE HISTORY
========================================================= */

    @GetMapping("/history")
    public ResponseEntity<
            PagedResponse<AdviserAttendanceHistoryResponse>
            >
    getAttendanceHistory(

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate fromDate,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate toDate,

            @RequestParam(
                    defaultValue = "0"
            )
            int page,

            @RequestParam(
                    defaultValue = "10"
            )
            int size,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        return ResponseEntity.ok(
                attendanceSessionService
                        .getAttendanceHistory(
                                adviserId,
                                fromDate,
                                toDate,
                                page,
                                size
                        )
        );
    }
}