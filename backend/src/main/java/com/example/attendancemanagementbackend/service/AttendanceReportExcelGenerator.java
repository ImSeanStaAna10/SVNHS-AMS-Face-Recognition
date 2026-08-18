package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportStudentSummary;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;

import org.apache.poi.ss.util.CellRangeAddress;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;

import java.math.BigDecimal;

import java.nio.file.Files;
import java.nio.file.Path;

import java.time.format.DateTimeFormatter;

import java.util.Locale;

@Component
public class AttendanceReportExcelGenerator {

    /* =========================================================
       GENERATE EXCEL REPORT
    ========================================================= */

    public void generate(

            AttendanceReportAggregationResponse report,

            Path outputFile

    ) throws IOException {

        try (
                XSSFWorkbook workbook =
                        new XSSFWorkbook();

                OutputStream outputStream =
                        Files.newOutputStream(
                                outputFile
                        )
        ) {

            Styles styles =
                    createStyles(
                            workbook
                    );

            /* =================================================
               SUMMARY SHEET
            ================================================= */

            createSummarySheet(
                    workbook,
                    report,
                    styles
            );

            /* =================================================
               STUDENT SUMMARY SHEET
            ================================================= */

            createStudentSummarySheet(
                    workbook,
                    report,
                    styles
            );

            /* =================================================
               SAVE WORKBOOK
            ================================================= */

            workbook.write(
                    outputStream
            );
        }
    }

    /* =========================================================
       SUMMARY SHEET
    ========================================================= */

    private void createSummarySheet(

            XSSFWorkbook workbook,

            AttendanceReportAggregationResponse report,

            Styles styles
    ) {

        Sheet sheet =
                workbook.createSheet(
                        "Summary"
                );

        configureSheet(
                sheet
        );

        /* =====================================================
           SCHOOL HEADER
        ===================================================== */

        Row schoolRow =
                sheet.createRow(
                        0
                );

        schoolRow.setHeightInPoints(
                28
        );

        Cell schoolCell =
                schoolRow.createCell(
                        0
                );

        schoolCell.setCellValue(
                "SIGNAL VILLAGE NATIONAL HIGH SCHOOL"
        );

        schoolCell.setCellStyle(
                styles.schoolTitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        0,
                        0,
                        0,
                        5
                )
        );

        /* =====================================================
           SYSTEM NAME
        ===================================================== */

        Row systemRow =
                sheet.createRow(
                        1
                );

        Cell systemCell =
                systemRow.createCell(
                        0
                );

        systemCell.setCellValue(
                "Attendance Management System"
        );

