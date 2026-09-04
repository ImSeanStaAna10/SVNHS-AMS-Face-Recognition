package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.AttendanceInterventionConfigRequest;
import com.example.attendancemanagementbackend.dto.intervention.AttendanceInterventionConfigResponse;
import com.example.attendancemanagementbackend.service.AttendanceInterventionConfigService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
        "/api/attendance-intervention-configs"
)
public class AttendanceInterventionConfigController {

    private final AttendanceInterventionConfigService
            attendanceInterventionConfigService;

    public AttendanceInterventionConfigController(
            AttendanceInterventionConfigService attendanceInterventionConfigService
    ) {

        this.attendanceInterventionConfigService =
                attendanceInterventionConfigService;
    }

    /* =====================================================
       GET CONFIG
    ===================================================== */

    /*
     * Returns the attendance intervention
     * configuration for a section.
     *
     * Only the Adviser assigned to the section
     * may access the configuration.
     */
    @GetMapping(
            "/sections/{sectionId}"
    )
    public AttendanceInterventionConfigResponse getConfig(
            @PathVariable String sectionId
    ) {

        return attendanceInterventionConfigService
                .getConfig(
                        sectionId
                );
    }

    /* =====================================================
       CREATE / UPDATE CONFIG
    ===================================================== */

    /*
     * Creates the section configuration when
     * one does not exist.
     *
     * If a configuration already exists,
     * the existing configuration is updated.
     *
     * One configuration is allowed per section.
     */
    @PutMapping(
            "/sections/{sectionId}"
    )
    public AttendanceInterventionConfigResponse saveConfig(
            @PathVariable String sectionId,
            @Valid
            @RequestBody
            AttendanceInterventionConfigRequest request
    ) {

        return attendanceInterventionConfigService
                .saveConfig(
                        sectionId,
                        request
                );
    }
}