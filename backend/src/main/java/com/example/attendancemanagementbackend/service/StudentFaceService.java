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

    /**
     * Cosine distance threshold used to determine
     * whether the supplied face is already registered.
     *
     * Lower distance = more similar.
     */
    private static final double FACE_DUPLICATE_THRESHOLD = 0.50;

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
     * Registers OR updates a student's face.
     *
     * Flow:
     *
     * 1. Find student
     * 2. Validate image
     * 3. Determine whether student already has a face
     * 4. Generate embedding using Python face service
     * 5. Validate embedding
     * 6. Check duplicate faces belonging to OTHER students
     * 7. UPDATE existing face or INSERT new face
     */
    @Transactional
    public void enrollFace(
            String studentId,
            MultipartFile image
    ) throws IOException {

        // =====================================================
        // 1. FIND STUDENT
        // =====================================================

        Student student =
                studentRepository.findById(studentId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        // =====================================================
        // 2. VALIDATE IMAGE
        // =====================================================

        if (image == null || image.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        // =====================================================
        // 3. CHECK WHETHER STUDENT ALREADY HAS A FACE
        //
        // IMPORTANT:
        // This is no longer an error.
        //
        // false = REGISTER
        // true  = UPDATE
        // =====================================================

        boolean alreadyRegistered =
                studentFaceRepository
                        .existsByStudentId(studentId);

        // =====================================================
        // 4. SEND IMAGE TO PYTHON FACE SERVICE
        // =====================================================

        FaceRecognitionClient.FaceEnrollmentResult result =
                faceRecognitionClient.enrollFace(
                        studentId,
                        image.getBytes(),
                        image.getOriginalFilename()
                );

        // =====================================================
        // 5. VALIDATE PYTHON RESPONSE
        // =====================================================

        if (result == null ||
                !result.success() ||
                result.embedding() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face enrollment failed"
            );
        }

        // =====================================================
        // 6. CONVERT EMBEDDING TO PGVECTOR FORMAT
        // =====================================================

        String embedding =
                toVectorString(
                        result.embedding()
                );

        // =====================================================
        // 7. CHECK DUPLICATE FACE
        //
        // IMPORTANT:
        // Exclude the current student.
        //
        // Otherwise, while updating a face,
        // the student's old face could be detected
        // as the nearest duplicate.
        // =====================================================

        studentFaceRepository
                .findMostSimilarFaceExcludingStudent(
                        embedding,
                        studentId
                )
                .ifPresent(match -> {

                    if (match.distance() <= FACE_DUPLICATE_THRESHOLD) {

                        throw new ApiException(
                                HttpStatus.CONFLICT,
                                "This face is already registered to another student"
                        );
                    }
                });

        // =====================================================
        // 8. CURRENT DATE/TIME
        // =====================================================

        LocalDateTime now =
                LocalDateTime.now();

        // =====================================================
        // 9. UPDATE EXISTING FACE
        // =====================================================

        if (alreadyRegistered) {

            int updatedRows =
                    studentFaceRepository
                            .updateFaceEmbedding(
                                    studentId,
                                    embedding,
                                    now
                            );

            if (updatedRows == 0) {
                throw new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Unable to update student face"
                );
            }

            return;
        }

        // =====================================================
        // 10. INSERT NEW FACE
        // =====================================================

        String faceId =
                UUID.randomUUID().toString();

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
     *
     * Used by attendance face recognition.
     */
    @Transactional(readOnly = true)
    public FaceMatchResult findMostSimilarFace(
            List<Double> embedding
    ) {

        // =====================================================
        // 1. VALIDATE AND CONVERT EMBEDDING
        // =====================================================

        String vector =
                toVectorString(embedding);

        // =====================================================
        // 2. FIND NEAREST REGISTERED FACE
        // =====================================================

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