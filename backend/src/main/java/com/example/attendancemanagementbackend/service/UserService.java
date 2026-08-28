package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.UserResponse;
import com.example.attendancemanagementbackend.dto.adviser.CreateAdviserRequest;
import com.example.attendancemanagementbackend.dto.adviser.UpdateAdviserRequest;
import com.example.attendancemanagementbackend.dto.password.ChangePasswordRequest;
import com.example.attendancemanagementbackend.dto.password.ResetPasswordRequest;

import com.example.attendancemanagementbackend.entity.Department;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.UserRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    private final SectionRepository sectionRepository;

    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            SectionRepository sectionRepository,
            PasswordEncoder passwordEncoder
    ) {

        this.userRepository =
                userRepository;

        this.sectionRepository =
                sectionRepository;

        this.passwordEncoder =
                passwordEncoder;
    }

    /* =========================================================
       CREATE ADVISER

       The Adviser automatically belongs to the same department
       as the authenticated Councilor.

       The client is never allowed to choose the department.
    ========================================================= */

    @Transactional
    public UserResponse createAdviser(
            String councilorId,
            CreateAdviserRequest request
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        Department department =
                councilor.getDepartment();

        String name =
                request
                        .getName()
                        .trim();

        String email =
                request
                        .getEmail()
                        .trim();

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

        String hashedPassword =
                passwordEncoder.encode(
                        request.getPassword()
                );

        User adviser =
                new User(
                        name,
                        email,
                        hashedPassword,
                        Role.ADVISER
                );

        /*
         * IMPORTANT:
         *
         * Department is derived from the authenticated
         * Councilor, never from the request body.
         */
        adviser.setDepartment(
                department
        );

        User savedAdviser =
                userRepository.save(
                        adviser
                );

        return mapToResponse(
                savedAdviser
        );
    }

    /* =========================================================
       GET DEPARTMENT ADVISERS

       Previously this returned ALL users.

       It now returns only ADVISER accounts belonging to the
       authenticated Councilor's department.

       SUPERADMIN and other COUNCILOR accounts are excluded.
    ========================================================= */

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers(
            String councilorId
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        String departmentId =
                councilor
                        .getDepartment()
                        .getId();

        return userRepository
                .findAllByRoleAndDepartment_Id(
                        Role.ADVISER,
                        departmentId
                )
                .stream()
                .map(
                        this::mapToResponse
                )
                .toList();
    }

    /* =========================================================
       GET USER BY ID

       Existing shared lookup behavior retained.
    ========================================================= */

    @Transactional(readOnly = true)
    public UserResponse getUserById(
            String id
    ) {

        User user =
                findUserById(
                        id
                );

        return mapToResponse(
                user
        );
    }

    /* =========================================================
       UPDATE ADVISER

       Councilor can only update an Adviser belonging to the
       same department.
    ========================================================= */

    @Transactional
    public UserResponse updateAdviser(
            String councilorId,
            String adviserId,
            UpdateAdviserRequest request
    ) {

        User adviser =
                findAdviserInCouncilorDepartment(
                        councilorId,
                        adviserId
                );

        String name =
                request
                        .getName()
                        .trim();

        String email =
                request
                        .getEmail()
                        .trim();

        /*
         * Email must remain globally unique.
         *
         * The current Adviser is excluded so keeping the same
         * email remains allowed.
         */
        if (
                userRepository
                        .existsByEmailIgnoreCaseAndIdNot(
                                email,
                                adviserId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        /*
         * Only Adviser profile information is modified.
         *
         * Password, role, active state, department,
         * sections, students, and attendance data remain
         * unchanged.
         */
        adviser.setName(
                name
        );

        adviser.setEmail(
                email
        );

        User savedAdviser =
                userRepository.save(
                        adviser
                );

        return mapToResponse(
                savedAdviser
        );
    }

    /* =========================================================
       DEACTIVATE ADVISER
       SOFT DELETE

       Councilor can only deactivate an Adviser belonging to
       the same department.
    ========================================================= */

    @Transactional
    public void deactivateAdviser(
            String councilorId,
            String adviserId
    ) {

        User adviser =
                findAdviserInCouncilorDepartment(
                        councilorId,
                        adviserId
                );

        if (!adviser.isActive()) {
            return;
        }

        /*
         * Do not deactivate an Adviser who is still
         * responsible for an active Section.
         *
         * Existing protection is retained.
         */
        boolean hasActiveSection =
                sectionRepository
                        .existsByAdviserIdAndActiveTrue(
                                adviserId
                        );

        if (hasActiveSection) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Adviser is assigned to an active section. Reassign or deactivate the section first."
            );
        }

        /*
         * SOFT DELETE ONLY.
         *
         * Historical relationships remain intact.
         */
        adviser.setActive(
                false
        );

        userRepository.save(
                adviser
        );
    }

    /* =========================================================
       CHANGE OWN PASSWORD

       Available to authenticated users according to
       SecurityConfig.

       Existing behavior retained.
    ========================================================= */

    @Transactional
    public void changeOwnPassword(
            String userId,
            ChangePasswordRequest request
    ) {

        User user =
                findUserById(
                        userId
                );

        if (!user.isActive()) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "User account is inactive"
            );
        }

        boolean currentPasswordMatches =
                passwordEncoder.matches(
                        request.getCurrentPassword(),
                        user.getPassword()
                );

        if (!currentPasswordMatches) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Current password is incorrect"
            );
        }

        boolean sameAsCurrentPassword =
                passwordEncoder.matches(
                        request.getNewPassword(),
                        user.getPassword()
                );

        if (sameAsCurrentPassword) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "New password must be different from the current password"
            );
        }

        String hashedPassword =
                passwordEncoder.encode(
                        request.getNewPassword()
                );

        user.setPassword(
                hashedPassword
        );

        userRepository.save(
                user
        );
    }

    /* =========================================================
       RESET ADVISER PASSWORD

       COUNCILOR ONLY.

       Councilor can only reset the password of an Adviser
       belonging to the same department.
    ========================================================= */

    @Transactional
    public void resetAdviserPassword(
            String councilorId,
            String adviserId,
            ResetPasswordRequest request
    ) {

        User adviser =
                findAdviserInCouncilorDepartment(
                        councilorId,
                        adviserId
                );

        String hashedPassword =
                passwordEncoder.encode(
                        request.getNewPassword()
                );

        adviser.setPassword(
                hashedPassword
        );

        userRepository.save(
                adviser
        );
    }

    /* =========================================================
       FIND AUTHENTICATED COUNCILOR

       Ensures:
       - User exists
       - User is a COUNCILOR
       - Account is active
       - Councilor has a Department
    ========================================================= */

    private User findCouncilorById(
            String councilorId
    ) {

        User councilor =
                findUserById(
                        councilorId
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
       FIND ADVISER INSIDE COUNCILOR DEPARTMENT

       This is the central ownership check used by:

       - Update Adviser
       - Deactivate Adviser
       - Reset Adviser Password

       An Adviser outside the Councilor's department is treated
       as unavailable to that Councilor.
    ========================================================= */

    private User findAdviserInCouncilorDepartment(
            String councilorId,
            String adviserId
    ) {

        User councilor =
                findCouncilorById(
                        councilorId
                );

        String departmentId =
                councilor
                        .getDepartment()
                        .getId();

        return userRepository
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
    }

    /* =========================================================
       SHARED USER LOOKUP
    ========================================================= */

    private User findUserById(
            String id
    ) {

        return userRepository
                .findById(
                        id
                )
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "User not found"
                                )
                );
    }

    /* =========================================================
       SHARED RESPONSE MAPPER

       Existing response format retained.
    ========================================================= */

    private UserResponse mapToResponse(
            User user
    ) {

        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.isActive()
        );
    }
}