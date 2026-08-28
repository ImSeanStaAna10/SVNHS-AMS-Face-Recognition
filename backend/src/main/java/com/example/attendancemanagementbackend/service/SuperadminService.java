package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.superadmin.CouncilorResponse;
import com.example.attendancemanagementbackend.dto.superadmin.CreateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.CreateDepartmentRequest;
import com.example.attendancemanagementbackend.dto.superadmin.DepartmentResponse;
import com.example.attendancemanagementbackend.entity.Department;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.DepartmentRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class SuperadminService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final DepartmentRepository departmentRepository;

    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    public SuperadminService(
            DepartmentRepository departmentRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {

        this.departmentRepository =
                departmentRepository;

        this.userRepository =
                userRepository;

        this.passwordEncoder =
                passwordEncoder;
    }

    /* =========================================================
       CREATE DEPARTMENT
    ========================================================= */

    @Transactional
    public DepartmentResponse createDepartment(
            CreateDepartmentRequest request
    ) {

        String code =
                request
                        .getCode()
                        .trim()
                        .toUpperCase();

        String name =
                request
                        .getName()
                        .trim();

        if (
                departmentRepository
                        .existsByCode(code)
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department code already exists"
            );
        }

        if (
                departmentRepository
                        .existsByName(name)
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department name already exists"
            );
        }

        Department department =
                new Department(
                        code,
                        name
                );

        Department savedDepartment =
                departmentRepository.save(
                        department
                );

        return mapDepartment(
                savedDepartment
        );
    }

    /* =========================================================
       GET DEPARTMENTS
    ========================================================= */

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getDepartments() {

        return departmentRepository
                .findAll()
                .stream()
                .sorted(
                        Comparator.comparing(
                                Department::getCode,
                                String.CASE_INSENSITIVE_ORDER
                        )
                )
                .map(
                        this::mapDepartment
                )
                .toList();
    }

    /* =========================================================
       CREATE COUNCILOR

       Rules:
       - Email must be unique
       - Department must exist
       - Department must be active
       - Only one ACTIVE Councilor per department
       - Role is assigned by backend
       - Client cannot choose the role
    ========================================================= */

    @Transactional
    public CouncilorResponse createCouncilor(
            CreateCouncilorRequest request
    ) {

        String name =
                request
                        .getName()
                        .trim();

        String email =
                request
                        .getEmail()
                        .trim();

        String departmentId =
                request
                        .getDepartmentId()
                        .trim();

        /* =====================================================
           CASE-INSENSITIVE EMAIL DUPLICATE CHECK

           Existing UserRepository currently uses an exact
           email comparison, so we protect Superadmin account
           creation here without changing the existing login
           / Adviser flow yet.
        ===================================================== */

        boolean emailExists =
                userRepository
                        .findAll()
                        .stream()
                        .anyMatch(
                                user ->
                                        user
                                                .getEmail()
                                                .equalsIgnoreCase(
                                                        email
                                                )
                        );

        if (emailExists) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        Department department =
                departmentRepository
                        .findById(
                                departmentId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Department not found"
                                        )
                        );

        if (!department.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department is inactive"
            );
        }

        /* =====================================================
           ONE ACTIVE COUNCILOR PER DEPARTMENT

           This matches our current architecture:

           ICT
           → ICT Councilor

           TVL
           → TVL Councilor

           Later, deactivating a Councilor will allow a
           replacement Councilor to be assigned.
        ===================================================== */

        boolean departmentAlreadyHasActiveCouncilor =
                userRepository
                        .findAll()
                        .stream()
                        .anyMatch(
                                user ->
                                        user.getRole() ==
                                                Role.COUNCILOR
                                                &&
                                                user.isActive()
                                                &&
                                                user.getDepartment() != null
                                                &&
                                                department
                                                        .getId()
                                                        .equals(
                                                                user
                                                                        .getDepartment()
                                                                        .getId()
                                                        )
                        );

        if (
                departmentAlreadyHasActiveCouncilor
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department already has an active Councilor"
            );
        }

        String hashedPassword =
                passwordEncoder.encode(
                        request.getPassword()
                );

        User councilor =
                new User(
                        name,
                        email,
                        hashedPassword,
                        Role.COUNCILOR
                );

        councilor.setDepartment(
                department
        );

        User savedCouncilor =
                userRepository.save(
                        councilor
                );

        return mapCouncilor(
                savedCouncilor
        );
    }

    /* =========================================================
       GET COUNCILORS

       SUPERADMIN view.

       Advisers and Superadmins are intentionally excluded.
    ========================================================= */

    @Transactional(readOnly = true)
    public List<CouncilorResponse> getCouncilors() {

        return userRepository
                .findAll()
                .stream()
                .filter(
                        user ->
                                user.getRole() ==
                                        Role.COUNCILOR
                )
                .sorted(
                        Comparator.comparing(
                                User::getName,
                                String.CASE_INSENSITIVE_ORDER
                        )
                )
                .map(
                        this::mapCouncilor
                )
                .toList();
    }

    /* =========================================================
       DEPARTMENT RESPONSE MAPPER
    ========================================================= */

    private DepartmentResponse mapDepartment(
            Department department
    ) {

        return new DepartmentResponse(
                department.getId(),
                department.getCode(),
                department.getName(),
                department.isActive()
        );
    }

    /* =========================================================
       COUNCILOR RESPONSE MAPPER
    ========================================================= */

    private CouncilorResponse mapCouncilor(
            User councilor
    ) {

        Department department =
                councilor.getDepartment();

        return new CouncilorResponse(
                councilor.getId(),
                councilor.getName(),
                councilor.getEmail(),
                councilor.isActive(),

                department != null
                        ? department.getId()
                        : null,

                department != null
                        ? department.getCode()
                        : null,

                department != null
                        ? department.getName()
                        : null
        );
    }
}