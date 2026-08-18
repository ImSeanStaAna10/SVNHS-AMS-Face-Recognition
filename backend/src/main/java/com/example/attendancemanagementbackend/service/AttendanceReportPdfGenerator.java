package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.dto.AttendanceReportAggregationResponse;
import com.example.attendancemanagementbackend.dto.AttendanceReportStudentSummary;
import com.example.attendancemanagementbackend.entity.AttendanceReportType;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;

import org.apache.pdfbox.pdmodel.common.PDRectangle;

import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.IOException;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.nio.file.Path;

import java.time.format.DateTimeFormatter;

import java.util.List;
import java.util.Locale;

@Component
public class AttendanceReportPdfGenerator {

    /* =========================================================
       COLORS

       Values remain in normal RGB 0-255 format.
       java.awt.Color converts them correctly for PDFBox 3.
    ========================================================= */

    private static final int[] NAVY = {
            11, 46, 103
    };

    private static final int[] DARK_NAVY = {
            6, 26, 63
    };

    private static final int[] RED = {
            181, 34, 50
    };

    private static final int[] GOLD = {
            194, 146, 31
    };

    private static final int[] GREEN = {
            36, 122, 80
    };

    private static final int[] TEXT = {
            25, 40, 64
    };

    private static final int[] MUTED = {
            100, 116, 139
    };

    private static final int[] BORDER = {
            205, 214, 226
    };

    private static final int[] SOFT_BLUE = {
            240, 246, 252
    };

    private static final int[] SOFT_GREEN = {
            238, 248, 243
    };

    private static final int[] SOFT_RED = {
            255, 241, 243
    };

    private static final int[] SOFT_GOLD = {
            255, 248, 232
    };

    private static final int[] WHITE = {
            255, 255, 255
    };

    /* =========================================================
       FONTS
    ========================================================= */

    private static final PDType1Font REGULAR =
            new PDType1Font(
                    Standard14Fonts.FontName.HELVETICA
            );

    private static final PDType1Font BOLD =
            new PDType1Font(
                    Standard14Fonts.FontName.HELVETICA_BOLD
            );

    /* =========================================================
       PAGE CONSTANTS
    ========================================================= */

    private static final float MARGIN = 36F;

    private static final float ROW_HEIGHT = 22F;

    private static final float TABLE_HEADER_HEIGHT = 24F;

    private static final float FOOTER_RESERVED = 34F;

    /* =========================================================
       GENERATE
    ========================================================= */

    public void generate(

            AttendanceReportAggregationResponse report,

            Path outputFile

    ) throws IOException {

        try (
                PDDocument document =
                        new PDDocument()
        ) {

            configureMetadata(
                    document,
                    report
            );

            List<AttendanceReportStudentSummary> students =
                    report.students();

            int studentIndex =
                    0;

            boolean firstPage =
                    true;

            while (
                    studentIndex < students.size()
                            ||
                            firstPage
            ) {

                PDPage page =
                        createPage(
                                document
                        );

                float tableY =
                        drawPageHeader(
                                document,
                                page,
                                report,
                                firstPage
                        );

                try (
                        PDPageContentStream content =
                                new PDPageContentStream(
                                        document,
                                        page,
                                        PDPageContentStream.AppendMode.APPEND,
                                        true,
                                        true
                                )
                ) {

                    float y =
                            drawTableHeader(
                                    content,
                                    tableY
                            );

                    while (
                            studentIndex < students.size()
                                    &&
                                    y - ROW_HEIGHT >
                                            FOOTER_RESERVED
                    ) {

                        AttendanceReportStudentSummary student =
                                students.get(
                                        studentIndex
                                );

                        drawStudentRow(
                                content,
                                student,
                                studentIndex + 1,
                                y
                        );

                        y -=
                                ROW_HEIGHT;

                        studentIndex++;
                    }
                }

                firstPage =
                        false;

                /*
                 * Handles empty student collections.
                 */
                if (
                        students.isEmpty()
                ) {

                    break;
                }
            }

            drawSignatures(
                    document,
                    report
            );

            drawPageFooters(
                    document
            );

            document.save(
                    outputFile.toFile()
            );
        }
    }

