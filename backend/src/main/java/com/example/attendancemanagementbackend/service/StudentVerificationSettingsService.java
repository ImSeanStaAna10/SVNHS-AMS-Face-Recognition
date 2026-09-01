package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.StudentVerificationSettingsResponse;
import com.example.attendancemanagementbackend.dto.student.UpdateStudentVerificationSettingsRequest;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentVerificationSettings;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.repository.StudentVerificationSettingsRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class StudentVerificationSettingsService {

    private final StudentRepository studentRepository;

    private final StudentVerificationSettingsRepository
            studentVerificationSettingsRepository;

    public StudentVerificationSettingsService(
            StudentRepository studentRepository,
            StudentVerificationSettingsRepository
                    studentVerificationSettingsRepository
    ) {

        this.studentRepository =
                studentRepository;

        this.studentVerificationSettingsRepository =
                studentVerificationSettingsRepository;
    }

    /* =========================================================
       GET EFFECTIVE VERIFICATION SETTINGS
    ========================================================= */

    /**
     * Returns the Student's effective liveness settings.
     *
     * IMPORTANT:
     * If no database row exists yet, the Student receives the
     * default inclusive/standard configuration:
     *
     * - BLINK allowed
     * - TURN_LEFT allowed
     * - TURN_RIGHT allowed
     *
     * A GET request does not create unnecessary database rows.
     */
    @Transactional(readOnly = true)
    public StudentVerificationSettingsResponse getSettings(
            String studentId,
            String adviserId
    ) {

        Student student =
                getStudentOwnedByAdviser(
                        studentId,
                        adviserId
                );

        StudentVerificationSettings settings =
                studentVerificationSettingsRepository
                        .findByStudentId(
                                student.getId()
                        )
                        .orElseGet(() ->
                                new StudentVerificationSettings(
                                        student
                                )
                        );

        return toResponse(
                settings
        );
    }

    /* =========================================================
       UPDATE VERIFICATION SETTINGS
    ========================================================= */

    /**
     * Partially updates the Student's allowed active-liveness
     * challenges.
     *
     * This stores capability preferences only.
     *
     * It intentionally does NOT store:
     * - disability status
     * - diagnosis
     * - medical condition
     * - reason for accommodation
     *
     * All three challenge types may be disabled. When that
     * happens, the frontend/backend should use the authorized
     * assisted-verification path.
     */
    @Transactional
    public StudentVerificationSettingsResponse updateSettings(
            String studentId,
            UpdateStudentVerificationSettingsRequest request,
            String adviserId
    ) {

        if (request == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Verification settings request is required"
            );
        }

        Student student =
                getStudentOwnedByAdviser(
                        studentId,
                        adviserId
                );

        StudentVerificationSettings settings =
                studentVerificationSettingsRepository
                        .findByStudentId(
                                student.getId()
                        )
                        .orElseGet(() ->
                                new StudentVerificationSettings(
                                        student
                                )
                        );

        if (request.blinkAllowed() != null) {

            settings.setBlinkAllowed(
                    request.blinkAllowed()
            );
        }

        if (request.turnLeftAllowed() != null) {

            settings.setTurnLeftAllowed(
                    request.turnLeftAllowed()
            );
        }

        if (request.turnRightAllowed() != null) {

            settings.setTurnRightAllowed(
                    request.turnRightAllowed()
            );
        }

        StudentVerificationSettings saved =
                studentVerificationSettingsRepository
                        .save(
                                settings
                        );

        return toResponse(
                saved
        );
    }

    /* =========================================================
       INTERNAL EFFECTIVE CHALLENGE LIST

       This method is intentionally reusable by the upcoming
       LivenessChallengeService.
    ========================================================= */

    @Transactional(readOnly = true)
    public List<String> getAllowedChallengesForStudent(
            Student student
    ) {

        if (student == null ||
                student.getId() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Student is required"
            );
        }

        StudentVerificationSettings settings =
                studentVerificationSettingsRepository
                        .findByStudentId(
                                student.getId()
                        )
                        .orElseGet(() ->
                                new StudentVerificationSettings(
                                        student
                                )
                        );

        return buildAllowedChallenges(
                settings
        );
    }

    /* =========================================================
       ADVISER OWNERSHIP
    ========================================================= */

    private Student getStudentOwnedByAdviser(
            String studentId,
            String adviserId
    ) {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        if (
                student.getSection() == null ||
                        student.getSection()
                                .getAdviser() == null ||
                        !student.getSection()
                                .getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this student's section"
            );
        }

        return student;
    }

    /* =========================================================
       RESPONSE MAPPING
    ========================================================= */

    private StudentVerificationSettingsResponse toResponse(
            StudentVerificationSettings settings
    ) {

        List<String> allowedChallenges =
                buildAllowedChallenges(
                        settings
                );

        return new StudentVerificationSettingsResponse(
                settings.getStudent()
                        .getId(),
                settings.isBlinkAllowed(),
                settings.isTurnLeftAllowed(),
                settings.isTurnRightAllowed(),
                allowedChallenges.isEmpty(),
                allowedChallenges
        );
    }

    private List<String> buildAllowedChallenges(
            StudentVerificationSettings settings
    ) {

        List<String> allowedChallenges =
                new ArrayList<>();

        if (settings.isBlinkAllowed()) {

            allowedChallenges.add(
                    "BLINK"
            );
        }

        if (settings.isTurnLeftAllowed()) {

            allowedChallenges.add(
                    "TURN_LEFT"
            );
        }

        if (settings.isTurnRightAllowed()) {

            allowedChallenges.add(
                    "TURN_RIGHT"
            );
        }

        return List.copyOf(
                allowedChallenges
        );
    }
}
