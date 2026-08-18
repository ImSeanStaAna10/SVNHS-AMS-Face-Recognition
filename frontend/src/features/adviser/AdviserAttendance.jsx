import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import "../../styles/adviser/adviserAttendance.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) =>
  Array.isArray(data) ? data : [];

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

const getSessionId = (session) =>
  session?.sessionId ||
  session?.id ||
  "";

const getStudentSectionId = (
  student,
) =>
  student?.sectionId ||
  student?.section?.id ||
  "";

const hasRegisteredFace = (
  student,
) =>
  student?.faceRegistered === true ||
  student?.hasFace === true ||
  student?.faceEnrolled === true;

const formatDate = () =>
  new Intl.DateTimeFormat(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(new Date());

const formatTime = (value) => {
  if (!value) {
    return "—";
  }

  const rawValue =
    String(value);

  const match =
    rawValue.match(
      /(?:T|\s|^)(\d{2}):(\d{2})/,
    );

  if (match) {
    const hours =
      Number(match[1]);

    const minutes =
      match[2];

    const period =
      hours >= 12
        ? "PM"
        : "AM";

    const normalizedHour =
      hours % 12 || 12;

    return `${normalizedHour}:${minutes} ${period}`;
  }

  const parsed =
    new Date(value);

  if (
    !Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return new Intl.DateTimeFormat(
      "en-PH",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    ).format(parsed);
  }

  return rawValue;
};

/* =========================================================
   COMPONENT
========================================================= */

function AdviserAttendance() {
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

  /* =======================================================
     PAGE STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    startingSession,
    setStartingSession,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     LOAD ATTENDANCE PAGE
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadAttendancePage =
      async () => {
        try {
          setLoading(true);

          setError("");

          const [
            sectionData,
            studentData,
          ] =
            await Promise.all([
              adviserService.getSections(),
              adviserService.getStudents(),
            ]);

          if (!mounted) {
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

          const assignedSection =
            sections.find(
              (item) =>
                item.active !==
                false,
            ) ||
            sections[0] ||
            null;

          setSection(
            assignedSection,
          );

          if (
            !assignedSection?.id
          ) {
            setStudents(
              [],
            );

            setActiveSession(
              null,
            );

            return;
          }

          const scopedStudents =
            allStudents.filter(
              (student) => {
                const studentSectionId =
                  getStudentSectionId(
                    student,
                  );

                return (
                  !studentSectionId ||
                  studentSectionId ===
                    assignedSection.id
                );
              },
            );

          setStudents(
            scopedStudents,
          );

          const currentSession =
            await adviserService.getActiveSession(
              assignedSection.id,
            );

          if (!mounted) {
            return;
          }

          setActiveSession(
            currentSession,
          );
        } catch (
          requestError
        ) {
          console.error(
            "Unable to load attendance page:",
            requestError,
          );

          if (!mounted) {
            return;
          }

          setError(
            getErrorMessage(
              requestError,
              "Unable to load attendance information.",
            ),
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void loadAttendancePage();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const adviserName =
    user?.name?.trim() ||
    section?.adviserName ||
    "Class Adviser";

  const sectionName =
    section?.name ||
    "No assigned section";

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

  const faceRegisteredStudents =
    useMemo(
      () =>
        activeStudents.filter(
          hasRegisteredFace,
        ),
      [activeStudents],
    );

  const facePendingCount =
    Math.max(
      activeStudents.length -
        faceRegisteredStudents.length,
      0,
    );

  const faceEnrollmentPercentage =
    activeStudents.length
      ? Math.round(
          (faceRegisteredStudents.length /
            activeStudents.length) *
            100,
        )
      : 0;

  const activeSessionId =
    getSessionId(
      activeSession,
    );

  const hasActiveSession =
    Boolean(
      activeSessionId,
    );

  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    null;

  const canStartSession =
    Boolean(
      section?.id &&
        activeStudents.length >
          0,
    );

  /* =======================================================
     START / CONTINUE SESSION
  ======================================================= */

  const handleAttendanceAction =
    async () => {
      if (startingSession) {
        return;
      }

      setError("");

      /*
       * ACTIVE SESSION:
       * go directly to the operational
       * attendance workspace.
       */
      if (hasActiveSession) {
        navigate(
          `/adviser/attendance/${activeSessionId}`,
        );

        return;
      }

      if (!section?.id) {
        setError(
          "No assigned section is available.",
        );

        return;
      }

      if (
        activeStudents.length ===
        0
      ) {
        setError(
          "Add at least one active student before starting attendance.",
        );

        return;
      }

      try {
        setStartingSession(
          true,
        );

        const createdSession =
          await adviserService.startAttendanceSession(
            section.id,
          );

        let createdSessionId =
          getSessionId(
            createdSession,
          );

        /*
         * Defensive fallback in case
         * the start endpoint does not
         * directly return the session ID.
         */
        if (!createdSessionId) {
          const refreshedSession =
            await adviserService.getActiveSession(
              section.id,
            );

          createdSessionId =
            getSessionId(
              refreshedSession,
            );

          setActiveSession(
            refreshedSession,
          );
        } else {
          setActiveSession(
            createdSession,
          );
        }

        if (!createdSessionId) {
          throw new Error(
            "Attendance session started, but the session ID could not be resolved.",
          );
        }

        navigate(
          `/adviser/attendance/${createdSessionId}`,
        );
      } catch (
        requestError
      ) {
        console.error(
          "Unable to start attendance session:",
          requestError,
        );

        /*
         * If backend says there is
         * already an active session,
         * recover by fetching it.
         */
        if (
          requestError?.response
            ?.status === 409
        ) {
          try {
            const currentSession =
              await adviserService.getActiveSession(
                section.id,
              );

            const currentSessionId =
              getSessionId(
                currentSession,
              );

            if (
              currentSessionId
            ) {
              setActiveSession(
                currentSession,
              );

              navigate(
                `/adviser/attendance/${currentSessionId}`,
              );

              return;
            }
          } catch (
            recoveryError
          ) {
            console.error(
              "Unable to recover active session:",
              recoveryError,
            );
          }
        }

        setError(
          getErrorMessage(
            requestError,
            requestError?.message ||
              "Unable to start the attendance session.",
          ),
        );
      } finally {
        setStartingSession(
          false,
        );
      }
    };

  /* =======================================================
     STUDENT MANAGEMENT
  ======================================================= */

  const handleManageStudents =
    () => {
      navigate(
        "/adviser/students",
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Attendance"
      eyebrow="ADVISER PORTAL"
      description="Start, continue, and manage your class attendance session"
    >
      <section className="adviser-attendance">
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
                Attendance unavailable
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

        <section className="adviser-attendance-hero">
          <div className="adviser-attendance-hero-copy">
            <span>
              TODAY'S ATTENDANCE
            </span>

            <h2>
              {loading
                ? "Preparing attendance..."
                : sectionName}
            </h2>

            <p>
              {formatDate()}
            </p>
          </div>

          <div className="adviser-attendance-hero-side">
            <div className="adviser-attendance-adviser">
              <span>
                CLASS ADVISER
              </span>

              <strong>
                {adviserName}
              </strong>
            </div>

            <span
              className={`adviser-attendance-session-badge ${
                hasActiveSession
                  ? "is-active"
                  : ""
              }`}
            >
              <span
                aria-hidden="true"
              />

              {loading
                ? "CHECKING"
                : hasActiveSession
                  ? "SESSION ACTIVE"
                  : "READY"}
            </span>
          </div>
        </section>

        {/* =================================================
            CLASS READINESS
        ================================================== */}

        <section className="adviser-attendance-summary-grid">
          <article className="adviser-attendance-summary-card">
            <div className="adviser-attendance-summary-icon">
              ♙
            </div>

            <div>
              <span>
                CLASS ROSTER
              </span>

              <strong>
                {loading
                  ? "—"
                  : activeStudents.length}
              </strong>

              <p>
                Active students
              </p>
            </div>
          </article>

          <article className="adviser-attendance-summary-card is-face">
            <div className="adviser-attendance-summary-icon">
              ◎
            </div>

            <div>
              <span>
                FACE READY
              </span>

              <strong>
                {loading
                  ? "—"
                  : faceRegisteredStudents.length}
              </strong>

              <p>
                Registered identities
              </p>
            </div>
          </article>

          <article className="adviser-attendance-summary-card">
            <div className="adviser-attendance-summary-icon">
              ◷
            </div>

            <div>
              <span>
                FACE PENDING
              </span>

              <strong>
                {loading
                  ? "—"
                  : facePendingCount}
              </strong>

              <p>
                Students to enroll
              </p>
            </div>
          </article>
        </section>

        {/* =================================================
            MAIN SESSION WORKSPACE
        ================================================== */}

        <section className="adviser-attendance-workspace">
          {/* ===============================================
              SESSION CARD
          ================================================ */}

          <article
            className={`adviser-attendance-session-card ${
              hasActiveSession
                ? "is-active"
                : ""
            }`}
          >
            <div className="adviser-attendance-session-visual">
              <div className="adviser-attendance-session-icon">
                {hasActiveSession
                  ? "▶"
                  : "◷"}
              </div>

              <span
                className={`adviser-attendance-live-dot ${
                  hasActiveSession
                    ? "is-active"
                    : ""
                }`}
              />
            </div>

            <div className="adviser-attendance-session-copy">
              <span>
                {hasActiveSession
                  ? "ACTIVE SESSION"
                  : "ATTENDANCE SESSION"}
              </span>

              <h2>
                {hasActiveSession
                  ? "Attendance is currently in progress"
                  : "Ready to take today's attendance"}
              </h2>

              <p>
                {hasActiveSession
                  ? `This session started at ${formatTime(
                      sessionStartedAt,
                    )}. Continue where you left off to record more students.`
                  : "Start a new attendance session for your assigned section. You can use face recognition or manual attendance once the session begins."}
              </p>

              {hasActiveSession && (
                <div className="adviser-attendance-session-meta">
                  <div>
                    <span>
                      SECTION
                    </span>

                    <strong>
                      {sectionName}
                    </strong>
                  </div>

                  <div>
                    <span>
                      STARTED
                    </span>

                    <strong>
                      {formatTime(
                        sessionStartedAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      STATUS
                    </span>

                    <strong className="is-active">
                      Active
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="adviser-attendance-session-action">
              <button
                type="button"
                className="adviser-attendance-primary-action"
                disabled={
                  loading ||
                  startingSession ||
                  (!hasActiveSession &&
                    !canStartSession)
                }
                onClick={() =>
                  void handleAttendanceAction()
                }
              >
                {startingSession && (
                  <span
                    className="adviser-button-spinner"
                    aria-hidden="true"
                  />
                )}

                <span>
                  {startingSession
                    ? "Starting Session..."
                    : hasActiveSession
                      ? "Continue Attendance"
                      : "Start Attendance"}
                </span>

                {!startingSession && (
                  <strong
                    aria-hidden="true"
                  >
                    →
                  </strong>
                )}
              </button>

              {!hasActiveSession && (
                <small>
                  Starting a session enables
                  manual and face-recognition
                  attendance.
                </small>
              )}
            </div>
          </article>

          {/* ===============================================
              READINESS PANEL
          ================================================ */}

          <aside className="adviser-attendance-readiness">
            <header>
              <div>
                <span>
                  CLASS READINESS
                </span>

                <h2>
                  Face Enrollment
                </h2>
              </div>

              <strong>
                {faceEnrollmentPercentage}%
              </strong>
            </header>

            <div className="adviser-attendance-readiness-progress">
              <span
                style={{
                  width: `${faceEnrollmentPercentage}%`,
                }}
              />
            </div>

            <div className="adviser-attendance-readiness-list">
              <div>
                <span>
                  Active students
                </span>

                <strong>
                  {activeStudents.length}
                </strong>
              </div>

              <div>
                <span>
                  Face registered
                </span>

                <strong className="is-success">
                  {
                    faceRegisteredStudents.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Registration pending
                </span>

                <strong
                  className={
                    facePendingCount >
                    0
                      ? "is-warning"
                      : "is-success"
                  }
                >
                  {facePendingCount}
                </strong>
              </div>
            </div>

            {facePendingCount >
            0 ? (
              <div className="adviser-attendance-readiness-note">
                <span
                  aria-hidden="true"
                >
                  !
                </span>

                <p>
                  Students without registered
                  faces can still be marked
                  present manually.
                </p>
              </div>
            ) : activeStudents.length >
              0 ? (
              <div className="adviser-attendance-readiness-note is-ready">
                <span
                  aria-hidden="true"
                >
                  ✓
                </span>

                <p>
                  All active students are
                  ready for face recognition.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="adviser-attendance-manage-button"
              onClick={
                handleManageStudents
              }
            >
              Manage Student Faces
              <span
                aria-hidden="true"
              >
                →
              </span>
            </button>
          </aside>
        </section>

        {/* =================================================
            ATTENDANCE METHODS PREVIEW
        ================================================== */}

        <section className="adviser-attendance-methods">
          <header className="adviser-attendance-section-header">
            <div>
              <span>
                ATTENDANCE METHODS
              </span>

              <h2>
                Available during the session
              </h2>

              <p>
                Use either method depending
                on the situation in your
                classroom.
              </p>
            </div>
          </header>

          <div className="adviser-attendance-method-grid">
            <article className="adviser-attendance-method-card is-face">
              <div className="adviser-attendance-method-icon">
                ◎
              </div>

              <div>
                <span>
                  FACE RECOGNITION
                </span>

                <h3>
                  Biometric Attendance
                </h3>

                <p>
                  Scan a registered student's
                  face and automatically mark
                  the recognized student
                  present.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                AVAILABLE
              </span>
            </article>

            <article className="adviser-attendance-method-card">
              <div className="adviser-attendance-method-icon">
                ✓
              </div>

              <div>
                <span>
                  MANUAL ENTRY
                </span>

                <h3>
                  Manual Attendance
                </h3>

                <p>
                  Search the class roster and
                  manually mark a student
                  present when needed.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                AVAILABLE
              </span>
            </article>

            <article className="adviser-attendance-method-card">
              <div className="adviser-attendance-method-icon">
                ⇩
              </div>

              <div>
                <span>
                  ATTENDANCE REPORT
                </span>

                <h3>
                  PDF & Excel Export
                </h3>

                <p>
                  Review the official
                  attendance sheet and export
                  session records for
                  reporting.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                IN SESSION
              </span>
            </article>
          </div>
        </section>
      </section>
    </AdviserLayout>
  );
}

export default AdviserAttendance;