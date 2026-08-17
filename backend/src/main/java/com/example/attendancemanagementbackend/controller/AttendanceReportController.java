package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.attendance.AttendanceReportResponse;
import com.example.attendancemanagementbackend.service.AttendanceReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/attendance-reports")
public class AttendanceReportController {

    private final AttendanceReportService
            attendanceReportService;

    public AttendanceReportController(
            AttendanceReportService attendanceReportService
    ) {
        this.attendanceReportService =
                attendanceReportService;
    }

    /* =========================================================
       SECTION ATTENDANCE REPORT
    ========================================================= */

    @GetMapping("/sections")
    public AttendanceReportResponse
    getSectionAttendanceReport(

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate to,

            @RequestParam(required = false)
            String sectionId,

            @RequestParam(required = false)
            String adviserId,

            @RequestParam(required = false)
            String search,

            @RequestParam(
                    defaultValue = "0"
            )
            int page,

            @RequestParam(
                    defaultValue = "9"
            )
            int size
    ) {

        return attendanceReportService
                .getSectionAttendanceReport(
                        from,
                        to,
                        sectionId,
                        adviserId,
                        search,
                        page,
                        size
                );
    }
}