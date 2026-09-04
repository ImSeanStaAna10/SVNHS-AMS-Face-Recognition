package com.example.attendancemanagementbackend.config;

import com.example.attendancemanagementbackend.security.JwtAuthenticationFilter;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.config.Customizer;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;

import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.web.SecurityFilterChain;

import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) {

        this.jwtAuthenticationFilter =
                jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http

                /* =================================================
                   CORS
                ================================================= */

                .cors(
                        Customizer.withDefaults()
                )

                /* =================================================
                   CSRF

                   Disabled because authentication is stateless JWT.
                ================================================= */

                .csrf(
                        AbstractHttpConfigurer::disable
                )

                /* =================================================
                   SESSION

                   No server-side HTTP session.
                ================================================= */

                .sessionManagement(
                        session ->
                                session.sessionCreationPolicy(
                                        SessionCreationPolicy.STATELESS
                                )
                )

                /* =================================================
                   AUTHORIZATION
                ================================================= */

                .authorizeHttpRequests(
                        auth -> auth

                                /* =================================
                                   CORS PREFLIGHT
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.OPTIONS,
                                        "/**"
                                )
                                .permitAll()

                                /* =================================
                                   PUBLIC LOGIN
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/auth/login"
                                )
                                .permitAll()

                                /* =================================
                                   PUBLIC PARENT ATTENDANCE NOTICE

                                   These endpoints are intentionally
                                   public because access is protected
                                   by the long cryptographically opaque
                                   parent notification token.

                                   No JWT/login is required.

                                   Supported routes:

                                   GET
                                   /api/public/parent-notifications/{token}

                                   POST
                                   /api/public/parent-notifications/{token}/acknowledge

                                   POST
                                   /api/public/parent-notifications/{token}/response
                                ================================= */

                                .requestMatchers(
                                        "/api/public/parent-notifications/**"
                                )
                                .permitAll()

                                /* =================================
                                   DISABLED PUBLIC REGISTRATION

                                   User accounts are managed through
                                   controlled administrative flows.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/auth/register"
                                )
                                .denyAll()

                                /* =================================
                                   SUPERADMIN MANAGEMENT

                                   SUPERADMIN is responsible for:
                                   - Departments
                                   - Councilor accounts

                                   Councilors and Advisers cannot
                                   access these endpoints.
                                ================================= */

                                .requestMatchers(
                                        "/api/superadmin/**"
                                )
                                .hasRole(
                                        "SUPERADMIN"
                                )

                                /* =================================
                                   PASSWORD MANAGEMENT

                                   SUPERADMIN, COUNCILOR, and ADVISER
                                   can change their own password.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.PATCH,
                                        "/api/users/me/password"
                                )
                                .hasAnyRole(
                                        "SUPERADMIN",
                                        "COUNCILOR",
                                        "ADVISER"
                                )

                                /* =================================
                                   COUNCILOR
                                   RESET ADVISER PASSWORD
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.PATCH,
                                        "/api/users/advisers/*/reset-password"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   CREATE ADVISER
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/users/advisers"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   UPDATE ADVISER
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.PATCH,
                                        "/api/users/advisers/*"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   DEACTIVATE ADVISER
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.DELETE,
                                        "/api/users/advisers/*"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   USER MANAGEMENT LIST
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/users"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   CREATE SECTION
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/sections"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   UPDATE SECTION
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.PATCH,
                                        "/api/sections/*"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   COUNCILOR
                                   DEACTIVATE SECTION
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.DELETE,
                                        "/api/sections/*"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   ATTENDANCE REPORT ARCHIVE

                                   COUNCILOR and ADVISER currently
                                   access reporting endpoints.

                                   Department-level Councilor
                                   restrictions will be enforced
                                   later inside the reporting
                                   access/service layer.

                                   ADVISER remains restricted to
                                   assigned-section reports.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/attendance-reports/**"
                                )
                                .hasAnyRole(
                                        "COUNCILOR",
                                        "ADVISER"
                                )

                                /* =================================
                                   REPORT GENERATION /
                                   REGENERATION

                                   COUNCILOR ONLY.

                                   SUPERADMIN does not automatically
                                   inherit Councilor operational
                                   permissions.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/attendance-reports/**"
                                )
                                .hasRole(
                                        "COUNCILOR"
                                )

                                /* =================================
                                   ADVISER
                                   STUDENT MANAGEMENT
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/students"
                                )
                                .hasRole(
                                        "ADVISER"
                                )

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/students"
                                )
                                .hasRole(
                                        "ADVISER"
                                )

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/students/*/face"
                                )
                                .hasRole(
                                        "ADVISER"
                                )

                                /* =================================
                                   ADVISER
                                   ATTENDANCE SESSION OPERATIONS
                                ================================= */

                                .requestMatchers(
                                        "/api/attendance-sessions/**"
                                )
                                .hasRole(
                                        "ADVISER"
                                )

                                /* =================================
                                   ADVISER
                                   ATTENDANCE RECORD OPERATIONS

                                   Councilor reporting does NOT use
                                   this route.

                                   Reporting uses:
                                   /api/attendance-reports/**
                                ================================= */

                                .requestMatchers(
                                        "/api/attendance-records/**"
                                )
                                .hasRole(
                                        "ADVISER"
                                )

                                /* =================================
                                   EVERYTHING ELSE

                                   Any route not explicitly listed
                                   still requires authentication.

                                   More specific department-level
                                   ownership rules will be enforced
                                   inside their respective services.
                                ================================= */

                                .anyRequest()
                                .authenticated()
                )

                /* =================================================
                   JWT FILTER
                ================================================= */

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }
}