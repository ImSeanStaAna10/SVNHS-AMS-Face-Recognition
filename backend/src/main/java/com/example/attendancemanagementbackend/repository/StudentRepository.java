package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, String> {

    List<Student> findBySectionId(String sectionId);

    List<Student> findBySectionAdviserId(String adviserId);

    Optional<Student> findByStudentNumber(String studentNumber);

    boolean existsByStudentNumber(String studentNumber);

    boolean existsByStudentNumberAndIdNot(
            String studentNumber,
            String id
    );
}