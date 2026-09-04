package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.AttendanceRiskLevel;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationAbsence;

import com.example.attendancemanagementbackend.repository.ParentNotificationAbsenceRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationRepository;

import com.example.attendancemanagementbackend.service.email.EmailMessage;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;

import java.util.List;
import java.util.Locale;

@Service
public class ParentNotificationEmailContentService {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern(
                    "MMMM d, yyyy",
                    Locale.ENGLISH
            );

    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern(
                    "h:mm a",
                    Locale.ENGLISH
            );

    private final ParentNotificationRepository
            parentNotificationRepository;

    private final ParentNotificationAbsenceRepository
            parentNotificationAbsenceRepository;

    private final ParentNotificationSecureTokenService
            secureTokenService;

    private final String
            parentNotificationPublicUrl;

    public ParentNotificationEmailContentService(
            ParentNotificationRepository parentNotificationRepository,
            ParentNotificationAbsenceRepository parentNotificationAbsenceRepository,
            ParentNotificationSecureTokenService secureTokenService,

            @Value(
                    "${app.parent-notification.public-url:http://localhost:5173/attendance-notice}"
            )
            String parentNotificationPublicUrl
    ) {

        this.parentNotificationRepository =
                parentNotificationRepository;

        this.parentNotificationAbsenceRepository =
                parentNotificationAbsenceRepository;

        this.secureTokenService =
                secureTokenService;

        this.parentNotificationPublicUrl =
                normalizePublicUrl(
                        parentNotificationPublicUrl
                );
    }

    /* =====================================================
       BUILD EMAIL FROM FROZEN SNAPSHOT
    ===================================================== */

    @Transactional(readOnly = true)
    public EmailMessage buildEmail(
            String parentNotificationId
    ) {

        ParentNotification notification =
                parentNotificationRepository
                        .findById(
                                parentNotificationId
                        )
                        .orElseThrow(() ->
                                new IllegalStateException(
                                        "Parent notification not found"
                                )
                        );

        List<ParentNotificationAbsence> absences =
                parentNotificationAbsenceRepository
                        .findByNotification_IdOrderByAttendanceDateAsc(
                                notification.getId()
                        );

        /*
         * Build secure review URL only when the
         * notification has token metadata.
         *
         * Old notifications created before the secure
         * parent-link feature remain sendable.
         */
        String reviewUrl =
                buildReviewUrl(
                        notification
                );

        String textBody =
                buildTextBody(
                        notification,
                        absences,
                        reviewUrl
                );

        String htmlBody =
                buildHtmlBody(
                        notification,
                        absences,
                        reviewUrl
                );

        return new EmailMessage(
                notification.getRecipientEmail(),
                notification.getRecipientName(),
                notification.getSubject(),
                textBody,
                htmlBody
        );
    }

    /* =====================================================
       BUILD SECURE REVIEW URL
    ===================================================== */

    private String buildReviewUrl(
            ParentNotification notification
    ) {

        if (notification == null) {

            return null;
        }

        /*
         * Backward compatibility:
         *
         * Old notifications may not contain secure
         * token metadata.
         */
        if (!hasText(
                notification.getAcknowledgementTokenHash()
        )) {

            return null;
        }

        if (notification.getTokenExpiresAt() == null) {

            return null;
        }

        if (!hasText(
                parentNotificationPublicUrl
        )) {

            return null;
        }

        /*
         * Do not place an already-expired link
         * inside a newly generated email.
         */
        if (secureTokenService.isExpired(
                notification
        )) {

            return null;
        }

        String rawToken =
                secureTokenService
                        .getRawTokenForEmail(
                                notification
                        );

        return parentNotificationPublicUrl
                + "/"
                + rawToken;
    }

    /* =====================================================
       PLAIN-TEXT FALLBACK
    ===================================================== */

