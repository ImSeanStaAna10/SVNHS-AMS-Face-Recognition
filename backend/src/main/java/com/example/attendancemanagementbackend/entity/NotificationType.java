package com.example.attendancemanagementbackend.entity;

public enum NotificationType {

    /* =========================================================
       STUDENT TRANSFERS
    ========================================================= */

    STUDENT_TRANSFER_REQUESTED,
    STUDENT_TRANSFER_APPROVED,
    STUDENT_TRANSFER_REJECTED,
    STUDENT_TRANSFER_CANCELLED,

    /* =========================================================
       ATTENDANCE REPORTS
    ========================================================= */

    WEEKLY_REPORT_READY,
    MONTHLY_REPORT_READY,
    REPORT_GENERATION_FAILED,

    /* =========================================================
       ATTENDANCE
    ========================================================= */

    ATTENDANCE_SESSION_AUTO_ENDED,

    /* =========================================================
       FACE / MANUAL REVIEW
    ========================================================= */

    FACE_CONFLICT_REVIEW_REQUIRED,

    /* =========================================================
       ACCOUNT
    ========================================================= */

    ACCOUNT_PASSWORD_RESET,

    /* =========================================================
       GENERIC SYSTEM
    ========================================================= */

    SYSTEM_NOTICE
}