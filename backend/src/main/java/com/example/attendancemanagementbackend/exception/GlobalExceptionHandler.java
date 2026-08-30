package com.example.attendancemanagementbackend.exception;

import com.example.attendancemanagementbackend.dto.ApiErrorResponse;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    GlobalExceptionHandler.class
            );

    /* =========================================================
       API EXCEPTIONS
    ========================================================= */

    /**
     * Handles expected application errors.
     *
     * Examples:
     *
     * 400 BAD REQUEST
     * 401 UNAUTHORIZED
     * 403 FORBIDDEN
     * 404 NOT FOUND
     * 409 CONFLICT
     *
     * These errors are intentionally returned to the client
     * with their application-safe message.
     */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(
            ApiException exception,
            HttpServletRequest request
    ) {

        logger.warn(
                "API exception: method={}, path={}, status={}, message={}",
                request.getMethod(),
                request.getRequestURI(),
                exception.getStatus().value(),
                exception.getMessage()
        );

        ApiErrorResponse response =
                new ApiErrorResponse(
                        false,
                        exception.getStatus().value(),
                        exception.getStatus().getReasonPhrase(),
                        exception.getMessage(),
                        request.getRequestURI(),
                        LocalDateTime.now()
                );

        return ResponseEntity
                .status(
                        exception.getStatus()
                )
                .body(
                        response
                );
    }

    /* =========================================================
       UNEXPECTED EXCEPTIONS
    ========================================================= */

    /**
     * Handles unexpected server-side failures.
     *
     * IMPORTANT:
     *
     * The real exception and full stack trace are logged
     * on the backend only.
     *
     * The client still receives a generic message so
     * internal implementation details are not exposed.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(
            Exception exception,
            HttpServletRequest request
    ) {

        // =====================================================
        // LOG FULL EXCEPTION + STACK TRACE
        // =====================================================

        logger.error(
                "Unexpected exception: method={}, path={}",
                request.getMethod(),
                request.getRequestURI(),
                exception
        );

        // =====================================================
        // SAFE CLIENT RESPONSE
        // =====================================================

        ApiErrorResponse response =
                new ApiErrorResponse(
                        false,
                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                        "An unexpected error occurred",
                        request.getRequestURI(),
                        LocalDateTime.now()
                );

        return ResponseEntity
                .status(
                        HttpStatus.INTERNAL_SERVER_ERROR
                )
                .body(
                        response
                );
    }
}