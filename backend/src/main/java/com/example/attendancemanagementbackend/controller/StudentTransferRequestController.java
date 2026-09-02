package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.studenttransfer.CreateStudentTransferRequest;
import com.example.attendancemanagementbackend.dto.studenttransfer.ReviewStudentTransferRequest;
import com.example.attendancemanagementbackend.dto.studenttransfer.StudentTransferRequestResponse;
import com.example.attendancemanagementbackend.dto.studenttransfer.TransferSectionOptionResponse;
import com.example.attendancemanagementbackend.service.StudentTransferRequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student-transfer-requests")
public class StudentTransferRequestController {

    private final StudentTransferRequestService transferRequestService;

    public StudentTransferRequestController(
            StudentTransferRequestService transferRequestService
    ) {
        this.transferRequestService = transferRequestService;
    }

    /* =========================================================
       DESTINATION OPTIONS
    ========================================================= */

    @GetMapping("/students/{studentId}/eligible-sections")
    public List<TransferSectionOptionResponse> getEligibleSections(
            @PathVariable String studentId
    ) {
        return transferRequestService.getEligibleSections(
                studentId
        );
    }

    /* =========================================================
       CREATE REQUEST
    ========================================================= */

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentTransferRequestResponse createRequest(
            @Valid @RequestBody CreateStudentTransferRequest request
    ) {
        return transferRequestService.createRequest(
                request
        );
    }

    /* =========================================================
       REQUEST LISTS
    ========================================================= */

    @GetMapping("/outgoing")
    public List<StudentTransferRequestResponse> getOutgoingRequests() {
        return transferRequestService.getOutgoingRequests();
    }

    @GetMapping("/incoming")
    public List<StudentTransferRequestResponse> getIncomingRequests() {
        return transferRequestService.getIncomingRequests();
    }

    /*
     * Future notification bell can call this lightweight endpoint.
     */
    @GetMapping("/incoming/pending-count")
    public long getIncomingPendingCount() {
        return transferRequestService.getIncomingPendingCount();
    }

    /* =========================================================
       CANCEL

       Only the Adviser who created a still-PENDING request
       may cancel it. Cancellation restores the student to
       normal active attendance in the source section.
    ========================================================= */

    @PatchMapping("/{requestId}/cancel")
    public StudentTransferRequestResponse cancelRequest(
            @PathVariable String requestId
    ) {
        return transferRequestService.cancelRequest(
                requestId
        );
    }

    /* =========================================================
       DESTINATION ADVISER REVIEW
    ========================================================= */

    @PatchMapping("/{requestId}/approve")
    public StudentTransferRequestResponse approveRequest(
            @PathVariable String requestId,
            @Valid @RequestBody(required = false)
            ReviewStudentTransferRequest request
    ) {
        return transferRequestService.approveRequest(
                requestId,
                request
        );
    }

    @PatchMapping("/{requestId}/reject")
    public StudentTransferRequestResponse rejectRequest(
            @PathVariable String requestId,
            @Valid @RequestBody(required = false)
            ReviewStudentTransferRequest request
    ) {
        return transferRequestService.rejectRequest(
                requestId,
                request
        );
    }
}
