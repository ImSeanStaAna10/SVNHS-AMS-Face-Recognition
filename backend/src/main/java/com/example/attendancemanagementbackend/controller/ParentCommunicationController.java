package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.ParentCommunicationResponse;

import com.example.attendancemanagementbackend.service.ParentCommunicationService;

import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/attendance-interventions")
public class ParentCommunicationController {

    private final ParentCommunicationService
            parentCommunicationService;

    public ParentCommunicationController(
            ParentCommunicationService parentCommunicationService
    ) {

        this.parentCommunicationService =
                parentCommunicationService;
    }

    /* =====================================================
       ADVISER PARENT-COMMUNICATION HISTORY

       GET
       /api/attendance-interventions/{interventionId}
       /parent-communications
    ===================================================== */

    @GetMapping(
            "/{interventionId}/parent-communications"
    )
    public ResponseEntity<List<ParentCommunicationResponse>>
    getParentCommunications(
            @PathVariable
            String interventionId
    ) {

        return ResponseEntity.ok(
                parentCommunicationService
                        .getByIntervention(
                                interventionId
                        )
        );
    }
}
