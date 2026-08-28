package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Role;
import com.example.attendancemanagementbackend.entity.User;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, String> {

    /* =========================================================
       EMAIL LOOKUPS
    ========================================================= */

    Optional<User> findByEmail(
            String email
    );

    boolean existsByEmail(
            String email
    );

    boolean existsByEmailAndIdNot(
            String email,
            String id
    );

    /*
     * Case-insensitive versions used by
     * administrative account management.
     */
    boolean existsByEmailIgnoreCase(
            String email
    );

    boolean existsByEmailIgnoreCaseAndIdNot(
            String email,
            String id
    );

    /* =========================================================
       DEPARTMENT-SCOPED USER LOOKUPS
    ========================================================= */

    List<User> findAllByRoleAndDepartment_Id(
            Role role,
            String departmentId
    );

    Optional<User> findByIdAndRoleAndDepartment_Id(
            String id,
            Role role,
            String departmentId
    );
}