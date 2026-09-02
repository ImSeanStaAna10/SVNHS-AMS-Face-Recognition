package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Section;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SectionRepository
        extends JpaRepository<Section, String> {

    /* =========================================================
       ADVISER SECTION LOOKUPS

       Existing behavior retained.
    ========================================================= */

    List<Section> findByAdviserId(
            String adviserId
    );

    boolean existsByAdviserIdAndActiveTrue(
            String adviserId
    );

    /*
     * Useful when only active sections assigned
     * to an Adviser should be returned.
     */
    List<Section> findByAdviserIdAndActiveTrue(
            String adviserId
    );

    /* =========================================================
       DEPARTMENT-SCOPED SECTION LOOKUPS

       Used by Councilor operations and
       student section-transfer workflows.
    ========================================================= */

    List<Section> findAllByDepartment_Id(
            String departmentId
    );

    /*
     * Returns only ACTIVE sections inside
     * the specified department.
     *
     * Useful for transfer destination selection.
     */
    List<Section> findAllByDepartment_IdAndActiveTrue(
            String departmentId
    );

    Optional<Section> findByIdAndDepartment_Id(
            String sectionId,
            String departmentId
    );

    /*
     * Safer lookup when an operation requires
     * the destination section itself to be active.
     */
    Optional<Section> findByIdAndDepartment_IdAndActiveTrue(
            String sectionId,
            String departmentId
    );

    /* =========================================================
       ACTIVE SECTION LOOKUPS
    ========================================================= */

    /*
     * Useful for general active-section selections
     * without exposing inactive sections.
     */
    List<Section> findAllByActiveTrue();

    /*
     * Convenience check for workflows that need
     * to validate whether a section is currently active.
     */
    boolean existsByIdAndActiveTrue(
            String sectionId
    );
}