package com.example.attendancemanagementbackend.controller;

import com.example.attendancemanagementbackend.dto.intervention.ParentNotificationQueueResponse;

import com.example.attendancemanagementbackend.service.ParentNotificationQueueService;

import org.springframework.http.HttpStatus;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
        "/api/parent-notifications"
)
public class ParentNotificationDeliveryController {

    private final ParentNotificationQueueService
            parentNotificationQueueService;

    public ParentNotificationDeliveryController(
            ParentNotificationQueueService parentNotificationQueueService
    ) {

        this.parentNotificationQueueService =
                parentNotificationQueueService;
    }

    /* =====================================================
       SEND PARENT NOTIFICATION

       Client semantics:
       "Send"

       Backend semantics:
       Queue for asynchronous delivery.

       No Gmail/network call happens inside this request.
    ===================================================== */

    @PostMapping(
            "/{notificationId}/send"
    )
    @ResponseStatus(
            HttpStatus.ACCEPTED
    )
    public ParentNotificationQueueResponse send(
            @PathVariable String notificationId
    ) {

        return parentNotificationQueueService
                .queueForDelivery(
                        notificationId
                );
    }
}