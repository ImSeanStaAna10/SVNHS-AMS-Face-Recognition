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

    sections: () => [
      "adviser",
      "sections",
    ],

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
    allStudents: () => [
      "adviser",
      "students",
    ],

    /**
     * Keep this for pages / future APIs that cache students
     * specifically by section.
     *
     * It also remains compatible with the cache structure
     * we already started.
     */
    students: (sectionId) => [
      "adviser",
      "students",
      String(
        sectionId || "",
      ),
    ],

    /**
     * Individual student cache.
     */
    student: (studentId) => [
      "adviser",
      "student",
      String(
        studentId || "",
      ),
    ],

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
      all: () => [
        "adviser",
        "transfers",
      ],

      incoming: () => [
        "adviser",
        "transfers",
        "incoming",
      ],

      outgoing: () => [
        "adviser",
        "transfers",
        "outgoing",
      ],

      /**
       * Incoming pending-transfer badge used by AdviserTopbar.
       */
      pendingCount: () => [
        "adviser",
        "transfers",
        "pending-count",
      ],
    },

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    notifications: {
      /**
       * Parent key for every Adviser notification query.
       */
      all: () => [
        "adviser",
        "notifications",
      ],

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
      String(
        sectionId || "",
      ),
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
      String(
        sessionId || "",
      ),
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
      all: () => [
        "adviser",
        "attendance-history",
      ],

      /**
       * Each date range / page / size gets its own cache entry.
       *
       * Example:
       * ["adviser", "attendance-history", "2026-09-01",
       *  "2026-09-30", 0, 8]
       */
      list: ({
        fromDate = "",
        toDate = "",
        page = 0,
        size = 8,
      } = {}) => [
        "adviser",
        "attendance-history",
        String(
          fromDate || "",
        ),
        String(
          toDate || "",
        ),
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
        String(
          sessionId || "",
        ),
      ],
    },

    /* =====================================================
       ATTENDANCE INTERVENTION / STUDENTS AT RISK

       These keys intentionally remain separate from live
       attendance-session data.

       Attendance intervention is based on finalized records,
       so it may safely use short-lived frontend caching.

       IMPORTANT:
       - Risk data is scoped per section.
       - Preview data is scoped per intervention.
       - Parent communication history is scoped per intervention.
       - No face-recognition or live attendance data is cached here.
    ===================================================== */

    attendanceIntervention: {
      /**
       * Root key for all Adviser attendance-intervention data.
       *
       * Useful when a major intervention configuration or
       * attendance-finalization change affects several related
       * intervention queries.
       *
       * Example:
       * ["adviser", "attendance-intervention"]
       */
      all: () => [
        "adviser",
        "attendance-intervention",
      ],

      /**
       * Root prefix for all section risk-register queries.
       *
       * Example:
       * ["adviser", "attendance-intervention", "risks"]
       */
      allRisks: () => [
        "adviser",
        "attendance-intervention",
        "risks",
      ],

      /**
       * Current attendance-risk register for one section.
       *
       * Example:
       * [
       *   "adviser",
       *   "attendance-intervention",
       *   "risks",
       *   "036c36d6-cdd7-4698-b16a-e41947647d3d"
       * ]
       */
      risks: (sectionId) => [
        "adviser",
        "attendance-intervention",
        "risks",
        String(
          sectionId || "",
        ),
      ],

      /**
       * Root prefix for parent-notification previews.
       *
       * Useful if a broader intervention mutation changes
       * frozen-preview inputs across multiple interventions.
       */
      allPreviews: () => [
        "adviser",
        "attendance-intervention",
        "preview",
      ],

      /**
       * Parent-notification preview for one intervention.
       *
       * This contains data such as:
       * - student
       * - guardian
       * - current risk
       * - absence count
       * - threshold
       * - finalized absence details
       * - suggested Adviser note
       *
       * Example:
       * [
       *   "adviser",
       *   "attendance-intervention",
       *   "preview",
       *   "<interventionId>"
       * ]
       */
      preview: (
        interventionId,
      ) => [
        "adviser",
        "attendance-intervention",
        "preview",
        String(
          interventionId || "",
        ),
      ],

      /**
       * Root prefix for all parent-communication history data.
       *
       * This can be invalidated after global communication
       * operations if ever needed.
       */
      allParentCommunications: () => [
        "adviser",
        "attendance-intervention",
        "parent-communications",
      ],

      /**
       * Parent communication history for one intervention.
       *
       * Includes states such as:
       * - PENDING
       * - QUEUED
       * - SENT
       * - FAILED
       * - ACKNOWLEDGED
       * - RESPONDED
       *
       * Example:
       * [
       *   "adviser",
       *   "attendance-intervention",
       *   "parent-communications",
       *   "<interventionId>"
       * ]
       */
      parentCommunications: (
        interventionId,
      ) => [
        "adviser",
        "attendance-intervention",
        "parent-communications",
        String(
          interventionId || "",
        ),
      ],
    },
  },

  /* =======================================================
     COUNCILOR

     Councilor cache is intentionally separated from Adviser
     cache so data from the two roles never shares the same
     TanStack Query entries.
  ======================================================= */

  councilor: {
    /**
     * Root key for all Councilor-related cached data.
     *
     * Useful for broad invalidation only when necessary:
     * ["councilor"]
     */
    all: ["councilor"],

    /* =====================================================
       ADVISERS
    ===================================================== */

    /**
     * Shared adviser directory used by:
     * - Councilor Dashboard
     * - Adviser Management
     * - Section Management
     * - Attendance filter options
     */
    advisers: () => [
      "councilor",
      "advisers",
    ],

    /* =====================================================
       SECTIONS
    ===================================================== */

    /**
     * Shared section directory used by:
     * - Councilor Dashboard
     * - Section Management
     * - Attendance filter options
     * - Attendance Records filters
     */
    sections: () => [
      "councilor",
      "sections",
    ],

    /* =====================================================
       ATTENDANCE REPORTS
    ===================================================== */

    attendanceReports: {
      /**
       * Parent key for all Councilor attendance report data.
       */
      all: () => [
        "councilor",
        "attendance-reports",
      ],

      /**
       * School-wide attendance overview.
       *
       * Every filter combination and page receives its own
       * cache entry.
       */
      overview: ({
        from = "",
        to = "",
        sectionId = "",
        adviserId = "",
        search = "",
        page = 0,
        size = 9,
      } = {}) => [
        "councilor",
        "attendance-reports",
        "overview",
        String(
          from || "",
        ),
        String(
          to || "",
        ),
        String(
          sectionId || "",
        ),
        String(
          adviserId || "",
        ),
        String(
          search || "",
        ),
        Number(page) || 0,
        Number(size) || 9,
      ],

      /**
       * Section-level attendance report.
       *
       * Used by AttendanceDetail.
       *
       * Section, date range, search, page, and page size are
       * all part of the key so cached pages cannot collide.
       */
      section: (
        sectionId,
        {
          from = "",
          to = "",
          search = "",
          page = 0,
          size = 25,
        } = {},
      ) => [
        "councilor",
        "attendance-reports",
        "section",
        String(
          sectionId || "",
        ),
        String(
          from || "",
        ),
        String(
          to || "",
        ),
        String(
          search || "",
        ),
        Number(page) || 0,
        Number(size) || 25,
      ],
    },
  },

  /* =======================================================
     SUPERADMIN

     Shared cache for system-level administrative data.

     Dashboard, Department Management, and Councilor
     Management reuse these same query entries.
  ======================================================= */

  superadmin: {
    /**
     * Root key for all SuperAdmin-related cached data.
     */
    all: ["superadmin"],

    /**
     * Department directory.
     */
    departments: () => [
      "superadmin",
      "departments",
    ],

    /**
     * Councilor account directory.
     */
    councilors: () => [
      "superadmin",
      "councilors",
    ],
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
    all: () => [
      "attendance-reports",
    ],

    /**
     * Role-scoped prefix.
     *
     * Useful after report regeneration because regeneration can
     * affect several pages or filter combinations for that role.
     */
    archives: (
      role,
    ) => [
      "attendance-reports",
      "archive",
      String(
        role || "",
      )
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
      String(
        role || "",
      )
        .trim()
        .toUpperCase(),

      String(
        type || "",
      ),

      String(
        sectionId || "",
      ),

      String(
        from || "",
      ),

      String(
        to || "",
      ),

      Number(page) || 0,

      Number(size) || 12,
    ],
  },
};

export default queryKeys;