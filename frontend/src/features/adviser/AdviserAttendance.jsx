import { useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import {
  useAdviserSections,
  useAdviserStudents,
} from "../../hooks/queries/useStudentsQueries";

import { useActiveAttendanceSession } from "../../hooks/queries/useAttendanceQueries";

import queryKeys from "../../lib/query/queryKeys";

import "../../styles/adviser/adviserAttendance.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) => (Array.isArray(data) ? data : []);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

const getSessionId = (session) => session?.sessionId || session?.id || "";

const getStudentSectionId = (student) =>
  student?.sectionId || student?.section?.id || "";

const hasRegisteredFace = (student) =>
  student?.faceRegistered === true ||
  student?.hasFace === true ||
  student?.faceEnrolled === true;

const formatDate = () =>
  new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

const formatTime = (value) => {
  if (!value) {
    return "—";
  }

  const rawValue = String(value);

  const match = rawValue.match(/(?:T|\s|^)(\d{2}):(\d{2})/);

  if (match) {
    const hours = Number(match[1]);

    const minutes = match[2];

    const period = hours >= 12 ? "PM" : "AM";

    const normalizedHour = hours % 12 || 12;

    return `${normalizedHour}:${minutes} ${period}`;
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  }

  return rawValue;
};

/* =========================================================
   COMPONENT
========================================================= */

function AdviserAttendance() {
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const user = authService.getUser();

  /* =======================================================
     SHARED SERVER CACHE

     Sections and students reuse the shared cache already
     used by Student Management and the Dashboard.

     Active session remains live operational data.
  ======================================================= */

  const sectionsQuery = useAdviserSections();

  const studentsQuery = useAdviserStudents();

  const section = useMemo(() => {
    const sections = normalizeArray(sectionsQuery.data);

    return (
      sections.find((item) => item?.active !== false) || sections[0] || null
    );
  }, [sectionsQuery.data]);

  const students = useMemo(() => {
    if (!section?.id) {
      return [];
    }

    const allStudents = normalizeArray(studentsQuery.data);

    return allStudents.filter((student) => {
      const studentSectionId = getStudentSectionId(student);

      return (
        !studentSectionId || String(studentSectionId) === String(section.id)
      );
    });
  }, [studentsQuery.data, section?.id]);

  const activeSessionQuery = useActiveAttendanceSession(section?.id);

  const activeSession = activeSessionQuery.data || null;

  /* =======================================================
     PAGE STATE
  ======================================================= */

  const [startingSession, setStartingSession] = useState(false);

  const [pageError, setPageError] = useState("");

  const loading =
    sectionsQuery.isLoading ||
    studentsQuery.isLoading ||
    (Boolean(section?.id) && activeSessionQuery.isLoading);

  const queryError =
    (sectionsQuery.data == null && sectionsQuery.error) ||
    (studentsQuery.data == null && studentsQuery.error) ||
    (section?.id &&
      activeSessionQuery.data === undefined &&
      activeSessionQuery.error) ||
    null;

  const error =
    pageError ||
    (queryError
      ? getErrorMessage(queryError, "Unable to load attendance information.")
      : "");

  /* =======================================================
     START SESSION SETTINGS
  ======================================================= */

  const [showStartModal, setShowStartModal] = useState(false);

  const [lateAfterMinutes, setLateAfterMinutes] = useState(15);

  const [autoEndEnabled, setAutoEndEnabled] = useState(false);

  const [scheduledEndTime, setScheduledEndTime] = useState("");

  const [startSessionError, setStartSessionError] = useState("");

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const adviserName =
    user?.name?.trim() || section?.adviserName || "Class Adviser";

  const sectionName = section?.name || "No assigned section";

  const activeStudents = useMemo(
    () => students.filter((student) => student.active !== false),
    [students],
  );

  const faceRegisteredStudents = useMemo(
    () => activeStudents.filter(hasRegisteredFace),
    [activeStudents],
  );

  const facePendingCount = Math.max(
    activeStudents.length - faceRegisteredStudents.length,
    0,
  );

  const faceEnrollmentPercentage = activeStudents.length
    ? Math.round((faceRegisteredStudents.length / activeStudents.length) * 100)
    : 0;

  const activeSessionId = getSessionId(activeSession);

  const hasActiveSession = Boolean(activeSessionId);

  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    null;

  const sessionLateAfterMinutes = activeSession?.lateAfterMinutes ?? null;

  const sessionLateCutoffAt = activeSession?.lateCutoffAt || null;

  const sessionScheduledEndAt = activeSession?.scheduledEndAt || null;

  const canStartSession = Boolean(section?.id && activeStudents.length > 0);

  /* =======================================================
     OPEN START SESSION SETTINGS
  ======================================================= */

  const handleAttendanceAction = () => {
    if (startingSession) {
      return;
    }

    setPageError("");

    /*
     * ACTIVE SESSION:
     * Continue directly to the attendance workspace.
     */
    if (hasActiveSession) {
      navigate(`/adviser/attendance/${activeSessionId}`);

      return;
    }

    if (!section?.id) {
      setPageError("No assigned section is available.");

      return;
    }

    if (activeStudents.length === 0) {
      setPageError(
        "Add at least one active student before starting attendance.",
      );

      return;
    }

    setStartSessionError("");

    setShowStartModal(true);
  };

  /* =======================================================
     START CONFIGURED SESSION
  ======================================================= */

  const handleStartSession = async () => {
    if (startingSession || !section?.id) {
      return;
    }

    setStartSessionError("");

    /* ===================================================
         VALIDATE LATE ALLOWANCE
      =================================================== */

    const parsedLateMinutes = Number(lateAfterMinutes);

    if (!Number.isInteger(parsedLateMinutes) || parsedLateMinutes < 1) {
      setStartSessionError("Late allowance must be at least 1 minute.");

      return;
    }

    /* ===================================================
         VALIDATE AUTOMATIC END
      =================================================== */

    if (autoEndEnabled && !scheduledEndTime) {
      setStartSessionError("Select an automatic session end time.");

      return;
    }

    try {
      setStartingSession(true);

      const createdSession = await adviserService.startAttendanceSession({
        sectionId: section.id,

        lateAfterMinutes: parsedLateMinutes,

        scheduledEndTime: autoEndEnabled ? scheduledEndTime : null,
      });

      let createdSessionId = getSessionId(createdSession);

      /*
       * Defensive fallback in case
       * the start endpoint does not
       * directly return the session ID.
       */
      if (!createdSessionId) {
        /*
         * Defensive fallback:
         * refetch the shared active-session query.
         */
        const refreshedResult = await activeSessionQuery.refetch();

        if (refreshedResult.isError) {
          throw (
            refreshedResult.error ||
            new Error("Unable to resolve the active attendance session.")
          );
        }

        const refreshedSession = refreshedResult.data;

        createdSessionId = getSessionId(refreshedSession);
      } else {
        /*
         * Start endpoint already returned the session.
         * Put it directly into the shared cache.
         */
        queryClient.setQueryData(
          queryKeys.adviser.activeSession(section.id),
          createdSession,
        );
      }

      if (!createdSessionId) {
        throw new Error(
          "Attendance session started, but the session ID could not be resolved.",
        );
      }

      setShowStartModal(false);

      navigate(`/adviser/attendance/${createdSessionId}`);
    } catch (requestError) {
      console.error("Unable to start attendance session:", requestError);

      /*
       * If backend says there is already
       * an active session, recover it.
       */
      if (requestError?.response?.status === 409) {
        try {
          const recoveryResult = await activeSessionQuery.refetch();

          if (recoveryResult.isError) {
            throw (
              recoveryResult.error ||
              new Error("Unable to recover the active attendance session.")
            );
          }

          const currentSession = recoveryResult.data;

          const currentSessionId = getSessionId(currentSession);

          if (currentSessionId) {
            setShowStartModal(false);

            navigate(`/adviser/attendance/${currentSessionId}`);

            return;
          }
        } catch (recoveryError) {
          console.error("Unable to recover active session:", recoveryError);
        }
      }

      setStartSessionError(
        getErrorMessage(
          requestError,
          requestError?.message || "Unable to start the attendance session.",
        ),
      );
    } finally {
      setStartingSession(false);
    }
  };

  /* =======================================================
     START MODAL SCROLL LOCK
  ======================================================= */

  useEffect(() => {
    if (!showStartModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showStartModal]);

  /* =======================================================
     STUDENT MANAGEMENT
  ======================================================= */

  const handleManageStudents = () => {
    navigate("/adviser/students");
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
          <div className="adviser-alert adviser-alert-error" role="alert">
            <span className="adviser-alert-icon" aria-hidden="true">
              !
            </span>

            <div>
              <strong>Attendance unavailable</strong>

              <p>{error}</p>
            </div>
          </div>
        )}

        {/* =================================================
            HERO
        ================================================== */}

        <section className="adviser-attendance-hero">
          <div className="adviser-attendance-hero-copy">
            <span>TODAY&apos;S ATTENDANCE</span>

            <h2>{loading ? "Preparing attendance..." : sectionName}</h2>

            <p>{formatDate()}</p>
          </div>

          <div className="adviser-attendance-hero-side">
            <div className="adviser-attendance-adviser">
              <span>CLASS ADVISER</span>

              <strong>{adviserName}</strong>
            </div>

            <span
              className={`adviser-attendance-session-badge ${
                hasActiveSession ? "is-active" : ""
              }`}
            >
              <span aria-hidden="true" />

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
            <div className="adviser-attendance-summary-icon">♙</div>

            <div>
              <span>CLASS ROSTER</span>

              <strong>{loading ? "—" : activeStudents.length}</strong>

              <p>Active students</p>
            </div>
          </article>

          <article className="adviser-attendance-summary-card is-face">
            <div className="adviser-attendance-summary-icon">◎</div>

            <div>
              <span>FACE READY</span>

              <strong>{loading ? "—" : faceRegisteredStudents.length}</strong>

              <p>Registered identities</p>
            </div>
          </article>

          <article className="adviser-attendance-summary-card">
            <div className="adviser-attendance-summary-icon">◷</div>

            <div>
              <span>FACE PENDING</span>

              <strong>{loading ? "—" : facePendingCount}</strong>

              <p>Students to enroll</p>
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
              hasActiveSession ? "is-active" : ""
            }`}
          >
            <div className="adviser-attendance-session-visual">
              <div className="adviser-attendance-session-icon">
                {hasActiveSession ? "▶" : "◷"}
              </div>

              <span
                className={`adviser-attendance-live-dot ${
                  hasActiveSession ? "is-active" : ""
                }`}
              />
            </div>

            <div className="adviser-attendance-session-copy">
              <span>
                {hasActiveSession ? "ACTIVE SESSION" : "ATTENDANCE SESSION"}
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
                  : "Start a new attendance session and configure the late allowance and optional automatic ending before attendance begins."}
              </p>

              {hasActiveSession && (
                <div className="adviser-attendance-session-meta">
                  <div>
                    <span>SECTION</span>

                    <strong>{sectionName}</strong>
                  </div>

                  <div>
                    <span>STARTED</span>

                    <strong>{formatTime(sessionStartedAt)}</strong>
                  </div>

                  {sessionLateAfterMinutes !== null && (
                    <div>
                      <span>LATE AFTER</span>

                      <strong>{sessionLateAfterMinutes} min</strong>
                    </div>
                  )}

                  {sessionLateCutoffAt && (
                    <div>
                      <span>LATE CUTOFF</span>

                      <strong>{formatTime(sessionLateCutoffAt)}</strong>
                    </div>
                  )}

                  <div>
                    <span>AUTO END</span>

                    <strong>
                      {sessionScheduledEndAt
                        ? formatTime(sessionScheduledEndAt)
                        : "Manual"}
                    </strong>
                  </div>

                  <div>
                    <span>STATUS</span>

                    <strong className="is-active">Active</strong>
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
                  (!hasActiveSession && !canStartSession)
                }
                onClick={handleAttendanceAction}
              >
                {startingSession && (
                  <span className="adviser-button-spinner" aria-hidden="true" />
                )}

                <span>
                  {startingSession
                    ? "Starting Session..."
                    : hasActiveSession
                      ? "Continue Attendance"
                      : "Start Attendance"}
                </span>

                {!startingSession && <strong aria-hidden="true">→</strong>}
              </button>

              {!hasActiveSession && (
                <small>
                  Configure attendance rules before opening the live scanner.
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
                <span>CLASS READINESS</span>

                <h2>Face Enrollment</h2>
              </div>

              <strong>{faceEnrollmentPercentage}%</strong>
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
                <span>Active students</span>

                <strong>{activeStudents.length}</strong>
              </div>

              <div>
                <span>Face registered</span>

                <strong className="is-success">
                  {faceRegisteredStudents.length}
                </strong>
              </div>

              <div>
                <span>Registration pending</span>

                <strong
                  className={facePendingCount > 0 ? "is-warning" : "is-success"}
                >
                  {facePendingCount}
                </strong>
              </div>
            </div>

            {facePendingCount > 0 ? (
              <div className="adviser-attendance-readiness-note">
                <span aria-hidden="true">!</span>

                <p>
                  Students without registered faces can still have their
                  attendance recorded manually.
                </p>
              </div>
            ) : activeStudents.length > 0 ? (
              <div className="adviser-attendance-readiness-note is-ready">
                <span aria-hidden="true">✓</span>

                <p>All active students are ready for face recognition.</p>
              </div>
            ) : null}

            <button
              type="button"
              className="adviser-attendance-manage-button"
              onClick={handleManageStudents}
            >
              Manage Student Faces
              <span aria-hidden="true">→</span>
            </button>
          </aside>
        </section>

        {/* =================================================
            ATTENDANCE METHODS PREVIEW
        ================================================== */}

        <section className="adviser-attendance-methods">
          <header className="adviser-attendance-section-header">
            <div>
              <span>ATTENDANCE METHODS</span>

              <h2>Available during the session</h2>

              <p>
                Use either method depending on the situation in your classroom.
              </p>
            </div>
          </header>

          <div className="adviser-attendance-method-grid">
            <article className="adviser-attendance-method-card is-face">
              <div className="adviser-attendance-method-icon">◎</div>

              <div>
                <span>FACE RECOGNITION</span>

                <h3>Biometric Attendance</h3>

                <p>
                  Scan a registered student&apos;s face and automatically record
                  the recognized student&apos;s attendance.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                AVAILABLE
              </span>
            </article>

            <article className="adviser-attendance-method-card">
              <div className="adviser-attendance-method-icon">✓</div>

              <div>
                <span>MANUAL ENTRY</span>

                <h3>Manual Attendance</h3>

                <p>
                  Search the class roster and manually record attendance when
                  face recognition is not available.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                AVAILABLE
              </span>
            </article>

            <article className="adviser-attendance-method-card">
              <div className="adviser-attendance-method-icon">⇩</div>

              <div>
                <span>ATTENDANCE REPORT</span>

                <h3>PDF & Excel Export</h3>

                <p>
                  Review the official attendance sheet and export session
                  records for reporting.
                </p>
              </div>

              <span className="adviser-attendance-method-status">
                IN SESSION
              </span>
            </article>
          </div>
        </section>

        {/* =================================================
            START SESSION SETTINGS MODAL
        ================================================== */}

        {showStartModal && (
          <div
            className="adviser-attendance-start-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !startingSession) {
                setShowStartModal(false);

                setStartSessionError("");
              }
            }}
          >
            <section
              className="adviser-attendance-start-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-session-settings-title"
            >
              <header className="adviser-attendance-start-modal-header">
                <div className="adviser-attendance-start-modal-icon">◷</div>

                <div>
                  <span>ATTENDANCE SESSION</span>

                  <h2 id="attendance-session-settings-title">
                    Configure session
                  </h2>

                  <p>
                    Set the late allowance and choose whether this attendance
                    session should end automatically.
                  </p>
                </div>

                <button
                  type="button"
                  className="adviser-attendance-start-modal-close"
                  aria-label="Close session settings"
                  disabled={startingSession}
                  onClick={() => {
                    setShowStartModal(false);

                    setStartSessionError("");
                  }}
                >
                  ×
                </button>
              </header>

              <div className="adviser-attendance-start-overview">
                <div>
                  <span>SECTION</span>

                  <strong>{sectionName}</strong>
                </div>

                <div>
                  <span>STUDENTS</span>

                  <strong>{activeStudents.length}</strong>
                </div>

                <div>
                  <span>FACE READY</span>

                  <strong>{faceRegisteredStudents.length}</strong>
                </div>
              </div>

              <div className="adviser-attendance-start-settings">
                {/* =========================================
                    LATE POLICY
                ========================================== */}

                <section className="adviser-attendance-policy-card">
                  <div className="adviser-attendance-policy-card-heading">
                    <div>
                      <span>LATE POLICY</span>

                      <h3>Late allowance</h3>

                      <p>
                        Students recorded after this allowance will
                        automatically be marked Late.
                      </p>
                    </div>

                    <div className="adviser-attendance-policy-number">
                      <input
                        id="late-after-minutes"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={lateAfterMinutes}
                        disabled={startingSession}
                        onChange={(event) =>
                          setLateAfterMinutes(event.target.value)
                        }
                      />

                      <span>minutes</span>
                    </div>
                  </div>

                  <div className="adviser-attendance-policy-preview">
                    <span>Example</span>

                    <p>
                      If the session starts at <strong>7:30 AM</strong> with a{" "}
                      <strong>
                        {lateAfterMinutes || "—"}
                        -minute
                      </strong>{" "}
                      allowance, students recorded after the cutoff will be
                      marked <strong>LATE</strong>.
                    </p>
                  </div>
                </section>

                {/* =========================================
                    AUTO END POLICY
                ========================================== */}

                <section
                  className={`adviser-attendance-policy-card ${
                    autoEndEnabled ? "is-enabled" : ""
                  }`}
                >
                  <div className="adviser-attendance-policy-card-heading">
                    <div>
                      <span>SESSION END</span>

                      <h3>Automatic ending</h3>

                      <p>
                        The session can close automatically at a selected time.
                        Manual ending remains available.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`adviser-attendance-auto-end-toggle ${
                        autoEndEnabled ? "is-on" : ""
                      }`}
                      disabled={startingSession}
                      aria-pressed={autoEndEnabled}
                      onClick={() => {
                        setAutoEndEnabled((current) => !current);

                        setStartSessionError("");
                      }}
                    >
                      <span aria-hidden="true" />

                      {autoEndEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  {autoEndEnabled ? (
                    <label className="adviser-attendance-end-time-field">
                      <span>AUTOMATIC END TIME</span>

                      <input
                        type="time"
                        value={scheduledEndTime}
                        disabled={startingSession}
                        onChange={(event) => {
                          setScheduledEndTime(event.target.value);

                          setStartSessionError("");
                        }}
                      />

                      <small>
                        Attendance will stop at this exact time. The remaining
                        unrecorded students will be finalized as absent.
                      </small>
                    </label>
                  ) : (
                    <div className="adviser-attendance-manual-end-note">
                      <span>MANUAL END</span>

                      <p>
                        No automatic end time is configured. You must use the
                        End Session button when attendance is finished.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {startSessionError && (
                <div className="adviser-attendance-start-error" role="alert">
                  <span aria-hidden="true">!</span>

                  <p>{startSessionError}</p>
                </div>
              )}

              <div className="adviser-attendance-start-summary">
                <div>
                  <span>LATE AFTER</span>

                  <strong>{lateAfterMinutes || "—"} min</strong>
                </div>

                <div>
                  <span>SESSION END</span>

                  <strong>
                    {autoEndEnabled
                      ? scheduledEndTime
                        ? formatTime(scheduledEndTime)
                        : "Select time"
                      : "Manual"}
                  </strong>
                </div>
              </div>

              <footer className="adviser-attendance-start-actions">
                <button
                  type="button"
                  disabled={startingSession}
                  onClick={() => {
                    setShowStartModal(false);

                    setStartSessionError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="is-primary"
                  disabled={startingSession}
                  onClick={() => void handleStartSession()}
                >
                  {startingSession && (
                    <span
                      className="adviser-button-spinner"
                      aria-hidden="true"
                    />
                  )}

                  {startingSession ? "Starting Session..." : "Start Attendance"}

                  {!startingSession && <span aria-hidden="true">→</span>}
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </AdviserLayout>
  );
}

export default AdviserAttendance;
