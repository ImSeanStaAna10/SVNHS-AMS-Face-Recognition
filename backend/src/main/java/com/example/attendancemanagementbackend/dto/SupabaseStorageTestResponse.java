package com.example.attendancemanagementbackend.dto;

public record SupabaseStorageTestResponse(

        boolean success,

        String bucket,

        String objectKey,

        boolean uploadVerified,

        boolean downloadVerified,

        boolean deleteVerified

) {
}