    /* =========================================================
       DOCUMENT METADATA
    ========================================================= */

    private void configureMetadata(

            PDDocument document,

            AttendanceReportAggregationResponse report
    ) {

        PDDocumentInformation info =
                document.getDocumentInformation();

        info.setTitle(
                report.sectionName()
                        +
                        " "
                        +
                        report.reportType()
                        +
                        " Attendance Report"
        );

        info.setSubject(
                "Official Attendance Report"
        );

        info.setAuthor(
                "Signal Village National High School"
        );

        info.setCreator(
                "SVNHS Attendance Management System"
        );
    }

    /* =========================================================
       CREATE PAGE
    ========================================================= */

    private PDPage createPage(
            PDDocument document
    ) {

        PDRectangle landscapeA4 =
                new PDRectangle(
                        PDRectangle.A4.getHeight(),
                        PDRectangle.A4.getWidth()
                );

        PDPage page =
                new PDPage(
                        landscapeA4
                );

        document.addPage(
                page
        );

        return page;
    }

    /* =========================================================
       PAGE HEADER
    ========================================================= */

    private float drawPageHeader(

            PDDocument document,

            PDPage page,

            AttendanceReportAggregationResponse report,

            boolean firstPage

    ) throws IOException {

        float width =
                page
                        .getMediaBox()
                        .getWidth();

        float height =
                page
                        .getMediaBox()
                        .getHeight();

        try (
                PDPageContentStream content =
                        new PDPageContentStream(
                                document,
                                page
                        )
        ) {

            /* ===============================================
               TOP BRAND LINE
            =============================================== */

            fillRectangle(
                    content,
                    0,
                    height - 7,
                    width * 0.32F,
                    7,
                    RED
            );

            fillRectangle(
                    content,
                    width * 0.32F,
                    height - 7,
                    width * 0.04F,
                    7,
                    GOLD
            );

            fillRectangle(
                    content,
                    width * 0.36F,
                    height - 7,
                    width * 0.64F,
                    7,
                    NAVY
            );

            /* ===============================================
               SCHOOL HEADER
            =============================================== */

            drawCenteredText(
                    content,
                    "REPUBLIC OF THE PHILIPPINES",
                    BOLD,
                    7,
                    width / 2,
                    height - 28,
                    MUTED
            );

            drawCenteredText(
                    content,
                    "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
                    BOLD,
                    15,
                    width / 2,
                    height - 45,
                    DARK_NAVY
            );

            drawCenteredText(
                    content,
                    "Attendance Management System",
                    REGULAR,
                    8,
                    width / 2,
                    height - 58,
                    MUTED
            );

            drawText(
                    content,
                    "OFFICIAL SCHOOL RECORD",
                    BOLD,
                    7,
                    MARGIN,
                    height - 32,
                    RED
            );

            drawRightText(
                    content,
                    report.reportType() ==
                            AttendanceReportType.WEEKLY
                            ? "WEEKLY ATTENDANCE REPORT"
                            : "MONTHLY ATTENDANCE REPORT",
                    BOLD,
                    8,
                    width - MARGIN,
                    height - 32,
                    NAVY
            );

            /* ===============================================
               DOCUMENT TITLE
            =============================================== */

            float titleY =
                    height - 88;

            drawText(
                    content,
                    "STUDENT ATTENDANCE REPORT",
                    BOLD,
                    14,
                    MARGIN,
                    titleY,
                    DARK_NAVY
            );

            drawText(
                    content,
                    getPeriodLabel(
                            report
                    ),
                    REGULAR,
                    8,
                    MARGIN,
                    titleY - 14,
                    MUTED
            );

            float metaY =
                    titleY - 30;

            drawMetadata(
                    content,
                    report,
                    metaY,
                    width
            );

            if (
                    firstPage
            ) {

                float summaryY =
                        metaY - 56;

                drawSummaryCards(
                        content,
                        report,
                        summaryY,
                        width
                );

                return summaryY - 62;
            }

            return metaY - 53;
        }
    }

