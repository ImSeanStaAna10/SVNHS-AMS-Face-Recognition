package com.example.attendancemanagementbackend.entity;

public enum NotificationOutboxStatus {

    /*
     * Waiting for the background delivery worker.
     */
    PENDING,

    /*
     * Currently being processed by the worker.
     */
    PROCESSING,

    /*
     * Successfully processed by the delivery worker.
     *
     * For email:
     * this means the email provider accepted the request.
     */
    PROCESSED,

    /*
     * A delivery attempt failed.
     *
     * Later, nextAttemptAt will determine when
     * another retry may be attempted.
     */
    FAILED
}