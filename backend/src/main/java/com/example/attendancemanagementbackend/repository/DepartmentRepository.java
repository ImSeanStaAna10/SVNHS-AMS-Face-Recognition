package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Department;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DepartmentRepository
        extends JpaRepository<Department, String> {

    /* =========================================================
       LOOKUPS
    ========================================================= */

    Optional<Department> findByCode(
            String code
    );

    Optional<Department> findByName(
            String name
    );

    /* =========================================================
       CREATE DUPLICATE CHECKS
    ========================================================= */

    boolean existsByCodeIgnoreCase(
            String code
    );

    boolean existsByNameIgnoreCase(
            String name
    );

    /* =========================================================
       UPDATE DUPLICATE CHECKS

       Excludes the Department currently being edited so
       keeping its existing code/name remains allowed.
    ========================================================= */

    boolean existsByCodeIgnoreCaseAndIdNot(
            String code,
            String id
    );

    boolean existsByNameIgnoreCaseAndIdNot(
            String name,
            String id
    );
}