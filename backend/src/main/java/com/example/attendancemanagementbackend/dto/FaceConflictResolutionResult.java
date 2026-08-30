package com.example.attendancemanagementbackend.dto;

import com.example.attendancemanagementbackend.entity.StudentFaceConflictStatus;

import java.time.LocalDateTime;

public record FaceConflictResolutionResult(

        String conflictId,

        StudentFaceConflictStatus conflictStatus,

        String studentId,

        String conflictingStudentId,

        String conflictingStudentName,

        String verifiedByUserId,

        String verifiedByName,

        LocalDateTime verifiedAt

) {
}