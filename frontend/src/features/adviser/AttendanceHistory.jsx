import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";

import "../../styles/adviser/attendanceHistory.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PH_TIME_ZONE = "Asia/Manila";

const FILTERS = [
  {
    key: "today",
    label: "Today",
  },
  {
    key: "week",
    label: "This Week",
  },
  {
    key: "month",
    label: "This Month",
  },
  {
    key: "custom",
    label: "Custom",
  },
];

/* =========================================================
   HELPERS
========================================================= */

const pad = (value) =>
  String(value).padStart(2, "0");

const toDateInputValue = (date) => {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: PH_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] =
        part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (date, amount) => {
  const next =
    new Date(date);

  next.setDate(
    next.getDate() + amount,
  );

  return next;
};

const getTodayRange = () => {
  const today =
    new Date();

  const value =
    toDateInputValue(today);

  return {
    fromDate: value,
    toDate: value,
  };
};

const getWeekRange = () => {
  const today =
    new Date();

  const day =
    today.getDay();

  /*
   * Monday = start of school week.
   * Sunday becomes the final day.
   */
  const offset =
    day === 0
      ? -6
      : 1 - day;

  const monday =
    addDays(
      today,
      offset,
    );

  const sunday =
    addDays(
      monday,
      6,
    );

  return {
    fromDate:
      toDateInputValue(
        monday,
      ),
    toDate:
      toDateInputValue(
        sunday,
      ),
  };
};

const getMonthRange = () => {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    today.getMonth();

  const firstDay =
    new Date(
      year,
      month,
      1,
    );

  const lastDay =
    new Date(
      year,
      month + 1,
      0,
    );

  return {
    fromDate:
      toDateInputValue(
        firstDay,
      ),
    toDate:
      toDateInputValue(
        lastDay,
      ),
  };
};

const getRangeForFilter = (
  filter,
) => {
  if (filter === "today") {
    return getTodayRange();
  }

  if (filter === "week") {
    return getWeekRange();
  }

  return getMonthRange();
};

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

const normalizeHistoryResponse = (
  data,
) => {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length,
      totalElements:
        data.length,
      totalPages:
        data.length > 0
          ? 1
          : 0,
    };
  }

  const content =
    Array.isArray(data?.content)
      ? data.content
      : Array.isArray(
            data?.items,
          )
        ? data.items
        : Array.isArray(
              data?.data,
            )
          ? data.data
          : [];

  return {
    content,
    page:
      Number(
        data?.page ??
          data?.pageNumber ??
          data?.number ??
          0,
      ) || 0,
    size:
      Number(
        data?.size ??
          data?.pageSize ??
          10,
      ) || 10,
    totalElements:
      Number(
        data?.totalElements ??
          data?.total ??
          content.length,
      ) ||
      content.length,
    totalPages:
      Number(
        data?.totalPages ??
          data?.pages ??
          0,
      ) ||
      (content.length > 0
        ? 1
        : 0),
  };
};

const parseLocalDateTime = (
  value,
) => {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" &&
    value.length >= 16 &&
    value[4] === "-" &&
    value[7] === "-"
  ) {
    const year =
      Number(
        value.slice(0, 4),
      );

    const month =
      Number(
        value.slice(5, 7),
      ) - 1;

    const day =
      Number(
        value.slice(8, 10),
      );

    const hour =
      Number(
        value.slice(11, 13),
      );

    const minute =
      Number(
        value.slice(14, 16),
      );

    const second =
      value.length >= 19
        ? Number(
            value.slice(
              17,
              19,
            ),
          )
        : 0;

    return new Date(
      year,
      month,
      day,
      hour,
      minute,
      second,
    );
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed;
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const parsed =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
      ? new Date(
          `${value}T12:00:00`,
        )
      : parseLocalDateTime(
          value,
        );

  if (!parsed) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(parsed);
};

const formatTime = (value) => {
  const parsed =
    parseLocalDateTime(
      value,
    );

  if (!parsed) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  ).format(parsed);
};

const getDurationLabel = (
  startedAt,
  endedAt,
) => {
  const start =
    parseLocalDateTime(
      startedAt,
    );

  const end =
    parseLocalDateTime(
      endedAt,
    );

  if (!start || !end) {
    return "—";
  }

  const minutes =
    Math.max(
      0,
      Math.round(
        (end.getTime() -
          start.getTime()) /
          60000,
      ),
    );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  const remaining =
    minutes % 60;

  return remaining
    ? `${hours} hr ${remaining} min`
    : `${hours} hr`;
};

const clampRate = (value) => {
  const parsed =
    Number(value);

  if (
    Number.isNaN(parsed)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      parsed,
    ),
  );
};

