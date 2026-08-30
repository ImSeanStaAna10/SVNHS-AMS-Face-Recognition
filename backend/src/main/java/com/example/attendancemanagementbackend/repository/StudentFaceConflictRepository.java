package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.StudentFaceConflict;
import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentFaceConflictRepository
        extends JpaRepository<StudentFaceConflict, String> {

    Optional<StudentFaceConflict>
    findByStudentA_IdAndStudentB_Id(
            String studentAId,
            String studentBId
    );

    boolean existsByStudentA_IdAndStudentB_Id(
            String studentAId,
            String studentBId
    );

    List<StudentFaceConflict>
    findAllByStatusOrderByCreatedAtDesc(
            StudentFaceConflictStatus status
    );
}