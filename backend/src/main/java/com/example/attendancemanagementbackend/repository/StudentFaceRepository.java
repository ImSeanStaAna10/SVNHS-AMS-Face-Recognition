package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.StudentFace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface StudentFaceRepository
        extends JpaRepository<StudentFace, String> {

    Optional<StudentFace> findByStudentId(String studentId);

    @Modifying
    @Query(value = """
            INSERT INTO student_faces (
                id,
                student_id,
                embedding,
                created_at,
                updated_at
            )
            VALUES (
                :id,
                :studentId,
                CAST(:embedding AS vector),
                :createdAt,
                :updatedAt
            )
            """, nativeQuery = true)
    void insertFaceEmbedding(
            @Param("id") String id,
            @Param("studentId") String studentId,
            @Param("embedding") String embedding,
            @Param("createdAt") LocalDateTime createdAt,
            @Param("updatedAt") LocalDateTime updatedAt
    );
}