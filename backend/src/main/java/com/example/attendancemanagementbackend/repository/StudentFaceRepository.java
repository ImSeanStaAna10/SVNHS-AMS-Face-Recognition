package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.StudentFace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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

    @Modifying
    @Query(value = """
            UPDATE student_faces
            SET
                embedding = CAST(:embedding AS vector),
                updated_at = :updatedAt
            WHERE student_id = :studentId
            """, nativeQuery = true)
    int updateFaceEmbedding(
            @Param("studentId") String studentId,
            @Param("embedding") String embedding,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    /* =========================================================
       LEGACY GLOBAL ATTENDANCE MATCH
    ========================================================= */

    @Query(value = """
            SELECT
                student_id AS studentId,
                embedding <=> CAST(:embedding AS vector) AS distance
            FROM student_faces
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT 1
            """, nativeQuery = true)
    Optional<FaceMatchResult> findMostSimilarFace(
            @Param("embedding") String embedding
    );

    /* =========================================================
       SECTION-SCOPED TOP TWO MATCHES

       Attendance recognition only.

       Rules:
       - same Section as active attendance session
       - active students only
       - registered faces only
       - return the closest two candidates
    ========================================================= */

    @Query(value = """
            SELECT
                sf.student_id AS studentId,
                sf.embedding <=> CAST(:embedding AS vector) AS distance
            FROM student_faces sf
            INNER JOIN students s
                ON s.id = sf.student_id
            WHERE s.section_id = :sectionId
              AND s.active = true
            ORDER BY sf.embedding <=> CAST(:embedding AS vector)
            LIMIT 2
            """, nativeQuery = true)
    List<FaceMatchResult> findTopSimilarFacesBySection(
            @Param("embedding") String embedding,
            @Param("sectionId") String sectionId
    );

    /* =========================================================
       GLOBAL DUPLICATE FACE CHECK
    ========================================================= */

    @Query(value = """
            SELECT
                student_id AS studentId,
                embedding <=> CAST(:embedding AS vector) AS distance
            FROM student_faces
            WHERE student_id <> :studentId
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT 1
            """, nativeQuery = true)
    Optional<FaceMatchResult> findMostSimilarFaceExcludingStudent(
            @Param("embedding") String embedding,
            @Param("studentId") String studentId
    );
}