    /* =========================================================
       METADATA
    ========================================================= */

    private void drawMetadata(

            PDPageContentStream content,

            AttendanceReportAggregationResponse report,

            float y,

            float pageWidth

    ) throws IOException {

        float usableWidth =
                pageWidth -
                        (MARGIN * 2);

        float boxWidth =
                usableWidth / 4F;

        drawMetaBox(
                content,
                MARGIN,
                y,
                boxWidth,
                "SECTION",
                report.sectionName()
        );

        drawMetaBox(
                content,
                MARGIN + boxWidth,
                y,
                boxWidth,
                "ADVISER",
                safe(
                        report.adviserName(),
                        "Class Adviser"
                )
        );

        drawMetaBox(
                content,
                MARGIN + boxWidth * 2,
                y,
                boxWidth,
                "REPORT TYPE",
                report
                        .reportType()
                        .name()
        );

        drawMetaBox(
                content,
                MARGIN + boxWidth * 3,
                y,
                boxWidth,
                "REPORT PERIOD",
                getPeriodLabel(
                        report
                )
        );
    }

    /* =========================================================
       METADATA BOX
    ========================================================= */

    private void drawMetaBox(

            PDPageContentStream content,

            float x,

            float y,

            float width,

            String label,

            String value

    ) throws IOException {

        fillRectangle(
                content,
                x,
                y - 36,
                width,
                36,
                SOFT_BLUE
        );

        strokeRectangle(
                content,
                x,
                y - 36,
                width,
                36,
                BORDER
        );

        drawText(
                content,
                label,
                BOLD,
                6,
                x + 9,
                y - 12,
                MUTED
        );

        drawText(
                content,
                fitText(
                        value,
                        BOLD,
                        8,
                        width - 18
                ),
                BOLD,
                8,
                x + 9,
                y - 26,
                TEXT
        );
    }

    /* =========================================================
       SUMMARY CARDS
    ========================================================= */

    private void drawSummaryCards(

            PDPageContentStream content,

            AttendanceReportAggregationResponse report,

            float y,

            float pageWidth

    ) throws IOException {

        float gap =
                7F;

        float usableWidth =
                pageWidth
                        -
                        MARGIN * 2
                        -
                        gap * 4;

        float cardWidth =
                usableWidth / 5F;

        drawSummaryCard(
                content,
                MARGIN,
                y,
                cardWidth,
                "STUDENTS",
                String.valueOf(
                        report.studentCount()
                ),
                NAVY
        );

        drawSummaryCard(
                content,
                MARGIN
                        +
                        cardWidth
                        +
                        gap,
                y,
                cardWidth,
                "PRESENT",
                String.valueOf(
                        report.presentCount()
                ),
                GREEN
        );

        drawSummaryCard(
                content,
                MARGIN
                        +
                        (cardWidth + gap) * 2,
                y,
                cardWidth,
                "LATE",
                String.valueOf(
                        report.lateCount()
                ),
                GOLD
        );

        drawSummaryCard(
                content,
                MARGIN
                        +
                        (cardWidth + gap) * 3,
                y,
                cardWidth,
                "ABSENT",
                String.valueOf(
                        report.absentCount()
                ),
                RED
        );

        drawSummaryCard(
                content,
                MARGIN
                        +
                        (cardWidth + gap) * 4,
                y,
                cardWidth,
                "ATTENDANCE",
                formatPercentage(
                        report.attendanceRate()
                ),
                DARK_NAVY
        );
    }

    /* =========================================================
       SUMMARY CARD
    ========================================================= */

    private void drawSummaryCard(

            PDPageContentStream content,

            float x,

            float y,

            float width,

            String label,

            String value,

            int[] accent

    ) throws IOException {

        fillRectangle(
                content,
                x,
                y - 45,
                width,
                45,
                WHITE
        );

        strokeRectangle(
                content,
                x,
                y - 45,
                width,
                45,
                BORDER
        );

        fillRectangle(
                content,
                x,
                y - 45,
                4,
                45,
                accent
        );

        drawText(
                content,
                label,
                BOLD,
                6,
                x + 12,
                y - 15,
                MUTED
        );

        drawText(
                content,
                value,
                BOLD,
                13,
                x + 12,
                y - 33,
                accent
        );
    }

