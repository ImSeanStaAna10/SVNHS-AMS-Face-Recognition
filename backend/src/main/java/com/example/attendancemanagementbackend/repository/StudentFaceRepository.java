package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.StudentFace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface StudentFaceRepository
        extends JpaRepository<StudentFace, String> {

    /* =========================================================
       CHECK IF STUDENT HAS REGISTERED FACE
    ========================================================= */

    boolean existsByStudentId(String studentId);

    /* =========================================================
       INSERT NEW FACE
    ========================================================= */

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

    /* =========================================================
       UPDATE EXISTING FACE
    ========================================================= */

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
       FIND MOST SIMILAR FACE

       Used by normal attendance face recognition.
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
       FIND MOST SIMILAR FACE EXCLUDING CURRENT STUDENT

       Used when registering/updating a student's face.

       This prevents the student's OLD face from being
       detected as a duplicate of their NEW face.
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