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
                                   PUBLIC
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/auth/login"
                                )
                                .permitAll()

                                /* =================================
                                   DISABLED REGISTRATION

                                   Councilor account is seeded
                                   during system initialization.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/auth/register"
                                )
                                .denyAll()

                                /* =================================
                                   PASSWORD MANAGEMENT

                                   Councilor and Adviser can change
                                   their own password.
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.PATCH,
                                        "/api/users/me/password"
                                )
                                .hasAnyRole(
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
                                .hasRole("COUNCILOR")

                                /* =================================
                                   COUNCILOR
                                   USER MANAGEMENT
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/users/advisers"
                                )
                                .hasRole("COUNCILOR")

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/users"
                                )
                                .hasRole("COUNCILOR")

                                /* =================================
                                   COUNCILOR
                                   SECTION MANAGEMENT
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/sections"
                                )
                                .hasRole("COUNCILOR")

                                /* =================================
                                   COUNCILOR
                                   ATTENDANCE REPORTING
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/attendance-reports/**"
                                )
                                .hasRole("COUNCILOR")

                                /* =================================
                                   ADVISER
                                   STUDENT MANAGEMENT
                                ================================= */

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/students"
                                )
                                .hasRole("ADVISER")

                                .requestMatchers(
                                        HttpMethod.GET,
                                        "/api/students"
                                )
                                .hasRole("ADVISER")

                                .requestMatchers(
                                        HttpMethod.POST,
                                        "/api/students/*/face"
                                )
                                .hasRole("ADVISER")

                                /* =================================
                                   ADVISER
                                   ATTENDANCE SESSION OPERATIONS
                                ================================= */

                                .requestMatchers(
                                        "/api/attendance-sessions/**"
                                )
                                .hasRole("ADVISER")

                                /* =================================
                                   ADVISER
                                   ATTENDANCE RECORD OPERATIONS

                                   Councilor reporting does NOT use
                                   this route. Reporting has its own
                                   /attendance-reports/** endpoint.
                                ================================= */

                                .requestMatchers(
                                        "/api/attendance-records/**"
                                )
                                .hasRole("ADVISER")

                                /* =================================
                                   EVERYTHING ELSE

                                   Any route not explicitly listed
                                   above still requires authentication.
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