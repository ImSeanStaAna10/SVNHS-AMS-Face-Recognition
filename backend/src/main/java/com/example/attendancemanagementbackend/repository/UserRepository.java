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
       ROLE LOOKUPS

       Used by SUPERADMIN for retrieving and validating
       Councilor accounts without loading every User.
    ========================================================= */

    List<User> findAllByRole(
            Role role
    );

    Optional<User> findByIdAndRole(
            String id,
            Role role
    );

    /* =========================================================
       DEPARTMENT-SCOPED USER LOOKUPS

       Existing methods retained for Councilor → Adviser
       ownership and department isolation.
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

    /* =========================================================
       ACTIVE ROLE / DEPARTMENT CHECKS

       Used by SUPERADMIN to enforce the rule:

       One ACTIVE Councilor per Department.
    ========================================================= */

    boolean existsByRoleAndDepartment_IdAndActiveTrue(
            Role role,
            String departmentId
    );

    /*
     * Same check, but excludes one User.
     *
     * Needed when editing/reactivating an existing
     * Councilor so the account does not conflict
     * with itself.
     */
    boolean existsByRoleAndDepartment_IdAndActiveTrueAndIdNot(
            Role role,
            String departmentId,
            String id
    );
}