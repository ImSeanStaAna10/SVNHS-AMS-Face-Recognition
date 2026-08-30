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
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    GlobalExceptionHandler.class
            );

    /* =========================================================
       AMBIGUOUS FACE MATCH
    ========================================================= */

    /**
     * Handles attendance face-recognition attempts where
     * two different students inside the SAME attendance
     * Section are both within the accepted face-match
     * threshold.
     *
     * IMPORTANT:
     *
     * AttendanceRecordService throws this exception BEFORE
     * an AttendanceRecord is created.
     *
     * Therefore:
     *
     * - no PRESENT record is created
     * - no LATE record is created
     * - the backend does not guess between the candidates
     *
     * The frontend receives both candidates so the Adviser
     * can safely fall back to manual attendance.
     */
    @ExceptionHandler(AmbiguousFaceMatchException.class)
    public ResponseEntity<Map<String, Object>>
    handleAmbiguousFaceMatchException(
            AmbiguousFaceMatchException exception,
            HttpServletRequest request
    ) {

        double distanceGap =
                exception.getSecondDistance() -
                        exception.getTopDistance();

        logger.warn(
                "Ambiguous face match: method={}, path={}, topStudentId={}, topDistance={}, secondStudentId={}, secondDistance={}, gap={}",
                request.getMethod(),
                request.getRequestURI(),
                exception.getTopStudentId(),
                exception.getTopDistance(),
                exception.getSecondStudentId(),
                exception.getSecondDistance(),
                distanceGap
        );

        /* =====================================================
           TOP CANDIDATE
        ===================================================== */

        Map<String, Object> topCandidate =
                new LinkedHashMap<>();

        topCandidate.put(
                "studentId",
                exception.getTopStudentId()
        );

        topCandidate.put(
                "studentNumber",
                exception.getTopStudentNumber()
        );

        topCandidate.put(
                "studentName",
                exception.getTopStudentName()
        );

        topCandidate.put(
                "distance",
                exception.getTopDistance()
        );

        /* =====================================================
           SECOND CANDIDATE
        ===================================================== */

        Map<String, Object> secondCandidate =
                new LinkedHashMap<>();

        secondCandidate.put(
                "studentId",
                exception.getSecondStudentId()
        );

        secondCandidate.put(
                "studentNumber",
                exception.getSecondStudentNumber()
        );

        secondCandidate.put(
                "studentName",
                exception.getSecondStudentName()
        );

        secondCandidate.put(
                "distance",
                exception.getSecondDistance()
        );

        /* =====================================================
           STRUCTURED AMBIGUOUS RESPONSE
        ===================================================== */

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "success",
                false
        );

        response.put(
                "status",
                exception.getStatus().value()
        );

        response.put(
                "error",
                exception.getStatus()
                        .getReasonPhrase()
        );

        response.put(
                "outcome",
                "AMBIGUOUS"
        );

        response.put(
                "message",
                exception.getMessage()
        );

        response.put(
                "distanceGap",
                distanceGap
        );

        response.put(
                "topCandidate",
                topCandidate
        );

        response.put(
                "secondCandidate",
                secondCandidate
        );

        response.put(
                "path",
                request.getRequestURI()
        );

        response.put(
                "timestamp",
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