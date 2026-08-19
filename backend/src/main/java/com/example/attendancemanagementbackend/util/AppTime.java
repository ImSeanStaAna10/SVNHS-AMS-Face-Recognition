package com.example.attendancemanagementbackend.util;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

public final class AppTime {

    private static final ZoneId PHILIPPINES =
            ZoneId.of("Asia/Manila");

    private AppTime() {
        /*
         * Utility class.
         * Prevent instantiation.
         */
    }

    public static LocalDate today() {
        return LocalDate.now(PHILIPPINES);
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(PHILIPPINES);
    }
}