package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.repository.StudentFaceRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class StudentFaceService {

    private final StudentRepository studentRepository;
    private final StudentFaceRepository studentFaceRepository;
    private final FaceRecognitionClient faceRecognitionClient;

    public StudentFaceService(
            StudentRepository studentRepository,
            StudentFaceRepository studentFaceRepository,
            FaceRecognitionClient faceRecognitionClient
    ) {
        this.studentRepository = studentRepository;
        this.studentFaceRepository = studentFaceRepository;
        this.faceRecognitionClient = faceRecognitionClient;
    }

    @Transactional
    public void enrollFace(
            String studentId,
            MultipartFile image
    ) throws IOException {

        // 1. Find student
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() ->
                        new RuntimeException("Student not found")
                );

        // 2. Check if student already has a registered face
        if (studentFaceRepository
                .findByStudentId(studentId)
                .isPresent()) {

            throw new RuntimeException(
                    "Student already has a registered face"
            );
        }

        // 3. Send image to Python Face Recognition Service
        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient.enrollFace(
                        studentId,
                        image.getBytes(),
                        image.getOriginalFilename()
                );

        // 4. Validate Python response
        if (result == null || !result.success()) {
            throw new RuntimeException(
                    "Face enrollment failed"
            );
        }

        // 5. Convert embedding to PostgreSQL vector format
        String embedding = toVectorString(
                result.embedding()
        );

        // 6. Generate ID
        String faceId = UUID.randomUUID().toString();

        // 7. Insert embedding using native SQL
        studentFaceRepository.insertFaceEmbedding(
                faceId,
                studentId,
                embedding,
                java.time.LocalDateTime.now(),
                java.time.LocalDateTime.now()
        );
    }

    private String toVectorString(
            List<Double> embedding
    ) {

        if (embedding == null) {
            throw new RuntimeException(
                    "Face embedding is null"
            );
        }

        if (embedding.size() != 512) {
            throw new RuntimeException(
                    "Invalid face embedding. Expected 512 dimensions, got "
                            + embedding.size()
            );
        }

        return embedding.toString();
    }
}