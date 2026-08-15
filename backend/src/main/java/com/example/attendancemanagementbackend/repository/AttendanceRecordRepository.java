package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceRecordRepository
        extends JpaRepository<AttendanceRecord, String> {

    Optional<AttendanceRecord> findBySessionIdAndStudentId(
            String sessionId,
            String studentId
    );

    List<AttendanceRecord> findBySessionId(
            String sessionId
    );

    boolean existsBySessionIdAndStudentId(
            String sessionId,
            String studentId
    );
}