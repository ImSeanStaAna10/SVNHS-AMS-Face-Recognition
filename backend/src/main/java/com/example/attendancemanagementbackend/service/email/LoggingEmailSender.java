package com.example.attendancemanagementbackend.service.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        name = "app.email.provider",
        havingValue = "logging",
        matchIfMissing = true
)
public class LoggingEmailSender
        implements EmailSender {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    LoggingEmailSender.class
            );

    private final boolean simulateFailure;

    public LoggingEmailSender(
            @Value(
                    "${app.email.logging.simulate-failure:false}"
            )
            boolean simulateFailure
    ) {

        this.simulateFailure =
                simulateFailure;
    }

    @Override
    public void send(
            EmailMessage message
    ) {

        if (message == null) {

            throw new IllegalArgumentException(
                    "Email message is required"
            );
        }

        if (message.recipientEmail() == null ||
                message.recipientEmail().isBlank()) {

            throw new IllegalArgumentException(
                    "Email recipient is required"
            );
        }

        if (message.subject() == null ||
                message.subject().isBlank()) {

            throw new IllegalArgumentException(
                    "Email subject is required"
            );
        }

        /*
         * Useful later for testing the FAILED / retry flow
         * without needing an actual Gmail failure.
         */
        if (simulateFailure) {

            throw new IllegalStateException(
                    "Simulated email delivery failure"
            );
        }

        /* =====================================================
           TEST EMAIL PROVIDER

           No external email is actually sent.

           This log represents a provider accepting
           the email request successfully.
        ===================================================== */

        logger.info(
                """
                
                ============================================================
                TEST EMAIL DELIVERY
                ============================================================
                To: {} <{}>
                Subject: {}
                
                {}
                ============================================================
                """,
                message.recipientName(),
                message.recipientEmail(),
                message.subject(),
                message.textBody()
        );
    }
}