    private String buildTextBody(
            ParentNotification notification,
            List<ParentNotificationAbsence> absences,
            String reviewUrl
    ) {

        StringBuilder body =
                new StringBuilder();

        body.append(
                "SVNHS ATTENDANCE MANAGEMENT SYSTEM\n"
        );

        body.append(
                "Attendance Notice\n\n"
        );

        body.append(
                "Dear "
        );

        body.append(
                safeText(
                        notification.getRecipientName()
                )
        );

        body.append(
                ",\n\n"
        );

        body.append(
                "We are writing to inform you about the finalized attendance record of "
        );

        body.append(
                safeText(
                        notification.getStudentNameAtSend()
                )
        );

        body.append(
                ".\n\n"
        );

        body.append(
                "Student Number: "
        );

        body.append(
                safeText(
                        notification.getStudentNumberAtSend()
                )
        );

        body.append(
                "\n"
        );

        body.append(
                "Risk Level: "
        );

        body.append(
                getReadableRiskLevel(
                        notification
                )
        );

        body.append(
                "\n"
        );

        body.append(
                "Total Finalized Absences: "
        );

        body.append(
                notification.getAbsenceCountAtSend()
        );

        body.append(
                "\n\n"
        );

        body.append(
                "FINALIZED ABSENCE RECORDS\n"
        );

        if (absences == null ||
                absences.isEmpty()) {

            body.append(
                    "- No finalized absence records available.\n"
            );
        }

        else {

            for (ParentNotificationAbsence absence :
                    absences) {

                body.append(
                        "- "
                );

                body.append(
                        formatDate(
                                absence
                        )
                );

                body.append(
                        " | "
                );

                body.append(
                        formatSessionTime(
                                absence
                        )
                );

                body.append(
                        " | "
                );

                if (absence.getStatusAtSend() != null) {

                    body.append(
                            absence
                                    .getStatusAtSend()
                                    .name()
                    );
                }

                else {

                    body.append(
                            "UNKNOWN"
                    );
                }

                body.append(
                        "\n"
                );
            }
        }

        /* =================================================
           ADVISER NOTE
        ================================================= */

        if (hasText(
                notification.getAdviserNote()
        )) {

            body.append(
                    "\nADVISER NOTE\n"
            );

            body.append(
                    notification.getAdviserNote()
            );

            body.append(
                    "\n"
            );
        }

        /* =================================================
           SECURE REVIEW LINK
        ================================================= */

        if (hasText(
                reviewUrl
        )) {

            body.append(
                    "\nREVIEW ATTENDANCE NOTICE\n"
            );

            body.append(
                    "Open the secure link below to review this notice"
            );

            body.append(
                    ", acknowledge receipt"
            );

            body.append(
                    ", and respond if enabled by the school.\n\n"
            );

            body.append(
                    reviewUrl
            );

            body.append(
                    "\n"
            );

            if (notification.getTokenExpiresAt() != null) {

                body.append(
                        "\nThis secure link expires on "
                );

                body.append(
                        notification
                                .getTokenExpiresAt()
                                .format(
                                        DATE_FORMATTER
                                )
                );

                body.append(
                        ".\n"
                );
            }

            body.append(
                    "For privacy, please do not forward this secure link.\n"
            );
        }

        body.append(
                "\nPlease review this attendance information."
        );

        body.append(
                "\nIf you believe any record requires clarification, please coordinate with the student's adviser or the school."
        );

        body.append(
                "\n\nThank you,\n"
        );

        body.append(
                "SVNHS Attendance Management System"
        );

        return body.toString();
    }

    /* =====================================================
       PROFESSIONAL HTML EMAIL
    ===================================================== */

