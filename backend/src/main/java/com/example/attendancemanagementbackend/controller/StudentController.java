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
        this.studentService =
                studentService;
    }

    /* =====================================================
       CREATE STUDENT
    ===================================================== */

    /*
     * Adviser registers a new student.
     *
     * Supported information:
     *
     * - student number
     * - student name
     * - section
     * - optional primary guardian information
     *
     * Guardian information is optional so existing
     * student creation requests remain compatible.
     */
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

    /*
     * Adviser views students belonging to
     * sections assigned to the logged-in Adviser.
     *
     * Student responses may include the current
     * active primary guardian when available.
     */
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
     * - optional primary guardian information
     *
     * Guardian behavior:
     *
     * - guardian omitted:
     *   existing guardian remains unchanged
     *
     * - guardian supplied:
     *   existing primary guardian is updated,
     *   or created when none exists
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
     *
     * This Adviser endpoint only allows transfers between
     * sections assigned to the currently logged-in Adviser.
     *
     * Preserved:
     *
     * - student ID
     * - student number
     * - face registration
     * - guardian information
     * - historical attendance
     *
     * For cross-Adviser transfers, use the existing
     * Councilor-controlled transfer workflow instead
     * of weakening Adviser ownership rules.
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
     * The student is only marked inactive.
     *
     * Preserved:
     *
     * - student identity
     * - guardian information
     * - face registration
     * - attendance history
     * - transfer history
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
     * Existing student ID, guardian information,
     * face registration, section, and historical
     * attendance remain unchanged.
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