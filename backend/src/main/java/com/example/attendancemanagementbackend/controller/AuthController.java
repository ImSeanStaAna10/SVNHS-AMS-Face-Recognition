package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.AuthResponse;
import com.example.attendancemanagementbackend.dto.LoginRequest;
import com.example.attendancemanagementbackend.dto.RegisterRequest;
import com.example.attendancemanagementbackend.entity.User;
import com.example.attendancemanagementbackend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@RequestBody RegisterRequest request) {

        User user = authService.register(request);

        return new AuthResponse(
                "Registration successful",
                null,
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole()
        );
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {

        return authService.login(request);
    }
}