    private String buildHtmlBody(
            ParentNotification notification,
            List<ParentNotificationAbsence> absences,
            String reviewUrl
    ) {

        String recipientName =
                escapeHtml(
                        notification.getRecipientName()
                );

        String studentName =
                escapeHtml(
                        notification.getStudentNameAtSend()
                );

        String studentNumber =
                escapeHtml(
                        notification.getStudentNumberAtSend()
                );

        String riskLevel =
                escapeHtml(
                        getReadableRiskLevel(
                                notification
                        )
                );

        String riskBackground =
                getRiskBackgroundColor(
                        notification
                );

        String riskText =
                getRiskTextColor(
                        notification
                );

        String riskBorder =
                getRiskBorderColor(
                        notification
                );

        StringBuilder html =
                new StringBuilder();

        html.append(
                """
                <!DOCTYPE html>
                <html lang="en">

                <head>

                    <meta charset="UTF-8">

                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    >

                    <meta
                        name="color-scheme"
                        content="light"
                    >

                    <meta
                        name="supported-color-schemes"
                        content="light"
                    >

                    <title>
                        SVNHS Attendance Notice
                    </title>

                </head>

                <body style="
                    margin:0;
                    padding:0;
                    background-color:#eef3f8;
                    font-family:Arial, Helvetica, sans-serif;
                    color:#172033;
                    -webkit-text-size-adjust:100%;
                    -ms-text-size-adjust:100%;
                ">

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                        width:100%;
                        margin:0;
                        padding:0;
                        background-color:#eef3f8;
                        border-collapse:collapse;
                    "
                >

                    <tr>

                        <td
                            align="center"
                            style="
                                padding:34px 12px;
                            "
                        >

                            <table
                                role="presentation"
                                width="100%"
                                cellspacing="0"
                                cellpadding="0"
                                border="0"
                                style="
                                    width:100%;
                                    max-width:680px;
                                    margin:0 auto;
                                    background-color:#ffffff;
                                    border:1px solid #dfe7ef;
                                    border-collapse:separate;
                                    border-spacing:0;
                                    border-radius:16px;
                                    overflow:hidden;
                                    box-shadow:0 18px 45px rgba(15,23,42,0.08);
                                "
                            >

                                <tr>

                                    <td
                                        style="
                                            height:4px;
                                            line-height:4px;
                                            font-size:0;
                                            background:linear-gradient(
                                                90deg,
                                                #123d7e 0%,
                                                #174f88 72%,
                                                #dc2626 72%,
                                                #dc2626 100%
                                            );
                                        "
                                    >
                                        &nbsp;
                                    </td>

                                </tr>
                """
        );

        /* =================================================
           HEADER
        ================================================= */

        html.append(
                """
                                <tr>

                                    <td
                                        style="
                                            padding:24px 28px;
                                            background-color:#123d7e;
                                        "
                                    >

                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellspacing="0"
                                            cellpadding="0"
                                            border="0"
                                            style="
                                                width:100%;
                                                border-collapse:collapse;
                                            "
                                        >

                                            <tr>

                                                <td
                                                    valign="middle"
                                                    style="
                                                        vertical-align:middle;
                                                    "
                                                >

                                                    <table
                                                        role="presentation"
                                                        cellspacing="0"
                                                        cellpadding="0"
                                                        border="0"
                                                        style="
                                                            border-collapse:collapse;
                                                        "
                                                    >

                                                        <tr>

                                                            <td
                                                                valign="middle"
                                                                style="
                                                                    width:42px;
                                                                    height:42px;
                                                                    text-align:center;
                                                                    vertical-align:middle;
                                                                    border:1px solid rgba(255,255,255,0.24);
                                                                    border-radius:10px;
                                                                    background-color:rgba(255,255,255,0.10);
                                                                    color:#ffffff;
                                                                    font-size:17px;
                                                                    font-weight:800;
                                                                "
                                                            >
                                                                S
                                                            </td>

                                                            <td
                                                                valign="middle"
                                                                style="
                                                                    padding-left:12px;
                                                                    vertical-align:middle;
                                                                "
                                                            >

                                                                <div
                                                                    style="
                                                                        color:#ffffff;
                                                                        font-size:16px;
                                                                        font-weight:800;
                                                                        line-height:1.2;
                                                                        letter-spacing:0.3px;
                                                                    "
                                                                >
                                                                    SVNHS
                                                                </div>

                                                                <div
                                                                    style="
                                                                        margin-top:4px;
                                                                        color:#c9d8ea;
                                                                        font-size:11px;
                                                                        line-height:1.4;
                                                                    "
                                                                >
                                                                    Attendance Management System
                                                                </div>

                                                            </td>

                                                        </tr>

                                                    </table>

                                                </td>

                                                <td
                                                    align="right"
                                                    valign="middle"
                                                    style="
                                                        vertical-align:middle;
                                                        text-align:right;
                                                    "
                                                >

                                                    <span
                                                        style="
                                                            display:inline-block;
                                                            padding:8px 11px;
                                                            border:1px solid rgba(255,255,255,0.20);
                                                            border-radius:999px;
                                                            background-color:rgba(255,255,255,0.09);
                                                            color:#eef6ff;
                                                            font-size:9px;
                                                            font-weight:800;
                                                            line-height:1;
                                                            letter-spacing:0.6px;
                                                            text-transform:uppercase;
                                                            white-space:nowrap;
                                                        "
                                                    >
                                                        Secure Parent Notice
                                                    </span>

                                                </td>

                                            </tr>

                                        </table>

                                    </td>

                                </tr>
                """
        );

        /* =================================================
           BODY
        ================================================= */

        html.append(
                """
                                <tr>

                                    <td
                                        style="
                                            padding:30px 30px 34px;
                                            background-color:#ffffff;
                                        "
                                    >

                                        <div
                                            style="
                                                margin:0 0 6px;
                                                color:#174f88;
                                                font-size:10px;
                                                font-weight:800;
                                                line-height:1.2;
                                                letter-spacing:1.1px;
                                                text-transform:uppercase;
                                            "
                                        >
                                            Attendance Intervention
                                        </div>

                                        <div
                                            style="
                                                margin:0;
                                                color:#172033;
                                                font-size:27px;
                                                font-weight:800;
                                                line-height:1.2;
                                                letter-spacing:-0.4px;
                                            "
                                        >
                                            Attendance Notice
                                        </div>

                                        <p
                                            style="
                                                margin:12px 0 0;
                                                color:#64748b;
                                                font-size:14px;
                                                line-height:1.7;
                                            "
                                        >
                                            Dear
                """
        );

        html.append(
                recipientName
        );

        html.append(
                """
                                            ,
                                        </p>

                                        <p
                                            style="
                                                margin:5px 0 0;
                                                color:#64748b;
                                                font-size:14px;
                                                line-height:1.7;
                                            "
                                        >
                                            We are writing to inform you about the finalized
                                            attendance record of
                                            <strong
                                                style="
                                                    color:#334155;
                                                    font-weight:800;
                                                "
                                            >
                """
        );

        html.append(
                studentName
        );

        html.append(
                """
                                            </strong>.
                                            Please review the attendance details below.
                                        </p>
                """
        );

        /* =================================================
           STUDENT INFORMATION
        ================================================= */

        html.append(
                """
                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellspacing="0"
                                            cellpadding="0"
                                            border="0"
                                            style="
                                                width:100%;
                                                margin-top:22px;
                                                border:1px solid #e6ebf1;
                                                border-collapse:separate;
                                                border-spacing:0;
                                                border-radius:12px;
                                                background-color:#f8fafc;
                                            "
                                        >

                                            <tr>

                                                <td
                                                    width="4"
                                                    style="
                                                        width:4px;
                                                        background-color:#123d7e;
                                                        border-radius:12px 0 0 12px;
                                                    "
                                                >
                                                    &nbsp;
                                                </td>

                                                <td
                                                    style="
                                                        padding:17px 18px;
                                                    "
                                                >

                                                    <div
                                                        style="
                                                            color:#8493a5;
                                                            font-size:9px;
                                                            font-weight:800;
                                                            line-height:1.3;
                                                            letter-spacing:0.8px;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Student
                                                    </div>

                                                    <div
                                                        style="
                                                            margin-top:5px;
                                                            color:#172033;
                                                            font-size:18px;
                                                            font-weight:800;
                                                            line-height:1.3;
                                                        "
                                                    >
                """
        );

        html.append(
                studentName
        );

        html.append(
                """
                                                    </div>

                                                    <div
                                                        style="
                                                            margin-top:5px;
                                                            color:#64748b;
                                                            font-size:11px;
                                                            line-height:1.5;
                                                        "
                                                    >
                                                        Student Number:
                                                        <strong
                                                            style="
                                                                color:#334155;
                                                                font-weight:800;
                                                            "
                                                        >
                """
        );

        html.append(
                studentNumber
        );

        html.append(
                """
                                                        </strong>
                                                    </div>

                                                </td>

                                            </tr>

                                        </table>
                """
        );

        /* =================================================
           RISK + ABSENCE SUMMARY
        ================================================= */

        html.append(
                """
                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellspacing="0"
                                            cellpadding="0"
                                            border="0"
                                            style="
                                                width:100%;
                                                margin-top:10px;
                                                border-collapse:collapse;
                                            "
                                        >

                                            <tr>

                                                <td
                                                    width="50%"
                                                    valign="top"
                                                    style="
                                                        width:50%;
                                                        padding-right:5px;
                                                        vertical-align:top;
                                                    "
                                                >

                                                    <div
                                                        style="
                                                            min-height:78px;
                                                            padding:14px 15px;
                                                            border:1px solid #e6ebf1;
                                                            border-radius:11px;
                                                            background-color:#ffffff;
                                                        "
                                                    >

                                                        <div
                                                            style="
                                                                color:#8493a5;
                                                                font-size:9px;
                                                                font-weight:800;
                                                                line-height:1.3;
                                                                letter-spacing:0.8px;
                                                                text-transform:uppercase;
                                                            "
                                                        >
                                                            Risk Level
                                                        </div>

                                                        <div
                                                            style="
                                                                margin-top:11px;
                                                            "
                                                        >

                                                            <span
                                                                style="
                                                                    display:inline-block;
                                                                    padding:7px 11px;
                                                                    border-radius:999px;
                                                                    font-size:10px;
                                                                    font-weight:800;
                                                                    line-height:1;
                                                                    letter-spacing:0.4px;
                                                                    text-transform:uppercase;
                                                                    background-color:
                """
        );

        html.append(
                riskBackground
        );

        html.append(
                "; color:"
        );

        html.append(
                riskText
        );

        html.append(
                "; border:1px solid "
        );

        html.append(
                riskBorder
        );

        html.append(
                """
                                                                    ;
                                                                "
                                                            >
                """
        );

        html.append(
                riskLevel
        );

        html.append(
                """
                                                            </span>

                                                        </div>

                                                    </div>

                                                </td>

                                                <td
                                                    width="50%"
                                                    valign="top"
                                                    style="
                                                        width:50%;
                                                        padding-left:5px;
                                                        vertical-align:top;
                                                    "
                                                >

                                                    <div
                                                        style="
                                                            min-height:78px;
                                                            padding:14px 15px;
                                                            border:1px solid #e6ebf1;
                                                            border-radius:11px;
                                                            background-color:#ffffff;
                                                        "
                                                    >

                                                        <div
                                                            style="
                                                                color:#8493a5;
                                                                font-size:9px;
                                                                font-weight:800;
                                                                line-height:1.3;
                                                                letter-spacing:0.8px;
                                                                text-transform:uppercase;
                                                            "
                                                        >
                                                            Finalized Absences
                                                        </div>

                                                        <div
                                                            style="
                                                                margin-top:8px;
                                                                color:#172033;
                                                                font-size:25px;
                                                                font-weight:800;
                                                                line-height:1;
                                                            "
                                                        >
                """
        );

        html.append(
                notification.getAbsenceCountAtSend()
        );

        html.append(
                """
                                                        </div>

                                                    </div>

                                                </td>

                                            </tr>

                                        </table>
                """
        );

        /* =================================================
           ATTENDANCE DETAILS
        ================================================= */

        html.append(
                """
                                        <div
                                            style="
                                                margin-top:28px;
                                            "
                                        >

                                            <div
                                                style="
                                                    color:#8493a5;
                                                    font-size:9px;
                                                    font-weight:800;
                                                    line-height:1.3;
                                                    letter-spacing:0.8px;
                                                    text-transform:uppercase;
                                                "
                                            >
                                                Finalized Records
                                            </div>

                                            <div
                                                style="
                                                    margin-top:4px;
                                                    color:#172033;
                                                    font-size:16px;
                                                    font-weight:800;
                                                    line-height:1.3;
                                                "
                                            >
                                                Attendance Details
                                            </div>

                                        </div>

                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellspacing="0"
                                            cellpadding="0"
                                            border="0"
                                            style="
                                                width:100%;
                                                margin-top:11px;
                                                border:1px solid #e6ebf1;
                                                border-collapse:separate;
                                                border-spacing:0;
                                                border-radius:11px;
                                                overflow:hidden;
                                                background-color:#ffffff;
                                            "
                                        >

                                            <thead>

                                                <tr
                                                    style="
                                                        background-color:#f8fafc;
                                                    "
                                                >

                                                    <th
                                                        style="
                                                            padding:11px 13px;
                                                            border-bottom:1px solid #e6ebf1;
                                                            color:#8493a5;
                                                            font-size:9px;
                                                            font-weight:800;
                                                            line-height:1.3;
                                                            letter-spacing:0.7px;
                                                            text-align:left;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Date
                                                    </th>

                                                    <th
                                                        style="
                                                            padding:11px 13px;
                                                            border-bottom:1px solid #e6ebf1;
                                                            color:#8493a5;
                                                            font-size:9px;
                                                            font-weight:800;
                                                            line-height:1.3;
                                                            letter-spacing:0.7px;
                                                            text-align:left;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Session
                                                    </th>

                                                    <th
                                                        style="
                                                            padding:11px 13px;
                                                            border-bottom:1px solid #e6ebf1;
                                                            color:#8493a5;
                                                            font-size:9px;
                                                            font-weight:800;
                                                            line-height:1.3;
                                                            letter-spacing:0.7px;
                                                            text-align:left;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Status
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>
                """
        );

        if (absences == null ||
                absences.isEmpty()) {

            html.append(
                    """
                                                <tr>

                                                    <td
                                                        colspan="3"
                                                        style="
                                                            padding:20px 16px;
                                                            color:#8493a5;
                                                            font-size:12px;
                                                            line-height:1.55;
                                                            text-align:center;
                                                        "
                                                    >
                                                        No finalized absence records available.
                                                    </td>

                                                </tr>
                    """
            );
        }

        else {

            for (ParentNotificationAbsence absence :
                    absences) {

                html.append(
                        """
                                                <tr>

                                                    <td
                                                        style="
                                                            padding:13px;
                                                            border-bottom:1px solid #eef2f6;
                                                            color:#334155;
                                                            font-size:12px;
                                                            font-weight:700;
                                                            line-height:1.5;
                                                        "
                                                    >
                        """
                );

                html.append(
                        escapeHtml(
                                formatDate(
                                        absence
                                )
                        )
                );

                html.append(
                        """
                                                    </td>

                                                    <td
                                                        style="
                                                            padding:13px;
                                                            border-bottom:1px solid #eef2f6;
                                                            color:#64748b;
                                                            font-size:12px;
                                                            line-height:1.5;
                                                        "
                                                    >
                        """
                );

                html.append(
                        escapeHtml(
                                formatSessionTime(
                                        absence
                                )
                        )
                );

                html.append(
                        """
                                                    </td>

                                                    <td
                                                        style="
                                                            padding:13px;
                                                            border-bottom:1px solid #eef2f6;
                                                            color:#b91c1c;
                                                            font-size:10px;
                                                            font-weight:800;
                                                            line-height:1.4;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                        """
                );

                if (absence.getStatusAtSend() != null) {

                    html.append(
                            escapeHtml(
                                    absence
                                            .getStatusAtSend()
                                            .name()
                            )
                    );
                }

                else {

                    html.append(
                            "UNKNOWN"
                    );
                }

                html.append(
                        """
                                                    </td>

                                                </tr>
                        """
                );
            }
        }

        html.append(
                """
                                            </tbody>

                                        </table>
                """
        );

        /* =================================================
           ADVISER NOTE
        ================================================= */

        if (hasText(
                notification.getAdviserNote()
        )) {

            html.append(
                    """
                                        <div
                                            style="
                                                margin-top:24px;
                                                padding:16px 17px 16px 18px;
                                                border:1px solid #c9dff5;
                                                border-left:4px solid #174f88;
                                                border-radius:10px;
                                                background-color:#f4f9ff;
                                            "
                                        >

                                            <div
                                                style="
                                                    color:#174f88;
                                                    font-size:9px;
                                                    font-weight:800;
                                                    line-height:1.3;
                                                    letter-spacing:0.8px;
                                                    text-transform:uppercase;
                                                "
                                            >
                                                Adviser Note
                                            </div>

                                            <div
                                                style="
                                                    margin-top:8px;
                                                    color:#334155;
                                                    font-size:12px;
                                                    line-height:1.7;
                                                "
                                            >
                    """
            );

            html.append(
                    escapeHtmlWithLineBreaks(
                            notification.getAdviserNote()
                    )
            );

            html.append(
                    """
                                            </div>

                                        </div>
                    """
            );
        }

        /* =================================================
           NOTICE
        ================================================= */

        html.append(
                """
                                        <div
                                            style="
                                                margin-top:24px;
                                                padding:14px 15px;
                                                border:1px solid #fde68a;
                                                border-radius:10px;
                                                background-color:#fffbeb;
                                                color:#92400e;
                                                font-size:12px;
                                                line-height:1.65;
                                            "
                                        >
                                            Please review this attendance information.
                                            If you believe any record requires clarification,
                                            kindly coordinate with the student's adviser
                                            or the school.
                                        </div>
                """
        );

        /* =================================================
           SECURE REVIEW BUTTON
        ================================================= */

        if (hasText(
                reviewUrl
        )) {

            String safeReviewUrl =
                    escapeHtml(
                            reviewUrl
                    );

            html.append(
                    """
                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellspacing="0"
                                            cellpadding="0"
                                            border="0"
                                            style="
                                                width:100%;
                                                margin-top:26px;
                                                border-collapse:collapse;
                                            "
                                        >

                                            <tr>

                                                <td
                                                    align="center"
                                                    style="
                                                        text-align:center;
                                                    "
                                                >

                                                    <table
                                                        role="presentation"
                                                        cellspacing="0"
                                                        cellpadding="0"
                                                        border="0"
                                                        style="
                                                            border-collapse:separate;
                                                            border-spacing:0;
                                                        "
                                                    >

                                                        <tr>

                                                            <td
                                                                align="center"
                                                                style="
                                                                    border-radius:9px;
                                                                    background-color:#123d7e;
                                                                "
                                                            >

                                                                <a
                                                                    href="
                    """
            );

            html.append(
                    safeReviewUrl
            );

            html.append(
                    """
                                                                    "
                                                                    style="
                                                                        display:inline-block;
                                                                        padding:14px 21px;
                                                                        border:1px solid #123d7e;
                                                                        border-radius:9px;
                                                                        background-color:#123d7e;
                                                                        color:#ffffff;
                                                                        font-size:12px;
                                                                        font-weight:800;
                                                                        line-height:1;
                                                                        text-decoration:none;
                                                                    "
                                                                >
                                                                    Review Attendance Notice
                                                                </a>

                                                            </td>

                                                        </tr>

                                                    </table>

                                                </td>

                                            </tr>

                                        </table>

                                        <div
                                            style="
                                                margin-top:14px;
                                                color:#64748b;
                                                font-size:10px;
                                                line-height:1.6;
                                                text-align:center;
                                            "
                                        >
                                            This secure link is intended only for the
                                            recipient of this attendance notice.
                                        </div>
                    """
            );

            if (notification.getTokenExpiresAt() != null) {

                html.append(
                        """
                                        <div
                                            style="
                                                margin-top:5px;
                                                color:#8493a5;
                                                font-size:10px;
                                                line-height:1.6;
                                                text-align:center;
                                            "
                                        >
                                            Secure link expires on
                        """
                );

                html.append(
                        escapeHtml(
                                notification
                                        .getTokenExpiresAt()
                                        .format(
                                                DATE_FORMATTER
                                        )
                        )
                );

                html.append(
                        """
                                            .
                                        </div>
                        """
                );
            }

            html.append(
                    """
                                        <div
                                            style="
                                                margin-top:4px;
                                                color:#8493a5;
                                                font-size:10px;
                                                line-height:1.6;
                                                text-align:center;
                                            "
                                        >
                                            For privacy, please do not forward this link.
                                        </div>
                    """
            );
        }

        /* =================================================
           CLOSE CONTENT
        ================================================= */

        html.append(
                """
                                    </td>

                                </tr>
                """
        );

        /* =================================================
           FOOTER
        ================================================= */

        html.append(
                """
                                <tr>

                                    <td
                                        style="
                                            padding:18px 28px;
                                            border-top:1px solid #e6ebf1;
                                            background-color:#f8fafc;
                                            text-align:center;
                                        "
                                    >

                                        <div
                                            style="
                                                color:#475569;
                                                font-size:10px;
                                                font-weight:800;
                                                line-height:1.4;
                                            "
                                        >
                                            SVNHS Attendance Management System
                                        </div>

                                        <div
                                            style="
                                                margin-top:5px;
                                                color:#8493a5;
                                                font-size:9px;
                                                line-height:1.55;
                                            "
                                        >
                                            This is an automated attendance notification
                                            generated by the school attendance system.
                                        </div>

                                    </td>

                                </tr>

                            </table>

                        </td>

                    </tr>

                </table>

                </body>

                </html>
                """
        );

        return html.toString();
    }

