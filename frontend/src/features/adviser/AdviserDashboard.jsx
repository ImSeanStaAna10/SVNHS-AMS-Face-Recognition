import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import "../../styles/adviser.css";

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const normalizeArray = (data) =>
  Array.isArray(data)
    ? data
    : [];

/**
 * AttendanceSession responses use sessionId in the
 * verified API tests. "id" is kept as a defensive fallback.
 */
const getSessionId = (session) =>
  session?.sessionId ||
  session?.id ||
  "";

/**
 * Handles ISO timestamps as well as simple HH:mm / HH:mm:ss
 * values returned by the backend.
 */
const formatTime = (value) => {
  if (!value) {
    return "—";
  }

  const rawValue =
    String(value);

  const timeMatch =
    rawValue.match(
      /(?:T|\s|^)(\d{2}):(\d{2})/,
    );

  if (timeMatch) {
    const hours =
      Number(timeMatch[1]);

    const minutes =
      timeMatch[2];

    const period =
      hours >= 12
        ? "PM"
        : "AM";

    const normalizedHours =
      hours % 12 || 12;

    return `${normalizedHours}:${minutes} ${period}`;
  }

  const parsedDate =
    new Date(value);

  if (
    !Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return new Intl.DateTimeFormat(
      "en-PH",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    ).format(parsedDate);
  }

  return rawValue;
};

