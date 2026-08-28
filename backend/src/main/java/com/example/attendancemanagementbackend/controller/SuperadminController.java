package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.superadmin.CouncilorResponse;
import com.example.attendancemanagementbackend.dto.superadmin.CreateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.CreateDepartmentRequest;
import com.example.attendancemanagementbackend.dto.superadmin.DepartmentResponse;
import com.example.attendancemanagementbackend.service.SuperadminService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
}