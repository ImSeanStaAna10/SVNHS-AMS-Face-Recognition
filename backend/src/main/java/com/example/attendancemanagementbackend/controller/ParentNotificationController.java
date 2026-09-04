package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationPreviewResponse;
import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationResponse;
import com.example.attendancemanagementbackend.dto.intervention.PrepareParentNotificationRequest;

import com.example.attendancemanagementbackend.service.ParentNotificationPreparationService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
        "/api/attendance-interventions"
)
public class ParentNotificationController {

    private final ParentNotificationPreparationService
            parentNotificationPreparationService;

    public ParentNotificationController(
            ParentNotificationPreparationService parentNotificationPreparationService
    ) {
        this.parentNotificationPreparationService =
                parentNotificationPreparationService;
    }

    /* =====================================================
       PREVIEW PARENT NOTICE
    ===================================================== */

    @GetMapping(
            "/{interventionId}/parent-notification-preview"
    )
    public ParentNotificationPreviewResponse preview(
            @PathVariable String interventionId
    ) {

        return parentNotificationPreparationService
                .preview(
                        interventionId
                );
    }

    /* =====================================================
       PREPARE MANUAL PARENT NOTICE
    ===================================================== */

    @PostMapping(
            "/{interventionId}/parent-notifications"
    )
    @ResponseStatus(HttpStatus.CREATED)
    public ParentNotificationResponse prepareManualNotification(
            @PathVariable String interventionId,
            @Valid
            @RequestBody(required = false)
            PrepareParentNotificationRequest request
    ) {

        return parentNotificationPreparationService
                .prepareManualNotification(
                        interventionId,
                        request
                );
    }
}