const formatToday = () =>
  new Intl.DateTimeFormat(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(new Date());

/* =========================================================
   COMPONENT
========================================================= */

function AdviserDashboard() {
  const navigate =
    useNavigate();

  const user =
    authService.getUser();

  /* =======================================================
     DATA STATE
  ======================================================= */

  const [
    section,
    setSection,
  ] = useState(null);

  const [
    students,
    setStudents,
  ] = useState([]);

  const [
    activeSession,
    setActiveSession,
  ] = useState(null);

  const [
    sessionRecords,
    setSessionRecords,
  ] = useState([]);

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* =======================================================
     FEEDBACK STATE
  ======================================================= */

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadDashboard =
      async () => {
        try {
          setLoading(true);
          setError("");

          /*
           * Sections and students can be fetched
           * independently.
           */
          const [
            sectionData,
            studentData,
          ] =
            await Promise.all([
              adviserService.getSections(),
              adviserService.getStudents(),
            ]);

          if (!isMounted) {
            return;
          }

          const sections =
            normalizeArray(
              sectionData,
            );

          const allStudents =
            normalizeArray(
              studentData,
            );

          /*
           * Adviser normally owns one assigned section.
           *
           * Prefer an active one if the backend ever
           * returns more than one.
           */
          const assignedSection =
            sections.find(
              (item) =>
                item.active !== false,
            ) ||
            sections[0] ||
            null;

          setSection(
            assignedSection,
          );

          /*
           * GET /students is already Adviser-scoped by
           * the backend.
           *
           * We still filter by sectionId when available
           * for an additional frontend safeguard.
           */
          const scopedStudents =
            assignedSection?.id
              ? allStudents.filter(
                  (student) =>
                    !student.sectionId ||
                    student.sectionId ===
                      assignedSection.id,
                )
              : allStudents;

          setStudents(
            scopedStudents,
          );

          /*
           * No section means there is nothing else
           * to query.
           */
          if (
            !assignedSection?.id
          ) {
            setActiveSession(
              null,
            );

            setSessionRecords(
              [],
            );

            return;
          }

          const session =
            await adviserService.getActiveSession(
              assignedSection.id,
            );

          if (!isMounted) {
            return;
          }

          setActiveSession(
            session,
          );

          const sessionId =
            getSessionId(
              session,
            );

          if (!sessionId) {
            setSessionRecords(
              [],
            );

            return;
          }

          const records =
            await adviserService.getSessionRecords(
              sessionId,
            );

          if (!isMounted) {
            return;
          }

          setSessionRecords(
            normalizeArray(
              records,
            ),
          );
        } catch (requestError) {
          console.error(
            "Unable to load Adviser dashboard:",
            requestError,
          );

          if (!isMounted) {
            return;
          }

          setError(
            getErrorMessage(
              requestError,
              "Unable to load your Adviser dashboard.",
            ),
          );
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const activeStudents =
    useMemo(
      () =>
        students.filter(
          (student) =>
            student.active !==
            false,
        ),
      [students],
    );

  const attendanceCounts =
    useMemo(() => {
      return sessionRecords.reduce(
        (counts, record) => {
          const status =
            String(
              record?.status || "",
            )
              .trim()
              .toUpperCase();

          if (
            status ===
            "PRESENT"
          ) {
            counts.present += 1;
            counts.attended += 1;
          } else if (
            status ===
            "LATE"
          ) {
            counts.late += 1;
            counts.attended += 1;
          }

          return counts;
        },
        {
          present: 0,
          late: 0,
          attended: 0,
        },
      );
    }, [sessionRecords]);

  const presentCount =
    attendanceCounts.present;

  const lateCount =
    attendanceCounts.late;

  const attendedCount =
    attendanceCounts.attended;

  const remainingCount =
    Math.max(
      activeStudents.length -
        attendedCount,
      0,
    );

  const sessionId =
    getSessionId(
      activeSession,
    );

  const hasActiveSession =
    Boolean(
      activeSession &&
        sessionId,
    );

  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    null;

  const adviserName =
    user?.name?.trim() ||
    section?.adviserName ||
    "Adviser";

  const firstName =
    adviserName
      .split(/\s+/)
      .filter(Boolean)[0] ||
    "Adviser";

  const sectionName =
    section?.name ||
    "No assigned section";

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const goToStudents = () => {
    navigate(
      "/adviser/students",
    );
  };

  const goToFaceRegistration =
    () => {
      /*
       * Face registration is student-specific,
       * so Adviser first chooses a Student.
       */
      navigate(
        "/adviser/students",
        {
          state: {
            action:
              "register-face",
          },
        },
      );
    };

  const openAttendance =
    () => {
      if (
        hasActiveSession
      ) {
        navigate(
          `/adviser/attendance/${sessionId}`,
        );

        return;
      }

      /*
       * Session creation and policy configuration now live
       * in the Adviser Attendance page. This keeps one
       * source of truth for late allowance and optional
       * automatic session ending.
       */
      navigate(
        "/adviser/attendance",
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Dashboard"
      eyebrow="ADVISER PORTAL"
      description="Assigned section and daily attendance readiness"
    >
      <section className="adviser-dashboard">
        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div
            className="adviser-alert adviser-alert-error"
            role="alert"
          >
            <span
              className="adviser-alert-icon"
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Dashboard unavailable
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            HERO
        ================================================== */}

        <section className="adviser-dashboard-hero">
          <div className="adviser-dashboard-hero-copy">
            <span className="adviser-dashboard-eyebrow">
              CLASS ADVISER WORKSPACE
            </span>

            <h2>
              Good day,{" "}
              {firstName}.
            </h2>

            <p>
              Manage your assigned
              section, prepare student
              records, and conduct
              today's attendance from
              one workspace.
            </p>

            <div className="adviser-dashboard-date">
              <span
                aria-hidden="true"
              >
                ◷
              </span>

              {formatToday()}
            </div>
          </div>

          <div className="adviser-dashboard-hero-context">
            <span>
              ASSIGNED SECTION
            </span>

            <strong>
              {loading
                ? "Loading..."
                : sectionName}
            </strong>

            <small>
              Signal Village National
              High School
            </small>
          </div>
        </section>

        {/* =================================================
            LOADING
        ================================================== */}

        {loading ? (
          <section
            className="adviser-dashboard-loading"
            aria-label="Loading dashboard"
          >
            <div className="adviser-skeleton adviser-skeleton-stat" />
            <div className="adviser-skeleton adviser-skeleton-stat" />
            <div className="adviser-skeleton adviser-skeleton-stat" />

            <div className="adviser-skeleton adviser-skeleton-panel" />
            <div className="adviser-skeleton adviser-skeleton-panel" />
          </section>
        ) : !section ? (
          /* =================================================
             NO ASSIGNED SECTION
          ================================================== */

          <section className="adviser-no-section">
            <div
              className="adviser-no-section-icon"
              aria-hidden="true"
            >
              ◇
            </div>

            <div>
              <span>
                SECTION ASSIGNMENT
              </span>

              <h2>
                No section assigned
              </h2>

              <p>
                Your Adviser account
                does not currently have
                an assigned section.
                Contact the Councilor
                before managing students
                or starting attendance.
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ===============================================
                SUMMARY CARDS
            ================================================ */}

            <section
              className="adviser-summary-grid"
              aria-label="Adviser summary"
            >
              {/* TOTAL STUDENTS */}

              <article className="adviser-summary-card">
                <div className="adviser-summary-card-top">
                  <span
                    className="adviser-summary-icon"
                    aria-hidden="true"
                  >
                    ♙
                  </span>

                  <span className="adviser-summary-label">
                    CLASS ROSTER
                  </span>
                </div>

                <strong className="adviser-summary-value">
                  {students.length}
                </strong>

                <h3>
                  Total Students
                </h3>

                <p>
                  Students currently
                  visible in your
                  assigned section.
                </p>
              </article>

              {/* ACTIVE STUDENTS */}

              <article className="adviser-summary-card">
                <div className="adviser-summary-card-top">
                  <span
                    className="adviser-summary-icon adviser-summary-icon-success"
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <span className="adviser-summary-label">
                    ACTIVE
                  </span>
                </div>

                <strong className="adviser-summary-value">
                  {
                    activeStudents.length
                  }
                </strong>

                <h3>
                  Active Students
                </h3>

                <p>
                  Active student records
                  eligible for current
                  class operations.
                </p>
              </article>

              {/* ATTENDANCE */}

              <article
                className={`adviser-summary-card ${
                  hasActiveSession
                    ? "adviser-summary-card-active"
                    : ""
                }`}
              >
                <div className="adviser-summary-card-top">
                  <span
                    className={`adviser-summary-icon ${
                      hasActiveSession
                        ? "adviser-summary-icon-success"
                        : ""
                    }`}
                    aria-hidden="true"
                  >
                    ◷
                  </span>

                  <span className="adviser-summary-label">
                    ATTENDANCE
                  </span>
                </div>

                <strong
                  className={`adviser-summary-session ${
                    hasActiveSession
                      ? "is-active"
                      : ""
                  }`}
                >
                  {hasActiveSession
                    ? "ACTIVE"
                    : "READY"}
                </strong>

                <h3>
                  Session Status
                </h3>

                <p>
                  {hasActiveSession
                    ? `${presentCount} present${
                        lateCount > 0
                          ? ` • ${lateCount} late`
                          : ""
                      } recorded.`
                    : "No attendance session is currently active."}
                </p>
              </article>
            </section>

            {/* ===============================================
                PRIMARY DASHBOARD
            ================================================ */}

            <section className="adviser-primary-grid">
              {/* =============================================
                  ASSIGNED SECTION
              ============================================== */}

              <article className="adviser-panel adviser-section-panel">
                <header className="adviser-panel-header">
                  <div>
                    <span className="adviser-panel-eyebrow">
                      ASSIGNED SECTION
                    </span>

                    <h2>
                      Class Overview
                    </h2>

                    <p>
                      Your current
                      teaching and
                      attendance scope.
                    </p>
                  </div>

                  <span
                    className={`adviser-section-status ${
                      section.active ===
                      false
                        ? "is-inactive"
                        : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                    />

                    {section.active ===
                    false
                      ? "Inactive"
                      : "Active"}
                  </span>
                </header>

                <div className="adviser-section-identity">
                  <div className="adviser-section-mark">
                    <span>
                      SECTION
                    </span>

                    <strong>
                      {section.name
                        ?.charAt(0)
                        ?.toUpperCase() ||
                        "S"}
                    </strong>
                  </div>

                  <div className="adviser-section-copy">
                    <span>
                      SIGNAL VILLAGE NATIONAL
                      HIGH SCHOOL
                    </span>

                    <h3>
                      {sectionName}
                    </h3>

                    <p>
                      Adviser:{" "}
                      <strong>
                        {section.adviserName ||
                          adviserName}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="adviser-section-metrics">
                  <div>
                    <span>
                      TOTAL STUDENTS
                    </span>

                    <strong>
                      {
                        students.length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ACTIVE STUDENTS
                    </span>

                    <strong>
                      {
                        activeStudents.length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      SECTION STATUS
                    </span>

                    <strong>
                      {section.active ===
                      false
                        ? "Inactive"
                        : "Active"}
                    </strong>
                  </div>
                </div>

                <footer className="adviser-panel-footer">
                  <p>
                    Student records and
                    face registration are
                    managed within this
                    assigned section.
                  </p>

                  <button
                    type="button"
                    className="adviser-secondary-button"
                    onClick={
                      goToStudents
                    }
                  >
                    Manage Students
                    <span
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </button>
                </footer>
              </article>

              {/* =============================================
                  ATTENDANCE SESSION
              ============================================== */}

              <article
                className={`adviser-panel adviser-session-panel ${
                  hasActiveSession
                    ? "is-active"
                    : ""
                }`}
              >
                <header className="adviser-panel-header">
                  <div>
                    <span className="adviser-panel-eyebrow">
                      TODAY'S ATTENDANCE
                    </span>

                    <h2>
                      Attendance Session
                    </h2>

                    <p>
                      {hasActiveSession
                        ? "Attendance recording is currently in progress."
                        : "Attendance is ready when you are."}
                    </p>
                  </div>

                  <span
                    className={`adviser-session-badge ${
                      hasActiveSession
                        ? "is-active"
                        : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                    />

                    {hasActiveSession
                      ? "ACTIVE"
                      : "NO ACTIVE SESSION"}
                  </span>
                </header>

                {hasActiveSession ? (
                  <>
                    <div className="adviser-active-session">
                      <div className="adviser-active-session-indicator">
                        <span
                          className="adviser-active-session-pulse"
                          aria-hidden="true"
                        />

                        <div>
                          <span>
                            ATTENDANCE IN
                            PROGRESS
                          </span>

                          <strong>
                            {sectionName}
                          </strong>
                        </div>
                      </div>

                      <div className="adviser-session-start">
                        <span>
                          STARTED
                        </span>

                        <strong>
                          {formatTime(
                            sessionStartedAt,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="adviser-session-metrics">
                      <div>
                        <span>
                          TOTAL
                        </span>

                        <strong>
                          {
                            activeStudents.length
                          }
                        </strong>

                        <small>
                          Students
                        </small>
                      </div>

                      <div className="is-present">
                        <span>
                          PRESENT
                        </span>

                        <strong>
                          {
                            presentCount
                          }
                        </strong>

                        <small>
                          Recorded
                        </small>
                      </div>

                      <div>
                        <span>
                          REMAINING
                        </span>

                        <strong>
                          {
                            remainingCount
                          }
                        </strong>

                        <small>
                          Pending
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="adviser-primary-button adviser-session-primary-action"
                      onClick={
                        openAttendance
                      }
                    >
                      Open Attendance
                      Session
                      <span
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="adviser-session-empty">
                    <div
                      className="adviser-session-empty-icon"
                      aria-hidden="true"
                    >
                      ◷
                    </div>

                    <div>
                      <span>
                        NO ACTIVE SESSION
                      </span>

                      <h3>
                        Ready for today's
                        attendance
                      </h3>

                      <p>
                        Start a session
                        for{" "}
                        <strong>
                          {sectionName}
                        </strong>{" "}
                        when you are
                        ready to record
                        student
                        attendance.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="adviser-primary-button"
                      onClick={
                        openAttendance
                      }
                    >
                      <span
                        aria-hidden="true"
                      >
                        +
                      </span>

                      Start Attendance
                      Session
                    </button>
                  </div>
                )}
              </article>
            </section>

            {/* ===============================================
                QUICK ACTIONS
            ================================================ */}

            <section className="adviser-quick-panel">
              <header className="adviser-quick-header">
                <div>
                  <span>
                    QUICK ACTIONS
                  </span>

                  <h2>
                    Adviser Operations
                  </h2>

                  <p>
                    Common actions for
                    managing your class
                    and today's
                    attendance.
                  </p>
                </div>

                <div className="adviser-quick-section">
                  <span>
                    CURRENT SECTION
                  </span>

                  <strong>
                    {sectionName}
                  </strong>
                </div>
              </header>

              <div className="adviser-quick-grid">
                {/* ADD STUDENT */}

                <button
                  type="button"
                  className="adviser-quick-card"
                  onClick={
                    goToStudents
                  }
                >
                  <span
                    className="adviser-quick-icon"
                    aria-hidden="true"
                  >
                    +
                  </span>

                  <span className="adviser-quick-copy">
                    <strong>
                      Add Student
                    </strong>

                    <small>
                      Add a student
                      record to your
                      assigned section.
                    </small>
                  </span>

                  <span
                    className="adviser-quick-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>

                {/* REGISTER FACE */}

                <button
                  type="button"
                  className="adviser-quick-card"
                  onClick={
                    goToFaceRegistration
                  }
                >
                  <span
                    className="adviser-quick-icon"
                    aria-hidden="true"
                  >
                    ◎
                  </span>

                  <span className="adviser-quick-copy">
                    <strong>
                      Register Student
                      Face
                    </strong>

                    <small>
                      Select a student
                      and enroll their
                      face identity.
                    </small>
                  </span>

                  <span
                    className="adviser-quick-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>

                {/* ATTENDANCE */}

                <button
                  type="button"
                  className={`adviser-quick-card adviser-quick-attendance ${
                    hasActiveSession
                      ? "is-active"
                      : ""
                  }`}
                  onClick={
                    openAttendance
                  }
                >
                  <span
                    className="adviser-quick-icon"
                    aria-hidden="true"
                  >
                    ◷
                  </span>

                  <span className="adviser-quick-copy">
                    <strong>
                      {hasActiveSession
                        ? "Open Attendance"
                        : "Start Attendance"}
                    </strong>

                    <small>
                      {hasActiveSession
                        ? `${presentCount} present${
                            lateCount > 0
                              ? ` • ${lateCount} late`
                              : ""
                          } • ${remainingCount} remaining`
                        : "Begin today's attendance session."}
                    </small>
                  </span>

                  <span
                    className="adviser-quick-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              </div>
            </section>
          </>
        )}
      </section>

    </AdviserLayout>
  );
}

export default AdviserDashboard;