    /* =========================================================
       TABLE HEADER
    ========================================================= */

    private float drawTableHeader(

            PDPageContentStream content,

            float y

    ) throws IOException {

        float x =
                MARGIN;

        float[] widths = {
                34F,
                92F,
                250F,
                62F,
                62F,
                55F,
                62F,
                75F
        };

        String[] headers = {
                "NO.",
                "STUDENT NO.",
                "STUDENT NAME",
                "SESSIONS",
                "PRESENT",
                "LATE",
                "ABSENT",
                "RATE"
        };

        for (
                int index = 0;
                index < headers.length;
                index++
        ) {

            fillRectangle(
                    content,
                    x,
                    y - TABLE_HEADER_HEIGHT,
                    widths[index],
                    TABLE_HEADER_HEIGHT,
                    DARK_NAVY
            );

            strokeRectangle(
                    content,
                    x,
                    y - TABLE_HEADER_HEIGHT,
                    widths[index],
                    TABLE_HEADER_HEIGHT,
                    WHITE
            );

            drawCenteredTextInCell(
                    content,
                    headers[index],
                    BOLD,
                    6.5F,
                    x,
                    y - TABLE_HEADER_HEIGHT,
                    widths[index],
                    TABLE_HEADER_HEIGHT,
                    WHITE
            );

            x +=
                    widths[index];
        }

        return y -
                TABLE_HEADER_HEIGHT;
    }

    /* =========================================================
       TABLE ROW
    ========================================================= */

    private void drawStudentRow(

            PDPageContentStream content,

            AttendanceReportStudentSummary student,

            int number,

            float y

    ) throws IOException {

        float x =
                MARGIN;

        float[] widths = {
                34F,
                92F,
                250F,
                62F,
                62F,
                55F,
                62F,
                75F
        };

        String[] values = {

                String.valueOf(
                        number
                ),

                safe(
                        student.studentNumber(),
                        "-"
                ),

                safe(
                        student.studentName(),
                        "Unnamed Student"
                ),

                String.valueOf(
                        student.sessionCount()
                ),

                String.valueOf(
                        student.presentCount()
                ),

                String.valueOf(
                        student.lateCount()
                ),

                String.valueOf(
                        student.absentCount()
                ),

                formatPercentage(
                        student.attendanceRate()
                )
        };

        for (
                int index = 0;
                index < values.length;
                index++
        ) {

            int[] fill =
                    number % 2 == 0
                            ? SOFT_BLUE
                            : WHITE;

            if (
                    index == 7
            ) {

                BigDecimal rate =
                        student.attendanceRate() != null
                                ? student.attendanceRate()
                                : BigDecimal.ZERO;

                if (
                        rate.compareTo(
                                BigDecimal.valueOf(
                                        90
                                )
                        ) >= 0
                ) {

                    fill =
                            SOFT_GREEN;

                } else if (
                        rate.compareTo(
                                BigDecimal.valueOf(
                                        75
                                )
                        ) >= 0
                ) {

                    fill =
                            SOFT_GOLD;

                } else {

                    fill =
                            SOFT_RED;
                }
            }

            fillRectangle(
                    content,
                    x,
                    y - ROW_HEIGHT,
                    widths[index],
                    ROW_HEIGHT,
                    fill
            );

            strokeRectangle(
                    content,
                    x,
                    y - ROW_HEIGHT,
                    widths[index],
                    ROW_HEIGHT,
                    BORDER
            );

            PDType1Font font =
                    index == 2
                            ? BOLD
                            : REGULAR;

            int[] color =
                    index == 2
                            ? DARK_NAVY
                            : TEXT;

            String value =
                    fitText(
                            values[index],
                            font,
                            7F,
                            widths[index] - 10
                    );

            if (
                    index == 2
            ) {

                drawText(
                        content,
                        value,
                        font,
                        7F,
                        x + 6,
                        y - 14,
                        color
                );

            } else {

                drawCenteredTextInCell(
                        content,
                        value,
                        font,
                        7F,
                        x,
                        y - ROW_HEIGHT,
                        widths[index],
                        ROW_HEIGHT,
                        color
                );
            }

            x +=
                    widths[index];
        }
    }

