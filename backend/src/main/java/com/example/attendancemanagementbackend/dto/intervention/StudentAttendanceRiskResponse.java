package com.example.attendancemanagementbackend.dto.intervention;

import com.example.attendancemanagementbackend.dto.student.StudentGuardianResponse;
import com.example.attendancemanagementbackend.entity.AttendanceInterventionStatus;
import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;

public class StudentAttendanceRiskResponse {

    private final String studentId;

    private final String studentNumber;

    private final String studentName;

    private final long sessionCount;

    private final long presentCount;

    private final long lateCount;

    private final long absentCount;

    private final long totalRecords;

    private final AttendanceRiskLevel riskLevel;

    private final String interventionId;

    private final AttendanceInterventionStatus interventionStatus;

    private final StudentGuardianResponse guardian;

    /* =====================================================
       FULL CONSTRUCTOR
    ===================================================== */

    public StudentAttendanceRiskResponse(
            String studentId,
            String studentNumber,
            String studentName,
            long sessionCount,
            long presentCount,
            long lateCount,
            long absentCount,
            long totalRecords,
            AttendanceRiskLevel riskLevel,
            String interventionId,
            AttendanceInterventionStatus interventionStatus,
            StudentGuardianResponse guardian
    ) {
        this.studentId =
                studentId;

        this.studentNumber =
                studentNumber;

        this.studentName =
                studentName;

        this.sessionCount =
                sessionCount;

        this.presentCount =
                presentCount;

        this.lateCount =
                lateCount;

        this.absentCount =
                absentCount;

        this.totalRecords =
                totalRecords;

        this.riskLevel =
                riskLevel;

        this.interventionId =
                interventionId;

        this.interventionStatus =
                interventionStatus;

        this.guardian =
                guardian;
    }

    /* =====================================================
       LEGACY CONSTRUCTOR

       Keeps existing callers compatible.
    ===================================================== */

    public StudentAttendanceRiskResponse(
            String studentId,
            String studentNumber,
            String studentName,
            long sessionCount,
            long presentCount,
            long lateCount,
            long absentCount,
            long totalRecords,
            AttendanceRiskLevel riskLevel,
            StudentGuardianResponse guardian
    ) {
        this(
                studentId,
                studentNumber,
                studentName,
                sessionCount,
                presentCount,
                lateCount,
                absentCount,
                totalRecords,
                riskLevel,
                null,
                null,
                guardian
        );
    }

    /* =====================================================
       GETTERS
    ===================================================== */

    public String getStudentId() {
        return studentId;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public String getStudentName() {
        return studentName;
    }

    public long getSessionCount() {
        return sessionCount;
    }

    public long getPresentCount() {
        return presentCount;
    }

    public long getLateCount() {
        return lateCount;
    }

    public long getAbsentCount() {
        return absentCount;
    }

    public long getTotalRecords() {
        return totalRecords;
    }

    public AttendanceRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public String getInterventionId() {
        return interventionId;
    }

    public AttendanceInterventionStatus getInterventionStatus() {
        return interventionStatus;
    }

    public StudentGuardianResponse getGuardian() {
        return guardian;
    }
}