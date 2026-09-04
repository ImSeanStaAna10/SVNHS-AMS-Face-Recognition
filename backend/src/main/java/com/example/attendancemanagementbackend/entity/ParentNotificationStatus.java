package com.example.attendancemanagementbackend.entity;

public enum ParentNotificationStatus {

    /*
     * Notification record exists but has not yet
     * been placed into the delivery queue.
     */
    PENDING,

    /*
     * Notification has been queued for delivery.
     */
    QUEUED,

    /*
     * Email provider accepted the send request.
     *
     * IMPORTANT:
     * SENT does not mean the parent has read it.
     */
    SENT,

    /*
     * Delivery attempt failed.
     */
    FAILED,

    /*
     * Parent opened the secure notice and explicitly
     * acknowledged that it was received.
     */
    ACKNOWLEDGED,

    /*
     * Parent submitted a response through
     * the secure notice page.
     */
    RESPONDED
}