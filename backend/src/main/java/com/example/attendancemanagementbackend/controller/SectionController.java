package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.dto.section.UpdateSectionRequest;
import com.example.attendancemanagementbackend.service.SectionService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sections")
public class SectionController {

    private final SectionService sectionService;

    public SectionController(
            SectionService sectionService
    ) {
        this.sectionService =
                sectionService;
    }

    /* =========================================================
       CREATE SECTION

       COUNCILOR ONLY

       Department is derived from the authenticated Councilor.
    ========================================================= */

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SectionResponse createSection(
            Authentication authentication,
            @Valid
            @RequestBody
            CreateSectionRequest request
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        return sectionService.createSection(
                councilorId,
                request
        );
    }

    /* =========================================================
       GET SECTIONS

       COUNCILOR:
       - Own department only

       ADVISER:
       - Assigned section(s) only
    ========================================================= */

    @GetMapping
    public List<SectionResponse> getAllSections(
            Authentication authentication
    ) {

        return sectionService.getAllSections(
                authentication
        );
    }

    /* =========================================================
       UPDATE SECTION

       COUNCILOR ONLY
       Section and Adviser must belong to the Councilor's
       department.
    ========================================================= */

    @PatchMapping("/{sectionId}")
    public SectionResponse updateSection(
            Authentication authentication,
            @PathVariable
            String sectionId,
            @Valid
            @RequestBody
            UpdateSectionRequest request
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        return sectionService.updateSection(
                councilorId,
                sectionId,
                request
        );
    }

    /* =========================================================
       DEACTIVATE SECTION

       COUNCILOR ONLY
       Section must belong to the Councilor's department.
    ========================================================= */

    @DeleteMapping("/{sectionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSection(
            Authentication authentication,
            @PathVariable
            String sectionId
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        sectionService.deactivateSection(
                councilorId,
                sectionId
        );
    }
}