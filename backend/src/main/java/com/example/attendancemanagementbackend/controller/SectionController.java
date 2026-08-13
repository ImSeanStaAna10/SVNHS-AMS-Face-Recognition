package com.example.attendancemanagementbackend.controller;
import java.util.List;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.service.SectionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sections")
public class SectionController {

    private final SectionService sectionService;

    public SectionController(SectionService sectionService) {
        this.sectionService = sectionService;
    }

    // POST - Create Section
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SectionResponse createSection(
            @Valid @RequestBody CreateSectionRequest request
    ) {
        return sectionService.createSection(request);
    }

    // READ - get all section
    @GetMapping
    public List<SectionResponse> getAllSections() {
        return sectionService.getAllSections();
    }
}