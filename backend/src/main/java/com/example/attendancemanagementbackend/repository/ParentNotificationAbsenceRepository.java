package com.example.attendancemanagementbackend.repository;

import com.example.attendancemanagementbackend.entity.ParentNotificationAbsence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParentNotificationAbsenceRepository
        extends JpaRepository<
        ParentNotificationAbsence,
        String
        > {

    List<ParentNotificationAbsence>
    findByNotification_IdOrderByAttendanceDateAsc(
            String notificationId
    );

    boolean existsByNotification_IdAndAttendanceRecord_Id(
            String notificationId,
            String attendanceRecordId
    );
}