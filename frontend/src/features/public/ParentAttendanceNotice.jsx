import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import publicParentNotificationService from "../../services/publicParentNotificationService";

import "./ParentAttendanceNotice.css";

/* =========================================================
   FORMATTERS
========================================================= */

const formatDate = (value) => {
  if (!value) {
    return "Date unavailable";
  }

  try {
    const date =
      new Date(
        `${value}T00:00:00`,
      );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    ).format(date);
  } catch {
    return value;
  }
};

const formatDateTimeDate = (
  value,
) => {
  if (!value) {
    return "Unavailable";
  }

  try {
    const date =
      new Date(value);

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    ).format(date);
  } catch {
    return value;
  }
};

const formatTime = (value) => {
  if (!value) {
    return null;
  }

  try {
    const date =
      new Date(value);

    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    ).format(date);
  } catch {
    return null;
  }
};

const formatSessionTime = (
  startedAt,
  endedAt,
) => {
  const start =
    formatTime(startedAt);

  const end =
    formatTime(endedAt);

  if (
    start &&
    end
  ) {
    return `${start} – ${end}`;
  }

  if (start) {
    return start;
  }

  if (end) {
    return end;
  }

  return "Session time unavailable";
};

const formatStatus = (value) => {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ");
};

const formatRiskLevel = (value) => {
  if (!value) {
    return "Normal";
  }

  return String(value)
    .replaceAll("_", " ");
};

/* =========================================================
   API ERROR
========================================================= */

