package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.dto.student.UpdateStudentRequest;
import com.example.attendancemanagementbackend.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(
            StudentService studentService
    ) {
        this.studentService = studentService;
    }

    /* =====================================================
       CREATE STUDENT
    ===================================================== */

    // Adviser registers a student
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse createStudent(
            @Valid @RequestBody CreateStudentRequest request
    ) {
        return studentService.createStudent(
                request
        );
    }

    /* =====================================================
       GET STUDENTS
    ===================================================== */

    // Adviser views students under their sections
    @GetMapping
    public List<StudentResponse> getMyStudents() {
        return studentService.getMyStudents();
    }

    /* =====================================================
       UPDATE STUDENT
    ===================================================== */

    /*
     * Adviser updates a student under
     * their assigned section.
     *
     * Editable fields:
     *
     * - studentNumber
     * - name
     *
     * Student section, face registration,
     * attendance history, and student ID
     * remain unchanged.
     */
    @PatchMapping("/{studentId}")
    public StudentResponse updateStudent(
            @PathVariable String studentId,
            @Valid @RequestBody UpdateStudentRequest request
    ) {

        return studentService.updateStudent(
                studentId,
                request
        );
    }

    /* =====================================================
       DEACTIVATE STUDENT
       SOFT DELETE
    ===================================================== */

    /*
     * This does NOT permanently delete
     * the student from the database.
     *
     * The student is only marked inactive
     * so historical attendance records and
     * face registration remain preserved.
     */
    @DeleteMapping("/{studentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(
            @PathVariable String studentId
    ) {

        studentService.deactivateStudent(
                studentId
        );
    }
}