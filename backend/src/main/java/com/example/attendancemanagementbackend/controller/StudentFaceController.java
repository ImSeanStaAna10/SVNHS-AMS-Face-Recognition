package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.service.StudentFaceService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
public class StudentFaceController {

    private final StudentFaceService studentFaceService;

    public StudentFaceController(
            StudentFaceService studentFaceService
    ) {
        this.studentFaceService = studentFaceService;
    }

    @PostMapping(
            value = "/{studentId}/face",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> enrollFace(
            @PathVariable String studentId,
            @RequestParam("image") MultipartFile image
    ) throws IOException {

        studentFaceService.enrollFace(
                studentId,
                image
        );

        return ResponseEntity.ok(
                Map.of(
                        "success", true,
                        "message", "Face enrolled successfully",
                        "studentId", studentId
                )
        );
    }
}