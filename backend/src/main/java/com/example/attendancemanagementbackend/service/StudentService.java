package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
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