export const queryKeys = {
  adviser: {
    /**
     * Root key for all Adviser-related cached data.
     *
     * Useful for broad invalidation when absolutely needed:
     * ["adviser"]
     */
    all: ["adviser"],

    /* =====================================================
       SECTIONS
    ===================================================== */

    sections: () => ["adviser", "sections"],

    /* =====================================================
       STUDENTS
    ===================================================== */

    /**
     * Current Student Management uses:
     *
     * adviserService.getStudents()
     *
     * without a sectionId parameter.
     *
     * This key represents that full Adviser student response.
     */
    allStudents: () => ["adviser", "students"],

    /**
     * Keep this for pages / future APIs that cache students
     * specifically by section.
     *
     * It also remains compatible with the cache structure
     * we already started.
     */
    students: (sectionId) => ["adviser", "students", String(sectionId || "")],

    /**
     * Individual student cache.
     */
    student: (studentId) => ["adviser", "student", String(studentId || "")],

    /* =====================================================
       STUDENT TRANSFERS
    ===================================================== */

    transfers: {
      /**
       * Parent transfer key.
       *
       * Invalidating this prefix can affect both incoming
       * and outgoing transfer queries.
       */
      all: () => ["adviser", "transfers"],

      incoming: () => ["adviser", "transfers", "incoming"],

      outgoing: () => ["adviser", "transfers", "outgoing"],

      /**
       * Incoming pending-transfer badge used by AdviserTopbar.
       */
      pendingCount: () => ["adviser", "transfers", "pending-count"],
    },

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    notifications: {
      /**
       * Parent key for every Adviser notification query.
       */
      all: () => ["adviser", "notifications"],

      /**
       * Topbar notification summary.
       *
       * The summary service returns:
       * - latest notifications
       * - unread count
       * - total notification count
       *
       * Size is part of the key because another notification
       * surface may request a different number of items.
       */
      topbar: (size = 10) => [
        "adviser",
        "notifications",
        "topbar",
        Number(size) || 10,
      ],
    },

    /* =====================================================
       ACTIVE ATTENDANCE SESSION
    ===================================================== */

    activeSession: (sectionId) => [
      "adviser",
      "active-session",
      String(sectionId || ""),
    ],

    /* =====================================================
       LIVE ATTENDANCE SESSION RECORDS
    ===================================================== */

    /**
     * Used by active/live attendance flows.
     *
     * Keep this separate from historical records because
     * active attendance data should stay aggressively fresh.
     */
    sessionRecords: (sessionId) => [
      "adviser",
      "session-records",
      String(sessionId || ""),
    ],

    /* =====================================================
       ATTENDANCE HISTORY
    ===================================================== */

    attendanceHistory: {
      /**
       * Parent key for all attendance-history list queries.
       *
       * Example:
       * ["adviser", "attendance-history"]
       */
      all: () => ["adviser", "attendance-history"],

      /**
       * Each date range / page / size gets its own cache entry.
       *
       * Example:
       * ["adviser", "attendance-history", "2026-09-01",
       *  "2026-09-30", 0, 8]
       */
      list: ({ fromDate = "", toDate = "", page = 0, size = 8 } = {}) => [
        "adviser",
        "attendance-history",
        String(fromDate || ""),
        String(toDate || ""),
        Number(page) || 0,
        Number(size) || 8,
      ],

      /**
       * Completed-session records use a different key from
       * live session records even though both currently call
       * adviserService.getSessionRecords(sessionId).
       *
       * This lets historical records use cachePolicy.history
       * without changing live attendance behavior.
       */
      sessionRecords: (sessionId) => [
        "adviser",
        "attendance-history",
        "session-records",
        String(sessionId || ""),
      ],
    },
  },

  /* =======================================================
     ATTENDANCE REPORT ARCHIVE

     This is intentionally top-level because AttendanceRecords
     is shared by ADVISER and COUNCILOR.

     The role is part of every report key so one role never
     reuses the other role's cached archive.
  ======================================================= */

  attendanceReports: {
    /**
     * Root key for all report archive cache entries.
     */
    all: () => ["attendance-reports"],

    /**
     * Role-scoped prefix.
     *
     * Useful after report regeneration because regeneration can
     * affect several pages or filter combinations for that role.
     */
    archives: (role) => [
      "attendance-reports",
      "archive",
      String(role || "")
        .trim()
        .toUpperCase(),
    ],

    /**
     * One cache entry per role + filters + page.
     */
    archive: ({
      role = "",
      type = "",
      sectionId = "",
      from = "",
      to = "",
      page = 0,
      size = 12,
    } = {}) => [
      "attendance-reports",
      "archive",
      String(role || "")
        .trim()
        .toUpperCase(),
      String(type || ""),
      String(sectionId || ""),
      String(from || ""),
      String(to || ""),
      Number(page) || 0,
      Number(size) || 12,
    ],
  },
};

export default queryKeys;
