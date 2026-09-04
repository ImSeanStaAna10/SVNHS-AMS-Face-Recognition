package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationResponseRequest;
import com.example.attendancemanagementbackend.dto.intervention.PublicParentNotificationResponse;

import com.example.attendancemanagementbackend.service.ParentNotificationPublicService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/public/parent-notifications"
)
public class ParentNotificationPublicController {

    private final ParentNotificationPublicService
            parentNotificationPublicService;

    public ParentNotificationPublicController(
            ParentNotificationPublicService parentNotificationPublicService
    ) {

        this.parentNotificationPublicService =
                parentNotificationPublicService;
    }

    /* =====================================================
       VIEW NOTICE
    ===================================================== */

    @GetMapping(
            "/{token}"
    )
    public ResponseEntity<PublicParentNotificationResponse>
    getNotice(

            @PathVariable
            String token
    ) {

        PublicParentNotificationResponse response =
                parentNotificationPublicService
                        .getNotice(
                                token
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =====================================================
       ACKNOWLEDGE
    ===================================================== */

    @PostMapping(
            "/{token}/acknowledge"
    )
    public ResponseEntity<PublicParentNotificationResponse>
    acknowledge(

            @PathVariable
            String token
    ) {

        PublicParentNotificationResponse response =
                parentNotificationPublicService
                        .acknowledge(
                                token
                        );

        return ResponseEntity.ok(
                response
        );
    }

    /* =====================================================
       RESPOND
    ===================================================== */

    @PostMapping(
            "/{token}/response"
    )
    public ResponseEntity<PublicParentNotificationResponse>
    respond(

            @PathVariable
            String token,

            @Valid
            @RequestBody
            ParentNotificationResponseRequest request
    ) {

        PublicParentNotificationResponse response =
                parentNotificationPublicService
                        .respond(
                                token,
                                request
                        );

        return ResponseEntity.ok(
                response
        );
    }
}