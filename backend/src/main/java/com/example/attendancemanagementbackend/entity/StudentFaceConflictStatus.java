package com.example.attendancemanagementbackend.entity;

public enum StudentFaceConflictStatus {

    /**
     * A highly similar face was detected and the two
     * Student identities have not yet been verified.
     */
    PENDING,

    /**
     * A human verifier confirmed that the two Student
     * records belong to different physical people.
     *
     * Example:
     * twins or highly similar-looking students.
     */
    VERIFIED_DIFFERENT_PEOPLE,

    /**
     * A human verifier confirmed that the two Student
     * records represent the same physical person.
     */
    CONFIRMED_SAME_PERSON
}