package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SectionRepository extends JpaRepository<Section, String> {

    List<Section> findByAdviserId(
            String adviserId
    );

    boolean existsByAdviserIdAndActiveTrue(
            String adviserId
    );
}