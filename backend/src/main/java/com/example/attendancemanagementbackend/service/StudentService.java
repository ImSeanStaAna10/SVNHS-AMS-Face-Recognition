package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final SectionRepository sectionRepository;

    public StudentService(
            StudentRepository studentRepository,
            SectionRepository sectionRepository
    ) {
        this.studentRepository = studentRepository;
        this.sectionRepository = sectionRepository;
    }

    // CREATE STUDENT
    public StudentResponse createStudent(
            CreateStudentRequest request
    ) {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String adviserId = authentication.getName();

        Section section = sectionRepository
                .findById(request.getSectionId())
                .orElseThrow(() ->
                        new RuntimeException("Section not found")
                );

        // Make sure this section belongs to the logged-in adviser
        if (!section.getAdviser().getId().equals(adviserId)) {
            throw new RuntimeException(
                    "You are not assigned to this section"
            );
        }

        if (!section.isActive()) {
            throw new RuntimeException(
                    "Section is inactive"
            );
        }

        if (studentRepository
                .existsByStudentNumber(request.getStudentNumber())) {

            throw new RuntimeException(
                    "Student number already exists"
            );
        }

        Student student = new Student(
                request.getStudentNumber(),
                request.getName(),
                section
        );

        Student savedStudent =
                studentRepository.save(student);

        return mapToResponse(savedStudent);
    }

    // GET STUDENTS FOR LOGGED-IN ADVISER
    public List<StudentResponse> getMyStudents() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String adviserId = authentication.getName();

        return studentRepository
                .findBySectionAdviserId(adviserId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    private StudentResponse mapToResponse(Student student) {

        return new StudentResponse(
                student.getId(),
                student.getStudentNumber(),
                student.getName(),
                student.getSection().getId(),
                student.getSection().getName(),
                student.isActive()
        );
    }
}