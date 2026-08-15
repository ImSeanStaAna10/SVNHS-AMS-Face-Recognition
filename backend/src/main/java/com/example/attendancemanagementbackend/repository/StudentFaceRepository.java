package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.StudentFace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface StudentFaceRepository
        extends JpaRepository<StudentFace, String> {

    boolean existsByStudentId(String studentId);

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

    @Query(value = """
            SELECT
                student_id AS studentId,
                embedding <=> CAST(:embedding AS vector) AS distance
            FROM student_faces
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT 1
            """, nativeQuery = true)
    java.util.Optional<FaceMatchResult> findMostSimilarFace(
            @Param("embedding") String embedding
    );
}