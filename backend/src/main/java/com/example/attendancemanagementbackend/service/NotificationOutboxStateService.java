package com.example.attendancemanagementbackend.service;

import com.example.attendancemanagementbackend.entity.NotificationOutbox;
import com.example.attendancemanagementbackend.entity.NotificationOutboxStatus;
import com.example.attendancemanagementbackend.entity.ParentNotification;
import com.example.attendancemanagementbackend.entity.ParentNotificationStatus;

import com.example.attendancemanagementbackend.repository.NotificationOutboxRepository;
import com.example.attendancemanagementbackend.repository.ParentNotificationRepository;

import com.example.attendancemanagementbackend.util.AppTime;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.data.domain.PageRequest;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.util.List;
import java.util.Optional;

@Service
public class NotificationOutboxStateService {

    private final NotificationOutboxRepository
            notificationOutboxRepository;

    private final ParentNotificationRepository
            parentNotificationRepository;

    private final int maxAttempts;

    private final long retryBaseSeconds;

    public NotificationOutboxStateService(
            NotificationOutboxRepository notificationOutboxRepository,
            ParentNotificationRepository parentNotificationRepository,

            @Value(
                    "${app.email.outbox.max-attempts:5}"
            )
            int maxAttempts,

            @Value(
                    "${app.email.outbox.retry-base-seconds:60}"
            )
            long retryBaseSeconds
    ) {

        this.notificationOutboxRepository =
                notificationOutboxRepository;

        this.parentNotificationRepository =
                parentNotificationRepository;

        this.maxAttempts =
                Math.max(
                        maxAttempts,
                        1
                );

        this.retryBaseSeconds =
                Math.max(
                        retryBaseSeconds,
                        1L
                );
    }

    /* =====================================================
       CLAIM NEXT JOB
    ===================================================== */

    @Transactional(
            propagation = Propagation.REQUIRES_NEW
    )
    public Optional<NotificationOutboxClaim>
    claimNextDueItem() {

        LocalDateTime now =
                AppTime.now();

        List<NotificationOutbox> dueItems =
                notificationOutboxRepository
                        .findDueOutboxItemsForUpdate(
                                now,
                                maxAttempts,
                                PageRequest.of(
                                        0,
                                        1
                                )
                        );

        if (dueItems.isEmpty()) {

            return Optional.empty();
        }

        NotificationOutbox outbox =
                dueItems.getFirst();

        /* =====================================================
           CLAIM OUTBOX
        ===================================================== */

        int nextAttemptNumber =
                outbox.getAttemptCount() +
                        1;

        outbox.setStatus(
                NotificationOutboxStatus.PROCESSING
        );

        outbox.setAttemptCount(
                nextAttemptNumber
        );

        outbox.setLastAttemptAt(
                now
        );

        /*
         * While PROCESSING there should be no scheduled
         * retry time.
         */
        outbox.setNextAttemptAt(
                null
        );

        outbox.setLastError(
                null
        );

        notificationOutboxRepository
                .save(
                        outbox
                );

        /* =====================================================
           RESTORE NOTIFICATION TO QUEUED WHEN RETRYING
        ===================================================== */

        ParentNotification notification =
                outbox.getParentNotification();

        if (notification != null &&
                notification.getStatus() ==
                        ParentNotificationStatus.FAILED) {

            notification.setStatus(
                    ParentNotificationStatus.QUEUED
            );

            parentNotificationRepository
                    .save(
                            notification
                    );
        }

        String parentNotificationId =
                notification != null
                        ? notification.getId()
                        : null;

        if (parentNotificationId == null) {

            throw new IllegalStateException(
                    "Outbox does not have a parent notification"
            );
        }

        return Optional.of(
                new NotificationOutboxClaim(
                        outbox.getId(),
                        parentNotificationId,
                        nextAttemptNumber
                )
        );
    }

    /* =====================================================
       MARK SUCCESS
    ===================================================== */

