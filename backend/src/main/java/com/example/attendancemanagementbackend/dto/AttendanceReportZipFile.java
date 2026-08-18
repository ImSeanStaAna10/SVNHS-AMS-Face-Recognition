package com.example.attendancemanagementbackend.dto;

public record AttendanceReportZipFile(

        String fileName,

        byte[] content

) {
}