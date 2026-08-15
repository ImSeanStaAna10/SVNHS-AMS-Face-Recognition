package com.example.attendancemanagementbackend.security;

import com.example.attendancemanagementbackend.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger =
            LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;

    public JwtAuthenticationFilter(
            JwtService jwtService
    ) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader =
                request.getHeader("Authorization");

        // No Authorization header
        if (authHeader == null ||
                !authHeader.startsWith("Bearer ")) {

            filterChain.doFilter(
                    request,
                    response
            );

            return;
        }

        String token =
                authHeader.substring(7);

        // Empty token
        if (token.isBlank()) {

            filterChain.doFilter(
                    request,
                    response
            );

            return;
        }

        try {

            // Parse and validate JWT only once
            Claims claims =
                    jwtService.extractAllClaims(token);

            String userId =
                    claims.getSubject();

            String role =
                    claims.get(
                            "role",
                            String.class
                    );

            if (userId == null ||
                    role == null) {

                filterChain.doFilter(
                        request,
                        response
                );

                return;
            }

            // Avoid replacing existing authentication
            if (SecurityContextHolder
                    .getContext()
                    .getAuthentication() == null) {

                SimpleGrantedAuthority authority =
                        new SimpleGrantedAuthority(
                                "ROLE_" + role
                        );

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userId,
                                null,
                                Collections.singletonList(
                                        authority
                                )
                        );

                authentication.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(request)
                );

                SecurityContextHolder
                        .getContext()
                        .setAuthentication(
                                authentication
                        );
            }

        } catch (Exception exception) {

            logger.warn(
                    "[JWT] Invalid or expired token: {}",
                    exception.getMessage()
            );

            // Don't authenticate.
            // Spring Security will handle protected endpoints.
        }

        filterChain.doFilter(
                request,
                response
        );
    }
}