    /* =====================================================
       NORMALIZE PUBLIC URL
    ===================================================== */

    private String normalizePublicUrl(
            String value
    ) {

        if (value == null) {

            return "";
        }

        String normalized =
                value.trim();

        /*
         * Avoid:
         *
         * /attendance-notice//svn1_xxxx
         */
        while (normalized.endsWith(
                "/"
        )) {

            normalized =
                    normalized.substring(
                            0,
                            normalized.length() - 1
                    );
        }

        return normalized;
    }

    /* =====================================================
       READABLE RISK LEVEL
    ===================================================== */

    private String getReadableRiskLevel(
            ParentNotification notification
    ) {

        AttendanceRiskLevel riskLevel =
                notification.getRiskLevelAtSend();

        if (riskLevel == null) {

            return "NORMAL";
        }

        return riskLevel
                .name()
                .replace(
                        "_",
                        " "
                );
    }

    /* =====================================================
       RISK COLORS
    ===================================================== */

    private String getRiskBackgroundColor(
            ParentNotification notification
    ) {

        AttendanceRiskLevel riskLevel =
                notification.getRiskLevelAtSend();

        if (riskLevel == null) {

            return "#f1f5f9";
        }

        return switch (riskLevel) {

            case NORMAL ->
                    "#dcfce7";

            case WARNING ->
                    "#fef3c7";

            case AT_RISK ->
                    "#ffedd5";

            case CRITICAL ->
                    "#fee2e2";
        };
    }

