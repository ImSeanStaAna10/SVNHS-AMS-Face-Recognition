package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.dto.student.TransferStudentRequest;
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
       TRANSFER STUDENT SECTION
    ===================================================== */

    /*
     * Transfers an ACTIVE student to another ACTIVE section.
     *
     * IMPORTANT:
     * This Adviser endpoint only allows transfers between
     * sections assigned to the currently logged-in Adviser.
     *
     * Student ID, student number, face registration,
     * and historical attendance remain preserved.
     *
     * For cross-Adviser transfers, use a higher-level
     * Councilor-controlled workflow instead of weakening
     * this Adviser ownership rule.
     */
    @PatchMapping("/{studentId}/section")
    public StudentResponse transferStudentSection(
            @PathVariable String studentId,
            @Valid @RequestBody TransferStudentRequest request
    ) {
        return studentService.transferStudentSection(
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

    /* =====================================================
       REACTIVATE STUDENT
    ===================================================== */

    /*
     * Restores an inactive student to the active roster.
     *
     * Existing student ID, face registration, section,
     * and historical attendance remain unchanged.
     */
    @PatchMapping("/{studentId}/reactivate")
    public StudentResponse reactivateStudent(
            @PathVariable String studentId
    ) {
        return studentService.reactivateStudent(
                studentId
        );
    }
}
