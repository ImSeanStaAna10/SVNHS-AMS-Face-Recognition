package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.StudentFaceRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
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

    /**
     * Enroll a student's face.
     */
    @Transactional
    public void enrollFace(
            String studentId,
            MultipartFile image
    ) throws IOException {

        // 1. Find student
        Student student =
                studentRepository.findById(studentId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        // 2. Validate image
        if (image == null || image.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        // 3. Check if student already has a registered face
        if (studentFaceRepository.existsByStudentId(studentId)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student already has a registered face"
            );
        }

        // 4. Send image to Python Face Recognition Service
        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient.enrollFace(
                        studentId,
                        image.getBytes(),
                        image.getOriginalFilename()
                );

        // 5. Validate Python response
        if (result == null ||
                !result.success() ||
                result.embedding() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face enrollment failed"
            );
        }

        // 6. Convert embedding to PostgreSQL vector format
        String embedding =
                toVectorString(
                        result.embedding()
                );

        // 7. Generate face ID
        String faceId =
                UUID.randomUUID().toString();

        LocalDateTime now =
                LocalDateTime.now();

        // 8. Insert embedding using native SQL
        studentFaceRepository.insertFaceEmbedding(
                faceId,
                student.getId(),
                embedding,
                now,
                now
        );
    }

    /**
     * Convert a 512-dimensional face embedding
     * into PostgreSQL pgvector format.
     */
    private String toVectorString(
            List<Double> embedding
    ) {

        if (embedding == null) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face embedding is null"
            );
        }

        if (embedding.size() != 512) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid face embedding. Expected 512 dimensions, got "
                            + embedding.size()
            );
        }

        return embedding.toString();
    }

    /**
     * Find the registered face with the smallest
     * cosine distance from the supplied embedding.
     */
    @Transactional(readOnly = true)
    public FaceMatchResult findMostSimilarFace(
            List<Double> embedding
    ) {

        // 1. Validate and convert embedding
        String vector =
                toVectorString(embedding);

        // 2. Find nearest registered face
        return studentFaceRepository
                .findMostSimilarFace(vector)
                .orElseThrow(() ->
                        new ApiException(
                                HttpStatus.NOT_FOUND,
                                "No registered face found"
                        )
                );
    }
}