    @Transactional(
            propagation = Propagation.REQUIRES_NEW
    )
    public void markProcessed(
            String outboxId
    ) {

        NotificationOutbox outbox =
                notificationOutboxRepository
                        .findById(
                                outboxId
                        )
                        .orElse(null);

        if (outbox == null) {
            return;
        }

        /*
         * Defensive idempotency.
         */
        if (outbox.getStatus() ==
                NotificationOutboxStatus.PROCESSED) {

            return;
        }

        LocalDateTime now =
                AppTime.now();

        outbox.setStatus(
                NotificationOutboxStatus.PROCESSED
        );

        outbox.setProcessedAt(
                now
        );

        outbox.setNextAttemptAt(
                null
        );

        outbox.setLastError(
                null
        );

        notificationOutboxRepository
                .save(
                        outbox
                );

        /* =====================================================
           UPDATE PARENT NOTIFICATION
        ===================================================== */

        ParentNotification notification =
                outbox.getParentNotification();

        if (notification == null) {
            return;
        }

        notification.setStatus(
                ParentNotificationStatus.SENT
        );

        notification.setSentAt(
                now
        );

        notification.setFailedAt(
                null
        );

        notification.setFailureReason(
                null
        );

        parentNotificationRepository
                .save(
                        notification
                );
    }

    /* =====================================================
       MARK FAILURE
    ===================================================== */

    @Transactional(
            propagation = Propagation.REQUIRES_NEW
    )
    public void markFailed(
            String outboxId,
            Throwable failure
    ) {

        NotificationOutbox outbox =
                notificationOutboxRepository
                        .findById(
                                outboxId
                        )
                        .orElse(null);

        if (outbox == null) {
            return;
        }

        LocalDateTime now =
                AppTime.now();

        String errorMessage =
                normalizeError(
                        failure
                );

        outbox.setStatus(
                NotificationOutboxStatus.FAILED
        );

        outbox.setLastError(
                errorMessage
        );

        /*
         * Retry only while below max attempts.
         */
        if (outbox.getAttemptCount() <
                maxAttempts) {

            outbox.setNextAttemptAt(
                    calculateNextAttempt(
                            now,
                            outbox.getAttemptCount()
                    )
            );
        }

        /*
         * Maximum attempts reached.
         *
         * null means no automatic retry remains.
         *
         * Our claim query intentionally requires
         * FAILED jobs to have a non-null due time.
         */
        else {

            outbox.setNextAttemptAt(
                    null
            );
        }

        notificationOutboxRepository
                .save(
                        outbox
                );

        /* =====================================================
           UPDATE PARENT NOTIFICATION
        ===================================================== */

        ParentNotification notification =
                outbox.getParentNotification();

        if (notification == null) {
            return;
        }

        notification.setStatus(
                ParentNotificationStatus.FAILED
        );

        notification.setFailedAt(
                now
        );

        notification.setFailureReason(
                errorMessage
        );

        parentNotificationRepository
                .save(
                        notification
                );
    }

    /* =====================================================
       RETRY BACKOFF
    ===================================================== */

    private LocalDateTime calculateNextAttempt(
            LocalDateTime now,
            int attemptCount
    ) {

        /*
         * Exponential retry:
         *
         * attempt 1 -> base
         * attempt 2 -> base * 2
         * attempt 3 -> base * 4
         * attempt 4 -> base * 8
         *
         * Cap exponent defensively.
         */

        int exponent =
                Math.max(
                        0,
                        Math.min(
                                attemptCount - 1,
                                10
                        )
                );

        long multiplier =
                1L << exponent;

        long delaySeconds;

        try {

            delaySeconds =
                    Math.multiplyExact(
                            retryBaseSeconds,
                            multiplier
                    );
        }

        catch (ArithmeticException exception) {

            delaySeconds =
                    Long.MAX_VALUE /
                            2;
        }

        /*
         * Defensive upper bound:
         * maximum seven days.
         */
        delaySeconds =
                Math.min(
                        delaySeconds,
                        604800L
                );

        return now.plusSeconds(
                delaySeconds
        );
    }

    /* =====================================================
       SAFE ERROR MESSAGE
    ===================================================== */

    private String normalizeError(
            Throwable failure
    ) {

        String message;

        if (failure == null) {

            message =
                    "Unknown email delivery failure";
        }

        else if (failure.getMessage() == null ||
                failure.getMessage().isBlank()) {

            message =
                    failure
                            .getClass()
                            .getSimpleName();
        }

        else {

            message =
                    failure.getMessage()
                            .trim();
        }

        /*
         * Avoid huge provider stack/error payloads
         * being written into operational DB rows.
         */
        int maxLength =
                4000;

        if (message.length() >
                maxLength) {

            return message.substring(
                    0,
                    maxLength
            );
        }

        return message;
    }
}