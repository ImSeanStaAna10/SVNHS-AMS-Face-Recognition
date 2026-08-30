package com.example.attendancemanagementbackend.exception;

import org.springframework.http.HttpStatus;

public class AmbiguousFaceMatchException extends ApiException {

    private final String topStudentId;
    private final String topStudentNumber;
    private final String topStudentName;
    private final double topDistance;

    private final String secondStudentId;
    private final String secondStudentNumber;
    private final String secondStudentName;
    private final double secondDistance;

    public AmbiguousFaceMatchException(
            String topStudentId,
            String topStudentNumber,
            String topStudentName,
            double topDistance,
            String secondStudentId,
            String secondStudentNumber,
            String secondStudentName,
            double secondDistance
    ) {
        super(
                HttpStatus.CONFLICT,
                "Two students are too similar for safe automatic attendance"
        );

        this.topStudentId = topStudentId;
        this.topStudentNumber = topStudentNumber;
        this.topStudentName = topStudentName;
        this.topDistance = topDistance;

        this.secondStudentId = secondStudentId;
        this.secondStudentNumber = secondStudentNumber;
        this.secondStudentName = secondStudentName;
        this.secondDistance = secondDistance;
    }

    public String getTopStudentId() {
        return topStudentId;
    }

    public String getTopStudentNumber() {
        return topStudentNumber;
    }

    public String getTopStudentName() {
        return topStudentName;
    }

    public double getTopDistance() {
        return topDistance;
    }

    public String getSecondStudentId() {
        return secondStudentId;
    }

    public String getSecondStudentNumber() {
        return secondStudentNumber;
    }

    public String getSecondStudentName() {
        return secondStudentName;
    }

    public double getSecondDistance() {
        return secondDistance;
    }
}