    /* =========================================================
       SIGNATURE / CERTIFICATION PAGE
    ========================================================= */

    private void drawSignatures(

            PDDocument document,

            AttendanceReportAggregationResponse report

    ) throws IOException {

        /*
         * Dedicated certification/signature page keeps
         * the table clean regardless of student count.
         */
        PDPage signaturePage =
                createPage(
                        document
                );

        float width =
                signaturePage
                        .getMediaBox()
                        .getWidth();

        float height =
                signaturePage
                        .getMediaBox()
                        .getHeight();

        try (
                PDPageContentStream content =
                        new PDPageContentStream(
                                document,
                                signaturePage
                        )
        ) {

            /* ===============================================
               TOP BRAND LINE
            =============================================== */

            fillRectangle(
                    content,
                    0,
                    height - 7,
                    width * 0.32F,
                    7,
                    RED
            );

            fillRectangle(
                    content,
                    width * 0.32F,
                    height - 7,
                    width * 0.04F,
                    7,
                    GOLD
            );

            fillRectangle(
                    content,
                    width * 0.36F,
                    height - 7,
                    width * 0.64F,
                    7,
                    NAVY
            );

            /* ===============================================
               CERTIFICATION HEADER
            =============================================== */

            drawCenteredText(
                    content,
                    "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
                    BOLD,
                    15,
                    width / 2,
                    height - 58,
                    DARK_NAVY
            );

            drawCenteredText(
                    content,
                    "REPORT CERTIFICATION",
                    BOLD,
                    10,
                    width / 2,
                    height - 92,
                    RED
            );

            drawCenteredText(
                    content,
                    safe(
                            report.sectionName(),
                            "Section"
                    )
                            +
                            " - "
                            +
                            getPeriodLabel(
                                    report
                            ),
                    REGULAR,
                    8,
                    width / 2,
                    height - 108,
                    MUTED
            );

            /* ===============================================
               CERTIFICATION MESSAGE
            =============================================== */

            drawText(
                    content,
                    "This document represents the official consolidated attendance records",
                    REGULAR,
                    9,
                    90,
                    height - 165,
                    TEXT
            );

            drawText(
                    content,
                    "for the reporting period indicated above.",
                    REGULAR,
                    9,
                    90,
                    height - 181,
                    TEXT
            );

            /* ===============================================
               SIGNATURES
            =============================================== */

            float lineY =
                    height - 310;

            float leftCenter =
                    width * 0.30F;

            float rightCenter =
                    width * 0.70F;

            drawSignature(
                    content,
                    leftCenter,
                    lineY,
                    safe(
                            report.adviserName(),
                            "Class Adviser"
                    ),
                    "Class Adviser"
            );

            drawSignature(
                    content,
                    rightCenter,
                    lineY,
                    "______________________________",
                    "School Official"
            );
        }
    }

    /* =========================================================
       SIGNATURE
    ========================================================= */

    private void drawSignature(

            PDPageContentStream content,

            float centerX,

            float y,

            String name,

            String role

    ) throws IOException {

        /*
         * PDFBox 3:
         * use java.awt.Color for 0-255 RGB.
         */
        content.setStrokingColor(
                toColor(
                        TEXT
                )
        );

        content.moveTo(
                centerX - 95,
                y
        );

        content.lineTo(
                centerX + 95,
                y
        );

        content.stroke();

        drawCenteredText(
                content,
                name,
                BOLD,
                9,
                centerX,
                y - 18,
                TEXT
        );

        drawCenteredText(
                content,
                role,
                REGULAR,
                7,
                centerX,
                y - 32,
                MUTED
        );
    }

