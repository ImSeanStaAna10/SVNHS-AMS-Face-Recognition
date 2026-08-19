package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.UserResponse;
import com.example.attendancemanagementbackend.dto.adviser.CreateAdviserRequest;
import com.example.attendancemanagementbackend.dto.adviser.UpdateAdviserRequest;
import com.example.attendancemanagementbackend.dto.password.ChangePasswordRequest;
import com.example.attendancemanagementbackend.dto.password.ResetPasswordRequest;
import com.example.attendancemanagementbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(
            UserService userService
    ) {
        this.userService = userService;
    }

    /* =========================================================
       GET ALL USERS
       Councilor only
    ========================================================= */

    @GetMapping
    public List<UserResponse> getAllUsers() {
        return userService.getAllUsers();
    }

    /* =========================================================
       CREATE ADVISER
       Councilor only
    ========================================================= */

    @PostMapping("/advisers")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createAdviser(
            @Valid @RequestBody CreateAdviserRequest request
    ) {
        return userService.createAdviser(
                request
        );
    }

    /* =========================================================
       UPDATE ADVISER
       Councilor only
    ========================================================= */

    @PatchMapping("/advisers/{adviserId}")
    public UserResponse updateAdviser(
            @PathVariable String adviserId,
            @Valid @RequestBody UpdateAdviserRequest request
    ) {

        return userService.updateAdviser(
                adviserId,
                request
        );
    }

    /* =========================================================
       DEACTIVATE ADVISER
       Councilor only
    ========================================================= */

    @DeleteMapping("/advisers/{adviserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAdviser(
            @PathVariable String adviserId
    ) {

        userService.deactivateAdviser(
                adviserId
        );
    }

    /* =========================================================
       CHANGE OWN PASSWORD
       Councilor or Adviser
    ========================================================= */

    @PatchMapping("/me/password")
    public Map<String, String> changeOwnPassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {

        String userId =
                authentication
                        .getPrincipal()
                        .toString();

        userService.changeOwnPassword(
                userId,
                request
        );

        return Map.of(
                "message",
                "Password changed successfully"
        );
    }

    /* =========================================================
       RESET ADVISER PASSWORD
       Councilor only
    ========================================================= */

    @PatchMapping("/advisers/{adviserId}/reset-password")
    public Map<String, String> resetAdviserPassword(
            @PathVariable String adviserId,
            @Valid @RequestBody ResetPasswordRequest request
    ) {

        userService.resetAdviserPassword(
                adviserId,
                request
        );

        return Map.of(
                "message",
                "Adviser password reset successfully"
        );
    }
}