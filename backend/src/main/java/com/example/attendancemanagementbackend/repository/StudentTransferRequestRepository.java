package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.StudentTransferRequest;
import com.example.attendancemanagementbackend.entity.StudentTransferRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentTransferRequestRepository
        extends JpaRepository<StudentTransferRequest, String> {

    boolean existsByStudent_IdAndStatus(
            String studentId,
            StudentTransferRequestStatus status
    );

    List<StudentTransferRequest>
    findByRequestedByAdviser_IdOrderByCreatedAtDesc(
            String adviserId
    );

    List<StudentTransferRequest>
    findByDestinationSection_Adviser_IdOrderByCreatedAtDesc(
            String adviserId
    );

    long countByDestinationSection_Adviser_IdAndStatus(
            String adviserId,
            StudentTransferRequestStatus status
    );
}
