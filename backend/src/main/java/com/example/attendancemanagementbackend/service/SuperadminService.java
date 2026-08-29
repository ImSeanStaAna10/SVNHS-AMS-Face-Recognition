package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.password.ResetPasswordRequest;

import com.example.attendancemanagementbackend.dto.superadmin.CouncilorResponse;
import com.example.attendancemanagementbackend.dto.superadmin.CreateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.CreateDepartmentRequest;
import com.example.attendancemanagementbackend.dto.superadmin.DepartmentResponse;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateActiveStatusRequest;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateCouncilorRequest;
import com.example.attendancemanagementbackend.dto.superadmin.UpdateDepartmentRequest;

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

        /* =====================================================
           DUPLICATE CODE
        ===================================================== */

        if (
                departmentRepository
                        .existsByCodeIgnoreCase(
                                code
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department code already exists"
            );
        }

        /* =====================================================
           DUPLICATE NAME
        ===================================================== */

        if (
                departmentRepository
                        .existsByNameIgnoreCase(
                                name
                        )
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
       UPDATE DEPARTMENT

       SUPERADMIN ONLY

       Editable:
       - code
       - name

       Active status is intentionally handled by a separate
       endpoint / service method.
    ========================================================= */

    @Transactional
    public DepartmentResponse updateDepartment(
            String departmentId,
            UpdateDepartmentRequest request
    ) {

        Department department =
                findDepartmentById(
                        departmentId
                );

        String code =
                request
                        .getCode()
                        .trim()
                        .toUpperCase();

        String name =
                request
                        .getName()
                        .trim();

        /* =====================================================
           CODE MUST REMAIN UNIQUE

           Current Department is excluded so keeping the
           existing code remains allowed.
        ===================================================== */

        if (
                departmentRepository
                        .existsByCodeIgnoreCaseAndIdNot(
                                code,
                                departmentId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department code already exists"
            );
        }

        /* =====================================================
           NAME MUST REMAIN UNIQUE
        ===================================================== */

        if (
                departmentRepository
                        .existsByNameIgnoreCaseAndIdNot(
                                name,
                                departmentId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department name already exists"
            );
        }

        department.setCode(
                code
        );

        department.setName(
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
       UPDATE DEPARTMENT STATUS

       SUPERADMIN ONLY

       Rules:
       - Soft status change only
       - Historical data is never deleted
       - Department cannot be deactivated while it still has
         an ACTIVE Councilor

       The Councilor must be deactivated / reassigned first.
    ========================================================= */

    @Transactional
    public DepartmentResponse updateDepartmentStatus(
            String departmentId,
            UpdateActiveStatusRequest request
    ) {

        Department department =
                findDepartmentById(
                        departmentId
                );

        boolean requestedActive =
                request.getActive();

        /* =====================================================
           NO CHANGE REQUIRED
        ===================================================== */

        if (
                department.isActive() ==
                        requestedActive
        ) {

            return mapDepartment(
                    department
            );
        }

        /* =====================================================
           DEACTIVATION PROTECTION
        ===================================================== */

        if (!requestedActive) {

            boolean hasActiveCouncilor =
                    userRepository
                            .existsByRoleAndDepartment_IdAndActiveTrue(
                                    Role.COUNCILOR,
                                    departmentId
                            );

            if (hasActiveCouncilor) {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Department has an active Councilor. Deactivate or reassign the Councilor first."
                );
            }
        }

        /* =====================================================
           SOFT STATUS UPDATE
        ===================================================== */

        department.setActive(
                requestedActive
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
       CREATE COUNCILOR

       Rules:
       - Email must be globally unique
       - Department must exist
       - Department must be active
       - Only one ACTIVE Councilor per Department
       - Role is always assigned by the backend
       - Client cannot choose a role
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
        ===================================================== */

        if (
                userRepository
                        .existsByEmailIgnoreCase(
                                email
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        /* =====================================================
           DEPARTMENT
        ===================================================== */

        Department department =
                findDepartmentById(
                        departmentId
                );

        if (!department.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department is inactive"
            );
        }

        /* =====================================================
           ONE ACTIVE COUNCILOR PER DEPARTMENT
        ===================================================== */

        boolean departmentAlreadyHasActiveCouncilor =
                userRepository
                        .existsByRoleAndDepartment_IdAndActiveTrue(
                                Role.COUNCILOR,
                                departmentId
                        );

        if (
                departmentAlreadyHasActiveCouncilor
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department already has an active Councilor"
            );
        }

        /* =====================================================
           PASSWORD
        ===================================================== */

        String hashedPassword =
                passwordEncoder.encode(
                        request.getPassword()
                );

        /* =====================================================
           CREATE ACCOUNT
        ===================================================== */

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

       Only COUNCILOR accounts are returned.
       Advisers and Superadmins are excluded.
    ========================================================= */

    @Transactional(readOnly = true)
    public List<CouncilorResponse> getCouncilors() {

        return userRepository
                .findAllByRole(
                        Role.COUNCILOR
                )
                .stream()
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
       UPDATE COUNCILOR

       SUPERADMIN ONLY

       Editable:
       - name
       - email
       - department

       Not editable here:
       - password
       - role
       - active status

       Those are handled independently.
    ========================================================= */

    @Transactional
    public CouncilorResponse updateCouncilor(
            String councilorId,
            UpdateCouncilorRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

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
           EMAIL MUST REMAIN GLOBALLY UNIQUE

           Current Councilor is excluded so keeping the same
           email remains allowed.
        ===================================================== */

        if (
                userRepository
                        .existsByEmailIgnoreCaseAndIdNot(
                                email,
                                councilorId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        /* =====================================================
           TARGET DEPARTMENT
        ===================================================== */

        Department department =
                findDepartmentById(
                        departmentId
                );

        if (!department.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Department is inactive"
            );
        }

        /* =====================================================
           ACTIVE COUNCILOR TRANSFER PROTECTION

           If this Councilor is active, the destination
           Department cannot already have another active
           Councilor.

           Current Councilor is excluded from the check.
        ===================================================== */

        if (councilor.isActive()) {

            boolean destinationAlreadyHasActiveCouncilor =
                    userRepository
                            .existsByRoleAndDepartment_IdAndActiveTrueAndIdNot(
                                    Role.COUNCILOR,
                                    departmentId,
                                    councilorId
                            );

            if (
                    destinationAlreadyHasActiveCouncilor
            ) {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Department already has an active Councilor"
                );
            }
        }

        /* =====================================================
           UPDATE PROFILE
        ===================================================== */

        councilor.setName(
                name
        );

        councilor.setEmail(
                email
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
       UPDATE COUNCILOR STATUS

       SUPERADMIN ONLY

       Deactivation:
       - Soft deactivation only
       - Historical relationships remain intact

       Reactivation:
       - Councilor must have a Department
       - Department must be active
       - Department must not have another active Councilor
    ========================================================= */

    @Transactional
    public CouncilorResponse updateCouncilorStatus(
            String councilorId,
            UpdateActiveStatusRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        boolean requestedActive =
                request.getActive();

        /* =====================================================
           NO CHANGE REQUIRED
        ===================================================== */

        if (
                councilor.isActive() ==
                        requestedActive
        ) {

            return mapCouncilor(
                    councilor
            );
        }

        /* =====================================================
           REACTIVATION VALIDATION
        ===================================================== */

        if (requestedActive) {

            Department department =
                    councilor.getDepartment();

            if (department == null) {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Councilor is not assigned to a department"
                );
            }

            if (!department.isActive()) {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Councilor's department is inactive"
                );
            }

            boolean departmentAlreadyHasActiveCouncilor =
                    userRepository
                            .existsByRoleAndDepartment_IdAndActiveTrueAndIdNot(
                                    Role.COUNCILOR,
                                    department.getId(),
                                    councilorId
                            );

            if (
                    departmentAlreadyHasActiveCouncilor
            ) {

                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Department already has an active Councilor"
                );
            }
        }

        /* =====================================================
           SOFT STATUS UPDATE
        ===================================================== */

        councilor.setActive(
                requestedActive
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
       RESET COUNCILOR PASSWORD

       SUPERADMIN ONLY

       Uses the same ResetPasswordRequest pattern already used
       by Councilor → Adviser password resets.

       Password is always encoded before persistence.
    ========================================================= */

    @Transactional
    public void resetCouncilorPassword(
            String councilorId,
            ResetPasswordRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        String hashedPassword =
                passwordEncoder.encode(
                        request.getNewPassword()
                );

        councilor.setPassword(
                hashedPassword
        );

        userRepository.save(
                councilor
        );
    }

    /* =========================================================
       FIND DEPARTMENT
    ========================================================= */

    private Department findDepartmentById(
            String departmentId
    ) {

        return departmentRepository
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
    }

    /* =========================================================
       FIND COUNCILOR

       Prevents SUPERADMIN management methods from accidentally
       modifying an Adviser or SUPERADMIN account even if a
       valid User ID is supplied.
    ========================================================= */

    private User findCouncilorById(
            String councilorId
    ) {

        return userRepository
                .findByIdAndRole(
                        councilorId,
                        Role.COUNCILOR
                )
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Councilor not found"
                                )
                );
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