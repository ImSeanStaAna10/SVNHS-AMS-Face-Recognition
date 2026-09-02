package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.studenttransfer.CreateStudentTransferRequest;
import com.example.attendancemanagementbackend.dto.studenttransfer.ReviewStudentTransferRequest;
import com.example.attendancemanagementbackend.dto.studenttransfer.StudentTransferRequestResponse;
import com.example.attendancemanagementbackend.dto.studenttransfer.TransferSectionOptionResponse;

import com.example.attendancemanagementbackend.entity.Department;
import com.example.attendancemanagementbackend.entity.NotificationReferenceType;
import com.example.attendancemanagementbackend.entity.NotificationType;
import com.example.attendancemanagementbackend.entity.Section;
import com.example.attendancemanagementbackend.entity.Student;
import com.example.attendancemanagementbackend.entity.StudentTransferRequest;
import com.example.attendancemanagementbackend.entity.StudentTransferRequestStatus;
import com.example.attendancemanagementbackend.entity.User;

import com.example.attendancemanagementbackend.exception.ApiException;

import com.example.attendancemanagementbackend.repository.SectionRepository;
import com.example.attendancemanagementbackend.repository.StudentRepository;
import com.example.attendancemanagementbackend.repository.StudentTransferRequestRepository;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.util.Comparator;
import java.util.List;

@Service
public class StudentTransferRequestService {

    /* =========================================================
       DEPENDENCIES
    ========================================================= */

    private final StudentRepository studentRepository;

    private final SectionRepository sectionRepository;

    private final StudentTransferRequestRepository transferRequestRepository;

    private final NotificationService notificationService;

    /* =========================================================
       CONSTRUCTOR
    ========================================================= */

    public StudentTransferRequestService(
            StudentRepository studentRepository,
            SectionRepository sectionRepository,
            StudentTransferRequestRepository transferRequestRepository,
            NotificationService notificationService
    ) {
        this.studentRepository =
                studentRepository;

        this.sectionRepository =
                sectionRepository;

        this.transferRequestRepository =
                transferRequestRepository;

        this.notificationService =
                notificationService;
    }

    /* =========================================================
       ELIGIBLE DESTINATION SECTIONS

       Adviser can request a transfer only for a student
       currently owned by one of their sections.

       Destination sections:
       - must be active
       - must have an Adviser
       - must be different from the current section
       - must belong to the SAME department
    ========================================================= */

    @Transactional(readOnly = true)
    public List<TransferSectionOptionResponse> getEligibleSections(
            String studentId
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        Student student =
                getOwnedStudent(
                        studentId,
                        adviserId
                );

        if (!student.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive. Reactivate the student before requesting a transfer."
            );
        }

        Section sourceSection =
                student.getSection();

        Department department =
                sourceSection.getDepartment();

