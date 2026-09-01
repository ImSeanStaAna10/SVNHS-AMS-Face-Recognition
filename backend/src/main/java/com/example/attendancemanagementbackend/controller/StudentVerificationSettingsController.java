package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.student.StudentVerificationSettingsResponse;
import com.example.attendancemanagementbackend.dto.student.UpdateStudentVerificationSettingsRequest;
import com.example.attendancemanagementbackend.service.StudentVerificationSettingsService;

import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
        "/api/students/{studentId}/verification-settings"
)
public class StudentVerificationSettingsController {

    private final StudentVerificationSettingsService
            studentVerificationSettingsService;

    public StudentVerificationSettingsController(
            StudentVerificationSettingsService
                    studentVerificationSettingsService
    ) {

        this.studentVerificationSettingsService =
                studentVerificationSettingsService;
    }

    /* =========================================================
       GET STUDENT VERIFICATION SETTINGS
    ========================================================= */

    @GetMapping
    public StudentVerificationSettingsResponse getSettings(

            @PathVariable
            String studentId,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        return studentVerificationSettingsService
                .getSettings(
                        studentId,
                        adviserId
                );
    }

    /* =========================================================
       UPDATE STUDENT VERIFICATION SETTINGS
    ========================================================= */

    @PatchMapping
    public StudentVerificationSettingsResponse updateSettings(

            @PathVariable
            String studentId,

            @RequestBody
            UpdateStudentVerificationSettingsRequest request,

            Authentication authentication
    ) {

        String adviserId =
                authentication
                        .getPrincipal()
                        .toString();

        return studentVerificationSettingsService
                .updateSettings(
                        studentId,
                        request,
                        adviserId
                );
    }
}
