package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.dto.student.UpdateStudentRequest;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentFaceRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final SectionRepository sectionRepository;
    private final StudentFaceRepository studentFaceRepository;

    public StudentService(
            StudentRepository studentRepository,
            SectionRepository sectionRepository,
            StudentFaceRepository studentFaceRepository
    ) {
        this.studentRepository = studentRepository;
        this.sectionRepository = sectionRepository;
        this.studentFaceRepository = studentFaceRepository;
    }

    /* =====================================================
       CREATE STUDENT
    ===================================================== */

    public StudentResponse createStudent(
            CreateStudentRequest request
    ) {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String adviserId =
                authentication.getName();

        Section section =
                sectionRepository
                        .findById(
                                request.getSectionId()
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Section not found"
                                )
                        );

        /*
         * Make sure this section belongs
         * to the logged-in adviser.
         */
        if (
                section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(adviserId)
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not assigned to this section"
            );
        }

        /*
         * Prevent students from being
         * created inside inactive sections.
         */
        if (!section.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Section is inactive"
            );
        }

        /*
         * Student numbers must be unique.
         */
        if (
                studentRepository
                        .existsByStudentNumber(
                                request.getStudentNumber()
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student number already exists"
            );
        }

        Student student =
                new Student(
                        request.getStudentNumber(),
                        request.getName(),
                        section
                );

        Student savedStudent =
                studentRepository.save(
                        student
                );

        return mapToResponse(
                savedStudent
        );
    }

    /* =====================================================
       GET STUDENTS FOR LOGGED-IN ADVISER
    ===================================================== */

    public List<StudentResponse> getMyStudents() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String adviserId =
                authentication.getName();

        return studentRepository
                .findBySectionAdviserId(
                        adviserId
                )
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    /* =====================================================
       UPDATE STUDENT
    ===================================================== */

    public StudentResponse updateStudent(
            String studentId,
            UpdateStudentRequest request
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        Student student =
                getOwnedStudent(
                        studentId,
                        adviserId
                );

        String studentNumber =
                request
                        .getStudentNumber()
                        .trim();

        String name =
                request
                        .getName()
                        .trim();

        /*
         * Student numbers must remain unique.
         *
         * The current student is excluded from
         * the duplicate check so keeping the
         * same student number is allowed.
         */
        if (
                studentRepository
                        .existsByStudentNumberAndIdNot(
                                studentNumber,
                                studentId
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student number already exists"
            );
        }

        /*
         * Only editable student information
         * is changed here.
         *
         * Student ID, section, face record,
         * and attendance history are preserved.
         */
        student.setStudentNumber(
                studentNumber
        );

        student.setName(
                name
        );

        student.setUpdatedAt(
                LocalDateTime.now()
        );

        Student savedStudent =
                studentRepository.save(
                        student
                );

        return mapToResponse(
                savedStudent
        );
    }

    /* =====================================================
       DEACTIVATE STUDENT
       SOFT DELETE
    ===================================================== */

    public void deactivateStudent(
            String studentId
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        Student student =
                getOwnedStudent(
                        studentId,
                        adviserId
                );

        /*
         * Student is already inactive.
         *
         * Nothing else needs to be changed.
         */
        if (!student.isActive()) {
            return;
        }

        /*
         * IMPORTANT:
         *
         * This is intentionally a soft delete.
         *
         * We DO NOT call:
         *
         * studentRepository.delete(...)
         *
         * The Student row remains in the database
         * so existing attendance records and the
         * registered face remain intact.
         */
        student.setActive(
                false
        );

        student.setUpdatedAt(
                LocalDateTime.now()
        );

        studentRepository.save(
                student
        );
    }

    /* =====================================================
       GET AUTHENTICATED ADVISER ID
    ===================================================== */

    private String getAuthenticatedAdviserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        return authentication.getName();
    }

    /* =====================================================
       GET STUDENT OWNED BY LOGGED-IN ADVISER
    ===================================================== */

    private Student getOwnedStudent(
            String studentId,
            String adviserId
    ) {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Student not found"
                                )
                        );

        Section section =
                student.getSection();

        /*
         * Prevent one adviser from modifying
         * another adviser's student.
         */
        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(adviserId)
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this student"
            );
        }

        return student;
    }

    /* =====================================================
       MAP STUDENT ENTITY TO RESPONSE
    ===================================================== */

    private StudentResponse mapToResponse(
            Student student
    ) {

        boolean faceRegistered =
                studentFaceRepository
                        .existsByStudentId(
                                student.getId()
                        );

        return new StudentResponse(
                student.getId(),
                student.getStudentNumber(),
                student.getName(),
                student.getSection().getId(),
                student.getSection().getName(),
                student.isActive(),
                faceRegistered
        );
    }
}