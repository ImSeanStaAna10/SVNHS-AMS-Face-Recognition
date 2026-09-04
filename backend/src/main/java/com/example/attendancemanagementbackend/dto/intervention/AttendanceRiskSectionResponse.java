package com.example.attendancemanagementbackend.dto.intervention;

import java.time.LocalDate;
import java.util.List;

public class AttendanceRiskSectionResponse {

    private final String sectionId;

    private final String sectionName;

    private final boolean interventionEnabled;

    private final LocalDate periodStart;

    private final LocalDate periodEnd;

    private final int warningAbsenceCount;

    private final int atRiskAbsenceCount;

    private final int criticalAbsenceCount;

    private final long totalStudents;

    private final long normalCount;

    private final long warningCount;

    private final long atRiskCount;

    private final long criticalCount;

    private final List<StudentAttendanceRiskResponse> students;

    public AttendanceRiskSectionResponse(
            String sectionId,
            String sectionName,
            boolean interventionEnabled,
            LocalDate periodStart,
            LocalDate periodEnd,
            int warningAbsenceCount,
            int atRiskAbsenceCount,
            int criticalAbsenceCount,
            long totalStudents,
            long normalCount,
            long warningCount,
            long atRiskCount,
            long criticalCount,
            List<StudentAttendanceRiskResponse> students
    ) {
        this.sectionId =
                sectionId;

        this.sectionName =
                sectionName;

        this.interventionEnabled =
                interventionEnabled;

        this.periodStart =
                periodStart;

        this.periodEnd =
                periodEnd;

        this.warningAbsenceCount =
                warningAbsenceCount;

        this.atRiskAbsenceCount =
                atRiskAbsenceCount;

        this.criticalAbsenceCount =
                criticalAbsenceCount;

        this.totalStudents =
                totalStudents;

        this.normalCount =
                normalCount;

        this.warningCount =
                warningCount;

        this.atRiskCount =
                atRiskCount;

        this.criticalCount =
                criticalCount;

        this.students =
                students;
    }

    public String getSectionId() {
        return sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public boolean isInterventionEnabled() {
        return interventionEnabled;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public int getWarningAbsenceCount() {
        return warningAbsenceCount;
    }

    public int getAtRiskAbsenceCount() {
        return atRiskAbsenceCount;
    }

    public int getCriticalAbsenceCount() {
        return criticalAbsenceCount;
    }

    public long getTotalStudents() {
        return totalStudents;
    }

    public long getNormalCount() {
        return normalCount;
    }

    public long getWarningCount() {
        return warningCount;
    }

    public long getAtRiskCount() {
        return atRiskCount;
    }

    public long getCriticalCount() {
        return criticalCount;
    }

    public List<StudentAttendanceRiskResponse> getStudents() {
        return students;
    }
}