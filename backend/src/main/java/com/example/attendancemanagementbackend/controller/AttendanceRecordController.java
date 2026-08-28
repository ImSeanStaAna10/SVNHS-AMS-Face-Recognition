package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AttendanceOverviewResponse;
import com.example.attendancemanagementbackend.dto.AttendanceRecordResponse;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.service.AttendanceRecordService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance-records")
public class AttendanceRecordController {

    private final AttendanceRecordService attendanceRecordService;

    public AttendanceRecordController(
            AttendanceRecordService attendanceRecordService
    ) {
        this.attendanceRecordService =
                attendanceRecordService;
    }

    /**
     * MANUAL ATTENDANCE
     *
     * POST
     * /api/attendance-records?sessionId=...&studentId=...
     *
     * SECURITY:
     * The authenticated Adviser may only record attendance
     * inside a session belonging to their assigned Section.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> markPresent(

            @RequestParam
            String sessionId,

            @RequestParam
            String studentId,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        AttendanceRecord record =
                attendanceRecordService
                        .markPresent(
                                sessionId,
                                studentId,
                                adviserId
                        );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Student marked present",
                        "attendanceRecordId", record.getId(),
                        "sessionId", record.getSession().getId(),
                        "studentId", record.getStudent().getId(),
                        "recordedAt", record.getRecordedAt(),
                        "status", record.getStatus()
                )
        );
    }

    /**
     * GET SESSION ATTENDANCE
     *
     * GET
     * /api/attendance-records/session/{sessionId}
     *
     * SECURITY:
     * Adviser may only read records from their own
     * assigned Section/session.
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSessionRecords(

            @PathVariable
            String sessionId,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        List<AttendanceRecordResponse> records =
                attendanceRecordService
                        .getSessionRecords(
                                sessionId,
                                adviserId
                        );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "sessionId", sessionId,
                        "count", records.size(),
                        "records", records
                )
        );
    }

    /**
     * ADVISER ATTENDANCE OVERVIEW
     *
     * GET
     * /api/attendance-records/overview
     *
     * NOTE:
     * SecurityConfig currently restricts
     * /api/attendance-records/** to ROLE_ADVISER.
     *
     * The overview will therefore be restricted
     * to the authenticated Adviser's assigned Section.
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>>
    getAttendanceOverview(

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        List<AttendanceOverviewResponse> overview =
                attendanceRecordService
                        .getAttendanceOverview(
                                adviserId
                        );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "count", overview.size(),
                        "records", overview
                )
        );
    }

    /**
     * FACE RECOGNITION ATTENDANCE
     *
     * POST
     * /api/attendance-records/face
     *
     * multipart/form-data
     *
     * sessionId = ...
     * image = file
     *
     * SECURITY:
     * Adviser may only use face attendance inside
     * a session belonging to their assigned Section.
     *
     * NOTE:
     * Face-matching algorithm itself is NOT changed here.
     */
    @PostMapping(
            value = "/face",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>>
    markAttendanceByFace(

            @RequestParam
            String sessionId,

            @RequestParam
            MultipartFile image,

            Authentication authentication
    ) throws IOException {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        AttendanceRecord record =
                attendanceRecordService
                        .markPresentByFace(
                                sessionId,
                                image,
                                adviserId
                        );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message",
                        "Student marked present by face recognition",
                        "attendanceRecordId", record.getId(),
                        "sessionId", record.getSession().getId(),
                        "studentId", record.getStudent().getId(),
                        "studentNumber",
                        record.getStudent().getStudentNumber(),
                        "studentName",
                        record.getStudent().getName(),
                        "recordedAt", record.getRecordedAt(),
                        "status", record.getStatus()
                )
        );
    }

    /**
     * DELETE ATTENDANCE
     *
     * DELETE
     * /api/attendance-records?sessionId=...&studentId=...
     *
     * Useful for testing.
     *
     * SECURITY:
     * Adviser may only delete attendance from
     * their own assigned Section/session.
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>>
    deleteAttendance(

            @RequestParam
            String sessionId,

            @RequestParam
            String studentId,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        attendanceRecordService
                .deleteAttendanceRecord(
                        sessionId,
                        studentId,
                        adviserId
                );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Attendance record deleted",
                        "sessionId", sessionId,
                        "studentId", studentId
                )
        );
    }
}