const getApiError = (
  error,
  fallbackMessage,
) => {
  const data =
    error?.response?.data;

  if (
    typeof data?.message ===
      "string" &&
    data.message.trim()
  ) {
    return data.message.trim();
  }

  if (
    typeof data?.error ===
      "string" &&
    data.error.trim()
  ) {
    return data.error.trim();
  }

  if (
    typeof error?.message ===
      "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallbackMessage;
};

/* =========================================================
   COMPONENT
========================================================= */

function ParentAttendanceNotice() {
  const {
    token,
  } = useParams();

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState(null);

  const [
    acknowledging,
    setAcknowledging,
  ] = useState(false);

  const [
    responseText,
    setResponseText,
  ] = useState("");

  const [
    submittingResponse,
    setSubmittingResponse,
  ] = useState(false);

  const [
    actionMessage,
    setActionMessage,
  ] = useState(null);

  const [
    actionError,
    setActionError,
  ] = useState(null);

  /* =======================================================
     LOAD NOTICE
  ======================================================= */

  const loadNotice =
    useCallback(
      async () => {
        if (!token) {
          setPageError({
            type: "invalid",
            message:
              "This attendance notice link is invalid.",
          });

          setLoading(false);

          return;
        }

        setLoading(true);
        setPageError(null);

        try {
          const data =
            await publicParentNotificationService
              .getNotice(token);

          setNotice(data);

          if (
            data?.parentResponse
          ) {
            setResponseText(
              data.parentResponse,
            );
          }
        } catch (error) {
          const status =
            error?.response?.status;

          if (status === 404) {
            setPageError({
              type: "invalid",
              message:
                "This attendance notice could not be found. The link may be invalid.",
            });
          } else if (
            status === 410
          ) {
            setPageError({
              type: "expired",
              message:
                "This secure attendance notice link has expired.",
            });
          } else {
            setPageError({
              type: "error",
              message:
                getApiError(
                  error,
                  "We could not load this attendance notice. Please try again later.",
                ),
            });
          }
        } finally {
          setLoading(false);
        }
      },
      [token],
    );

  useEffect(() => {
    loadNotice();
  }, [
    loadNotice,
  ]);

  /* =======================================================
     DERIVED STATE
  ======================================================= */

  const hasAcknowledged =
    Boolean(
      notice?.acknowledgedAt,
    ) ||
    notice?.status ===
      "ACKNOWLEDGED" ||
    notice?.status ===
      "RESPONDED";

  const hasResponded =
    Boolean(
      notice?.respondedAt,
    ) ||
    notice?.status ===
      "RESPONDED";

  const canAcknowledge =
    Boolean(
      notice
        ?.acknowledgementAllowed,
    ) &&
    !hasAcknowledged;

  const canRespond =
    Boolean(
      notice?.responseAllowed,
    ) &&
    !hasResponded;

  const responseCharacters =
    responseText.length;

  const responseTooLong =
    responseCharacters > 2000;

  const riskClass =
    useMemo(() => {
      switch (
        notice?.riskLevel
      ) {
        case "NORMAL":
          return "parent-notice-risk parent-notice-risk--normal";

        case "WARNING":
          return "parent-notice-risk parent-notice-risk--warning";

        case "AT_RISK":
          return "parent-notice-risk parent-notice-risk--at-risk";

        case "CRITICAL":
          return "parent-notice-risk parent-notice-risk--critical";

        default:
          return "parent-notice-risk";
      }
    }, [
      notice?.riskLevel,
    ]);

  /* =======================================================
     ACKNOWLEDGE
  ======================================================= */

  const handleAcknowledge =
    async () => {
      if (
        !token ||
        acknowledging ||
        !canAcknowledge
      ) {
        return;
      }

      setAcknowledging(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const updatedNotice =
          await publicParentNotificationService
            .acknowledgeNotice(
              token,
            );

        setNotice(
          updatedNotice,
        );

        setActionMessage(
          "Thank you. Your acknowledgement has been recorded.",
        );
      } catch (error) {
        setActionError(
          getApiError(
            error,
            "We could not record your acknowledgement. Please try again.",
          ),
        );
      } finally {
        setAcknowledging(false);
      }
    };

  /* =======================================================
     SUBMIT RESPONSE
  ======================================================= */

  const handleSubmitResponse =
    async (event) => {
      event.preventDefault();

      if (
        !token ||
        submittingResponse ||
        !canRespond
      ) {
        return;
      }

      const normalized =
        responseText.trim();

      if (!normalized) {
        setActionError(
          "Please enter your response before submitting.",
        );

        return;
      }

      if (
        normalized.length >
        2000
      ) {
        setActionError(
          "Your response must not exceed 2,000 characters.",
        );

        return;
      }

      setSubmittingResponse(
        true,
      );

      setActionError(null);
      setActionMessage(null);

      try {
        const updatedNotice =
          await publicParentNotificationService
            .submitResponse(
              token,
              normalized,
            );

        setNotice(
          updatedNotice,
        );

        setResponseText(
          updatedNotice
            ?.parentResponse ||
            normalized,
        );

        setActionMessage(
          "Thank you. Your response has been submitted successfully.",
        );
      } catch (error) {
        setActionError(
          getApiError(
            error,
            "We could not submit your response. Please try again.",
          ),
        );
      } finally {
        setSubmittingResponse(
          false,
        );
      }
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="parent-notice-page">
        <div className="parent-notice-shell parent-notice-shell--state">
          <div
            className="parent-notice-spinner"
            aria-hidden="true"
          />

          <h1>
            Loading attendance notice
          </h1>

          <p>
            Please wait while we
            securely retrieve the
            attendance information.
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (
    pageError ||
    !notice
  ) {
    return (
      <main className="parent-notice-page">
        <div className="parent-notice-shell parent-notice-shell--state">
          <div className="parent-notice-state-mark">
            !
          </div>

          <p className="parent-notice-eyebrow">
            SVNHS Attendance
          </p>

          <h1>
            {pageError?.type ===
            "expired"
              ? "Link expired"
              : "Notice unavailable"}
          </h1>

          <p>
            {pageError?.message ||
              "This attendance notice is unavailable."}
          </p>

          <p className="parent-notice-state-help">
            If you believe this is an
            error, please contact the
            student's adviser or the
            school.
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     NOTICE
  ======================================================= */

  return (
    <main className="parent-notice-page">
      <div className="parent-notice-shell">
        {/* ===============================================
            HEADER
        =============================================== */}

        <header className="parent-notice-header">
          <div className="parent-notice-brand">
            <div
              className="parent-notice-brand-mark"
              aria-hidden="true"
            >
              S
            </div>

            <div>
              <div className="parent-notice-school">
                SVNHS
              </div>

              <div className="parent-notice-system-name">
                Attendance Management
                System
              </div>
            </div>
          </div>

          <div className="parent-notice-secure">
            Secure Parent Notice
          </div>
        </header>

        {/* ===============================================
            CONTENT
        =============================================== */}

        <section className="parent-notice-content">
          <div className="parent-notice-heading">
            <p className="parent-notice-eyebrow">
              Attendance intervention
            </p>

            <h1>
              Attendance Notice
            </h1>

            <p>
              Dear{" "}
              <strong>
                {notice.recipientName}
              </strong>
              , please review the
              finalized attendance
              information below.
            </p>
          </div>

          {/* =============================================
              STUDENT
          ============================================= */}

          <section className="parent-notice-student-card">
            <div>
              <span className="parent-notice-label">
                Student
              </span>

              <h2>
                {notice.studentName}
              </h2>

              <p>
                Student Number:{" "}
                <strong>
                  {
                    notice.studentNumber
                  }
                </strong>
              </p>
            </div>

            <span
              className={
                riskClass
              }
            >
              {formatRiskLevel(
                notice.riskLevel,
              )}
            </span>
          </section>

          {/* =============================================
              SUMMARY
          ============================================= */}

          <section className="parent-notice-summary-grid">
            <article className="parent-notice-summary-card">
              <span className="parent-notice-label">
                Risk Level
              </span>

              <strong>
                {formatRiskLevel(
                  notice.riskLevel,
                )}
              </strong>
            </article>

            <article className="parent-notice-summary-card">
              <span className="parent-notice-label">
                Finalized Absences
              </span>

              <strong className="parent-notice-summary-number">
                {
                  notice.absenceCount
                }
              </strong>
            </article>

            <article className="parent-notice-summary-card">
              <span className="parent-notice-label">
                Notice Status
              </span>

              <strong>
                {formatStatus(
                  notice.status,
                )}
              </strong>
            </article>
          </section>

          {/* =============================================
              ATTENDANCE DETAILS
          ============================================= */}

          <section className="parent-notice-section">
            <div className="parent-notice-section-heading">
              <div>
                <span className="parent-notice-label">
                  Finalized records
                </span>

                <h2>
                  Attendance Details
                </h2>
              </div>
            </div>

            {Array.isArray(
              notice.absences,
            ) &&
            notice.absences.length >
              0 ? (
              <div className="parent-notice-record-list">
                {notice.absences.map(
                  (
                    absence,
                    index,
                  ) => (
                    <article
                      key={`${absence.attendanceDate}-${absence.sessionStartedAt}-${index}`}
                      className="parent-notice-record"
                    >
                      <div className="parent-notice-record-main">
                        <strong>
                          {formatDate(
                            absence.attendanceDate,
                          )}
                        </strong>

                        <span>
                          {formatSessionTime(
                            absence.sessionStartedAt,
                            absence.sessionEndedAt,
                          )}
                        </span>
                      </div>

                      <span className="parent-notice-absence-badge">
                        {formatStatus(
                          absence.status,
                        )}
                      </span>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <div className="parent-notice-empty">
                No finalized absence
                records are available
                for this notice.
              </div>
            )}
          </section>

          {/* =============================================
              ADVISER NOTE
          ============================================= */}

          {notice.adviserNote && (
            <section className="parent-notice-adviser-note">
              <span className="parent-notice-label">
                Adviser Note
              </span>

              <p>
                {notice.adviserNote}
              </p>
            </section>
          )}

          {/* =============================================
              ACTION RESULT
          ============================================= */}

          {actionMessage && (
            <div
              className="parent-notice-alert parent-notice-alert--success"
              role="status"
            >
              {actionMessage}
            </div>
          )}

          {actionError && (
            <div
              className="parent-notice-alert parent-notice-alert--error"
              role="alert"
            >
              {actionError}
            </div>
          )}

          {/* =============================================
              ACKNOWLEDGEMENT
          ============================================= */}

          {notice
            .acknowledgementAllowed && (
            <section className="parent-notice-action-card">
              <div className="parent-notice-action-copy">
                <span className="parent-notice-label">
                  Parent acknowledgement
                </span>

                <h2>
                  Confirm that you
                  received this notice
                </h2>

                <p>
                  Acknowledging confirms
                  that you have received
                  and reviewed the
                  attendance notice. It
                  does not change the
                  student's attendance
                  record.
                </p>
              </div>

              {hasAcknowledged ? (
                <div className="parent-notice-complete">
                  <div className="parent-notice-complete-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      Notice acknowledged
                    </strong>

                    {notice.acknowledgedAt && (
                      <span>
                        Recorded on{" "}
                        {formatDateTimeDate(
                          notice.acknowledgedAt,
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="parent-notice-primary-button"
                  onClick={
                    handleAcknowledge
                  }
                  disabled={
                    acknowledging
                  }
                >
                  {acknowledging
                    ? "Recording..."
                    : "Acknowledge Notice"}
                </button>
              )}
            </section>
          )}

          {/* =============================================
              PARENT RESPONSE
          ============================================= */}

          {notice
            .responseAllowed && (
            <section className="parent-notice-action-card">
              <div className="parent-notice-action-copy">
                <span className="parent-notice-label">
                  Parent response
                </span>

                <h2>
                  Send a response to the
                  school
                </h2>

                <p>
                  You may provide an
                  optional message or
                  clarification regarding
                  this attendance notice.
                </p>
              </div>

              {hasResponded ? (
                <div className="parent-notice-submitted-response">
                  <span className="parent-notice-label">
                    Submitted response
                  </span>

                  <p>
                    {
                      notice.parentResponse
                    }
                  </p>

                  {notice.respondedAt && (
                    <small>
                      Submitted on{" "}
                      {formatDateTimeDate(
                        notice.respondedAt,
                      )}
                    </small>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={
                    handleSubmitResponse
                  }
                  className="parent-notice-response-form"
                >
                  <label
                    htmlFor="parentResponse"
                    className="parent-notice-response-label"
                  >
                    Your message
                  </label>

                  <textarea
                    id="parentResponse"
                    value={
                      responseText
                    }
                    onChange={(
                      event,
                    ) => {
                      setResponseText(
                        event.target
                          .value,
                      );

                      if (
                        actionError
                      ) {
                        setActionError(
                          null,
                        );
                      }
                    }}
                    maxLength={
                      2100
                    }
                    rows={5}
                    placeholder="Write your response here..."
                    disabled={
                      submittingResponse
                    }
                  />

                  <div className="parent-notice-response-meta">
                    <span
                      className={
                        responseTooLong
                          ? "parent-notice-character-count parent-notice-character-count--error"
                          : "parent-notice-character-count"
                      }
                    >
                      {
                        responseCharacters
                      }
                      /2000
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="parent-notice-primary-button"
                    disabled={
                      submittingResponse ||
                      !responseText.trim() ||
                      responseTooLong
                    }
                  >
                    {submittingResponse
                      ? "Submitting..."
                      : "Submit Response"}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* =============================================
              EXPIRATION / PRIVACY
          ============================================= */}

          <section className="parent-notice-security-note">
            <strong>
              Secure attendance notice
            </strong>

            <p>
              This page was opened
              through a private link sent
              to the registered
              guardian's email address.
              Please do not share or
              forward the link.
            </p>

            {notice.tokenExpiresAt && (
              <span>
                This secure link expires
                on{" "}
                {formatDateTimeDate(
                  notice.tokenExpiresAt,
                )}
                .
              </span>
            )}
          </section>
        </section>

        {/* ===============================================
            FOOTER
        =============================================== */}

        <footer className="parent-notice-footer">
          <strong>
            SVNHS Attendance Management
            System
          </strong>

          <span>
            For attendance concerns,
            please coordinate with the
            student's adviser or the
            school.
          </span>
        </footer>
      </div>
    </main>
  );
}

export default ParentAttendanceNotice;