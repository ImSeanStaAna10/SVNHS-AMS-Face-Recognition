package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SectionService {

    private final SectionRepository sectionRepository;
    private final UserRepository userRepository;

    public SectionService(
            SectionRepository sectionRepository,
            UserRepository userRepository
    ) {
        this.sectionRepository = sectionRepository;
        this.userRepository = userRepository;
    }

    // CREATE SECTION
    public SectionResponse createSection(CreateSectionRequest request) {

        User adviser = userRepository.findById(request.getAdviserId())
                .orElseThrow(() ->
                        new RuntimeException("Adviser not found")
                );

        if (adviser.getRole() != Role.ADVISER) {
            throw new RuntimeException(
                    "Selected user is not an adviser"
            );
        }

        if (!adviser.isActive()) {
            throw new RuntimeException(
                    "Adviser account is inactive"
            );
        }

        Section section = new Section(
                request.getName(),
                adviser
        );

        Section savedSection = sectionRepository.save(section);

        return new SectionResponse(
                savedSection.getId(),
                savedSection.getName(),
                adviser.getId(),
                adviser.getName(),
                savedSection.isActive()
        );
    }

    // GET SECTIONS
    public List<SectionResponse> getAllSections() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String userId = authentication.getName();

        boolean isCouncilor = authentication.getAuthorities()
                .stream()
                .anyMatch(authority ->
                        authority.getAuthority().equals("ROLE_COUNCILOR")
                );

        List<Section> sections;

        if (isCouncilor) {
            // Councilor can see all sections
            sections = sectionRepository.findAll();
        } else {
            // Adviser can only see assigned sections
            sections = sectionRepository.findByAdviserId(userId);
        }

        return sections.stream()
                .map(section -> new SectionResponse(
                        section.getId(),
                        section.getName(),
                        section.getAdviser().getId(),
                        section.getAdviser().getName(),
                        section.isActive()
                ))
                .toList();
    }
}