package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentResponse;
import com.example.attendancemanagementbackend.dto.student.TransferStudentRequest;
import com.example.attendancemanagementbackend.dto.student.UpdateStudentRequest;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentTransferRequestStatus;
import com.example.attendancemanagementbackend.exception.ApiException;
import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentFaceRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.repository.StudentTransferRequestRepository;
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
    private final StudentTransferRequestRepository
            studentTransferRequestRepository;

    public StudentService(
            StudentRepository studentRepository,
            SectionRepository sectionRepository,
            StudentFaceRepository studentFaceRepository,
            StudentTransferRequestRepository studentTransferRequestRepository
    ) {
        this.studentRepository = studentRepository;
        this.sectionRepository = sectionRepository;
        this.studentFaceRepository = studentFaceRepository;
        this.studentTransferRequestRepository =
                studentTransferRequestRepository;
    }

    /* =====================================================
       CREATE STUDENT
    ===================================================== */

    public StudentResponse createStudent(
            CreateStudentRequest request
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

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
        assertSectionOwnedByAdviser(
                section,
                adviserId
        );

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

        String studentNumber =
                request
                        .getStudentNumber()
                        .trim();

        String name =
                request
                        .getName()
                        .trim();

        /*
         * Student numbers must remain globally unique,
         * including inactive students.
         *
         * This prevents duplicate student identities.
         * Inactive students should be reactivated instead.
         */
        if (
                studentRepository
                        .existsByStudentNumber(
                                studentNumber
                        )
        ) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student number already exists"
            );
        }

        Student student =
                new Student(
                        studentNumber,
                        name,
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

        String adviserId =
                getAuthenticatedAdviserId();

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

        /*
         * Prevent editing an inactive student.
         *
         * Reactivate first, then edit normally.
         */
        if (!student.isActive()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive. Reactivate the student before editing."
            );
        }

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
       TRANSFER STUDENT SECTION
    ===================================================== */

    public StudentResponse transferStudentSection(
            String studentId,
            TransferStudentRequest request
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        Student student =
                getOwnedStudent(
                        studentId,
                        adviserId
                );

        /*
         * Keep the lifecycle explicit:
         * inactive students should be reactivated first.
         */
        if (!student.isActive()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive. Reactivate the student before transferring sections."
            );
        }

        String destinationSectionId =
                request
                        .getSectionId()
                        .trim();

        Section destinationSection =
                sectionRepository
                        .findById(
                                destinationSectionId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Destination section not found"
                                )
                        );

        /*
         * IMPORTANT SECURITY RULE:
         *
         * This StudentController is Adviser-scoped.
         * Therefore an Adviser may only transfer a student
         * into another section that is also assigned to
         * the same logged-in Adviser.
         *
         * Cross-Adviser transfers should be implemented
         * through a Councilor-controlled endpoint.
         */
        assertSectionOwnedByAdviser(
                destinationSection,
                adviserId
        );

        if (!destinationSection.isActive()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Destination section is inactive"
            );
        }

        Section currentSection =
                student.getSection();

        /*
         * Idempotent behavior:
         * requesting the current section again is safe.
         */
        if (
                currentSection != null &&
                        currentSection
                                .getId()
                                .equals(
                                        destinationSection.getId()
                                )
        ) {
            return mapToResponse(
                    student
            );
        }

        /*
         * Only the student's CURRENT section changes.
         *
         * We do not recreate the Student.
         * We do not modify the StudentFace.
         * We do not modify historical AttendanceRecord rows.
         * We do not change the Student ID or student number.
         */
        student.setSection(
                destinationSection
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
       REACTIVATE STUDENT
    ===================================================== */

    public StudentResponse reactivateStudent(
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
         * A student with a PENDING transfer is temporarily
         * operationally inactive for attendance.
         *
         * Do not allow the normal Reactivate endpoint to bypass
         * the transfer workflow. The destination Adviser must
         * approve or reject the pending request first.
         */
        if (
                studentTransferRequestRepository
                        .existsByStudent_IdAndStatus(
                                studentId,
                                StudentTransferRequestStatus.PENDING
                        )
        ) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student has a pending section transfer request"
            );
        }

        /*
         * Already active.
         *
         * Keep the operation idempotent.
         */
        if (student.isActive()) {
            return mapToResponse(
                    student
            );
        }

        Section section =
                student.getSection();

        if (section == null) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student does not have a valid section"
            );
        }

        /*
         * The student must not be restored into
         * an inactive section.
         */
        if (!section.isActive()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot reactivate student because the assigned section is inactive"
            );
        }

        /*
         * getOwnedStudent(...) already verifies that
         * this section belongs to the logged-in Adviser.
         *
         * Only the active flag is restored.
         * Student ID, face, section, and history stay intact.
         */
        student.setActive(
                true
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
       GET AUTHENTICATED ADVISER ID
    ===================================================== */

    private String getAuthenticatedAdviserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null ||
                        !authentication.isAuthenticated() ||
                        authentication.getName() == null
        ) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

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
        assertSectionOwnedByAdviser(
                section,
                adviserId
        );

        return student;
    }

    /* =====================================================
       VERIFY SECTION OWNERSHIP
    ===================================================== */

    private void assertSectionOwnedByAdviser(
            Section section,
            String adviserId
    ) {

        if (
                section == null ||
                        section.getAdviser() == null ||
                        section.getAdviser().getId() == null ||
                        !section.getAdviser()
                                .getId()
                                .equals(adviserId)
        ) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this section"
            );
        }
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

        Section section =
                student.getSection();

        return new StudentResponse(
                student.getId(),
                student.getStudentNumber(),
                student.getName(),
                section != null
                        ? section.getId()
                        : null,
                section != null
                        ? section.getName()
                        : null,
                student.isActive(),
                faceRegistered
        );
    }
}
