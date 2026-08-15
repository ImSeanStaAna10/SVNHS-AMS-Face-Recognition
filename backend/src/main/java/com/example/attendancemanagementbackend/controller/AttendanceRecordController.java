package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AttendanceRecordResponse;
import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import com.example.attendancemanagementbackend.service.AttendanceRecordService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
        this.attendanceRecordService = attendanceRecordService;
    }

    /**
     * MANUAL ATTENDANCE
     *
     * POST
     * /api/attendance-records?sessionId=...&studentId=...
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> markPresent(
            @RequestParam String sessionId,
            @RequestParam String studentId
    ) {

        AttendanceRecord record =
                attendanceRecordService.markPresent(
                        sessionId,
                        studentId
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
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSessionRecords(
            @PathVariable String sessionId
    ) {

        List<AttendanceRecordResponse> records =
                attendanceRecordService.getSessionRecords(
                        sessionId
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
     * FACE RECOGNITION ATTENDANCE
     *
     * POST
     * /api/attendance-records/face
     *
     * multipart/form-data
     * sessionId = ...
     * image = file
     */
    @PostMapping(
            value = "/face",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> markAttendanceByFace(
            @RequestParam String sessionId,
            @RequestParam MultipartFile image
    ) throws IOException {

        AttendanceRecord record =
                attendanceRecordService.markPresentByFace(
                        sessionId,
                        image
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
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> deleteAttendance(
            @RequestParam String sessionId,
            @RequestParam String studentId
    ) {

        attendanceRecordService.deleteAttendanceRecord(
                sessionId,
                studentId
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