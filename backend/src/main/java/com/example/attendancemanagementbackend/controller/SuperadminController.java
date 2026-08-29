package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.password.ResetPasswordRequest;

import com.example.attendancemanagementbackend.dto.superadmin.CouncilorResponse;
import com.example.attendancemanagementbackend.dto.superadmin.CreateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.CreateDepartmentRequest;
import com.example.attendancemanagementbackend.dto.superadmin.DepartmentResponse;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateActiveStatusRequest;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateDepartmentRequest;

import com.example.attendancemanagementbackend.service.SuperadminService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin")
public class SuperadminController {

    private final SuperadminService superadminService;

    public SuperadminController(
            SuperadminService superadminService
    ) {

        this.superadminService =
                superadminService;
    }

    /* =========================================================
       GET DEPARTMENTS

       SUPERADMIN ONLY
    ========================================================= */

    @GetMapping("/departments")
    public List<DepartmentResponse> getDepartments() {

        return superadminService
                .getDepartments();
    }

    /* =========================================================
       CREATE DEPARTMENT

       SUPERADMIN ONLY
    ========================================================= */

    @PostMapping("/departments")
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse createDepartment(
            @Valid
            @RequestBody
            CreateDepartmentRequest request
    ) {

        return superadminService
                .createDepartment(
                        request
                );
    }

    /* =========================================================
       UPDATE DEPARTMENT

       SUPERADMIN ONLY

       Updates:
       - code
       - name

       Active status is handled separately.
    ========================================================= */

    @PatchMapping(
            "/departments/{departmentId}"
    )
    public DepartmentResponse updateDepartment(
            @PathVariable
            String departmentId,
            @Valid
            @RequestBody
            UpdateDepartmentRequest request
    ) {

        return superadminService
                .updateDepartment(
                        departmentId,
                        request
                );
    }

    /* =========================================================
       UPDATE DEPARTMENT STATUS

       SUPERADMIN ONLY

       Soft activation / deactivation.
    ========================================================= */

    @PatchMapping(
            "/departments/{departmentId}/status"
    )
    public DepartmentResponse updateDepartmentStatus(
            @PathVariable
            String departmentId,
            @Valid
            @RequestBody
            UpdateActiveStatusRequest request
    ) {

        return superadminService
                .updateDepartmentStatus(
                        departmentId,
                        request
                );
    }

    /* =========================================================
       GET COUNCILORS

       SUPERADMIN ONLY
    ========================================================= */

    @GetMapping("/councilors")
    public List<CouncilorResponse> getCouncilors() {

        return superadminService
                .getCouncilors();
    }

    /* =========================================================
       CREATE COUNCILOR

       SUPERADMIN ONLY
    ========================================================= */

    @PostMapping("/councilors")
    @ResponseStatus(HttpStatus.CREATED)
    public CouncilorResponse createCouncilor(
            @Valid
            @RequestBody
            CreateCouncilorRequest request
    ) {

        return superadminService
                .createCouncilor(
                        request
                );
    }

    /* =========================================================
       UPDATE COUNCILOR

       SUPERADMIN ONLY

       Updates:
       - name
       - email
       - department

       Password and active status are handled separately.
    ========================================================= */

    @PatchMapping(
            "/councilors/{councilorId}"
    )
    public CouncilorResponse updateCouncilor(
            @PathVariable
            String councilorId,
            @Valid
            @RequestBody
            UpdateCouncilorRequest request
    ) {

        return superadminService
                .updateCouncilor(
                        councilorId,
                        request
                );
    }

    /* =========================================================
       UPDATE COUNCILOR STATUS

       SUPERADMIN ONLY

       Soft activation / deactivation.
    ========================================================= */

    @PatchMapping(
            "/councilors/{councilorId}/status"
    )
    public CouncilorResponse updateCouncilorStatus(
            @PathVariable
            String councilorId,
            @Valid
            @RequestBody
            UpdateActiveStatusRequest request
    ) {

        return superadminService
                .updateCouncilorStatus(
                        councilorId,
                        request
                );
    }

    /* =========================================================
       RESET COUNCILOR PASSWORD

       SUPERADMIN ONLY

       Uses the same ResetPasswordRequest pattern as the
       existing Councilor -> Adviser password reset.
    ========================================================= */

    @PatchMapping(
            "/councilors/{councilorId}/reset-password"
    )
    public Map<String, String> resetCouncilorPassword(
            @PathVariable
            String councilorId,
            @Valid
            @RequestBody
            ResetPasswordRequest request
    ) {

        superadminService
                .resetCouncilorPassword(
                        councilorId,
                        request
                );

        return Map.of(
                "message",
                "Councilor password reset successfully"
        );
    }
}