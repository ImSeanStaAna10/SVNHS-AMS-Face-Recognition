package com.example.attendancemanagementbackend.config;

import com.example.attendancemanagementbackend.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .authorizeHttpRequests(auth -> auth

                        // PUBLIC
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/auth/login"
                        )
                        .permitAll()

                        // Disable old registration endpoint
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/auth/register"
                        )
                        .denyAll()

                        // COUNCILOR ONLY
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

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/sections"
                        )
                        .hasRole("COUNCILOR")

                        // ADVISER ONLY
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/students/*/face"
                        )
                        .hasRole("ADVISER")

                        // EVERYTHING ELSE REQUIRES LOGIN
                        .anyRequest()
                        .authenticated()
                )

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }
}