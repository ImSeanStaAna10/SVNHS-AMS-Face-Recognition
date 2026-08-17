package com.example.attendancemanagementbackend.dto.attendance;

import java.time.LocalDate;

public record AttendanceSectionDetailResponse(

        LocalDate fromDate,

        LocalDate toDate,

        AttendanceSectionInfoResponse section,

        AttendanceSectionDetailSummaryResponse summary,

        PagedResponse<AttendanceStudentReportResponse> students

) {
}