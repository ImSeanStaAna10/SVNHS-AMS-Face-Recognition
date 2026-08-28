package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Section;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SectionRepository
        extends JpaRepository<Section, String> {

    /* =========================================================
       ADVISER SECTION LOOKUP

       Existing behavior retained.
    ========================================================= */

    List<Section> findByAdviserId(
            String adviserId
    );

    boolean existsByAdviserIdAndActiveTrue(
            String adviserId
    );

    /* =========================================================
       DEPARTMENT-SCOPED SECTION LOOKUPS

       Used by Councilor operations.
    ========================================================= */

    List<Section> findAllByDepartment_Id(
            String departmentId
    );

    Optional<Section> findByIdAndDepartment_Id(
            String sectionId,
            String departmentId
    );
}