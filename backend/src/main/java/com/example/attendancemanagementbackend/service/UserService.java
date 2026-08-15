package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.UserResponse;
import com.example.attendancemanagementbackend.dto.adviser.CreateAdviserRequest;
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

    // CREATE ADVISER
    public UserResponse createAdviser(
            CreateAdviserRequest request
    ) {

        // Prevent duplicate email
        if (userRepository.existsByEmail(request.getEmail())) {
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

    // GET ALL USERS
    public List<UserResponse> getAllUsers() {

        return userRepository
                .findAll()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // GET USER BY ID
    public UserResponse getUserById(
            String id
    ) {

        User user =
                userRepository.findById(id)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "User not found"
                                )
                        );

        return mapToResponse(user);
    }

    // SHARED RESPONSE MAPPER
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