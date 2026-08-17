import {
  useEffect,
  useMemo,
  useState,
} from "react";

import CouncilorLayout from "../../layouts/CouncilorLayout";
import councilorService from "../../services/councilorService";
import "../../styles/councilor.css";

const PAGE_SIZE = 9;
const SEARCH_DELAY = 350;

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatPercentage(value) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(`${value}T00:00:00`),
  );
}

function AttendanceManagement() {
  const today = useMemo(
    () => getToday(),
    [],
  );

  const [report, setReport] =
    useState(null);

  const [sections, setSections] =
    useState([]);

  const [advisers, setAdvisers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");

  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [fromDate, setFromDate] =
    useState(today);

  const [toDate, setToDate] =
    useState(today);

  const [sectionId, setSectionId] =
    useState("");

  const [adviserId, setAdviserId] =
    useState("");

  const [page, setPage] =
    useState(0);

  /* =========================================================
     LOAD FILTER OPTIONS ONCE
  ========================================================= */

  useEffect(() => {
    let ignore = false;

    const loadFilterOptions = async () => {
      try {
        const [
          sectionData,
          adviserData,
        ] = await Promise.all([
          councilorService.getSections(),
          councilorService.getAdvisers(),
        ]);

        if (ignore) {
          return;
        }

        setSections(
          Array.isArray(sectionData)
            ? sectionData
            : [],
        );

        setAdvisers(
          Array.isArray(adviserData)
            ? adviserData.filter(
                (adviser) =>
                  adviser.role === "ADVISER" &&
                  adviser.active !== false,
              )
            : [],
        );
      } catch {
        /*
         * Attendance reporting can still work even
         * if filter metadata fails to load.
         */
      }
    };

    loadFilterOptions();

    return () => {
      ignore = true;
    };
  }, []);

  /* =========================================================
     DEBOUNCE SEARCH
  ========================================================= */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        setDebouncedSearch(
          searchInput.trim(),
        );

        setPage(0);
      }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [searchInput]);

  /* =========================================================
     LOAD ATTENDANCE REPORT
  ========================================================= */

  useEffect(() => {
    const controller =
      new AbortController();

    const loadReport = async () => {
      setLoading(true);
      setError("");

      try {
        const data =
          await councilorService
            .getAttendanceReport({
              from: fromDate,
              to: toDate,
              sectionId,
              adviserId,
              search:
                debouncedSearch,
              page,
              size: PAGE_SIZE,
              signal:
                controller.signal,
            });

        setReport(data);
      } catch (requestError) {
        if (
          requestError?.code ===
            "ERR_CANCELED" ||
          requestError?.name ===
            "CanceledError"
        ) {
          return;
        }

        setReport(null);

        setError(
          requestError?.response?.data
            ?.message ||
            "Unable to load attendance reports.",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      controller.abort();
    };
  }, [
    fromDate,
    toDate,
    sectionId,
    adviserId,
    debouncedSearch,
    page,
  ]);

  /* =========================================================
     DERIVED DATA
  ========================================================= */

  const summary =
    report?.summary ?? {
      sections: 0,
      sessions: 0,
      students: 0,
      present: 0,
      late: 0,
      absent: 0,
      totalRecords: 0,
      presentRate: 0,
      lateRate: 0,
      attendanceRate: 0,
      absenceRate: 0,
    };

  const sectionPage =
    report?.sections ?? {
      content: [],
      page: 0,
      size: PAGE_SIZE,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    };

  const attendanceSections =
    sectionPage.content ?? [];

  const startRecord =
    sectionPage.totalElements > 0
      ? sectionPage.page *
          sectionPage.size +
        1
      : 0;

  const endRecord =
    Math.min(
      (sectionPage.page + 1) *
        sectionPage.size,
      sectionPage.totalElements,
    );

  /* =========================================================
     FILTER HANDLERS
  ========================================================= */

  const handleFromDateChange = (
    event,
  ) => {
    setFromDate(
      event.target.value,
    );

    setPage(0);
  };

  const handleToDateChange = (
    event,
  ) => {
    setToDate(
      event.target.value,
    );

    setPage(0);
  };

  const handleSectionChange = (
    event,
  ) => {
    setSectionId(
      event.target.value,
    );

    setPage(0);
  };

  const handleAdviserChange = (
    event,
  ) => {
    setAdviserId(
      event.target.value,
    );

    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");

    setFromDate(today);
    setToDate(today);

    setSectionId("");
    setAdviserId("");

    setPage(0);
  };

  const goToPreviousPage = () => {
    if (!sectionPage.first) {
      setPage(
        (currentPage) =>
          currentPage - 1,
      );
    }
  };

  const goToNextPage = () => {
    if (!sectionPage.last) {
      setPage(
        (currentPage) =>
          currentPage + 1,
      );
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <CouncilorLayout>
      <section className="attendance-page">
        <header className="attendance-hero">
          <div className="attendance-hero-copy">
            <span className="attendance-eyebrow">
              ATTENDANCE REPORTING
            </span>

            <h1>
              School Attendance Reports
            </h1>

            <p>
              Monitor section attendance,
              review school-wide performance,
              and prepare detailed attendance
              reports.
            </p>
          </div>

          <div className="attendance-hero-period">
            <span>
              REPORT PERIOD
            </span>

            <strong>
              {formatDate(fromDate)}
              {fromDate !== toDate
                ? ` – ${formatDate(toDate)}`
                : ""}
            </strong>
          </div>
        </header>

        {/* ===================================================
            SUMMARY
        =================================================== */}

        <section
          className="attendance-summary-grid"
          aria-label="Attendance summary"
        >
          <article className="attendance-summary-card">
            <div className="attendance-summary-card-top">
              <span className="attendance-summary-icon">
                ♙
              </span>

              <span>
                Students
              </span>
            </div>

            <strong>
              {formatNumber(
                summary.students,
              )}
            </strong>

            <small>
              Across{" "}
              {formatNumber(
                summary.sections,
              )}{" "}
              reporting sections
            </small>
          </article>

          <article className="attendance-summary-card attendance-summary-present">
            <div className="attendance-summary-card-top">
              <span className="attendance-summary-icon">
                ✓
              </span>

              <span>
                Present
              </span>
            </div>

            <strong>
              {formatPercentage(
                summary.presentRate,
              )}
            </strong>

            <small>
              {formatNumber(
                summary.present,
              )}{" "}
              attendance records
            </small>
          </article>

          <article className="attendance-summary-card attendance-summary-late">
            <div className="attendance-summary-card-top">
              <span className="attendance-summary-icon">
                ◷
              </span>

              <span>
                Late
              </span>
            </div>

            <strong>
              {formatPercentage(
                summary.lateRate,
              )}
            </strong>

            <small>
              {formatNumber(
                summary.late,
              )}{" "}
              attendance records
            </small>
          </article>

          <article className="attendance-summary-card attendance-summary-absent">
            <div className="attendance-summary-card-top">
              <span className="attendance-summary-icon">
                ×
              </span>

              <span>
                Absent
              </span>
            </div>

            <strong>
              {formatPercentage(
                summary.absenceRate,
              )}
            </strong>

            <small>
              {formatNumber(
                summary.absent,
              )}{" "}
              attendance records
            </small>
          </article>
        </section>

        {/* ===================================================
            FILTERS
        =================================================== */}

        <section className="attendance-report-panel">
          <div className="attendance-report-heading">
            <div>
              <span className="attendance-section-label">
                REPORT DIRECTORY
              </span>

              <h2>
                Section Attendance
              </h2>

              <p>
                Select a reporting period
                and review attendance by
                section.
              </p>
            </div>

            <div className="attendance-session-count">
              <strong>
                {formatNumber(
                  summary.sessions,
                )}
              </strong>

              <span>
                Sessions
              </span>
            </div>
          </div>

          <div className="attendance-filter-bar">
            <label className="attendance-search">
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(
                    event.target.value,
                  )
                }
                placeholder="Search section or adviser..."
                aria-label="Search attendance reports"
              />
            </label>

            <label className="attendance-filter-field">
              <span>
                From
              </span>

              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={
                  handleFromDateChange
                }
              />
            </label>

            <label className="attendance-filter-field">
              <span>
                To
              </span>

              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={
                  handleToDateChange
                }
              />
            </label>

            <label className="attendance-filter-field">
              <span>
                Section
              </span>

              <select
                value={sectionId}
                onChange={
                  handleSectionChange
                }
              >
                <option value="">
                  All Sections
                </option>

                {sections.map(
                  (section) => (
                    <option
                      key={section.id}
                      value={section.id}
                    >
                      {section.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="attendance-filter-field">
              <span>
                Adviser
              </span>

              <select
                value={adviserId}
                onChange={
                  handleAdviserChange
                }
              >
                <option value="">
                  All Advisers
                </option>

                {advisers.map(
                  (adviser) => (
                    <option
                      key={adviser.id}
                      value={adviser.id}
                    >
                      {adviser.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              className="attendance-reset-button"
              onClick={
                handleResetFilters
              }
            >
              Reset
            </button>
          </div>

          {/* =================================================
              STATUS
          ================================================= */}

          {error && (
            <div
              className="councilor-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading && (
            <div className="attendance-loading">
              <span
                className="councilor-spinner"
                aria-hidden="true"
              />

              <span>
                Loading attendance
                reports...
              </span>
            </div>
          )}

          {!loading &&
            !error &&
            attendanceSections.length ===
              0 && (
              <div className="attendance-empty">
                <div className="attendance-empty-icon">
                  ▦
                </div>

                <h3>
                  No attendance reports
                  found
                </h3>

                <p>
                  There are no completed
                  attendance sessions for
                  the selected reporting
                  period or filters.
                </p>
              </div>
            )}

          {/* =================================================
              SECTION CARDS
          ================================================= */}

          {!loading &&
            !error &&
            attendanceSections.length >
              0 && (
              <>
                <div className="attendance-section-grid">
                  {attendanceSections.map(
                    (section) => (
                      <article
                        className="attendance-section-card"
                        key={
                          section.sectionId
                        }
                      >
                        <div className="attendance-card-header">
                          <div className="attendance-card-section-icon">
                            ▤
                          </div>

                          <div className="attendance-card-title">
                            <span>
                              SECTION
                            </span>

                            <h3>
                              {
                                section.sectionName
                              }
                            </h3>

                            <p>
                              Adviser:{" "}
                              {section.adviserName ||
                                "Unassigned"}
                            </p>
                          </div>
                        </div>

                        <div className="attendance-card-meta">
                          <div>
                            <span>
                              Students
                            </span>

                            <strong>
                              {formatNumber(
                                section.studentCount,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Sessions
                            </span>

                            <strong>
                              {formatNumber(
                                section.sessionCount,
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="attendance-card-rate">
                          <div className="attendance-card-rate-heading">
                            <span>
                              Attendance Rate
                            </span>

                            <strong>
                              {formatPercentage(
                                section.attendanceRate,
                              )}
                            </strong>
                          </div>

                          <div className="attendance-progress">
                            <span
                              style={{
                                width: `${Math.min(
                                  Math.max(
                                    Number(
                                      section.attendanceRate ??
                                        0,
                                    ),
                                    0,
                                  ),
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="attendance-card-breakdown">
                          <div>
                            <span className="attendance-dot attendance-dot-present" />

                            <div>
                              <span>
                                Present
                              </span>

                              <strong>
                                {formatPercentage(
                                  section.presentRate,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div>
                            <span className="attendance-dot attendance-dot-late" />

                            <div>
                              <span>
                                Late
                              </span>

                              <strong>
                                {formatPercentage(
                                  section.lateRate,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div>
                            <span className="attendance-dot attendance-dot-absent" />

                            <div>
                              <span>
                                Absent
                              </span>

                              <strong>
                                {formatPercentage(
                                  section.absenceRate,
                                )}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="attendance-card-footer">
                          <span>
                            {formatNumber(
                              section.totalRecords,
                            )}{" "}
                            attendance records
                          </span>

                          <span className="attendance-card-report-label">
                            Detailed report
                            coming next →
                          </span>
                        </div>
                      </article>
                    ),
                  )}
                </div>

                {/* ===========================================
                    PAGINATION
                =========================================== */}

                <div className="attendance-pagination">
                  <p>
                    Showing{" "}
                    <strong>
                      {startRecord}
                    </strong>
                    {" – "}
                    <strong>
                      {endRecord}
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {formatNumber(
                        sectionPage.totalElements,
                      )}
                    </strong>{" "}
                    sections
                  </p>

                  <div className="attendance-pagination-controls">
                    <button
                      type="button"
                      disabled={
                        sectionPage.first
                      }
                      onClick={
                        goToPreviousPage
                      }
                    >
                      ← Previous
                    </button>

                    <span>
                      Page{" "}
                      <strong>
                        {sectionPage.totalPages >
                        0
                          ? sectionPage.page +
                            1
                          : 0}
                      </strong>{" "}
                      of{" "}
                      <strong>
                        {
                          sectionPage.totalPages
                        }
                      </strong>
                    </span>

                    <button
                      type="button"
                      disabled={
                        sectionPage.last
                      }
                      onClick={
                        goToNextPage
                      }
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
        </section>
      </section>
    </CouncilorLayout>
  );
}

export default AttendanceManagement;