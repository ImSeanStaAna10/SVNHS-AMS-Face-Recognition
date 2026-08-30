package com.example.attendancemanagementbackend.dto;

public enum FaceConflictVerificationOutcome {

    /**
     * The second capture still strongly matches
     * the same conflicting Student.
     *
     * Automatic verification cannot safely decide
     * whether these are twins / similar people /
     * duplicate identities.
     */
    MANUAL_REVIEW_REQUIRED,

    /**
     * The original conflict could not be reproduced
     * using the verification capture.
     *
     * No face is saved automatically.
     * The Adviser should retake and retry enrollment.
     */
    CONFLICT_NOT_REPRODUCED,

    /**
     * This pair was previously verified as
     * different physical people.
     */
    VERIFIED_DIFFERENT_PEOPLE,

    /**
     * This pair was previously confirmed as
     * the same physical person.
     */
    CONFIRMED_SAME_PERSON
}