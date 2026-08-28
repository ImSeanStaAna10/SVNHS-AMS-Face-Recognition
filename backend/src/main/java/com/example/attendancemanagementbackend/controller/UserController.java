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

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(
            UserService userService
    ) {
        this.userService =
                userService;
    }

    /* =========================================================
       GET DEPARTMENT ADVISERS

       COUNCILOR ONLY

       Returns only Advisers belonging to the authenticated
       Councilor's department.
    ========================================================= */

    @GetMapping
    public List<UserResponse> getAllUsers(
            Authentication authentication
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        return userService.getAllUsers(
                councilorId
        );
    }

    /* =========================================================
       CREATE ADVISER

       COUNCILOR ONLY

       The department is NOT accepted from the client.
       The Adviser automatically inherits the authenticated
       Councilor's department.
    ========================================================= */

    @PostMapping("/advisers")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createAdviser(
            Authentication authentication,
            @Valid
            @RequestBody
            CreateAdviserRequest request
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        return userService.createAdviser(
                councilorId,
                request
        );
    }

    /* =========================================================
       UPDATE ADVISER

       COUNCILOR ONLY

       A Councilor can only update an Adviser from the same
       department.
    ========================================================= */

    @PatchMapping("/advisers/{adviserId}")
    public UserResponse updateAdviser(
            Authentication authentication,
            @PathVariable
            String adviserId,
            @Valid
            @RequestBody
            UpdateAdviserRequest request
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        return userService.updateAdviser(
                councilorId,
                adviserId,
                request
        );
    }

    /* =========================================================
       DEACTIVATE ADVISER

       COUNCILOR ONLY

       A Councilor can only deactivate an Adviser from the same
       department.
    ========================================================= */

    @DeleteMapping("/advisers/{adviserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAdviser(
            Authentication authentication,
            @PathVariable
            String adviserId
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        userService.deactivateAdviser(
                councilorId,
                adviserId
        );
    }

    /* =========================================================
       CHANGE OWN PASSWORD

       SUPERADMIN, COUNCILOR, OR ADVISER

       Authorization is controlled by SecurityConfig.
    ========================================================= */

    @PatchMapping("/me/password")
    public Map<String, String> changeOwnPassword(
            Authentication authentication,
            @Valid
            @RequestBody
            ChangePasswordRequest request
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

       COUNCILOR ONLY

       The Adviser must belong to the authenticated
       Councilor's department.
    ========================================================= */

    @PatchMapping(
            "/advisers/{adviserId}/reset-password"
    )
    public Map<String, String> resetAdviserPassword(
            Authentication authentication,
            @PathVariable
            String adviserId,
            @Valid
            @RequestBody
            ResetPasswordRequest request
    ) {

        String councilorId =
                authentication
                        .getPrincipal()
                        .toString();

        userService.resetAdviserPassword(
                councilorId,
                adviserId,
                request
        );

        return Map.of(
                "message",
                "Adviser password reset successfully"
        );
    }
}