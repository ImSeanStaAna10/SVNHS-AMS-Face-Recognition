package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.FaceMatchResult;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.service.FaceRecognitionClient;
import com.example.attendancemanagementbackend.service.StudentFaceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/face-test")
public class FaceRecognitionTestController {

    private static final double FACE_MATCH_THRESHOLD = 0.50;

    private final FaceRecognitionClient faceRecognitionClient;
    private final StudentFaceService studentFaceService;

    public FaceRecognitionTestController(
            FaceRecognitionClient faceRecognitionClient,
            StudentFaceService studentFaceService
    ) {
        this.faceRecognitionClient = faceRecognitionClient;
        this.studentFaceService = studentFaceService;
    }

    @PostMapping(
            value = "/recognize",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> recognize(
            @RequestParam MultipartFile image
    ) throws IOException {

        // 1. Validate image
        if (image == null || image.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Image is required"
            );
        }

        // 2. Send image to Python Face Recognition Service
        FaceRecognitionClient.FaceRecognitionResult result =
                faceRecognitionClient.recognizeFace(
                        image.getBytes(),
                        image.getOriginalFilename()
                );

        // 3. Validate Python response
        if (result == null ||
                !result.success() ||
                result.embedding() == null) {

            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Face recognition failed"
            );
        }

        // 4. Find nearest registered face
        FaceMatchResult match =
                studentFaceService.findMostSimilarFace(
                        result.embedding()
                );

        // 5. Check threshold
        boolean recognized =
                match.distance() <= FACE_MATCH_THRESHOLD;

        // 6. Return test result
        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "recognized", recognized,
                        "studentId",
                        recognized
                                ? match.studentId()
                                : "",
                        "distance", match.distance()
                )
        );
    }
}