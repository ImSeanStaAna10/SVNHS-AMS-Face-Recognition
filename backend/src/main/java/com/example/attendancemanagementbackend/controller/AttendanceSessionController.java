package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AdviserAttendanceHistoryResponse;
import com.example.attendancemanagementbackend.dto.attendance.PagedResponse;
import com.example.attendancemanagementbackend.dto.attendance.StartAttendanceSessionRequest;
import com.example.attendancemanagementbackend.entity.AttendanceSession;
import com.example.attendancemanagementbackend.service.AttendanceSessionService;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance-sessions")
public class AttendanceSessionController {

    private final AttendanceSessionService
            attendanceSessionService;

    public AttendanceSessionController(
            AttendanceSessionService attendanceSessionService
    ) {
        this.attendanceSessionService =
                attendanceSessionService;
    }

    /* =========================================================
       START ATTENDANCE SESSION
    ========================================================= */

    /**
     * Supports both:
     *
     * OLD / CURRENT FRONTEND:
     *
     * POST /api/attendance-sessions?sectionId=...
     *
     *
     * NEW SESSION POLICY:
     *
     * POST /api/attendance-sessions
     *
     * {
     *   "sectionId": "...",
     *   "lateAfterMinutes": 15,
     *   "scheduledEndTime": "09:00"
     * }
     *
     *
     * scheduledEndTime may be null when the
     * Adviser wants manual ending only.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> startSession(

            @RequestParam(
                    required = false
            )
            String sectionId,

            @Valid
            @RequestBody(
                    required = false
            )
            StartAttendanceSessionRequest request,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        AttendanceSession session;

        /* =====================================================
           NEW REQUEST BODY FLOW
        ===================================================== */

        if (request != null) {

            session =
                    attendanceSessionService
                            .startSession(
                                    request.sectionId(),
                                    request.lateAfterMinutes(),
                                    request.scheduledEndTime(),
                                    adviserId
                            );
        }

        /* =====================================================
           LEGACY QUERY PARAM FLOW

           Keeps the existing frontend working
           while it has not yet been migrated.
        ===================================================== */

        else {

            if (sectionId == null ||
                    sectionId.isBlank()) {

                throw new IllegalArgumentException(
                        "Section ID is required"
                );
            }

            session =
                    attendanceSessionService
                            .startSession(
                                    sectionId,
                                    adviserId
                            );
        }

        /* =====================================================
           RESPONSE

           LinkedHashMap is intentional because
           lateCutoffAt and scheduledEndAt may
           currently be null for legacy sessions.

           Map.of() cannot contain null values.
        ===================================================== */

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "message",
                "Attendance session started"
        );

        response.put(
                "sessionId",
                session.getId()
        );

        response.put(
                "sectionId",
                session.getSection()
                        .getId()
        );

        response.put(
                "attendanceDate",
                session.getAttendanceDate()
        );

        response.put(
                "startedAt",
                session.getStartedAt()
        );

        response.put(
                "lateAfterMinutes",
                session.getLateAfterMinutes()
        );

        response.put(
                "lateCutoffAt",
                session.getLateCutoffAt()
        );

        response.put(
                "scheduledEndAt",
                session.getScheduledEndAt()
        );

        response.put(
                "status",
                session.getStatus()
        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       GET ACTIVE SESSION
    ========================================================= */

    @GetMapping(
            "/section/{sectionId}/active"
    )
    public ResponseEntity<Map<String, Object>>
    getActiveSession(
            @PathVariable
            String sectionId
    ) {

        AttendanceSession session =
                attendanceSessionService
                        .getActiveSession(
                                sectionId
                        );

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "sessionId",
                session.getId()
        );

        response.put(
                "sectionId",
                session.getSection()
                        .getId()
        );

        response.put(
                "attendanceDate",
                session.getAttendanceDate()
        );

        response.put(
                "startedAt",
                session.getStartedAt()
        );

        response.put(
                "lateAfterMinutes",
                session.getLateAfterMinutes()
        );

        response.put(
                "lateCutoffAt",
                session.getLateCutoffAt()
        );

        response.put(
                "scheduledEndAt",
                session.getScheduledEndAt()
        );

        response.put(
                "endedAt",
                session.getEndedAt()
        );

        response.put(
                "status",
                session.getStatus()
        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =========================================================
       MANUALLY END ATTENDANCE SESSION
    ========================================================= */

    @PatchMapping(
            "/{sessionId}/end"
    )
    public ResponseEntity<Map<String, Object>>
    endSession(
            @PathVariable
            String sessionId,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        AttendanceSession session =
                attendanceSessionService
                        .endSession(
                                sessionId,
                                adviserId
                        );

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                true
        );

        response.put(
                "message",
                "Attendance session ended"
        );

        response.put(
                "sessionId",
                session.getId()
        );

        response.put(
                "endedAt",
                session.getEndedAt()
        );

        response.put(
                "scheduledEndAt",
                session.getScheduledEndAt()
        );

        response.put(
                "status",
                session.getStatus()
        );

        return ResponseEntity.ok(
                response
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

            @RequestParam(
                    required = false
            )
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate fromDate,

            @RequestParam(
                    required = false
            )
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