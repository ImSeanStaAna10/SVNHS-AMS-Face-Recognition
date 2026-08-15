package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
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
    public SectionResponse createSection(
            CreateSectionRequest request
    ) {

        User adviser =
                userRepository.findById(request.getAdviserId())
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Adviser not found"
                                )
                        );

        // Selected user must be an adviser
        if (adviser.getRole() != Role.ADVISER) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Selected user is not an adviser"
            );
        }

        // Adviser account must be active
        if (!adviser.isActive()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Adviser account is inactive"
            );
        }

        Section section =
                new Section(
                        request.getName(),
                        adviser
                );

        Section savedSection =
                sectionRepository.save(section);

        return mapToResponse(savedSection);
    }

    // GET SECTIONS
    public List<SectionResponse> getAllSections() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String userId =
                authentication.getName();

        boolean isCouncilor =
                authentication.getAuthorities()
                        .stream()
                        .anyMatch(authority ->
                                authority.getAuthority()
                                        .equals("ROLE_COUNCILOR")
                        );

        List<Section> sections;

        if (isCouncilor) {

            // Councilor can see all sections
            sections =
                    sectionRepository.findAll();

        } else {

            // Adviser can only see assigned sections
            sections =
                    sectionRepository.findByAdviserId(
                            userId
                    );
        }

        return sections
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // SHARED RESPONSE MAPPER
    private SectionResponse mapToResponse(
            Section section
    ) {

        User adviser =
                section.getAdviser();

        return new SectionResponse(
                section.getId(),
                section.getName(),
                adviser != null ? adviser.getId() : null,
                adviser != null ? adviser.getName() : null,
                section.isActive()
        );
    }
}