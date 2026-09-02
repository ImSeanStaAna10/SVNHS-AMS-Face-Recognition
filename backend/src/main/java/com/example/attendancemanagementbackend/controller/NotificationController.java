package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.notification.NotificationBulkRequest;
import com.example.attendancemanagementbackend.dto.notification.NotificationMutationResponse;
import com.example.attendancemanagementbackend.dto.notification.NotificationPageResponse;
import com.example.attendancemanagementbackend.dto.notification.NotificationResponse;
import com.example.attendancemanagementbackend.dto.notification.NotificationUnreadCountResponse;

import com.example.attendancemanagementbackend.entity.NotificationType;

import com.example.attendancemanagementbackend.service.NotificationService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;

import org.springframework.validation.annotation.Validated;

import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/notifications")
@Validated
public class NotificationController {

    private final NotificationService
            notificationService;

    public NotificationController(
            NotificationService notificationService
    ) {
        this.notificationService =
                notificationService;
    }

    /* =========================================================
       LIST

       Examples:

       GET /api/notifications

       GET /api/notifications?page=0&size=10

       GET /api/notifications?read=false

       GET /api/notifications?read=true

       GET /api/notifications?type=STUDENT_TRANSFER_REQUESTED

       GET /api/notifications
           ?fromDate=2026-09-01
           &toDate=2026-09-30
    ========================================================= */

    @GetMapping
    public NotificationPageResponse getNotifications(

            @RequestParam(
                    defaultValue = "0"
            )
            @Min(0)
            int page,

            @RequestParam(
                    defaultValue = "10"
            )
            @Min(1)
            @Max(100)
            int size,

            @RequestParam(
                    required = false
            )
            Boolean read,

            @RequestParam(
                    required = false
            )
            NotificationType type,

            @RequestParam(
                    required = false
            )
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate fromDate,

            @RequestParam(
                    required = false
            )
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate toDate
    ) {

        return notificationService
                .getNotifications(
                        page,
                        size,
                        read,
                        type,
                        fromDate,
                        toDate
                );
    }

    /* =========================================================
       UNREAD COUNT
    ========================================================= */

    @GetMapping("/unread-count")
    public NotificationUnreadCountResponse getUnreadCount() {

        return new NotificationUnreadCountResponse(
                notificationService
                        .getUnreadCount()
        );
    }

    /* =========================================================
       SINGLE READ / UNREAD
    ========================================================= */

    @PatchMapping("/{notificationId}/read")
    public NotificationResponse markRead(
            @PathVariable
            String notificationId
    ) {

        return notificationService
                .markRead(
                        notificationId
                );
    }

    @PatchMapping("/{notificationId}/unread")
    public NotificationResponse markUnread(
            @PathVariable
            String notificationId
    ) {

        return notificationService
                .markUnread(
                        notificationId
                );
    }

    /* =========================================================
       MARK ALL READ
    ========================================================= */

    @PatchMapping("/read-all")
    public NotificationMutationResponse markAllRead() {

        return new NotificationMutationResponse(
                notificationService
                        .markAllRead()
        );
    }

    /* =========================================================
       BULK READ
    ========================================================= */

    @PatchMapping("/bulk/read")
    public NotificationMutationResponse markSelectedRead(
            @Valid
            @RequestBody
            NotificationBulkRequest request
    ) {

        return new NotificationMutationResponse(
                notificationService
                        .markSelectedRead(
                                request.notificationIds()
                        )
        );
    }

    /* =========================================================
       BULK UNREAD
    ========================================================= */

    @PatchMapping("/bulk/unread")
    public NotificationMutationResponse markSelectedUnread(
            @Valid
            @RequestBody
            NotificationBulkRequest request
    ) {

        return new NotificationMutationResponse(
                notificationService
                        .markSelectedUnread(
                                request.notificationIds()
                        )
        );
    }

    /* =========================================================
       DELETE ONE
       SOFT DELETE
    ========================================================= */

    @DeleteMapping("/{notificationId}")
    public NotificationMutationResponse deleteNotification(
            @PathVariable
            String notificationId
    ) {

        notificationService
                .deleteNotification(
                        notificationId
                );

        return new NotificationMutationResponse(
                1
        );
    }

    /* =========================================================
       BULK DELETE

       POST is intentional here rather than DELETE-with-body,
       which has inconsistent client/proxy support.
    ========================================================= */

    @PostMapping("/bulk/delete")
    public NotificationMutationResponse deleteSelected(
            @Valid
            @RequestBody
            NotificationBulkRequest request
    ) {

        return new NotificationMutationResponse(
                notificationService
                        .deleteSelected(
                                request.notificationIds()
                        )
        );
    }

    /* =========================================================
       DELETE ALL READ
    ========================================================= */

    @DeleteMapping("/read")
    public NotificationMutationResponse deleteAllRead() {

        return new NotificationMutationResponse(
                notificationService
                        .deleteAllRead()
        );
    }

    /* =========================================================
       DELETE ALL
    ========================================================= */

    @DeleteMapping("/all")
    public NotificationMutationResponse deleteAll() {

        return new NotificationMutationResponse(
                notificationService
                        .deleteAll()
        );
    }

    /* =========================================================
       DELETE BEFORE DATE

       DELETE /api/notifications/before?date=2026-08-01
    ========================================================= */

    @DeleteMapping("/before")
    public NotificationMutationResponse deleteBefore(

            @RequestParam

            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate date
    ) {

        return new NotificationMutationResponse(
                notificationService
                        .deleteBefore(
                                date
                        )
        );
    }
}