    private String getRiskTextColor(
            ParentNotification notification
    ) {

        AttendanceRiskLevel riskLevel =
                notification.getRiskLevelAtSend();

        if (riskLevel == null) {

            return "#334155";
        }

        return switch (riskLevel) {

            case NORMAL ->
                    "#166534";

            case WARNING ->
                    "#92400e";

            case AT_RISK ->
                    "#c2410c";

            case CRITICAL ->
                    "#b91c1c";
        };
    }

    private String getRiskBorderColor(
            ParentNotification notification
    ) {

        AttendanceRiskLevel riskLevel =
                notification.getRiskLevelAtSend();

        if (riskLevel == null) {

            return "#cbd5e1";
        }

        return switch (riskLevel) {

            case NORMAL ->
                    "#86efac";

            case WARNING ->
                    "#fcd34d";

            case AT_RISK ->
                    "#fdba74";

            case CRITICAL ->
                    "#fca5a5";
        };
    }

    /* =====================================================
       FORMAT DATE
    ===================================================== */

    private String formatDate(
            ParentNotificationAbsence absence
    ) {

        if (absence == null ||
                absence.getAttendanceDate() == null) {

            return "Date unavailable";
        }

        return absence
                .getAttendanceDate()
                .format(
                        DATE_FORMATTER
                );
    }

