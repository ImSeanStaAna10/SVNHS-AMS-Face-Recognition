package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.StudentVerificationSettings;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentVerificationSettingsRepository
        extends JpaRepository<StudentVerificationSettings, String> {

    Optional<StudentVerificationSettings>
    findByStudentId(
            String studentId
    );

    boolean existsByStudentId(
            String studentId
    );
}
