package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.student.CreateStudentRequest;
import com.example.attendancemanagementbackend.dto.student.StudentGuardianResponse;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class StudentService {

    private final StudentRepository studentRepository;

    private final SectionRepository sectionRepository;

    private final StudentFaceRepository
            studentFaceRepository;

    private final StudentTransferRequestRepository
            studentTransferRequestRepository;

    private final StudentGuardianService
            studentGuardianService;

    public StudentService(
            StudentRepository studentRepository,
            SectionRepository sectionRepository,
            StudentFaceRepository studentFaceRepository,
            StudentTransferRequestRepository studentTransferRequestRepository,
            StudentGuardianService studentGuardianService
    ) {
        this.studentRepository =
                studentRepository;

        this.sectionRepository =
                sectionRepository;

        this.studentFaceRepository =
                studentFaceRepository;

        this.studentTransferRequestRepository =
                studentTransferRequestRepository;

        this.studentGuardianService =
                studentGuardianService;
    }

    /* =====================================================
       CREATE STUDENT
    ===================================================== */

    @Transactional
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

        /*
         * Guardian is optional.
         *
         * Existing student creation requests without
         * guardian information continue to work.
         *
         * Because this method is @Transactional,
         * Student + Guardian are saved atomically.
         */
        StudentGuardianResponse guardian =
                null;

        if (
                request.getGuardian() !=
                        null
        ) {
            guardian =
                    studentGuardianService
                            .createPrimaryGuardian(
                                    savedStudent,
                                    request.getGuardian()
                            );
        }

        return mapToResponse(
                savedStudent,
                guardian
        );
    }

    /* =====================================================
       GET STUDENTS FOR LOGGED-IN ADVISER
    ===================================================== */

    @Transactional(readOnly = true)
    public List<StudentResponse> getMyStudents() {

        String adviserId =
                getAuthenticatedAdviserId();

        List<Student> students =
                studentRepository
                        .findBySectionAdviserId(
                                adviserId
                        );

        if (students.isEmpty()) {
            return List.of();
        }

        /*
         * Load all primary guardians in one query.
         *
         * This avoids introducing an additional N+1
         * guardian query problem on Student Management.
         */
        List<String> studentIds =
                students
                        .stream()
                        .map(
                                Student::getId
                        )
                        .toList();

        Map<String, StudentGuardianResponse>
                guardianByStudentId =
                studentGuardianService
                        .getPrimaryGuardians(
                                studentIds
                        );

        return students
                .stream()
                .map(student ->
                        mapToResponse(
                                student,
                                guardianByStudentId
                                        .get(
                                                student.getId()
                                        )
                        )
                )
                .toList();
    }

    /* =====================================================
       UPDATE STUDENT
    ===================================================== */

    @Transactional
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
         * Student ID, section, face record,
         * and attendance history remain preserved.
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

        /*
         * guardian == null means:
         *
         * KEEP the current guardian unchanged.
         *
         * A supplied guardian object means:
         *
         * CREATE a primary guardian if missing,
         * otherwise UPDATE the current primary guardian.
         */
        StudentGuardianResponse guardian;

        if (
                request.getGuardian() !=
                        null
        ) {
            guardian =
                    studentGuardianService
                            .upsertPrimaryGuardian(
                                    savedStudent,
                                    request.getGuardian()
                            );
        } else {
            guardian =
                    studentGuardianService
                            .getPrimaryGuardian(
                                    savedStudent.getId()
                            );
        }

        return mapToResponse(
                savedStudent,
                guardian
        );
    }

    /* =====================================================
       TRANSFER STUDENT SECTION
    ===================================================== */

    @Transactional
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
         * Guardian information is also preserved.
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

    @Transactional
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
         */
        if (!student.isActive()) {
            return;
        }

        /*
         * IMPORTANT:
         *
         * This remains a soft delete.
         *
         * Student guardian information is also preserved.
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

    @Transactional
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
         * the transfer workflow.
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
         * Guardian information, Student ID, face,
         * section, and history stay intact.
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
                                .equals(
                                        adviserId
                                )
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

        StudentGuardianResponse guardian =
                studentGuardianService
                        .getPrimaryGuardian(
                                student.getId()
                        );

        return mapToResponse(
                student,
                guardian
        );
    }

    /* =====================================================
       MAP STUDENT + PRELOADED GUARDIAN
    ===================================================== */

    private StudentResponse mapToResponse(
            Student student,
            StudentGuardianResponse guardian
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
                faceRegistered,
                guardian
        );
    }
}