        if (department == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "The student's current section is not assigned to a department"
            );
        }

        return sectionRepository
                .findAllByDepartment_Id(
                        department.getId()
                )
                .stream()
                .filter(
                        Section::isActive
                )
                .filter(
                        section ->
                                section.getAdviser() != null
                )
                .filter(
                        section ->
                                !section
                                        .getId()
                                        .equals(
                                                sourceSection.getId()
                                        )
                )
                .sorted(
                        Comparator.comparing(
                                Section::getName,
                                String.CASE_INSENSITIVE_ORDER
                        )
                )
                .map(
                        this::mapSectionOption
                )
                .toList();
    }

    /* =========================================================
       CREATE TRANSFER REQUEST

       IMPORTANT:
       Creating the request DOES NOT move the student.

       Student remains in source section until approval.

       Notification:
       Destination Adviser receives:
       STUDENT_TRANSFER_REQUESTED
    ========================================================= */

    @Transactional
    public StudentTransferRequestResponse createRequest(
            CreateStudentTransferRequest request
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        Student student =
                getOwnedStudent(
                        request.getStudentId(),
                        adviserId
                );

        if (!student.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is inactive. Reactivate the student before requesting a transfer."
            );
        }

        Section sourceSection =
                student.getSection();

        Section destinationSection =
                sectionRepository
                        .findById(
                                request.getDestinationSectionId()
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Destination section not found"
                                        )
                        );

        validateDestinationSection(
                sourceSection,
                destinationSection
        );

        /* =====================================================
           PREVENT DUPLICATE PENDING REQUEST
        ===================================================== */

        if (
                transferRequestRepository
                        .existsByStudent_IdAndStatus(
                                student.getId(),
                                StudentTransferRequestStatus.PENDING
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This student already has a pending transfer request"
            );
        }

        String reason =
                normalizeOptionalText(
                        request.getReason()
                );

        StudentTransferRequest transferRequest =
                new StudentTransferRequest(
                        student,
                        sourceSection,
                        destinationSection,
                        sourceSection.getAdviser(),
                        reason
                );

        /* =====================================================
           TEMPORARILY PAUSE STUDENT ATTENDANCE

           While transfer request is PENDING:

           active = false

           Existing attendance rules already exclude inactive
           students from:
           - manual attendance
           - face attendance
           - absence finalization

           UI can still identify this state as
           "Being Transferred" using the pending request.
        ===================================================== */

        LocalDateTime now =
                LocalDateTime.now();

        student.setActive(
                false
        );

        student.setUpdatedAt(
                now
        );

        studentRepository.save(
                student
        );

        /* =====================================================
           SAVE TRANSFER REQUEST FIRST

           We need its generated ID for the notification
           reference and deduplication key.
        ===================================================== */

        StudentTransferRequest savedRequest =
                transferRequestRepository.save(
                        transferRequest
                );

        /* =====================================================
           NOTIFY DESTINATION ADVISER
        ===================================================== */

        User destinationAdviser =
                destinationSection.getAdviser();

        if (destinationAdviser != null) {

            notificationService.createForUser(
                    destinationAdviser,

                    NotificationType.STUDENT_TRANSFER_REQUESTED,

                    "New student transfer request",

                    buildTransferRequestedMessage(
                            student,
                            sourceSection,
                            destinationSection
                    ),

                    NotificationReferenceType.STUDENT_TRANSFER,

                    savedRequest.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "requested"
                    )
            );
        }

        return mapResponse(
                savedRequest
        );
    }

    /* =========================================================
       OUTGOING REQUESTS

       Requests sent by the logged-in Adviser.
    ========================================================= */

    @Transactional(readOnly = true)
    public List<StudentTransferRequestResponse> getOutgoingRequests() {

        String adviserId =
                getAuthenticatedAdviserId();

        return transferRequestRepository
                .findByRequestedByAdviser_IdOrderByCreatedAtDesc(
                        adviserId
                )
                .stream()
                .map(
                        this::mapResponse
                )
                .toList();
    }

    /* =========================================================
       INCOMING REQUESTS
    ========================================================= */

    @Transactional(readOnly = true)
    public List<StudentTransferRequestResponse> getIncomingRequests() {

        String adviserId =
                getAuthenticatedAdviserId();

        return transferRequestRepository
                .findByDestinationSection_Adviser_IdOrderByCreatedAtDesc(
                        adviserId
                )
                .stream()
                .map(
                        this::mapResponse
                )
                .toList();
    }

    /* =========================================================
       INCOMING PENDING COUNT

       NOTE:
       This remains useful for the Transfers sidebar.

       Transfer pending count and notification unread count
       are intentionally different concepts.
    ========================================================= */

    @Transactional(readOnly = true)
    public long getIncomingPendingCount() {

        String adviserId =
                getAuthenticatedAdviserId();

        return transferRequestRepository
                .countByDestinationSection_Adviser_IdAndStatus(
                        adviserId,
                        StudentTransferRequestStatus.PENDING
                );
    }

    /* =========================================================
       APPROVE REQUEST

       Only destination Adviser can approve.

       Real section movement occurs here.

       Notifications:
       1. Original destination notification becomes READ.
       2. Source Adviser receives TRANSFER_APPROVED.
    ========================================================= */

    @Transactional
    public StudentTransferRequestResponse approveRequest(
            String requestId,
            ReviewStudentTransferRequest reviewRequest
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        StudentTransferRequest transferRequest =
                getPendingRequestForDestinationAdviser(
                        requestId,
                        adviserId
                );

        Student student =
                transferRequest.getStudent();

        Section originalSourceSection =
                transferRequest.getSourceSection();

        Section destinationSection =
                transferRequest.getDestinationSection();

        /* =====================================================
           VERIFY STUDENT STILL BELONGS TO ORIGINAL SOURCE
        ===================================================== */

        if (
                student.getSection() == null ||
                        !student
                                .getSection()
                                .getId()
                                .equals(
                                        originalSourceSection.getId()
                                )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is no longer in the original source section"
            );
        }

        validateDestinationSection(
                originalSourceSection,
                destinationSection
        );

        LocalDateTime now =
                LocalDateTime.now();

        /* =====================================================
           ACTUAL TRANSFER
        ===================================================== */

        student.setSection(
                destinationSection
        );

        student.setActive(
                true
        );

        student.setUpdatedAt(
                now
        );

        studentRepository.save(
                student
        );

        /* =====================================================
           RESOLVE REQUEST
        ===================================================== */

        transferRequest.setStatus(
                StudentTransferRequestStatus.APPROVED
        );

        transferRequest.setReviewedByAdviser(
                destinationSection.getAdviser()
        );

        transferRequest.setReviewedAt(
                now
        );

        transferRequest.setReviewNote(
                normalizeReviewNote(
                        reviewRequest
                )
        );

        StudentTransferRequest savedRequest =
                transferRequestRepository.save(
                        transferRequest
                );

        /* =====================================================
           ORIGINAL REQUEST NOTIFICATION → READ

           Even if Adviser approved directly from Transfers
           instead of clicking the notification first,
           the request notification should no longer remain
           unread.
        ===================================================== */

        User destinationAdviser =
                destinationSection.getAdviser();

        if (destinationAdviser != null) {

            notificationService.markBusinessEventRead(
                    destinationAdviser.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "requested"
                    )
            );
        }

        /* =====================================================
           NOTIFY SOURCE / REQUESTING ADVISER
        ===================================================== */

        User requestingAdviser =
                savedRequest.getRequestedByAdviser();

        if (requestingAdviser != null) {

            notificationService.createForUser(
                    requestingAdviser,

                    NotificationType.STUDENT_TRANSFER_APPROVED,

                    "Student transfer approved",

                    buildTransferApprovedMessage(
                            student,
                            destinationSection
                    ),

                    NotificationReferenceType.STUDENT_TRANSFER,

                    savedRequest.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "approved"
                    )
            );
        }

        return mapResponse(
                savedRequest
        );
    }

    /* =========================================================
       CANCEL REQUEST

       Only requesting Adviser can cancel.

       Cancellation:
       - keeps source section
       - restores active=true
       - resolves PENDING request

       Notifications:
       1. Original destination request notification → READ
       2. Destination Adviser receives CANCELLED notification
    ========================================================= */

    @Transactional
    public StudentTransferRequestResponse cancelRequest(
            String requestId
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        StudentTransferRequest transferRequest =
                transferRequestRepository
                        .findById(
                                requestId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Transfer request not found"
                                        )
                        );

        User requestedBy =
                transferRequest.getRequestedByAdviser();

        /* =====================================================
           OWNERSHIP
        ===================================================== */

        if (
                requestedBy == null ||
                        !requestedBy
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to cancel this transfer request"
            );
        }

        /* =====================================================
           MUST STILL BE PENDING
        ===================================================== */

        if (
                transferRequest.getStatus() !=
                        StudentTransferRequestStatus.PENDING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Only a pending transfer request can be cancelled"
            );
        }

        Student student =
                transferRequest.getStudent();

        Section sourceSection =
                transferRequest.getSourceSection();

        Section destinationSection =
                transferRequest.getDestinationSection();

        /* =====================================================
           SOURCE SECTION VALIDATION
        ===================================================== */

        if (
                student == null ||
                        sourceSection == null ||
                        student.getSection() == null ||
                        !student
                                .getSection()
                                .getId()
                                .equals(
                                        sourceSection.getId()
                                )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is no longer in the original source section"
            );
        }

        LocalDateTime now =
                LocalDateTime.now();

        /* =====================================================
           RESTORE STUDENT
        ===================================================== */

        student.setActive(
                true
        );

        student.setUpdatedAt(
                now
        );

        studentRepository.save(
                student
        );

        /* =====================================================
           RESOLVE REQUEST
        ===================================================== */

        transferRequest.setStatus(
                StudentTransferRequestStatus.CANCELLED
        );

        /*
         * Destination Adviser did not review this request,
         * therefore reviewedByAdviser intentionally remains null.
         *
         * reviewedAt acts as the resolution timestamp.
         */
        transferRequest.setReviewedAt(
                now
        );

        transferRequest.setReviewNote(
                "Cancelled by requesting Adviser"
        );

        StudentTransferRequest savedRequest =
                transferRequestRepository.save(
                        transferRequest
                );

        /* =====================================================
           DESTINATION ADVISER NOTIFICATIONS
        ===================================================== */

        User destinationAdviser =
                destinationSection != null
                        ? destinationSection.getAdviser()
                        : null;

        if (destinationAdviser != null) {

            /*
             * Original pending request is no longer actionable.
             */
            notificationService.markBusinessEventRead(
                    destinationAdviser.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "requested"
                    )
            );

            /*
             * Inform destination Adviser that the source
             * Adviser cancelled the request.
             */
            notificationService.createForUser(
                    destinationAdviser,

                    NotificationType.STUDENT_TRANSFER_CANCELLED,

                    "Student transfer cancelled",

                    buildTransferCancelledMessage(
                            student,
                            sourceSection,
                            destinationSection
                    ),

                    NotificationReferenceType.STUDENT_TRANSFER,

                    savedRequest.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "cancelled"
                    )
            );
        }

        return mapResponse(
                savedRequest
        );
    }

    /* =========================================================
       REJECT REQUEST

       Student remains in source section.

       Notifications:
       1. Original destination notification becomes READ.
       2. Requesting Adviser receives REJECTED notification.
    ========================================================= */

    @Transactional
    public StudentTransferRequestResponse rejectRequest(
            String requestId,
            ReviewStudentTransferRequest reviewRequest
    ) {

        String adviserId =
                getAuthenticatedAdviserId();

        StudentTransferRequest transferRequest =
                getPendingRequestForDestinationAdviser(
                        requestId,
                        adviserId
                );

        LocalDateTime now =
                LocalDateTime.now();

        Student student =
                transferRequest.getStudent();

        Section sourceSection =
                transferRequest.getSourceSection();

        Section destinationSection =
                transferRequest.getDestinationSection();

        /* =====================================================
           VERIFY SOURCE SECTION
        ===================================================== */

        if (
                student == null ||
                        sourceSection == null ||
                        student.getSection() == null ||
                        !student
                                .getSection()
                                .getId()
                                .equals(
                                        sourceSection.getId()
                                )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is no longer in the original source section"
            );
        }

        /* =====================================================
           RESTORE STUDENT
        ===================================================== */

        student.setActive(
                true
        );

        student.setUpdatedAt(
                now
        );

        studentRepository.save(
                student
        );

        /* =====================================================
           RESOLVE REQUEST
        ===================================================== */

        transferRequest.setStatus(
                StudentTransferRequestStatus.REJECTED
        );

        transferRequest.setReviewedByAdviser(
                destinationSection.getAdviser()
        );

        transferRequest.setReviewedAt(
                now
        );

        transferRequest.setReviewNote(
                normalizeReviewNote(
                        reviewRequest
                )
        );

        StudentTransferRequest savedRequest =
                transferRequestRepository.save(
                        transferRequest
                );

        /* =====================================================
           ORIGINAL REQUEST NOTIFICATION → READ
        ===================================================== */

        User destinationAdviser =
                destinationSection != null
                        ? destinationSection.getAdviser()
                        : null;

        if (destinationAdviser != null) {

            notificationService.markBusinessEventRead(
                    destinationAdviser.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "requested"
                    )
            );
        }

        /* =====================================================
           NOTIFY REQUESTING ADVISER
        ===================================================== */

        User requestingAdviser =
                savedRequest.getRequestedByAdviser();

        if (requestingAdviser != null) {

            notificationService.createForUser(
                    requestingAdviser,

                    NotificationType.STUDENT_TRANSFER_REJECTED,

                    "Student transfer rejected",

                    buildTransferRejectedMessage(
                            student,
                            destinationSection
                    ),

                    NotificationReferenceType.STUDENT_TRANSFER,

                    savedRequest.getId(),

                    buildTransferNotificationKey(
                            savedRequest.getId(),
                            "rejected"
                    )
            );
        }

        return mapResponse(
                savedRequest
        );
    }

    /* =========================================================
       GET PENDING REQUEST FOR DESTINATION ADVISER
    ========================================================= */

    private StudentTransferRequest getPendingRequestForDestinationAdviser(
            String requestId,
            String adviserId
    ) {

        StudentTransferRequest request =
                transferRequestRepository
                        .findById(
                                requestId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Transfer request not found"
                                        )
                        );

        Section destinationSection =
                request.getDestinationSection();

        if (
                destinationSection == null ||
                        destinationSection.getAdviser() == null ||
                        !destinationSection
                                .getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to review this transfer request"
            );
        }

        if (
                request.getStatus() !=
                        StudentTransferRequestStatus.PENDING
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This transfer request has already been resolved"
            );
        }

        return request;
    }

    /* =========================================================
       GET STUDENT OWNED BY ADVISER
    ========================================================= */

    private Student getOwnedStudent(
            String studentId,
            String adviserId
    ) {

        Student student =
                studentRepository
                        .findById(
                                studentId
                        )
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Student not found"
                                        )
                        );

        Section section =
                student.getSection();

        if (
                section == null ||
                        section.getAdviser() == null ||
                        !section
                                .getAdviser()
                                .getId()
                                .equals(
                                        adviserId
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "You are not allowed to manage this student"
            );
        }

        return student;
    }

    /* =========================================================
       DESTINATION VALIDATION
    ========================================================= */

    private void validateDestinationSection(
            Section sourceSection,
            Section destinationSection
    ) {

        if (sourceSection == null) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student does not have a valid source section"
            );
        }

        if (destinationSection == null) {

            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "Destination section not found"
            );
        }

        /* =====================================================
           CANNOT TRANSFER TO SAME SECTION
        ===================================================== */

        if (
                sourceSection
                        .getId()
                        .equals(
                                destinationSection.getId()
                        )
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student is already assigned to this section"
            );
        }

        /* =====================================================
           DESTINATION MUST BE ACTIVE
        ===================================================== */

        if (!destinationSection.isActive()) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Destination section is inactive"
            );
        }

        /* =====================================================
           DESTINATION MUST HAVE ADVISER
        ===================================================== */

        if (
                destinationSection.getAdviser() == null
        ) {

            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Destination section does not have an Adviser who can review the transfer"
            );
        }

        /* =====================================================
           SAME DEPARTMENT ONLY
        ===================================================== */

        Department sourceDepartment =
                sourceSection.getDepartment();

        Department destinationDepartment =
                destinationSection.getDepartment();

        if (
                sourceDepartment == null ||
                        destinationDepartment == null ||
                        !sourceDepartment
                                .getId()
                                .equals(
                                        destinationDepartment.getId()
                                )
        ) {

            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Student transfers are currently limited to sections within the same department"
            );
        }
    }

    /* =========================================================
       AUTHENTICATED ADVISER ID
    ========================================================= */

    private String getAuthenticatedAdviserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null ||
                        !authentication.isAuthenticated() ||
                        authentication.getName() == null ||
                        authentication
                                .getName()
                                .isBlank()
        ) {

            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required"
            );
        }

        return authentication.getName();
    }

    /* =========================================================
       OPTIONAL TEXT NORMALIZATION
    ========================================================= */

    private String normalizeOptionalText(
            String value
    ) {

        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    /* =========================================================
       REVIEW NOTE NORMALIZATION
    ========================================================= */

    private String normalizeReviewNote(
            ReviewStudentTransferRequest reviewRequest
    ) {

        if (reviewRequest == null) {
            return null;
        }

        return normalizeOptionalText(
                reviewRequest.getNote()
        );
    }

    /* =========================================================
       NOTIFICATION DEDUPLICATION KEY

       Examples:

       student-transfer:123:requested
       student-transfer:123:approved
       student-transfer:123:rejected
       student-transfer:123:cancelled
    ========================================================= */

    private String buildTransferNotificationKey(
            String requestId,
            String event
    ) {

        return "student-transfer:"
                + requestId
                + ":"
                + event;
    }

    /* =========================================================
       NOTIFICATION MESSAGE:
       REQUESTED
    ========================================================= */

    private String buildTransferRequestedMessage(
            Student student,
            Section sourceSection,
            Section destinationSection
    ) {

        String studentName =
                getSafeStudentName(
                        student
                );

        String sourceName =
                getSafeSectionName(
                        sourceSection,
                        "the source section"
                );

        String destinationName =
                getSafeSectionName(
                        destinationSection,
                        "your section"
                );

        return studentName
                + " has been requested for transfer from "
                + sourceName
                + " to "
                + destinationName
                + ".";
    }

    /* =========================================================
       NOTIFICATION MESSAGE:
       APPROVED
    ========================================================= */

    private String buildTransferApprovedMessage(
            Student student,
            Section destinationSection
    ) {

        String studentName =
                getSafeStudentName(
                        student
                );

        String destinationName =
                getSafeSectionName(
                        destinationSection,
                        "the destination section"
                );

        return studentName
                + "'s transfer to "
                + destinationName
                + " was approved.";
    }

    /* =========================================================
       NOTIFICATION MESSAGE:
       REJECTED
    ========================================================= */

    private String buildTransferRejectedMessage(
            Student student,
            Section destinationSection
    ) {

        String studentName =
                getSafeStudentName(
                        student
                );

        String destinationName =
                getSafeSectionName(
                        destinationSection,
                        "the destination section"
                );

        return studentName
                + "'s transfer request to "
                + destinationName
                + " was rejected.";
    }

    /* =========================================================
       NOTIFICATION MESSAGE:
       CANCELLED
    ========================================================= */

    private String buildTransferCancelledMessage(
            Student student,
            Section sourceSection,
            Section destinationSection
    ) {

        String studentName =
                getSafeStudentName(
                        student
                );

        String sourceName =
                getSafeSectionName(
                        sourceSection,
                        "the source section"
                );

        String destinationName =
                getSafeSectionName(
                        destinationSection,
                        "the destination section"
                );

        return studentName
                + "'s transfer request from "
                + sourceName
                + " to "
                + destinationName
                + " was cancelled by the requesting Adviser.";
    }

    /* =========================================================
       SAFE STUDENT NAME
    ========================================================= */

    private String getSafeStudentName(
            Student student
    ) {

        if (
                student == null ||
                        student.getName() == null ||
                        student
                                .getName()
                                .isBlank()
        ) {
            return "A student";
        }

        return student
                .getName()
                .trim();
    }

    /* =========================================================
       SAFE SECTION NAME
    ========================================================= */

    private String getSafeSectionName(
            Section section,
            String fallback
    ) {

        if (
                section == null ||
                        section.getName() == null ||
                        section
                                .getName()
                                .isBlank()
        ) {
            return fallback;
        }

        return section
                .getName()
                .trim();
    }

    /* =========================================================
       MAP SECTION OPTION
    ========================================================= */

    private TransferSectionOptionResponse mapSectionOption(
            Section section
    ) {

        User adviser =
                section.getAdviser();

        Department department =
                section.getDepartment();

        return new TransferSectionOptionResponse(
                section.getId(),

                section.getName(),

                adviser != null
                        ? adviser.getId()
                        : null,

                adviser != null
                        ? adviser.getName()
                        : null,

                department != null
                        ? department.getId()
                        : null,

                department != null
                        ? department.getCode()
                        : null,

                department != null
                        ? department.getName()
                        : null
        );
    }

    /* =========================================================
       MAP TRANSFER RESPONSE
    ========================================================= */

    private StudentTransferRequestResponse mapResponse(
            StudentTransferRequest request
    ) {

        Student student =
                request.getStudent();

        Section sourceSection =
                request.getSourceSection();

        Section destinationSection =
                request.getDestinationSection();

        User destinationAdviser =
                destinationSection != null
                        ? destinationSection.getAdviser()
                        : null;

        User requestedBy =
                request.getRequestedByAdviser();

        return new StudentTransferRequestResponse(
                request.getId(),

                request
                        .getStatus()
                        .name(),

                student != null
                        ? student.getId()
                        : null,

                student != null
                        ? student.getStudentNumber()
                        : null,

                student != null
                        ? student.getName()
                        : null,

                sourceSection != null
                        ? sourceSection.getId()
                        : null,

                sourceSection != null
                        ? sourceSection.getName()
                        : null,

                destinationSection != null
                        ? destinationSection.getId()
                        : null,

                destinationSection != null
                        ? destinationSection.getName()
                        : null,

                destinationAdviser != null
                        ? destinationAdviser.getId()
                        : null,

                destinationAdviser != null
                        ? destinationAdviser.getName()
                        : null,

                requestedBy != null
                        ? requestedBy.getId()
                        : null,

                requestedBy != null
                        ? requestedBy.getName()
                        : null,

                request.getReason(),

                request.getReviewNote(),

                request.getCreatedAt(),

                request.getReviewedAt()
        );
    }
}