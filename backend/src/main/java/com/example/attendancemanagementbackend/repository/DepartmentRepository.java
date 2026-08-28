package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Department;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DepartmentRepository
        extends JpaRepository<Department, String> {

    Optional<Department> findByCode(
            String code
    );

    Optional<Department> findByName(
            String name
    );

    boolean existsByCode(
            String code
    );

    boolean existsByName(
            String name
    );
}