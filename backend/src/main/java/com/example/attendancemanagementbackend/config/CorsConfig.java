package com.example.attendancemanagementbackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration =
                new CorsConfiguration();

        /* =====================================================
           ALLOWED FRONTEND ORIGINS
        ===================================================== */

        configuration.setAllowedOrigins(
                List.of(
                        "http://localhost:5173",
                        "https://svnhs-atms-system.onrender.com"
                )
        );

        /* =====================================================
           ALLOWED HTTP METHODS
        ===================================================== */

        configuration.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        /* =====================================================
           ALLOWED REQUEST HEADERS
        ===================================================== */

        configuration.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type",
                        "Accept",
                        "Origin"
                )
        );

        /* =====================================================
           EXPOSED RESPONSE HEADERS
        ===================================================== */

        configuration.setExposedHeaders(
                List.of(
                        "Authorization"
                )
        );

        /* =====================================================
           JWT AUTHENTICATION

           JWT is sent through Authorization header,
           not through browser cookies.
        ===================================================== */

        configuration.setAllowCredentials(false);

        /* =====================================================
           PREFLIGHT CACHE

           3600 seconds = 1 hour
        ===================================================== */

        configuration.setMaxAge(3600L);

        /* =====================================================
           APPLY TO ALL ENDPOINTS
        ===================================================== */

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                configuration
        );

        return source;
    }
}