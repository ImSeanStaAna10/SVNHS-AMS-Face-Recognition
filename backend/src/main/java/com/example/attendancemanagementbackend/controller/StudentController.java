package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    // Adviser registers a student
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse createStudent(
            @Valid @RequestBody CreateStudentRequest request
    ) {
        return studentService.createStudent(request);
    }

    // Adviser views students under their sections
    @GetMapping
    public List<StudentResponse> getMyStudents() {
        return studentService.getMyStudents();
    }
}