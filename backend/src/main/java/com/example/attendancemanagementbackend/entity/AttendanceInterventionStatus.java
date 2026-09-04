package com.example.attendancemanagementbackend.entity;

public enum AttendanceInterventionStatus {

    /*
     * Newly-created risk intervention.
     *
     * The Adviser has not reviewed or acted
     * on the intervention yet.
     */
    OPEN,

    /*
     * The Adviser has reviewed the intervention.
     */
    REVIEWED,

    /*
     * A parent/guardian notification has already
     * been created/sent for this intervention.
     *
     * Later phases will define the exact
     * notification delivery lifecycle.
     */
    NOTIFIED,

    /*
     * Intervention has been manually or
     * administratively resolved.
     */
    RESOLVED
}