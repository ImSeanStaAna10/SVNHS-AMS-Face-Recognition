package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.AttendanceRiskSectionResponse;

import com.example.attendancemanagementbackend.service.AttendanceRiskService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/attendance-risks"
)
public class AttendanceRiskController {

    private final AttendanceRiskService
            attendanceRiskService;

    public AttendanceRiskController(
            AttendanceRiskService attendanceRiskService
    ) {
        this.attendanceRiskService =
                attendanceRiskService;
    }

    /* =====================================================
       SECTION ATTENDANCE RISK
    ===================================================== */

    @GetMapping(
            "/sections/{sectionId}"
    )
    public AttendanceRiskSectionResponse
    getSectionRiskSummary(
            @PathVariable String sectionId
    ) {

        return attendanceRiskService
                .getSectionRiskSummary(
                        sectionId
                );
    }
}