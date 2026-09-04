package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.StudentGuardianRequest;
import com.example.attendancemanagementbackend.dto.student.StudentGuardianResponse;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentGuardian;
import com.example.attendancemanagementbackend.repository.StudentGuardianRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class StudentGuardianService {

    private final StudentGuardianRepository
            studentGuardianRepository;

    public StudentGuardianService(
            StudentGuardianRepository studentGuardianRepository
    ) {
        this.studentGuardianRepository =
                studentGuardianRepository;
    }

    /* =====================================================
       CREATE PRIMARY GUARDIAN
    ===================================================== */

    @Transactional
    public StudentGuardianResponse createPrimaryGuardian(
            Student student,
            StudentGuardianRequest request
    ) {

        if (
                student == null ||
                        request == null
        ) {
            return null;
        }

        StudentGuardian guardian =
                new StudentGuardian(
                        student,
                        normalizeName(
                                request.getName()
                        ),
                        request.getRelationship(),
                        normalizeEmail(
                                request.getEmail()
                        ),
                        request.isReceiveAttendanceNotifications()
                );

        guardian.setPrimaryGuardian(
                true
        );

        guardian.setActive(
                true
        );

        StudentGuardian savedGuardian =
                studentGuardianRepository.save(
                        guardian
                );

        return mapToResponse(
                savedGuardian
        );
    }

    /* =====================================================
       UPSERT PRIMARY GUARDIAN
    ===================================================== */

    /**
     * If the student already has an active primary guardian,
     * update that guardian.
     *
     * If no active primary guardian exists,
     * create one.
     */
    @Transactional
    public StudentGuardianResponse upsertPrimaryGuardian(
            Student student,
            StudentGuardianRequest request
    ) {

        if (
                student == null ||
                        request == null
        ) {
            return null;
        }

        StudentGuardian guardian =
                studentGuardianRepository
                        .findFirstByStudent_IdAndPrimaryGuardianTrueAndActiveTrue(
                                student.getId()
                        )
                        .orElseGet(() ->
                                new StudentGuardian(
                                        student,
                                        normalizeName(
                                                request.getName()
                                        ),
                                        request.getRelationship(),
                                        normalizeEmail(
                                                request.getEmail()
                                        ),
                                        request.isReceiveAttendanceNotifications()
                                )
                        );

        /*
         * Apply the incoming values even when
         * this is an existing guardian.
         */
        guardian.setStudent(
                student
        );

        guardian.setName(
                normalizeName(
                        request.getName()
                )
        );

        guardian.setRelationship(
                request.getRelationship()
        );

        guardian.setEmail(
                normalizeEmail(
                        request.getEmail()
                )
        );

        guardian.setReceiveAttendanceNotifications(
                request.isReceiveAttendanceNotifications()
        );

        guardian.setPrimaryGuardian(
                true
        );

        guardian.setActive(
                true
        );

        StudentGuardian savedGuardian =
                studentGuardianRepository.save(
                        guardian
                );

        return mapToResponse(
                savedGuardian
        );
    }

    /* =====================================================
       GET PRIMARY GUARDIAN
    ===================================================== */

    @Transactional(readOnly = true)
    public StudentGuardianResponse getPrimaryGuardian(
            String studentId
    ) {

        if (
                studentId == null ||
                        studentId.isBlank()
        ) {
            return null;
        }

        return studentGuardianRepository
                .findFirstByStudent_IdAndPrimaryGuardianTrueAndActiveTrue(
                        studentId
                )
                .map(this::mapToResponse)
                .orElse(null);
    }

    /* =====================================================
       GET PRIMARY GUARDIANS FOR MANY STUDENTS
    ===================================================== */

    /**
     * Used by the Student Management list.
     *
     * This avoids doing one guardian query for
     * every single student.
     */
    @Transactional(readOnly = true)
    public Map<String, StudentGuardianResponse>
    getPrimaryGuardians(
            Collection<String> studentIds
    ) {

        if (
                studentIds == null ||
                        studentIds.isEmpty()
        ) {
            return Map.of();
        }

        Map<String, StudentGuardianResponse>
                guardianByStudentId =
                new HashMap<>();

        studentGuardianRepository
                .findByStudent_IdInAndPrimaryGuardianTrueAndActiveTrue(
                        studentIds
                )
                .forEach(guardian -> {

                    Student student =
                            guardian.getStudent();

                    if (
                            student == null ||
                                    student.getId() == null
                    ) {
                        return;
                    }

                    /*
                     * putIfAbsent protects the response even
                     * if inconsistent historical data somehow
                     * contains multiple primary guardians.
                     */
                    guardianByStudentId.putIfAbsent(
                            student.getId(),
                            mapToResponse(
                                    guardian
                            )
                    );
                });

        return guardianByStudentId;
    }

    /* =====================================================
       NORMALIZATION
    ===================================================== */

    private String normalizeName(
            String value
    ) {

        if (value == null) {
            return null;
        }

        return value.trim();
    }

    private String normalizeEmail(
            String value
    ) {

        if (value == null) {
            return null;
        }

        return value
                .trim()
                .toLowerCase(
                        Locale.ROOT
                );
    }

    /* =====================================================
       RESPONSE MAPPING
    ===================================================== */

    private StudentGuardianResponse mapToResponse(
            StudentGuardian guardian
    ) {

        return new StudentGuardianResponse(
                guardian.getId(),
                guardian.getName(),
                guardian.getRelationship(),
                guardian.getEmail(),
                guardian.isPrimaryGuardian(),
                guardian.isReceiveAttendanceNotifications(),
                guardian.isActive()
        );
    }
}