        systemCell.setCellStyle(
                styles.subtitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        1,
                        1,
                        0,
                        5
                )
        );

        /* =====================================================
           REPORT TITLE
        ===================================================== */

        Row reportTitleRow =
                sheet.createRow(
                        2
                );

        reportTitleRow.setHeightInPoints(
                24
        );

        Cell reportTitleCell =
                reportTitleRow.createCell(
                        0
                );

        reportTitleCell.setCellValue(
                getReportTitle(
                        report
                )
        );

        reportTitleCell.setCellStyle(
                styles.reportTitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        2,
                        2,
                        0,
                        5
                )
        );

        /* =====================================================
           REPORT INFORMATION
        ===================================================== */

        createMetadataRow(
                sheet,
                4,
                "Section",
                report.sectionName(),
                styles
        );

        createMetadataRow(
                sheet,
                5,
                "Adviser",
                safe(
                        report.adviserName(),
                        "Class Adviser"
                ),
                styles
        );

        createMetadataRow(
                sheet,
                6,
                "Report Type",
                report
                        .reportType()
                        .name(),
                styles
        );

        createMetadataRow(
                sheet,
                7,
                "Report Period",
                getPeriodLabel(
                        report
                ),
                styles
        );

        /* =====================================================
           SUMMARY HEADER
        ===================================================== */

        Row summaryHeaderRow =
                sheet.createRow(
                        9
                );

        Cell summaryHeader =
                summaryHeaderRow.createCell(
                        0
                );

        summaryHeader.setCellValue(
                "ATTENDANCE SUMMARY"
        );

        summaryHeader.setCellStyle(
                styles.sectionHeader()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        9,
                        9,
                        0,
                        5
                )
        );

        /* =====================================================
           SUMMARY VALUES
        ===================================================== */

        createMetricRow(
                sheet,
                10,
                "Total Students",
                report.studentCount(),
                styles
        );

        createMetricRow(
                sheet,
                11,
                "Completed Sessions",
                report.sessionCount(),
                styles
        );

        createMetricRow(
                sheet,
                12,
                "Present",
                report.presentCount(),
                styles
        );

        createMetricRow(
                sheet,
                13,
                "Late",
                report.lateCount(),
                styles
        );

        createMetricRow(
                sheet,
                14,
                "Absent",
                report.absentCount(),
                styles
        );

        createMetricRow(
                sheet,
                15,
                "Total Attendance Records",
                report.totalRecords(),
                styles
        );

        createPercentageRow(
                sheet,
                17,
                "Present Rate",
                report.presentRate(),
                styles
        );

        createPercentageRow(
                sheet,
                18,
                "Late Rate",
                report.lateRate(),
                styles
        );

        createPercentageRow(
                sheet,
                19,
                "Absence Rate",
                report.absenceRate(),
                styles
        );

        createPercentageRow(
                sheet,
                20,
                "Overall Attendance Rate",
                report.attendanceRate(),
                styles
        );

        /* =====================================================
           COLUMN WIDTHS
        ===================================================== */

        sheet.setColumnWidth(
                0,
                28 * 256
        );

        sheet.setColumnWidth(
                1,
                34 * 256
        );

        sheet.setColumnWidth(
                2,
                18 * 256
        );

        sheet.setColumnWidth(
                3,
                18 * 256
        );

        sheet.setColumnWidth(
                4,
                18 * 256
        );

        sheet.setColumnWidth(
                5,
                18 * 256
        );
    }

    /* =========================================================
       STUDENT SUMMARY SHEET
    ========================================================= */

    private void createStudentSummarySheet(

            XSSFWorkbook workbook,

            AttendanceReportAggregationResponse report,

            Styles styles
    ) {

        Sheet sheet =
                workbook.createSheet(
                        "Student Summary"
                );

        configureSheet(
                sheet
        );

        /* =====================================================
           FREEZE TABLE HEADER
        ===================================================== */

        sheet.createFreezePane(
                0,
                5
        );

        /* =====================================================
           SCHOOL HEADER
        ===================================================== */

        Row schoolRow =
                sheet.createRow(
                        0
                );

        schoolRow.setHeightInPoints(
                28
        );

        Cell schoolCell =
                schoolRow.createCell(
                        0
                );

        schoolCell.setCellValue(
                "SIGNAL VILLAGE NATIONAL HIGH SCHOOL"
        );

        schoolCell.setCellStyle(
                styles.schoolTitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        0,
                        0,
                        0,
                        7
                )
        );

        /* =====================================================
           REPORT TITLE
        ===================================================== */

        Row titleRow =
                sheet.createRow(
                        1
                );

        Cell titleCell =
                titleRow.createCell(
                        0
                );

        titleCell.setCellValue(
                getReportTitle(
                        report
                )
        );

        titleCell.setCellStyle(
                styles.reportTitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        1,
                        1,
                        0,
                        7
                )
        );

        /* =====================================================
           SECTION / PERIOD
        ===================================================== */

        Row infoRow =
                sheet.createRow(
                        2
                );

        Cell infoCell =
                infoRow.createCell(
                        0
                );

        infoCell.setCellValue(
                safe(
                        report.sectionName(),
                        "Section"
                )
                        +
                        " | "
                        +
                        getPeriodLabel(
                                report
                        )
        );

        infoCell.setCellStyle(
                styles.subtitle()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        2,
                        2,
                        0,
                        7
                )
        );

        /* =====================================================
           TABLE HEADER
        ===================================================== */

        Row headerRow =
                sheet.createRow(
                        4
                );

        headerRow.setHeightInPoints(
                26
        );

        String[] headers = {

                "No.",

                "Student Number",

                "Student Name",

                "Sessions",

                "Present",

                "Late",

                "Absent",

                "Attendance Rate"
        };

        for (
                int columnIndex = 0;
                columnIndex < headers.length;
                columnIndex++
        ) {

            Cell cell =
                    headerRow.createCell(
                            columnIndex
                    );

            cell.setCellValue(
                    headers[columnIndex]
            );

            cell.setCellStyle(
                    styles.tableHeader()
            );
        }

        /* =====================================================
           STUDENT DATA
        ===================================================== */

        int rowIndex =
                5;

        int studentNumber =
                1;

        for (
                AttendanceReportStudentSummary student
                : report.students()
        ) {

            Row row =
                    sheet.createRow(
                            rowIndex++
                    );

            row.setHeightInPoints(
                    22
            );

            createNumericCell(
                    row,
                    0,
                    studentNumber++,
                    styles.centerData()
            );

            createTextCell(
                    row,
                    1,
                    safe(
                            student.studentNumber(),
                            "-"
                    ),
                    styles.data()
            );

            createTextCell(
                    row,
                    2,
                    safe(
                            student.studentName(),
                            "Unnamed Student"
                    ),
                    styles.studentName()
            );

            createNumericCell(
                    row,
                    3,
                    student.sessionCount(),
                    styles.centerData()
            );

            createNumericCell(
                    row,
                    4,
                    student.presentCount(),
                    styles.centerData()
            );

            createNumericCell(
                    row,
                    5,
                    student.lateCount(),
                    styles.centerData()
            );

            createNumericCell(
                    row,
                    6,
                    student.absentCount(),
                    styles.centerData()
            );

            Cell attendanceRateCell =
                    row.createCell(
                            7
                    );

            attendanceRateCell.setCellValue(
                    toExcelPercentage(
                            student.attendanceRate()
                    )
            );

            attendanceRateCell.setCellStyle(
                    styles.percentage()
            );
        }

        /* =====================================================
           AUTO FILTER
        ===================================================== */

        if (rowIndex > 5) {

            sheet.setAutoFilter(
                    new CellRangeAddress(
                            4,
                            rowIndex - 1,
                            0,
                            7
                    )
            );
        }

        /* =====================================================
           COLUMN WIDTHS
        ===================================================== */

        sheet.setColumnWidth(
                0,
                8 * 256
        );

        sheet.setColumnWidth(
                1,
                20 * 256
        );

        sheet.setColumnWidth(
                2,
                38 * 256
        );

        sheet.setColumnWidth(
                3,
                14 * 256
        );

        sheet.setColumnWidth(
                4,
                14 * 256
        );

        sheet.setColumnWidth(
                5,
                14 * 256
        );

        sheet.setColumnWidth(
                6,
                14 * 256
        );

        sheet.setColumnWidth(
                7,
                20 * 256
        );
    }

    /* =========================================================
       SHEET CONFIGURATION
    ========================================================= */

    private void configureSheet(
            Sheet sheet
    ) {

        sheet.setDisplayGridlines(
                false
        );

        sheet.setFitToPage(
                true
        );

        PrintSetup printSetup =
                sheet.getPrintSetup();

        printSetup.setLandscape(
                true
        );

        printSetup.setPaperSize(
                PrintSetup.A4_PAPERSIZE
        );

        printSetup.setFitWidth(
                (short) 1
        );

        printSetup.setFitHeight(
                (short) 0
        );

        sheet.setMargin(
                Sheet.LeftMargin,
                0.35
        );

        sheet.setMargin(
                Sheet.RightMargin,
                0.35
        );

        sheet.setMargin(
                Sheet.TopMargin,
                0.50
        );

        sheet.setMargin(
                Sheet.BottomMargin,
                0.50
        );
    }

    /* =========================================================
       CREATE STYLES
    ========================================================= */

    private Styles createStyles(
            XSSFWorkbook workbook
    ) {

        /* =====================================================
           SCHOOL TITLE
        ===================================================== */

        CellStyle schoolTitle =
                workbook.createCellStyle();

        Font schoolTitleFont =
                workbook.createFont();

        schoolTitleFont.setBold(
                true
        );

        schoolTitleFont.setFontHeightInPoints(
                (short) 16
        );

        schoolTitleFont.setColor(
                IndexedColors.DARK_BLUE
                        .getIndex()
        );

        schoolTitle.setFont(
                schoolTitleFont
        );

        schoolTitle.setAlignment(
                HorizontalAlignment.CENTER
        );

        schoolTitle.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        /* =====================================================
           SUBTITLE
        ===================================================== */

        CellStyle subtitle =
                workbook.createCellStyle();

        Font subtitleFont =
                workbook.createFont();

        subtitleFont.setFontHeightInPoints(
                (short) 10
        );

        subtitleFont.setColor(
                IndexedColors.GREY_50_PERCENT
                        .getIndex()
        );

        subtitle.setFont(
                subtitleFont
        );

        subtitle.setAlignment(
                HorizontalAlignment.CENTER
        );

        subtitle.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        /* =====================================================
           REPORT TITLE
        ===================================================== */

        CellStyle reportTitle =
                workbook.createCellStyle();

        Font reportTitleFont =
                workbook.createFont();

        reportTitleFont.setBold(
                true
        );

        reportTitleFont.setFontHeightInPoints(
                (short) 12
        );

        reportTitleFont.setColor(
                IndexedColors.DARK_RED
                        .getIndex()
        );

        reportTitle.setFont(
                reportTitleFont
        );

        reportTitle.setAlignment(
                HorizontalAlignment.CENTER
        );

        reportTitle.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        /* =====================================================
           SECTION HEADER
        ===================================================== */

        CellStyle sectionHeader =
                workbook.createCellStyle();

        Font sectionHeaderFont =
                workbook.createFont();

        sectionHeaderFont.setBold(
                true
        );

        sectionHeaderFont.setColor(
                IndexedColors.WHITE
                        .getIndex()
        );

        sectionHeader.setFont(
                sectionHeaderFont
        );

        sectionHeader.setFillForegroundColor(
                IndexedColors.DARK_BLUE
                        .getIndex()
        );

        sectionHeader.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );

        sectionHeader.setAlignment(
                HorizontalAlignment.LEFT
        );

        sectionHeader.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        /* =====================================================
           LABEL
        ===================================================== */

        CellStyle label =
                workbook.createCellStyle();

        Font labelFont =
                workbook.createFont();

        labelFont.setBold(
                true
        );

        labelFont.setColor(
                IndexedColors.GREY_80_PERCENT
                        .getIndex()
        );

        label.setFont(
                labelFont
        );

        label.setFillForegroundColor(
                IndexedColors.LIGHT_CORNFLOWER_BLUE
                        .getIndex()
        );

        label.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );

        label.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        applyBorder(
                label
        );

        /* =====================================================
           VALUE
        ===================================================== */

        CellStyle value =
                workbook.createCellStyle();

        Font valueFont =
                workbook.createFont();

        valueFont.setBold(
                true
        );

        value.setFont(
                valueFont
        );

        value.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        applyBorder(
                value
        );

        /* =====================================================
           TABLE HEADER
        ===================================================== */

        CellStyle tableHeader =
                workbook.createCellStyle();

        Font tableHeaderFont =
                workbook.createFont();

        tableHeaderFont.setBold(
                true
        );

        tableHeaderFont.setColor(
                IndexedColors.WHITE
                        .getIndex()
        );

        tableHeader.setFont(
                tableHeaderFont
        );

        tableHeader.setFillForegroundColor(
                IndexedColors.DARK_BLUE
                        .getIndex()
        );

        tableHeader.setFillPattern(
                FillPatternType.SOLID_FOREGROUND
        );

        tableHeader.setAlignment(
                HorizontalAlignment.CENTER
        );

        tableHeader.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        applyBorder(
                tableHeader
        );

        /* =====================================================
           NORMAL DATA
        ===================================================== */

        CellStyle data =
                workbook.createCellStyle();

        data.setVerticalAlignment(
                VerticalAlignment.CENTER
        );

        applyBorder(
                data
        );

        /* =====================================================
           CENTER DATA
        ===================================================== */

        CellStyle centerData =
                workbook.createCellStyle();

        centerData.cloneStyleFrom(
                data
        );

        centerData.setAlignment(
                HorizontalAlignment.CENTER
        );

        /* =====================================================
           STUDENT NAME
        ===================================================== */

        CellStyle studentName =
                workbook.createCellStyle();

        studentName.cloneStyleFrom(
                data
        );

        Font studentNameFont =
                workbook.createFont();

        studentNameFont.setBold(
                true
        );

        studentNameFont.setColor(
                IndexedColors.DARK_BLUE
                        .getIndex()
        );

        studentName.setFont(
                studentNameFont
        );

        /* =====================================================
           PERCENTAGE
        ===================================================== */

        CellStyle percentage =
                workbook.createCellStyle();

        percentage.cloneStyleFrom(
                centerData
        );

        percentage.setDataFormat(
                workbook
                        .createDataFormat()
                        .getFormat(
                                "0.00%"
                        )
        );

        return new Styles(

                schoolTitle,

                subtitle,

                reportTitle,

                sectionHeader,

                label,

                value,

                tableHeader,

                data,

                centerData,

                studentName,

                percentage
        );
    }

    /* =========================================================
       METADATA ROW
    ========================================================= */

    private void createMetadataRow(

            Sheet sheet,

            int rowIndex,

            String label,

            String value,

            Styles styles
    ) {

        Row row =
                sheet.createRow(
                        rowIndex
                );

        row.setHeightInPoints(
                22
        );

        Cell labelCell =
                row.createCell(
                        0
                );

        labelCell.setCellValue(
                label
        );

        labelCell.setCellStyle(
                styles.label()
        );

        Cell valueCell =
                row.createCell(
                        1
                );

        valueCell.setCellValue(
                safe(
                        value,
                        "-"
                )
        );

        valueCell.setCellStyle(
                styles.value()
        );

        sheet.addMergedRegion(
                new CellRangeAddress(
                        rowIndex,
                        rowIndex,
                        1,
                        5
                )
        );

        /*
         * Apply the value style to all merged cells
         * for cleaner borders.
         */
        for (
                int column = 2;
                column <= 5;
                column++
        ) {

            Cell mergedCell =
                    row.createCell(
                            column
                    );

            mergedCell.setCellStyle(
                    styles.value()
            );
        }
    }

    /* =========================================================
       NUMERIC SUMMARY ROW
    ========================================================= */

    private void createMetricRow(

            Sheet sheet,

            int rowIndex,

            String label,

            long value,

            Styles styles
    ) {

        Row row =
                sheet.createRow(
                        rowIndex
                );

        createTextCell(
                row,
                0,
                label,
                styles.label()
        );

        createNumericCell(
                row,
                1,
                value,
                styles.value()
        );
    }

    /* =========================================================
       PERCENTAGE SUMMARY ROW
    ========================================================= */

    private void createPercentageRow(

            Sheet sheet,

            int rowIndex,

            String label,

            BigDecimal value,

            Styles styles
    ) {

        Row row =
                sheet.createRow(
                        rowIndex
                );

        createTextCell(
                row,
                0,
                label,
                styles.label()
        );

        Cell percentageCell =
                row.createCell(
                        1
                );

        percentageCell.setCellValue(
                toExcelPercentage(
                        value
                )
        );

        percentageCell.setCellStyle(
                styles.percentage()
        );
    }

    /* =========================================================
       TEXT CELL
    ========================================================= */

    private void createTextCell(

            Row row,

            int column,

            String value,

            CellStyle style
    ) {

        Cell cell =
                row.createCell(
                        column
                );

        cell.setCellValue(
                safe(
                        value,
                        ""
                )
        );

        cell.setCellStyle(
                style
        );
    }

    /* =========================================================
       NUMERIC CELL
    ========================================================= */

    private void createNumericCell(

            Row row,

            int column,

            long value,

            CellStyle style
    ) {

        Cell cell =
                row.createCell(
                        column
                );

        cell.setCellValue(
                value
        );

        cell.setCellStyle(
                style
        );
    }

    /* =========================================================
       BORDERS
    ========================================================= */

    private void applyBorder(
            CellStyle style
    ) {

        style.setBorderTop(
                BorderStyle.THIN
        );

        style.setBorderBottom(
                BorderStyle.THIN
        );

        style.setBorderLeft(
                BorderStyle.THIN
        );

        style.setBorderRight(
                BorderStyle.THIN
        );

        short borderColor =
                IndexedColors.GREY_25_PERCENT
                        .getIndex();

        style.setTopBorderColor(
                borderColor
        );

        style.setBottomBorderColor(
                borderColor
        );

        style.setLeftBorderColor(
                borderColor
        );

        style.setRightBorderColor(
                borderColor
        );
    }

    /* =========================================================
       REPORT TITLE
    ========================================================= */

    private String getReportTitle(
            AttendanceReportAggregationResponse report
    ) {

        if (
                report.reportType() ==
                        AttendanceReportType.MONTHLY
        ) {

            return "OFFICIAL MONTHLY ATTENDANCE REPORT";
        }

        return "OFFICIAL WEEKLY ATTENDANCE REPORT";
    }

    /* =========================================================
       PERIOD LABEL
    ========================================================= */

    private String getPeriodLabel(
            AttendanceReportAggregationResponse report
    ) {

        if (
                report.reportType() ==
                        AttendanceReportType.MONTHLY
        ) {

            return report
                    .periodStart()
                    .format(
                            DateTimeFormatter
                                    .ofPattern(
                                            "MMMM yyyy",
                                            Locale.ENGLISH
                                    )
                    );
        }

        DateTimeFormatter formatter =
                DateTimeFormatter
                        .ofPattern(
                                "MMMM d, yyyy",
                                Locale.ENGLISH
                        );

        return report
                .periodStart()
                .format(
                        formatter
                )
                +
                " - "
                +
                report
                        .periodEnd()
                        .format(
                                formatter
                        );
    }

    /* =========================================================
       CONVERT 100.00 → 1.00 FOR EXCEL PERCENTAGE FORMAT
    ========================================================= */

    private double toExcelPercentage(
            BigDecimal value
    ) {

        if (value == null) {

            return 0D;
        }

        return value
                .divide(
                        BigDecimal.valueOf(
                                100
                        )
                )
                .doubleValue();
    }

    /* =========================================================
       SAFE STRING
    ========================================================= */

    private String safe(

            String value,

            String fallback
    ) {

        if (
                value == null ||
                        value.isBlank()
        ) {

            return fallback;
        }

        return value.trim();
    }

    /* =========================================================
       STYLE CONTAINER
    ========================================================= */

    private record Styles(

            CellStyle schoolTitle,

            CellStyle subtitle,

            CellStyle reportTitle,

            CellStyle sectionHeader,

            CellStyle label,

            CellStyle value,

            CellStyle tableHeader,

            CellStyle data,

            CellStyle centerData,

            CellStyle studentName,

            CellStyle percentage

    ) {
    }
}