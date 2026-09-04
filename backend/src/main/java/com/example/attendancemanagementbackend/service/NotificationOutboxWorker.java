package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.service.email.EmailMessage;
import com.example.attendancemanagementbackend.service.email.EmailSender;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.scheduling.annotation.Scheduled;

import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class NotificationOutboxWorker {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    NotificationOutboxWorker.class
            );

    private final NotificationOutboxStateService
            notificationOutboxStateService;

    private final ParentNotificationEmailContentService
            emailContentService;

    private final EmailSender
            emailSender;

    private final int batchSize;

    public NotificationOutboxWorker(
            NotificationOutboxStateService notificationOutboxStateService,
            ParentNotificationEmailContentService emailContentService,
            EmailSender emailSender,

            @Value(
                    "${app.email.outbox.batch-size:10}"
            )
            int batchSize
    ) {

        this.notificationOutboxStateService =
                notificationOutboxStateService;

        this.emailContentService =
                emailContentService;

        this.emailSender =
                emailSender;

        this.batchSize =
                Math.max(
                        batchSize,
                        1
                );
    }

    /* =====================================================
       BACKGROUND EMAIL DELIVERY
    ===================================================== */

    @Scheduled(
            fixedDelayString =
                    "${app.email.outbox.poll-ms:5000}"
    )
    public void processPendingEmails() {

        for (int index = 0;
             index < batchSize;
             index++) {

            Optional<NotificationOutboxClaim>
                    claimOptional =
                    notificationOutboxStateService
                            .claimNextDueItem();

            if (claimOptional.isEmpty()) {

                return;
            }

            NotificationOutboxClaim claim =
                    claimOptional.get();

            processClaim(
                    claim
            );
        }
    }

    /* =====================================================
       PROCESS ONE CLAIM

       IMPORTANT:
       EmailSender executes OUTSIDE the database
       claim/finalization transactions.

       Therefore a slow email provider does not hold
       the attendance/outbox database transaction open.
    ===================================================== */

    private void processClaim(
            NotificationOutboxClaim claim
    ) {

        try {

            EmailMessage message =
                    emailContentService
                            .buildEmail(
                                    claim.parentNotificationId()
                            );

            emailSender.send(
                    message
            );

            notificationOutboxStateService
                    .markProcessed(
                            claim.outboxId()
                    );

            logger.info(
                    "Parent attendance email processed successfully: outboxId={}, notificationId={}, attempt={}",
                    claim.outboxId(),
                    claim.parentNotificationId(),
                    claim.attemptNumber()
            );
        }

        catch (Exception exception) {

            logger.error(
                    "Parent attendance email processing failed: outboxId={}, notificationId={}, attempt={}",
                    claim.outboxId(),
                    claim.parentNotificationId(),
                    claim.attemptNumber(),
                    exception
            );

            try {

                notificationOutboxStateService
                        .markFailed(
                                claim.outboxId(),
                                exception
                        );
            }

            catch (Exception stateException) {

                logger.error(
                        "Failed to persist outbox failure state: outboxId={}",
                        claim.outboxId(),
                        stateException
                );
            }
        }
    }
}