    /* =========================================================
       PAGE FOOTERS
    ========================================================= */

    private void drawPageFooters(
            PDDocument document
    ) throws IOException {

        int pageCount =
                document.getNumberOfPages();

        for (
                int index = 0;
                index < pageCount;
                index++
        ) {

            PDPage page =
                    document.getPage(
                            index
                    );

            float width =
                    page
                            .getMediaBox()
                            .getWidth();

            try (
                    PDPageContentStream content =
                            new PDPageContentStream(
                                    document,
                                    page,
                                    PDPageContentStream.AppendMode.APPEND,
                                    true,
                                    true
                            )
            ) {

                /*
                 * PDFBox 3:
                 * use java.awt.Color for 0-255 RGB.
                 */
                content.setStrokingColor(
                        toColor(
                                BORDER
                        )
                );

                content.moveTo(
                        MARGIN,
                        25
                );

                content.lineTo(
                        width - MARGIN,
                        25
                );

                content.stroke();

                drawText(
                        content,
                        "Generated by SVNHS Attendance Management System",
                        REGULAR,
                        6,
                        MARGIN,
                        12,
                        MUTED
                );

                drawRightText(
                        content,
                        "Page "
                                +
                                (index + 1)
                                +
                                " of "
                                +
                                pageCount,
                        REGULAR,
                        6,
                        width - MARGIN,
                        12,
                        MUTED
                );
            }
        }
    }

    /* =========================================================
       PERIOD LABEL
    ========================================================= */

