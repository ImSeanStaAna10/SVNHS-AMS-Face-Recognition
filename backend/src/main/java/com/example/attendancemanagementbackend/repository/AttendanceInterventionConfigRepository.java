package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceInterventionConfig;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AttendanceInterventionConfigRepository
        extends JpaRepository<
        AttendanceInterventionConfig,
        String
        > {

    Optional<AttendanceInterventionConfig>
    findBySection_Id(
            String sectionId
    );

    boolean existsBySection_Id(
            String sectionId
    );
}