    /* =====================================================
       FORMAT SESSION TIME
    ===================================================== */

    private String formatSessionTime(
            ParentNotificationAbsence absence
    ) {

        if (absence == null) {

            return "Session time unavailable";
        }

        if (absence.getSessionStartedAt() == null &&
                absence.getSessionEndedAt() == null) {

            return "Session time unavailable";
        }

        if (absence.getSessionStartedAt() != null &&
                absence.getSessionEndedAt() == null) {

            return absence
                    .getSessionStartedAt()
                    .format(
                            TIME_FORMATTER
                    );
        }

        if (absence.getSessionStartedAt() == null) {

            return absence
                    .getSessionEndedAt()
                    .format(
                            TIME_FORMATTER
                    );
        }

        return absence
                .getSessionStartedAt()
                .format(
                        TIME_FORMATTER
                )
                +
                " - "
                +
                absence
                        .getSessionEndedAt()
                        .format(
                                TIME_FORMATTER
                        );
    }

    /* =====================================================
       SAFE TEXT
    ===================================================== */

    private String safeText(
            String value
    ) {

        if (value == null) {

            return "";
        }

        return value.trim();
    }

    /* =====================================================
       HTML ESCAPE
    ===================================================== */

    private String escapeHtml(
            String value
    ) {

        if (value == null) {

            return "";
        }

        return value
                .replace(
                        "&",
                        "&amp;"
                )
                .replace(
                        "<",
                        "&lt;"
                )
                .replace(
                        ">",
                        "&gt;"
                )
                .replace(
                        "\"",
                        "&quot;"
                )
                .replace(
                        "'",
                        "&#39;"
                );
    }

    /* =====================================================
       HTML ESCAPE WITH LINE BREAKS
    ===================================================== */

    private String escapeHtmlWithLineBreaks(
            String value
    ) {

        if (value == null) {

            return "";
        }

        return escapeHtml(
                value
        )
                .replace(
                        "\r\n",
                        "\n"
                )
                .replace(
                        "\r",
                        "\n"
                )
                .replace(
                        "\n",
                        "<br>"
                );
    }

    /* =====================================================
       HAS TEXT
    ===================================================== */

    private boolean hasText(
            String value
    ) {

        return value != null &&
                !value.isBlank();
    }
}