    private String getPeriodLabel(
            AttendanceReportAggregationResponse report
    ) {

        if (
                report.reportType()
                        ==
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
       DRAW TEXT
    ========================================================= */

    private void drawText(

            PDPageContentStream content,

            String value,

            PDType1Font font,

            float size,

            float x,

            float y,

            int[] color

    ) throws IOException {

        content.beginText();

        content.setFont(
                font,
                size
        );

        /*
         * IMPORTANT:
         *
         * PDFBox 3 float RGB values expect 0.0 - 1.0.
         * Our palette uses standard 0 - 255 RGB,
         * therefore use java.awt.Color.
         */
        content.setNonStrokingColor(
                toColor(
                        color
                )
        );

        content.newLineAtOffset(
                x,
                y
        );

        content.showText(
                pdfSafe(
                        value
                )
        );

        content.endText();
    }

    /* =========================================================
       CENTERED TEXT
    ========================================================= */

    private void drawCenteredText(

            PDPageContentStream content,

            String value,

            PDType1Font font,

            float size,

            float centerX,

            float y,

            int[] color

    ) throws IOException {

        String safe =
                pdfSafe(
                        value
                );

        float textWidth =
                font
                        .getStringWidth(
                                safe
                        )
                        /
                        1000F
                        *
                        size;

        drawText(
                content,
                safe,
                font,
                size,
                centerX -
                        textWidth / 2F,
                y,
                color
        );
    }

    /* =========================================================
       RIGHT-ALIGNED TEXT
    ========================================================= */

    private void drawRightText(

            PDPageContentStream content,

            String value,

            PDType1Font font,

            float size,

            float rightX,

            float y,

            int[] color

    ) throws IOException {

        String safe =
                pdfSafe(
                        value
                );

        float textWidth =
                font
                        .getStringWidth(
                                safe
                        )
                        /
                        1000F
                        *
                        size;

        drawText(
                content,
                safe,
                font,
                size,
                rightX -
                        textWidth,
                y,
                color
        );
    }

    /* =========================================================
       CENTERED CELL TEXT
    ========================================================= */

    private void drawCenteredTextInCell(

            PDPageContentStream content,

            String value,

            PDType1Font font,

            float size,

            float x,

            float y,

            float width,

            float height,

            int[] color

    ) throws IOException {

        String safe =
                pdfSafe(
                        value
                );

        float textWidth =
                font
                        .getStringWidth(
                                safe
                        )
                        /
                        1000F
                        *
                        size;

        float textX =
                x
                        +
                        (
                                width
                                        -
                                        textWidth
                        ) / 2F;

        float textY =
                y
                        +
                        (
                                height
                                        -
                                        size
                        ) / 2F
                        +
                        2F;

        drawText(
                content,
                safe,
                font,
                size,
                textX,
                textY,
                color
        );
    }

    /* =========================================================
       FILLED RECTANGLE
    ========================================================= */

    private void fillRectangle(

            PDPageContentStream content,

            float x,

            float y,

            float width,

            float height,

            int[] color

    ) throws IOException {

        /*
         * PDFBox 3-safe RGB.
         */
        content.setNonStrokingColor(
                toColor(
                        color
                )
        );

        content.addRect(
                x,
                y,
                width,
                height
        );

        content.fill();
    }

    /* =========================================================
       RECTANGLE BORDER
    ========================================================= */

    private void strokeRectangle(

            PDPageContentStream content,

            float x,

            float y,

            float width,

            float height,

            int[] color

    ) throws IOException {

        /*
         * PDFBox 3-safe RGB.
         */
        content.setStrokingColor(
                toColor(
                        color
                )
        );

        content.setLineWidth(
                0.5F
        );

        content.addRect(
                x,
                y,
                width,
                height
        );

        content.stroke();
    }

    /* =========================================================
       COLOR HELPER

       Converts our existing 0-255 RGB arrays into a
       java.awt.Color supported correctly by PDFBox 3.
    ========================================================= */

    private Color toColor(
            int[] rgb
    ) {

        if (
                rgb == null
                        ||
                        rgb.length < 3
        ) {

            return Color.BLACK;
        }

        return new Color(
                clampColor(
                        rgb[0]
                ),
                clampColor(
                        rgb[1]
                ),
                clampColor(
                        rgb[2]
                )
        );
    }

    /* =========================================================
       COLOR RANGE SAFETY
    ========================================================= */

    private int clampColor(
            int value
    ) {

        return Math.max(
                0,
                Math.min(
                        255,
                        value
                )
        );
    }

    /* =========================================================
       FIT TEXT
    ========================================================= */

    private String fitText(

            String value,

            PDType1Font font,

            float fontSize,

            float maxWidth

    ) throws IOException {

        String text =
                pdfSafe(
                        value
                );

        if (
                font
                        .getStringWidth(
                                text
                        )
                        /
                        1000F
                        *
                        fontSize
                        <=
                        maxWidth
        ) {

            return text;
        }

        String suffix =
                "...";

        while (
                text.length() > 1
        ) {

            text =
                    text.substring(
                            0,
                            text.length() - 1
                    );

            String candidate =
                    text
                            +
                            suffix;

            float width =
                    font
                            .getStringWidth(
                                    candidate
                            )
                            /
                            1000F
                            *
                            fontSize;

            if (
                    width <= maxWidth
            ) {

                return candidate;
            }
        }

        return suffix;
    }

    /* =========================================================
       PDF-SAFE TEXT
    ========================================================= */

    private String pdfSafe(
            String value
    ) {

        return safe(
                value,
                ""
        )
                .replace(
                        "–",
                        "-"
                )
                .replace(
                        "—",
                        "-"
                )
                .replace(
                        "“",
                        "\""
                )
                .replace(
                        "”",
                        "\""
                )
                .replace(
                        "‘",
                        "'"
                )
                .replace(
                        "’",
                        "'"
                )
                .replace(
                        "\n",
                        " "
                )
                .replace(
                        "\r",
                        " "
                );
    }

    /* =========================================================
       SAFE STRING
    ========================================================= */

    private String safe(

            String value,

            String fallback

    ) {

        if (
                value == null
                        ||
                        value.isBlank()
        ) {

            return fallback;
        }

        return value.trim();
    }

    /* =========================================================
       FORMAT PERCENTAGE
    ========================================================= */

    private String formatPercentage(
            BigDecimal value
    ) {

        BigDecimal safeValue =
                value != null
                        ? value
                        : BigDecimal.ZERO;

        return safeValue
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                )
                .toPlainString()
                +
                "%";
    }
}