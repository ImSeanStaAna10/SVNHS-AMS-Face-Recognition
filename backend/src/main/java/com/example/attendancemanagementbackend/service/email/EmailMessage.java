package com.example.attendancemanagementbackend.service.email;

public record EmailMessage(

        String recipientEmail,

        String recipientName,

        String subject,

        String textBody,

        String htmlBody

) {

    /*
     * Backward-compatible constructor.
     *
     * Existing code that still creates an EmailMessage
     * with only a plain-text body will continue working.
     */
    public EmailMessage(
            String recipientEmail,
            String recipientName,
            String subject,
            String textBody
    ) {

        this(
                recipientEmail,
                recipientName,
                subject,
                textBody,
                null
        );
    }
}