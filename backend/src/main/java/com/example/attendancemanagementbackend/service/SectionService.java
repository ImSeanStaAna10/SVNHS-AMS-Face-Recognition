package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.section.CreateSectionRequest;
import com.example.attendancemanagementbackend.dto.section.SectionResponse;
import com.example.attendancemanagementbackend.dto.section.UpdateSectionRequest;

import com.example.attendancemanagementbackend.entity.Department;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SectionService {

    private final SectionRepository sectionRepository;

    private final UserRepository userRepository;

    public SectionService(
            SectionRepository sectionRepository,
            UserRepository userRepository
    ) {

        this.sectionRepository =
                sectionRepository;

        this.userRepository =
                userRepository;
    }

    /* =========================================================
       CREATE SECTION

       COUNCILOR ONLY

       Rules:
       - Councilor must be active
       - Councilor must have a Department
       - Adviser must belong to same Department
       - Adviser must be active
       - Section automatically inherits Councilor Department
       - Client cannot choose Department
    ========================================================= */

    @Transactional
    public SectionResponse createSection(
            String councilorId,
            CreateSectionRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        Department department =
                councilor.getDepartment();

        User adviser =
                findActiveAdviserInDepartment(
                        request.getAdviserId(),
                        department.getId()
                );

        String sectionName =
                request
                        .getName()
                        .trim();

        Section section =
                new Section(
                        sectionName,
                        adviser
                );

        /*
         * IMPORTANT:
         *
         * Department is derived from the authenticated
         * Councilor.
         *
         * The frontend never chooses the Department.
         */
        section.setDepartment(
                department
        );

        Section savedSection =
                sectionRepository.save(
                        section
                );

        return mapToResponse(
                savedSection
        );
    }

    /* =========================================================
       GET SECTIONS

       COUNCILOR:
       - only Sections inside own Department

       ADVISER:
       - only Sections assigned to that Adviser

       Other roles:
       - denied here
    ========================================================= */

    @Transactional(readOnly = true)
    public List<SectionResponse> getAllSections(
            Authentication authentication
    ) {

        String userId =
                authentication
                        .getPrincipal()
                        .toString();

        boolean isCouncilor =
                authentication
                        .getAuthorities()
                        .stream()
                        .anyMatch(
                                authority ->
                                        authority
                                                .getAuthority()
                                                .equals(
                                                        "ROLE_COUNCILOR"
                                                )
                        );

        boolean isAdviser =
                authentication
                        .getAuthorities()
                        .stream()
                        .anyMatch(
                                authority ->
                                        authority
                                                .getAuthority()
                                                .equals(
                                                        "ROLE_ADVISER"
                                                )
                        );

        List<Section> sections;

        if (isCouncilor) {

            User councilor =
                    findCouncilorById(
                            userId
                    );

            String departmentId =
                    councilor
                            .getDepartment()
                            .getId();

            sections =
                    sectionRepository
                            .findAllByDepartment_Id(
                                    departmentId
                            );

        } else if (isAdviser) {

            /*
             * Existing Adviser behavior retained.
             *
             * Adviser only sees Sections directly assigned
             * to their account.
             */
            sections =
                    sectionRepository
                            .findByAdviserId(
                                    userId
                            );

        } else {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Section access is not permitted for this role"
            );
        }

        return sections
                .stream()
                .map(
                        this::mapToResponse
                )
                .toList();
    }

    /* =========================================================
       UPDATE SECTION

       COUNCILOR ONLY

       Rules:
       - Target Section must belong to Councilor Department
       - Assigned Adviser must belong to same Department
       - Adviser must be active
       - Department itself is never changed
    ========================================================= */

    @Transactional
    public SectionResponse updateSection(
            String councilorId,
            String sectionId,
            UpdateSectionRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        String departmentId =
                councilor
                        .getDepartment()
                        .getId();

        Section section =
                findSectionInDepartment(
                        sectionId,
                        departmentId
                );

        User adviser =
                findActiveAdviserInDepartment(
                        request.getAdviserId(),
                        departmentId
                );

        String sectionName =
                request
                        .getName()
                        .trim();

        /*
         * Only Section name and Adviser assignment are changed.
         *
         * Existing:
         * - Section ID
         * - Department
         * - Students
         * - Attendance sessions
         * - Attendance records
         *
         * remain untouched.
         */
        section.setName(
                sectionName
        );

        section.setAdviser(
                adviser
        );

        section.setUpdatedAt(
                LocalDateTime.now()
        );

        Section savedSection =
                sectionRepository.save(
                        section
                );

        return mapToResponse(
                savedSection
        );
    }

    /* =========================================================
       DEACTIVATE SECTION
       SOFT DELETE

       COUNCILOR ONLY

       Councilor can only deactivate Sections belonging to
       their own Department.
    ========================================================= */

    @Transactional
    public void deactivateSection(
            String councilorId,
            String sectionId
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        String departmentId =
                councilor
                        .getDepartment()
                        .getId();

        Section section =
                findSectionInDepartment(
                        sectionId,
                        departmentId
                );

        if (!section.isActive()) {
            return;
        }

        /*
         * SOFT DELETE ONLY.
         *
         * Students, Adviser assignment,
         * Attendance Sessions, Records,
         * Reports, and Department relationship
         * remain intact.
         */
        section.setActive(
                false
        );

        section.setUpdatedAt(
                LocalDateTime.now()
        );

        sectionRepository.save(
                section
        );
    }

    /* =========================================================
       FIND AUTHENTICATED COUNCILOR

       Ensures:
       - User exists
       - Role is COUNCILOR
       - Account is active
       - Councilor has a Department
    ========================================================= */

    private User findCouncilorById(
            String councilorId
    ) {

        User councilor =
                userRepository
                        .findById(
                                councilorId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Councilor not found"
                                        )
                        );

        if (
                councilor.getRole() !=
                        Role.COUNCILOR
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Councilor access required"
            );
        }

        if (!councilor.isActive()) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Councilor account is inactive"
            );
        }

        if (
                councilor.getDepartment() ==
                        null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Councilor is not assigned to a department"
            );
        }

        return councilor;
    }

    /* =========================================================
       FIND ACTIVE ADVISER INSIDE DEPARTMENT

       Used during:
       - Section creation
       - Adviser reassignment

       Prevents a Councilor from supplying an Adviser UUID
       belonging to another Department.
    ========================================================= */

    private User findActiveAdviserInDepartment(
            String adviserId,
            String departmentId
    ) {

        User adviser =
                userRepository
                        .findByIdAndRoleAndDepartment_Id(
                                adviserId,
                                Role.ADVISER,
                                departmentId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Adviser not found in your department"
                                        )
                        );

        if (!adviser.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Adviser account is inactive"
            );
        }

        return adviser;
    }

    /* =========================================================
       FIND SECTION INSIDE DEPARTMENT

       Prevents Councilors from manipulating Sections belonging
       to another Department even if they know the Section UUID.
    ========================================================= */

    private Section findSectionInDepartment(
            String sectionId,
            String departmentId
    ) {

        return sectionRepository
                .findByIdAndDepartment_Id(
                        sectionId,
                        departmentId
                )
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Section not found in your department"
                                )
                );
    }

    /* =========================================================
       SHARED RESPONSE MAPPER

       Existing frontend response structure retained.
    ========================================================= */

    private SectionResponse mapToResponse(
            Section section
    ) {

        User adviser =
                section.getAdviser();

        return new SectionResponse(
                section.getId(),
                section.getName(),

                adviser != null
                        ? adviser.getId()
                        : null,

                adviser != null
                        ? adviser.getName()
                        : null,

                section.isActive()
        );
    }
}