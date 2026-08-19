package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.dto.section.UpdateSectionRequest;
import com.example.attendancemanagementbackend.service.SectionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sections")
public class SectionController {

    private final SectionService sectionService;

    public SectionController(
            SectionService sectionService
    ) {
        this.sectionService = sectionService;
    }

    /* =========================================================
       CREATE SECTION
    ========================================================= */

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SectionResponse createSection(
            @Valid @RequestBody CreateSectionRequest request
    ) {
        return sectionService.createSection(
                request
        );
    }

    /* =========================================================
       GET SECTIONS
    ========================================================= */

    @GetMapping
    public List<SectionResponse> getAllSections() {
        return sectionService.getAllSections();
    }

    /* =========================================================
       UPDATE SECTION
    ========================================================= */

    @PatchMapping("/{sectionId}")
    public SectionResponse updateSection(
            @PathVariable String sectionId,
            @Valid @RequestBody UpdateSectionRequest request
    ) {

        return sectionService.updateSection(
                sectionId,
                request
        );
    }

    /* =========================================================
       DEACTIVATE SECTION
       SOFT DELETE
    ========================================================= */

    @DeleteMapping("/{sectionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSection(
            @PathVariable String sectionId
    ) {

        sectionService.deactivateSection(
                sectionId
        );
    }
}