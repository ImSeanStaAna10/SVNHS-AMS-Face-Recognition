package com.example.attendancemanagementbackend.entity;

import com.pgvector.PGvector;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.SQLException;
import java.time.LocalDateTime;

@Entity
@Table(name = "student_faces")
public class StudentFace {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "student_id",
            nullable = false,
            unique = true
    )
    private Student student;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Column(
            name = "embedding",
            columnDefinition = "vector(512)",
            nullable = false
    )
    private PGvector embedding;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public StudentFace() {
    }

    public StudentFace(
            Student student,
            String embedding
    ) throws SQLException {

        this.student = student;
        this.embedding = new PGvector(embedding);
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public PGvector getEmbedding() {
        return embedding;
    }

    public void setEmbedding(PGvector embedding) {
        this.embedding = embedding;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}