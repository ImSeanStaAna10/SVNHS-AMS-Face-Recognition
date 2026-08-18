package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.UserResponse;
import com.example.attendancemanagementbackend.dto.adviser.CreateAdviserRequest;
import com.example.attendancemanagementbackend.dto.password.ChangePasswordRequest;
import com.example.attendancemanagementbackend.dto.password.ResetPasswordRequest;
import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /* =========================================================
       CREATE ADVISER
    ========================================================= */

    public UserResponse createAdviser(
            CreateAdviserRequest request
    ) {

        if (userRepository.existsByEmail(
                request.getEmail()
        )) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        String hashedPassword =
                passwordEncoder.encode(
                        request.getPassword()
                );

        User adviser = new User(
                request.getName(),
                request.getEmail(),
                hashedPassword,
                Role.ADVISER
        );

        User savedAdviser =
                userRepository.save(adviser);

        return mapToResponse(savedAdviser);
    }

    /* =========================================================
       GET ALL USERS
    ========================================================= */

    public List<UserResponse> getAllUsers() {

        return userRepository
                .findAll()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    /* =========================================================
       GET USER BY ID
    ========================================================= */

    public UserResponse getUserById(
            String id
    ) {

        User user =
                findUserById(id);

        return mapToResponse(user);
    }

    /* =========================================================
       CHANGE OWN PASSWORD

       Available to authenticated users.
       Current password must be correct.
    ========================================================= */

    public void changeOwnPassword(
            String userId,
            ChangePasswordRequest request
    ) {

        User user =
                findUserById(userId);

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

        user.setPassword(hashedPassword);

        userRepository.save(user);
    }

    /* =========================================================
       RESET ADVISER PASSWORD

       Intended for COUNCILOR only.
       Authorization is enforced by SecurityConfig.
    ========================================================= */

    public void resetAdviserPassword(
            String adviserId,
            ResetPasswordRequest request
    ) {

        User adviser =
                findUserById(adviserId);

        if (adviser.getRole() != Role.ADVISER) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Selected user is not an adviser"
            );
        }

        String hashedPassword =
                passwordEncoder.encode(
                        request.getNewPassword()
                );

        adviser.setPassword(hashedPassword);

        userRepository.save(adviser);
    }

    /* =========================================================
       SHARED USER LOOKUP
    ========================================================= */

    private User findUserById(
            String id
    ) {

        return userRepository
                .findById(id)
                .orElseThrow(() ->
                        new ApiException(
                                HttpStatus.NOT_FOUND,
                                "User not found"
                        )
                );
    }

    /* =========================================================
       SHARED RESPONSE MAPPER
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