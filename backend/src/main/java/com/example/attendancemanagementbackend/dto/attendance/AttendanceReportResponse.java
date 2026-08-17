package com.example.attendancemanagementbackend.dto.attendance;

import java.time.LocalDate;

public record AttendanceReportResponse(

        LocalDate fromDate,

        LocalDate toDate,

        AttendanceReportSummaryResponse summary,

        PagedResponse<AttendanceSectionCardResponse> sections

) {
}