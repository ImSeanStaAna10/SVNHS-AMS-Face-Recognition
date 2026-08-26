package com.example.attendancemanagementbackend.dto.attendance;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record StartAttendanceSessionRequest(

        @NotBlank(
                message = "Section ID is required"
        )
        String sectionId,

        @NotNull(
                message = "Late allowance is required"
        )
        @Min(
                value = 1,
                message = "Late allowance must be at least 1 minute"
        )
        Integer lateAfterMinutes,

        /*
         * Optional.
         *
         * null:
         * Adviser will manually end the session.
         *
         * non-null:
         * Session will automatically end
         * at the selected time.
         *
         * Example:
         * "09:00"
         */
        LocalTime scheduledEndTime

) {
}