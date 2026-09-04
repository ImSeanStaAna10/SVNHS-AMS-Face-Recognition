package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.StudentGuardian;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentGuardianRepository
        extends JpaRepository<StudentGuardian, String> {

    Optional<StudentGuardian>
    findFirstByStudent_IdAndPrimaryGuardianTrueAndActiveTrue(
            String studentId
    );

    List<StudentGuardian>
    findByStudent_IdInAndPrimaryGuardianTrueAndActiveTrue(
            Collection<String> studentIds
    );

    List<StudentGuardian>
    findByStudent_IdAndActiveTrue(
            String studentId
    );

    Optional<StudentGuardian>
    findByIdAndStudent_Id(
            String guardianId,
            String studentId
    );
}