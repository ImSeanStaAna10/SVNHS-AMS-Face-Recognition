package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.UserResponse;
import com.example.attendancemanagementbackend.dto.adviser.CreateAdviserRequest;
import com.example.attendancemanagementbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(
            UserService userService
    ) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserResponse> getAllUsers() {
        return userService.getAllUsers();
    }

    // CREATE ADVISER - Councilor only
    @PostMapping("/advisers")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createAdviser(
            @Valid @RequestBody CreateAdviserRequest request
    ) {
        return userService.createAdviser(request);
    }
}