const getRateTone = (rate) => {
  if (rate >= 90) {
    return "excellent";
  }

  if (rate >= 75) {
    return "good";
  }

  return "attention";
};

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceHistory() {
  const navigate =
    useNavigate();

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("month");

  const initialRange =
    useMemo(
      () =>
        getMonthRange(),
      [],
    );

  const [
    fromDate,
    setFromDate,
  ] = useState(
    initialRange.fromDate,
  );

  const [
    toDate,
    setToDate,
  ] = useState(
    initialRange.toDate,
  );

  const [
    appliedFromDate,
    setAppliedFromDate,
  ] = useState(
    initialRange.fromDate,
  );

  const [
    appliedToDate,
    setAppliedToDate,
  ] = useState(
    initialRange.toDate,
  );

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  /* =======================================================
     PAGINATION
  ======================================================= */

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    pageSize,
  ] = useState(8);

  /* =======================================================
     DATA
  ======================================================= */

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    totalElements,
    setTotalElements,
  ] = useState(0);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     LOAD HISTORY
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadHistory =
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await adviserService.getAttendanceHistory(
              {
                fromDate:
                  appliedFromDate,
                toDate:
                  appliedToDate,
                page,
                size:
                  pageSize,
              },
            );

          if (!mounted) {
            return;
          }

          const normalized =
            normalizeHistoryResponse(
              response,
            );

          setHistory(
            normalized.content,
          );

          setTotalElements(
            normalized.totalElements,
          );

          setTotalPages(
            normalized.totalPages,
          );
        } catch (
          requestError
        ) {
          console.error(
            "Unable to load attendance history:",
            requestError,
          );

          if (!mounted) {
            return;
          }

          setHistory([]);
          setTotalElements(0);
          setTotalPages(0);

          setError(
            getErrorMessage(
              requestError,
              "Unable to load attendance history.",
            ),
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void loadHistory();

    return () => {
      mounted = false;
    };
  }, [
    appliedFromDate,
    appliedToDate,
    page,
    pageSize,
  ]);

  /* =======================================================
     FILTER HANDLERS
  ======================================================= */

  const handlePresetFilter =
    (filter) => {
      setActiveFilter(
        filter,
      );

      if (
        filter === "custom"
      ) {
        return;
      }

      const range =
        getRangeForFilter(
          filter,
        );

      setFromDate(
        range.fromDate,
      );

      setToDate(
        range.toDate,
      );

      setAppliedFromDate(
        range.fromDate,
      );

      setAppliedToDate(
        range.toDate,
      );

      setPage(0);
    };

  const handleApplyCustomRange =
    () => {
      if (
        !fromDate ||
        !toDate
      ) {
        setError(
          "Select both the start and end date.",
        );

        return;
      }

      if (
        fromDate > toDate
      ) {
        setError(
          "Start date cannot be after end date.",
        );

        return;
      }

      setError("");

      setActiveFilter(
        "custom",
      );

      setAppliedFromDate(
        fromDate,
      );

      setAppliedToDate(
        toDate,
      );

      setPage(0);
    };

  /* =======================================================
     CLIENT SEARCH
  ======================================================= */

  const filteredHistory =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      if (!query) {
        return history;
      }

      return history.filter(
        (session) => {
          const sectionName =
            String(
              session?.sectionName ||
                "",
            ).toLowerCase();

          const date =
            String(
              session?.attendanceDate ||
                "",
            ).toLowerCase();

          return (
            sectionName.includes(
              query,
            ) ||
            date.includes(
              query,
            )
          );
        },
      );
    }, [
      history,
      searchQuery,
    ]);

  /* =======================================================
     PAGE SUMMARY
  ======================================================= */

  const pageSummary =
    useMemo(() => {
      return history.reduce(
        (
          totals,
          session,
        ) => {
          totals.sessions +=
            1;

          totals.present +=
            Number(
              session?.presentCount ||
                0,
            );

          totals.absent +=
            Number(
              session?.absentCount ||
                0,
            );

          totals.students +=
            Number(
              session?.studentCount ||
                0,
            );

          return totals;
        },
        {
          sessions: 0,
          present: 0,
          absent: 0,
          students: 0,
        },
      );
    }, [history]);

  const pageAttendanceRate =
    pageSummary.students > 0
      ? Math.round(
          (pageSummary.present /
            pageSummary.students) *
            100,
        )
      : 0;

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleViewRecord =
    (sessionId) => {
      if (!sessionId) {
        return;
      }

      const selectedSession =
        history.find(
          (item) =>
            String(
              item.sessionId,
            ) ===
            String(
              sessionId,
            ),
        );

      navigate(
        `/adviser/attendance/history/${sessionId}`,
        {
          state: {
            session:
              selectedSession ||
              null,
          },
        },
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Attendance History"
      eyebrow="ADVISER PORTAL"
      description="Review completed attendance sessions and official class records"
    >
      <section className="attendance-history-page">
        {/* =================================================
            HERO
        ================================================== */}

        <section className="attendance-history-hero">
          <div className="attendance-history-hero-copy">
            <span>
              ATTENDANCE ARCHIVE
            </span>

            <h2>
              Completed Attendance Records
            </h2>

            <p>
              Review daily attendance sessions,
              verify class participation, and
              open the official attendance
              register for each completed
              session.
            </p>
          </div>

          <div className="attendance-history-hero-meta">
            <span>
              RECORD RANGE
            </span>

            <strong>
              {formatDate(
                appliedFromDate,
              )}
            </strong>

            <small>
              through{" "}
              {formatDate(
                appliedToDate,
              )}
            </small>
          </div>
        </section>

        {/* =================================================
            SUMMARY
        ================================================== */}

        <section className="attendance-history-summary">
          <article>
            <span>
              COMPLETED SESSIONS
            </span>

            <strong>
              {loading
                ? "—"
                : totalElements}
            </strong>

            <p>
              Within selected period
            </p>
          </article>

          <article>
            <span>
              PAGE PRESENT
            </span>

            <strong className="is-success">
              {loading
                ? "—"
                : pageSummary.present}
            </strong>

            <p>
              Present records shown
            </p>
          </article>

          <article>
            <span>
              PAGE ABSENT
            </span>

            <strong className="is-danger">
              {loading
                ? "—"
                : pageSummary.absent}
            </strong>

            <p>
              Absent records shown
            </p>
          </article>

          <article>
            <span>
              PAGE RATE
            </span>

            <strong>
              {loading
                ? "—"
                : `${pageAttendanceRate}%`}
            </strong>

            <p>
              Current page average
            </p>
          </article>
        </section>

        {/* =================================================
            FILTERS
        ================================================== */}

        <section className="attendance-history-filter-panel">
          <div className="attendance-history-filter-head">
            <div>
              <span>
                FILTER RECORDS
              </span>

              <h3>
                Attendance Period
              </h3>
            </div>

            <div className="attendance-history-presets">
              {FILTERS.map(
                (filter) => (
                  <button
                    key={
                      filter.key
                    }
                    type="button"
                    className={
                      activeFilter ===
                      filter.key
                        ? "is-active"
                        : ""
                    }
                    onClick={() =>
                      handlePresetFilter(
                        filter.key,
                      )
                    }
                  >
                    {
                      filter.label
                    }
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="attendance-history-filter-controls">
            <label>
              <span>
                FROM DATE
              </span>

              <input
                type="date"
                value={
                  fromDate
                }
                onChange={(
                  event,
                ) => {
                  setFromDate(
                    event.target
                      .value,
                  );

                  setActiveFilter(
                    "custom",
                  );
                }}
              />
            </label>

            <label>
              <span>
                TO DATE
              </span>

              <input
                type="date"
                value={
                  toDate
                }
                onChange={(
                  event,
                ) => {
                  setToDate(
                    event.target
                      .value,
                  );

                  setActiveFilter(
                    "custom",
                  );
                }}
              />
            </label>

            <button
              type="button"
              className="attendance-history-apply-button"
              onClick={
                handleApplyCustomRange
              }
            >
              Apply Date Range
            </button>

            <label className="attendance-history-search">
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  searchQuery
                }
                placeholder="Search section or date..."
                onChange={(
                  event,
                ) =>
                  setSearchQuery(
                    event.target
                      .value,
                  )
                }
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery(
                      "",
                    )
                  }
                >
                  ×
                </button>
              )}
            </label>
          </div>
        </section>

        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div
            className="attendance-history-alert"
            role="alert"
          >
            <span>
              !
            </span>

            <div>
              <strong>
                Unable to display records
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            RECORDS
        ================================================== */}

        <section className="attendance-history-records">
          <header className="attendance-history-records-head">
            <div>
              <span>
                SESSION RECORDS
              </span>

              <h3>
                Daily Attendance History
              </h3>

              <p>
                Newest completed sessions are
                shown first.
              </p>
            </div>

            <span className="attendance-history-record-count">
              {loading
                ? "Loading..."
                : `${filteredHistory.length} shown`}
            </span>
          </header>

          {loading ? (
            <div className="attendance-history-loading">
              <span />
              <strong>
                Loading attendance records
              </strong>
              <p>
                Retrieving completed class
                sessions...
              </p>
            </div>
          ) : filteredHistory.length ===
            0 ? (
            <div className="attendance-history-empty">
              <div>
                ▤
              </div>

              <span>
                NO RECORDS FOUND
              </span>

              <h3>
                No completed attendance
                sessions
              </h3>

              <p>
                Try another date range or
                complete an attendance session
                first.
              </p>
            </div>
          ) : (
            <div className="attendance-history-card-list">
              {filteredHistory.map(
                (session) => {
                  const rate =
                    clampRate(
                      session
                        ?.attendanceRate,
                    );

                  const tone =
                    getRateTone(
                      rate,
                    );

                  return (
                    <article
                      key={
                        session.sessionId
                      }
                      className="attendance-history-card"
                    >
                      <div className="attendance-history-date-block">
                        <span>
                          {new Intl.DateTimeFormat(
                            "en-PH",
                            {
                              month:
                                "short",
                            },
                          )
                            .format(
                              new Date(
                                `${session.attendanceDate}T12:00:00`,
                              ),
                            )
                            .toUpperCase()}
                        </span>

                        <strong>
                          {pad(
                            new Date(
                              `${session.attendanceDate}T12:00:00`,
                            ).getDate(),
                          )}
                        </strong>

                        <small>
                          {new Intl.DateTimeFormat(
                            "en-PH",
                            {
                              weekday:
                                "short",
                            },
                          ).format(
                            new Date(
                              `${session.attendanceDate}T12:00:00`,
                            ),
                          )}
                        </small>
                      </div>

                      <div className="attendance-history-card-main">
                        <div className="attendance-history-card-title">
                          <div>
                            <span>
                              COMPLETED SESSION
                            </span>

                            <h3>
                              {session.sectionName ||
                                "Assigned Section"}
                            </h3>

                            <p>
                              {formatDate(
                                session.attendanceDate,
                              )}
                            </p>
                          </div>

                          <span className="attendance-history-ended-badge">
                            <i />
                            ENDED
                          </span>
                        </div>

                        <div className="attendance-history-session-times">
                          <div>
                            <span>
                              STARTED
                            </span>

                            <strong>
                              {formatTime(
                                session.startedAt,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              ENDED
                            </span>

                            <strong>
                              {formatTime(
                                session.endedAt,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              DURATION
                            </span>

                            <strong>
                              {getDurationLabel(
                                session.startedAt,
                                session.endedAt,
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="attendance-history-card-stats">
                        <div>
                          <span>
                            STUDENTS
                          </span>

                          <strong>
                            {session.studentCount ||
                              0}
                          </strong>
                        </div>

                        <div>
                          <span>
                            PRESENT
                          </span>

                          <strong className="is-success">
                            {session.presentCount ||
                              0}
                          </strong>
                        </div>

                        <div>
                          <span>
                            ABSENT
                          </span>

                          <strong className="is-danger">
                            {session.absentCount ||
                              0}
                          </strong>
                        </div>
                      </div>

                      <div className="attendance-history-rate">
                        <div className="attendance-history-rate-head">
                          <span>
                            ATTENDANCE RATE
                          </span>

                          <strong
                            className={`is-${tone}`}
                          >
                            {rate.toFixed(
                              rate % 1 === 0
                                ? 0
                                : 1,
                            )}
                            %
                          </strong>
                        </div>

                        <div className="attendance-history-rate-track">
                          <span
                            className={`is-${tone}`}
                            style={{
                              width: `${rate}%`,
                            }}
                          />
                        </div>

                        <small>
                          {rate >= 90
                            ? "Excellent attendance"
                            : rate >= 75
                              ? "Good attendance"
                              : "Needs attention"}
                        </small>
                      </div>

                      <div className="attendance-history-card-action">
                        <button
                          type="button"
                          onClick={() =>
                            handleViewRecord(
                              session.sessionId,
                            )
                          }
                        >
                          <span>
                            View Record
                          </span>

                          <strong
                            aria-hidden="true"
                          >
                            →
                          </strong>
                        </button>

                        <small>
                          Open official student
                          attendance sheet
                        </small>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}

          {/* =================================================
              PAGINATION
          ================================================== */}

          {!loading &&
            totalPages > 0 && (
              <footer className="attendance-history-pagination">
                <div>
                  <span>
                    PAGE
                  </span>

                  <strong>
                    {page + 1}
                  </strong>

                  <small>
                    of{" "}
                    {totalPages}
                  </small>
                </div>

                <div className="attendance-history-pagination-actions">
                  <button
                    type="button"
                    disabled={
                      page <= 0
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            0,
                            current -
                              1,
                          ),
                      )
                    }
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      page + 1 >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current +
                          1,
                      )
                    }
                  >
                    Next →
                  </button>
                </div>
              </footer>
            )}
        </section>
      </section>
    </AdviserLayout>
  );
}

export default AttendanceHistory;
