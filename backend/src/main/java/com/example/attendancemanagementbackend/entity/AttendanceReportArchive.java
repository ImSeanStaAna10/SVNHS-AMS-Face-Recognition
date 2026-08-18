package com.example.attendancemanagementbackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "attendance_report_archives",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_attendance_report_section_type_period",
                        columnNames = {
                                "section_id",
                                "report_type",
                                "period_start",
                                "period_end"
                        }
                )
        }
)
public class AttendanceReportArchive {

    /* =====================================================
       ID
    ===================================================== */

    @Id
    @GeneratedValue
    private UUID id;

    /* =====================================================
       SECTION SNAPSHOT
    ===================================================== */

    @Column(
            name = "section_id",
            nullable = false,
            length = 64
    )
    private String sectionId;

    @Column(
            name = "section_name",
            nullable = false,
            length = 150
    )
    private String sectionName;

    @Column(
            name = "adviser_id",
            length = 64
    )
    private String adviserId;

    @Column(
            name = "adviser_name",
            length = 150
    )
    private String adviserName;

    /* =====================================================
       REPORT TYPE
    ===================================================== */

    @Enumerated(EnumType.STRING)
    @Column(
            name = "report_type",
            nullable = false,
            length = 20
    )
    private AttendanceReportType reportType;

    /* =====================================================
       REPORT PERIOD
    ===================================================== */

    @Column(
            name = "period_start",
            nullable = false
    )
    private LocalDate periodStart;

    @Column(
            name = "period_end",
            nullable = false
    )
    private LocalDate periodEnd;

    /* =====================================================
       SUMMARY SNAPSHOT
    ===================================================== */

    @Column(
            name = "student_count",
            nullable = false
    )
    private int studentCount;

    @Column(
            name = "session_count",
            nullable = false
    )
    private int sessionCount;

    @Column(
            name = "present_count",
            nullable = false
    )
    private int presentCount;

    @Column(
            name = "late_count",
            nullable = false
    )
    private int lateCount;

    @Column(
            name = "absent_count",
            nullable = false
    )
    private int absentCount;

    @Column(
            name = "attendance_rate",
            nullable = false,
            precision = 6,
            scale = 2
    )
    private BigDecimal attendanceRate = BigDecimal.ZERO;

    /* =====================================================
       PDF FILE
    ===================================================== */

    @Column(
            name = "pdf_file_name",
            nullable = false,
            length = 255
    )
    private String pdfFileName;

    /*
     * Relative path only.
     *
     * Example:
     *
     * 2026/weekly/2026-08-17_to_2026-08-21/STEM_11-A/report.pdf
     *
     * We deliberately do not store an absolute machine path
     * such as C:/... or /home/... so deployment can move the
     * storage root without changing database records.
     */
    @Column(
            name = "pdf_relative_path",
            nullable = false,
            length = 1000
    )
    private String pdfRelativePath;

    /* =====================================================
       EXCEL FILE
    ===================================================== */

    @Column(
            name = "excel_file_name",
            nullable = false,
            length = 255
    )
    private String excelFileName;

    @Column(
            name = "excel_relative_path",
            nullable = false,
            length = 1000
    )
    private String excelRelativePath;

    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    @Column(
            name = "generated_at",
            nullable = false
    )
    private LocalDateTime generatedAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private LocalDateTime updatedAt;

    /* =====================================================
       JPA CALLBACKS
    ===================================================== */

    @PrePersist
    public void onCreate() {

        LocalDateTime now =
                LocalDateTime.now();

        if (generatedAt == null) {
            generatedAt = now;
        }

        updatedAt = now;

        if (attendanceRate == null) {
            attendanceRate = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    public void onUpdate() {

        updatedAt =
                LocalDateTime.now();

        if (attendanceRate == null) {
            attendanceRate = BigDecimal.ZERO;
        }
    }

    /* =====================================================
       GETTERS / SETTERS
    ===================================================== */

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getSectionId() {
        return sectionId;
    }

    public void setSectionId(
            String sectionId
    ) {
        this.sectionId = sectionId;
    }

    public String getSectionName() {
        return sectionName;
    }

    public void setSectionName(
            String sectionName
    ) {
        this.sectionName = sectionName;
    }

    public String getAdviserId() {
        return adviserId;
    }

    public void setAdviserId(
            String adviserId
    ) {
        this.adviserId = adviserId;
    }

    public String getAdviserName() {
        return adviserName;
    }

    public void setAdviserName(
            String adviserName
    ) {
        this.adviserName = adviserName;
    }

    public AttendanceReportType getReportType() {
        return reportType;
    }

    public void setReportType(
            AttendanceReportType reportType
    ) {
        this.reportType = reportType;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(
            LocalDate periodStart
    ) {
        this.periodStart = periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(
            LocalDate periodEnd
    ) {
        this.periodEnd = periodEnd;
    }

    public int getStudentCount() {
        return studentCount;
    }

    public void setStudentCount(
            int studentCount
    ) {
        this.studentCount = studentCount;
    }

    public int getSessionCount() {
        return sessionCount;
    }

    public void setSessionCount(
            int sessionCount
    ) {
        this.sessionCount = sessionCount;
    }

    public int getPresentCount() {
        return presentCount;
    }

    public void setPresentCount(
            int presentCount
    ) {
        this.presentCount = presentCount;
    }

    public int getLateCount() {
        return lateCount;
    }

    public void setLateCount(
            int lateCount
    ) {
        this.lateCount = lateCount;
    }

    public int getAbsentCount() {
        return absentCount;
    }

    public void setAbsentCount(
            int absentCount
    ) {
        this.absentCount = absentCount;
    }

    public BigDecimal getAttendanceRate() {
        return attendanceRate;
    }

    public void setAttendanceRate(
            BigDecimal attendanceRate
    ) {
        this.attendanceRate = attendanceRate;
    }

    public String getPdfFileName() {
        return pdfFileName;
    }

    public void setPdfFileName(
            String pdfFileName
    ) {
        this.pdfFileName = pdfFileName;
    }

    public String getPdfRelativePath() {
        return pdfRelativePath;
    }

    public void setPdfRelativePath(
            String pdfRelativePath
    ) {
        this.pdfRelativePath = pdfRelativePath;
    }

    public String getExcelFileName() {
        return excelFileName;
    }

    public void setExcelFileName(
            String excelFileName
    ) {
        this.excelFileName = excelFileName;
    }

    public String getExcelRelativePath() {
        return excelRelativePath;
    }

    public void setExcelRelativePath(
            String excelRelativePath
    ) {
        this.excelRelativePath = excelRelativePath;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(
            LocalDateTime generatedAt
    ) {
        this.generatedAt = generatedAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(
            LocalDateTime updatedAt
    ) {
        this.updatedAt = updatedAt;
    }
}