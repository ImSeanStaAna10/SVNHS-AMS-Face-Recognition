package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SectionRepository extends JpaRepository<Section, String> {
}