package com.example.attendancemanagementbackend.dto.notification;

import java.util.List;

public record NotificationPageResponse(

        List<NotificationResponse> content,

        int page,

        int size,

        long totalElements,

        int totalPages,

        boolean first,

        boolean last

) {
}