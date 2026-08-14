
package com.example.attendancemanagementbackend.security;

import com.example.attendancemanagementbackend.service.JwtService;
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

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String requestUri = request.getRequestURI();
        String method = request.getMethod();

        logger.info(
                "[JWT] Request received: {} {}",
                method,
                requestUri
        );

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null) {

            logger.warn("[JWT] Authorization header is missing");

            filterChain.doFilter(request, response);
            return;
        }

        if (!authHeader.startsWith("Bearer ")) {

            logger.warn("[JWT] Authorization header is not Bearer");

            filterChain.doFilter(request, response);
            return;
        }

        logger.info("[JWT] Bearer token detected");

        String token = authHeader.substring(7);

        if (token.isBlank()) {

            logger.warn("[JWT] Token is empty");

            filterChain.doFilter(request, response);
            return;
        }

        boolean valid;

        try {

            valid = jwtService.isTokenValid(token);

        } catch (Exception exception) {

            logger.error(
                    "[JWT] Token validation threw an exception: {}",
                    exception.getMessage()
            );

            filterChain.doFilter(request, response);
            return;
        }

        if (!valid) {

            logger.warn("[JWT] Token is INVALID");

            filterChain.doFilter(request, response);
            return;
        }

        logger.info("[JWT] Token is VALID");

        String userId = jwtService.extractUserId(token);
        String role = jwtService.extractRole(token);

        logger.info("[JWT] User ID: {}", userId);
        logger.info("[JWT] Role: {}", role);

        if (userId == null || role == null) {

            logger.warn(
                    "[JWT] User ID or role is missing from token"
            );

            filterChain.doFilter(request, response);
            return;
        }

        SimpleGrantedAuthority authority =
                new SimpleGrantedAuthority("ROLE_" + role);

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        userId,
                        null,
                        Collections.singletonList(authority)
                );

        authentication.setDetails(
                new WebAuthenticationDetailsSource()
                        .buildDetails(request)
        );

        SecurityContextHolder
                .getContext()
                .setAuthentication(authentication);

        logger.info(
                "[JWT] Authentication set successfully | userId={} | authority={}",
                userId,
                authority.getAuthority()
        );

        filterChain.doFilter(request, response);
    }
}

