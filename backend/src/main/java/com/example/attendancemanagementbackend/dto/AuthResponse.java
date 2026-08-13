package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.Role;

public class AuthResponse {

    private String message;
    private String token;
    private String userId;
    private String name;
    private String email;
    private Role role;

    public AuthResponse(
            String message,
            String token,
            String userId,
            String name,
            String email,
            Role role
    ) {
        this.message = message;
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.role = role;
    }

    public String getMessage() {
        return message;
    }

    public String getToken() {
        return token;
    }

    public String getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public Role getRole() {
        return role;
    }
}