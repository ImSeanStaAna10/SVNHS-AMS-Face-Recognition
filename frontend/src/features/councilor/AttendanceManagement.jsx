import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import councilorService from "../../services/councilorService";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 9;

const SEARCH_DELAY = 350;

/*
 * These are UI reporting bands only.
 * Adjust them later if SVNHS adopts official thresholds.
 */
const ATTENDANCE_BANDS = [
  {
    key: "high",
    min: 90,
    title: "90%+ Attendance",
    label: "HIGH",
    description:
      "Sections showing higher attendance within the selected reporting period.",
  },
  {
    key: "moderate",
    min: 75,
    title: "75–89.9% Attendance",
    label: "MODERATE",
    description:
      "Sections with moderate attendance that may benefit from closer monitoring.",
  },
  {
    key: "low",
    min: 0,
    title: "Below 75% Attendance",
    label: "REVIEW",
    description:
      "Sections with lower attendance in the selected reporting period.",
  },
];

const DEFAULT_SUMMARY = {
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

const DEFAULT_SECTION_PAGE = {
  content: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

/* =========================================================
   DATE HELPERS
========================================================= */

function toDateInputValue(date) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(
    2,
    "0",
  );

  const day = String(
    date.getDate(),
  ).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

function getToday() {
  return toDateInputValue(
    new Date(),
  );
}

function getDateOffset(
  baseDate,
  offsetDays,
) {
  const date =
    new Date(
      `${baseDate}T00:00:00`,
    );

  date.setDate(
    date.getDate() +
      offsetDays,
  );

  return toDateInputValue(
    date,
  );
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatNumber(value) {
  const number =
    Number(
      value ?? 0,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "0";
  }

  return number.toLocaleString(
    "en-PH",
  );
}

function formatPercentage(value) {
  const number =
    Number(
      value ?? 0,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "0.0%";
  }

  return `${number.toFixed(
    1,
  )}%`;
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
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

function formatDateRange(
  from,
  to,
) {
  if (from === to) {
    return formatDate(
      from,
    );
  }

  return `${formatDate(
    from,
  )} – ${formatDate(
    to,
  )}`;
}

function clampPercentage(value) {
  const number =
    Number(
      value ?? 0,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      number,
      0,
    ),
    100,
  );
}


function getSectionAbbreviation(sectionName) {
  const value = (sectionName ?? "")
    .trim()
    .toUpperCase();

  if (!value) {
    return "SECTION";
  }

  const knownTracks = [
    "STEM",
    "HUMSS",
    "ABM",
    "GAS",
    "ICT",
    "TVL",
    "HE",
    "SMAW",
  ];

  const matchedTrack = knownTracks.find((track) =>
    new RegExp(`\\b${track}\\b`).test(value),
  );

  if (matchedTrack) {
    return matchedTrack;
  }

  const words = value
    .split(/[\s\-–—_/]+/)
    .filter(Boolean)
    .filter((word) => !/^\d+$/.test(word));

  if (words.length === 0) {
    return "SECTION";
  }

  if (words[0].length <= 6) {
    return words[0].slice(0, 6);
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 5);
}
/* =========================================================
   PERFORMANCE BAND
========================================================= */

function getAttendanceBand(
  rate,
) {
  const number =
    Number(
      rate ?? 0,
    );

  return (
    ATTENDANCE_BANDS.find(
      (band) =>
        number >=
        band.min,
    ) ??
    ATTENDANCE_BANDS[
      ATTENDANCE_BANDS.length -
        1
    ]
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceManagement() {
  const today =
    useMemo(
      () => getToday(),
      [],
    );

  /* =======================================================
     REPORT DATA
  ======================================================= */

  const [
    report,
    setReport,
  ] = useState(null);

  const [
    sections,
    setSections,
  ] = useState([]);

  const [
    advisers,
    setAdvisers,
  ] = useState([]);

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    filtersLoading,
    setFiltersLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    filterError,
    setFilterError,
  ] = useState("");

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");

  const [
    fromDate,
    setFromDate,
  ] = useState(today);

  const [
    toDate,
    setToDate,
  ] = useState(today);

  const [
    sectionId,
    setSectionId,
  ] = useState("");

  const [
    adviserId,
    setAdviserId,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(0);

  /* =======================================================
     LOAD FILTER OPTIONS
  ======================================================= */

  useEffect(() => {
    let ignore = false;

    const loadFilterOptions =
      async () => {
        setFiltersLoading(
          true,
        );

        setFilterError("");

        const [
          sectionResult,
          adviserResult,
        ] =
          await Promise.allSettled(
            [
              councilorService.getSections(),

              councilorService.getAdvisers(),
            ],
          );

        if (ignore) {
          return;
        }

        const unavailable =
          [];

        if (
          sectionResult.status ===
          "fulfilled"
        ) {
          setSections(
            Array.isArray(
              sectionResult.value,
            )
              ? sectionResult.value
              : [],
          );
        } else {
          setSections([]);

          unavailable.push(
            "section options",
          );
        }

        if (
          adviserResult.status ===
          "fulfilled"
        ) {
          setAdvisers(
            Array.isArray(
              adviserResult.value,
            )
              ? adviserResult.value.filter(
                  (
                    adviser,
                  ) =>
                    adviser.role ===
                      "ADVISER" &&
                    adviser.active !==
                      false,
                )
              : [],
          );
        } else {
          setAdvisers([]);

          unavailable.push(
            "adviser options",
          );
        }

        if (
          unavailable.length >
          0
        ) {
          setFilterError(
            `Some filter options are unavailable: ${unavailable.join(
              ", ",
            )}. Attendance reports can still be viewed.`,
          );
        }

        setFiltersLoading(
          false,
        );
      };

    void loadFilterOptions();

    return () => {
      ignore = true;
    };
  }, []);

  /* =======================================================
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            searchInput.trim(),
          );

          setPage(0);
        },
        SEARCH_DELAY,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [searchInput]);

  /* =======================================================
     LOAD REPORT
  ======================================================= */

  useEffect(() => {
    const controller =
      new AbortController();

    const loadReport =
      async () => {
        setLoading(true);

        setError("");

        try {
          const data =
            await councilorService.getAttendanceReport(
              {
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
              },
            );

          setReport(
            data,
          );
        } catch (
          requestError
        ) {
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
            requestError
              ?.response?.data
              ?.message ||
              "Unable to load attendance reports.",
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false,
            );
          }
        }
      };

    void loadReport();

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

  /* =======================================================
     DERIVED REPORT DATA
  ======================================================= */

  const summary =
    report?.summary ??
    DEFAULT_SUMMARY;

  const sectionPage =
    report?.sections ??
    DEFAULT_SECTION_PAGE;

  const attendanceSections =
    sectionPage.content ??
    [];

  const startRecord =
    sectionPage.totalElements >
    0
      ? sectionPage.page *
          sectionPage.size +
        1
      : 0;

  const endRecord =
    Math.min(
      (sectionPage.page +
        1) *
        sectionPage.size,

      sectionPage.totalElements,
    );

  /* =======================================================
     SCHOOL SCOPE
  ======================================================= */

  const activeSectionCount =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            section.active !==
            false,
        ).length,
      [sections],
    );

  const hasScopeFilter =
    Boolean(
      searchInput.trim() ||
        sectionId ||
        adviserId,
    );

  const reportingCoverage =
    !hasScopeFilter &&
    activeSectionCount > 0
      ? Math.min(
          (Number(
            summary.sections ??
              0,
          ) /
            activeSectionCount) *
            100,
          100,
        )
      : null;

  const overallBand =
    getAttendanceBand(
      summary.attendanceRate,
    );

  /* =======================================================
     GROUP SECTION RESULTS
  ======================================================= */

  const sectionGroups =
    useMemo(() => {
      const grouped =
        new Map();

      ATTENDANCE_BANDS.forEach(
        (band) => {
          grouped.set(
            band.key,
            {
              ...band,

              sections: [],
            },
          );
        },
      );

      attendanceSections.forEach(
        (section) => {
          const band =
            getAttendanceBand(
              section.attendanceRate,
            );

          grouped
            .get(band.key)
            ?.sections.push(
              section,
            );
        },
      );

      return ATTENDANCE_BANDS.map(
        (band) =>
          grouped.get(
            band.key,
          ),
      ).filter(
        (group) =>
          group.sections
            .length > 0,
      );
    }, [
      attendanceSections,
    ]);

  /* =======================================================
     SELECTED FILTER LABELS
  ======================================================= */

  const selectedSectionName =
    useMemo(
      () =>
        sections.find(
          (section) =>
            String(
              section.id,
            ) ===
            String(
              sectionId,
            ),
        )?.name ?? "",
      [
        sections,
        sectionId,
      ],
    );

  const selectedAdviserName =
    useMemo(
      () =>
        advisers.find(
          (adviser) =>
            String(
              adviser.id,
            ) ===
            String(
              adviserId,
            ),
        )?.name ?? "",
      [
        advisers,
        adviserId,
      ],
    );

  const isDefaultPeriod =
    fromDate === today &&
    toDate === today;

  const hasCustomFilters =
    Boolean(
      searchInput.trim() ||
        sectionId ||
        adviserId ||
        !isDefaultPeriod,
    );

  const activeFilterCount =
    [
      Boolean(
        searchInput.trim(),
      ),

      Boolean(sectionId),

      Boolean(adviserId),

      !isDefaultPeriod,
    ].filter(Boolean).length;

  /* =======================================================
     DETAIL URL
  ======================================================= */

  const getDetailUrl = (
    selectedSectionId,
  ) => {
    const params =
      new URLSearchParams();

    params.set(
      "from",
      fromDate,
    );

    params.set(
      "to",
      toDate,
    );

    return `/councilor/attendance/${selectedSectionId}?${params.toString()}`;
  };

  /* =======================================================
     DATE PRESETS
  ======================================================= */

  const applyDatePreset = (
    days,
  ) => {
    setFromDate(
      getDateOffset(
        today,
        -(days - 1),
      ),
    );

    setToDate(today);

    setPage(0);
  };

  const isPresetActive = (
    days,
  ) =>
    fromDate ===
      getDateOffset(
        today,
        -(days - 1),
      ) &&
    toDate === today;

  /* =======================================================
     FILTER HANDLERS
  ======================================================= */

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

  const handleResetFilters =
    () => {
      setSearchInput("");

      setDebouncedSearch(
        "",
      );

      setFromDate(today);

      setToDate(today);

      setSectionId("");

      setAdviserId("");

      setPage(0);
    };

  /* =======================================================
     PAGINATION
  ======================================================= */

  const goToPreviousPage =
    () => {
      if (
        !sectionPage.first
      ) {
        setPage(
          (currentPage) =>
            currentPage -
            1,
        );
      }
    };

  const goToNextPage =
    () => {
      if (
        !sectionPage.last
      ) {
        setPage(
          (currentPage) =>
            currentPage +
            1,
        );
      }
    };

  /* =======================================================
     SECTION CARD
  ======================================================= */

  const renderSectionCard = (
    section,
  ) => {
    const band =
      getAttendanceBand(
        section.attendanceRate,
      );

    return (
      <Link
        key={
          section.sectionId
        }
        to={getDetailUrl(
          section.sectionId,
        )}
        className="attendance-section-card-link"
        aria-label={`View detailed attendance report for ${section.sectionName}`}
      >
        <article
  className={`attendance-section-card attendance-band-${band.key}`}
  data-room-label={getSectionAbbreviation(section.sectionName)}
>
          {/* =============================================
              CARD HEADER
          ============================================== */}

          <header className="attendance-card-header">
            <div
              className="attendance-card-section-icon"
              aria-hidden="true"
            >
              ▤
            </div>

            <div className="attendance-card-title">
              <span>
                SCHOOL SECTION
              </span>

              <h3>
                {
                  section.sectionName
                }
              </h3>

              <p>
                {section.adviserName
                  ? `Adviser: ${section.adviserName}`
                  : "No adviser assigned"}
              </p>
            </div>

            <span
              className={`attendance-card-health attendance-card-health-${band.key}`}
            >
              {band.label}
            </span>
          </header>

          {/* =============================================
              OPERATIONAL INFORMATION
          ============================================== */}

          <div className="attendance-card-operations">
            <div>
              <span>
                STUDENTS
              </span>

              <strong>
                {formatNumber(
                  section.studentCount,
                )}
              </strong>
            </div>

            <div>
              <span>
                SESSIONS
              </span>

              <strong>
                {formatNumber(
                  section.sessionCount,
                )}
              </strong>
            </div>

            <div>
              <span>
                RECORDS
              </span>

              <strong>
                {formatNumber(
                  section.totalRecords,
                )}
              </strong>
            </div>
          </div>

          {/* =============================================
              ATTENDANCE PERFORMANCE
          ============================================== */}

          <section className="attendance-card-performance">
            <div className="attendance-card-rate-heading">
              <div>
                <span>
                  OVERALL ATTENDANCE
                </span>

                <small>
                  Selected report period
                </small>
              </div>

              <strong>
                {formatPercentage(
                  section.attendanceRate,
                )}
              </strong>
            </div>

            <div
              className="attendance-progress"
              aria-hidden="true"
            >
              <span
                style={{
                  width: `${clampPercentage(
                    section.attendanceRate,
                  )}%`,
                }}
              />
            </div>
          </section>

          {/* =============================================
              STATUS BREAKDOWN
          ============================================== */}

          <div className="attendance-card-breakdown">
            <div className="attendance-card-status-item attendance-card-status-present">
              <span
                className="attendance-dot"
                aria-hidden="true"
              />

              <div>
                <span>
                  PRESENT
                </span>

                <strong>
                  {formatPercentage(
                    section.presentRate,
                  )}
                </strong>
              </div>
            </div>

            <div className="attendance-card-status-item attendance-card-status-late">
              <span
                className="attendance-dot"
                aria-hidden="true"
              />

              <div>
                <span>
                  LATE
                </span>

                <strong>
                  {formatPercentage(
                    section.lateRate,
                  )}
                </strong>
              </div>
            </div>

            <div className="attendance-card-status-item attendance-card-status-absent">
              <span
                className="attendance-dot"
                aria-hidden="true"
              />

              <div>
                <span>
                  ABSENT
                </span>

                <strong>
                  {formatPercentage(
                    section.absenceRate,
                  )}
                </strong>
              </div>
            </div>
          </div>

          {/* =============================================
              CARD FOOTER
          ============================================== */}

          <footer className="attendance-card-footer">
            <span>
              Detailed student and
              session records
            </span>

            <strong className="attendance-card-report-label">
              Open Report
              <span
                aria-hidden="true"
              >
                →
              </span>
            </strong>
          </footer>
        </article>
      </Link>
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <CouncilorLayout>
      <section className="attendance-page">
        {/* =================================================
            HERO
        ================================================== */}

        <header className="attendance-hero">
          <div className="attendance-hero-copy">
            <span className="attendance-eyebrow">
              ATTENDANCE
              INTELLIGENCE
            </span>

            <h1>
              School Attendance
              Reports
            </h1>

            <p>
              Review school-wide
              attendance performance,
              identify sections that
              may need closer
              monitoring, and open
              detailed student-level
              attendance reports.
            </p>

            <div className="attendance-hero-meta">
              <span>
                SVNHS
              </span>

              <span
                aria-hidden="true"
              >
                •
              </span>

              <span>
                Councilor Reporting
                Portal
              </span>
            </div>
          </div>

          <div className="attendance-hero-period">
            <span>
              CURRENT REPORT PERIOD
            </span>

            <strong>
              {formatDateRange(
                fromDate,
                toDate,
              )}
            </strong>

            <small>
              {activeFilterCount >
              0
                ? `${activeFilterCount} additional ${
                    activeFilterCount ===
                    1
                      ? "filter"
                      : "filters"
                  } applied`
                : "School-wide reporting scope"}
            </small>
          </div>
        </header>

        {/* =================================================
            SCHOOL ATTENDANCE OVERVIEW
        ================================================== */}

        <section className="attendance-overview-grid">
          {/* ===============================================
              OVERALL HEALTH
          ================================================ */}

          <article className="attendance-health-panel">
            <header className="attendance-overview-header">
              <div>
                <span>
                  SCHOOL OVERVIEW
                </span>

                <h2>
                  Attendance Health
                </h2>

                <p>
                  Overall attendance
                  performance for the
                  selected reporting
                  scope.
                </p>
              </div>

              <span
                className={`attendance-overall-band attendance-overall-band-${overallBand.key}`}
              >
                {
                  overallBand.label
                }
              </span>
            </header>

            <div className="attendance-overall-rate">
              <div>
                <span>
                  OVERALL ATTENDANCE
                </span>

                <strong>
                  {loading
                    ? "—"
                    : formatPercentage(
                        summary.attendanceRate,
                      )}
                </strong>

                <p>
                  Based on{" "}
                  {formatNumber(
                    summary.totalRecords,
                  )}{" "}
                  attendance records.
                </p>
              </div>

              {!hasScopeFilter &&
                reportingCoverage !==
                  null && (
                  <div className="attendance-coverage-box">
                    <strong>
                      {formatPercentage(
                        reportingCoverage,
                      )}
                    </strong>

                    <span>
                      Reporting
                      Coverage
                    </span>

                    <small>
                      {formatNumber(
                        summary.sections,
                      )}{" "}
                      of{" "}
                      {formatNumber(
                        activeSectionCount,
                      )}{" "}
                      active sections
                    </small>
                  </div>
                )}
            </div>

            <div className="attendance-overall-progress">
              <span
                style={{
                  width: `${clampPercentage(
                    summary.attendanceRate,
                  )}%`,
                }}
              />
            </div>

            <div className="attendance-overview-metrics">
              <div>
                <span>
                  STUDENTS
                </span>

                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        summary.students,
                      )}
                </strong>
              </div>

              <div>
                <span>
                  REPORTING
                  SECTIONS
                </span>

                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        summary.sections,
                      )}
                </strong>
              </div>

              <div>
                <span>
                  SESSIONS
                </span>

                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        summary.sessions,
                      )}
                </strong>
              </div>

              <div>
                <span>
                  RECORDS
                </span>

                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        summary.totalRecords,
                      )}
                </strong>
              </div>
            </div>
          </article>

          {/* ===============================================
              STATUS BREAKDOWN
          ================================================ */}

          <article className="attendance-status-panel">
            <header className="attendance-overview-header">
              <div>
                <span>
                  STATUS BREAKDOWN
                </span>

                <h2>
                  Attendance
                  Distribution
                </h2>

                <p>
                  Present, late, and
                  absent attendance
                  records.
                </p>
              </div>
            </header>

            <div className="attendance-status-list">
              {/* PRESENT */}

              <div className="attendance-status-row attendance-status-present">
                <span
                  className="attendance-status-indicator"
                  aria-hidden="true"
                />

                <div className="attendance-status-copy">
                  <strong>
                    Present
                  </strong>

                  <span>
                    {formatNumber(
                      summary.present,
                    )}{" "}
                    records
                  </span>
                </div>

                <strong className="attendance-status-rate">
                  {loading
                    ? "—"
                    : formatPercentage(
                        summary.presentRate,
                      )}
                </strong>
              </div>

              {/* LATE */}

              <div className="attendance-status-row attendance-status-late">
                <span
                  className="attendance-status-indicator"
                  aria-hidden="true"
                />

                <div className="attendance-status-copy">
                  <strong>
                    Late
                  </strong>

                  <span>
                    {formatNumber(
                      summary.late,
                    )}{" "}
                    records
                  </span>
                </div>

                <strong className="attendance-status-rate">
                  {loading
                    ? "—"
                    : formatPercentage(
                        summary.lateRate,
                      )}
                </strong>
              </div>

              {/* ABSENT */}

              <div className="attendance-status-row attendance-status-absent">
                <span
                  className="attendance-status-indicator"
                  aria-hidden="true"
                />

                <div className="attendance-status-copy">
                  <strong>
                    Absent
                  </strong>

                  <span>
                    {formatNumber(
                      summary.absent,
                    )}{" "}
                    records
                  </span>
                </div>

                <strong className="attendance-status-rate">
                  {loading
                    ? "—"
                    : formatPercentage(
                        summary.absenceRate,
                      )}
                </strong>
              </div>
            </div>

            <div className="attendance-status-note">
              <span
                aria-hidden="true"
              >
                i
              </span>

              <p>
                Rates reflect the
                currently selected
                dates and filters.
              </p>
            </div>
          </article>
        </section>

        {/* =================================================
            REPORT CONTROLS
        ================================================== */}

        <section className="attendance-controls-panel">
          <header className="attendance-controls-header">
            <div>
              <span>
                REPORT CONTROLS
              </span>

              <h2>
                Build your report
                scope
              </h2>

              <p>
                Choose a reporting
                period and narrow the
                report by section,
                adviser, or search
                term.
              </p>
            </div>

            <div className="attendance-filter-count">
              <strong>
                {
                  activeFilterCount
                }
              </strong>

              <span>
                Active{" "}
                {activeFilterCount ===
                1
                  ? "Filter"
                  : "Filters"}
              </span>
            </div>
          </header>

          {/* ===============================================
              DATE PRESETS
          ================================================ */}

          <div className="attendance-date-presets">
            <span>
              QUICK PERIOD
            </span>

            <div>
              <button
                type="button"
                className={
                  isPresetActive(
                    1,
                  )
                    ? "active"
                    : ""
                }
                onClick={() =>
                  applyDatePreset(
                    1,
                  )
                }
              >
                Today
              </button>

              <button
                type="button"
                className={
                  isPresetActive(
                    7,
                  )
                    ? "active"
                    : ""
                }
                onClick={() =>
                  applyDatePreset(
                    7,
                  )
                }
              >
                Last 7 Days
              </button>

              <button
                type="button"
                className={
                  isPresetActive(
                    30,
                  )
                    ? "active"
                    : ""
                }
                onClick={() =>
                  applyDatePreset(
                    30,
                  )
                }
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* ===============================================
              FILTER GRID
          ================================================ */}

          <div className="attendance-filter-bar">
            {/* SEARCH */}

            <label className="attendance-search">
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  searchInput
                }
                onChange={(
                  event,
                ) =>
                  setSearchInput(
                    event.target
                      .value,
                  )
                }
                placeholder="Search section or adviser..."
                aria-label="Search attendance reports"
              />
            </label>

            {/* FROM */}

            <label className="attendance-filter-field">
              <span>
                FROM DATE
              </span>

              <input
                type="date"
                value={
                  fromDate
                }
                max={
                  toDate
                }
                onChange={
                  handleFromDateChange
                }
              />
            </label>

            {/* TO */}

            <label className="attendance-filter-field">
              <span>
                TO DATE
              </span>

              <input
                type="date"
                value={
                  toDate
                }
                min={
                  fromDate
                }
                max={
                  today
                }
                onChange={
                  handleToDateChange
                }
              />
            </label>

            {/* SECTION */}

            <label className="attendance-filter-field">
              <span>
                SECTION
              </span>

              <select
                value={
                  sectionId
                }
                onChange={
                  handleSectionChange
                }
                disabled={
                  filtersLoading ||
                  sections.length ===
                    0
                }
              >
                <option value="">
                  All Sections
                </option>

                {sections.map(
                  (section) => (
                    <option
                      key={
                        section.id
                      }
                      value={
                        section.id
                      }
                    >
                      {
                        section.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            {/* ADVISER */}

            <label className="attendance-filter-field">
              <span>
                ADVISER
              </span>

              <select
                value={
                  adviserId
                }
                onChange={
                  handleAdviserChange
                }
                disabled={
                  filtersLoading ||
                  advisers.length ===
                    0
                }
              >
                <option value="">
                  All Advisers
                </option>

                {advisers.map(
                  (adviser) => (
                    <option
                      key={
                        adviser.id
                      }
                      value={
                        adviser.id
                      }
                    >
                      {
                        adviser.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            {/* RESET */}

            <button
              type="button"
              className="attendance-reset-button"
              onClick={
                handleResetFilters
              }
              disabled={
                !hasCustomFilters
              }
            >
              Reset
            </button>
          </div>

          {/* ===============================================
              ACTIVE SCOPE
          ================================================ */}

          {hasCustomFilters && (
            <div className="attendance-active-scope">
              <span className="attendance-active-scope-label">
                ACTIVE SCOPE
              </span>

              <div className="attendance-scope-chips">
                {!isDefaultPeriod && (
                  <span>
                    Period:
                    <strong>
                      {formatDateRange(
                        fromDate,
                        toDate,
                      )}
                    </strong>
                  </span>
                )}

                {selectedSectionName && (
                  <span>
                    Section:
                    <strong>
                      {
                        selectedSectionName
                      }
                    </strong>
                  </span>
                )}

                {selectedAdviserName && (
                  <span>
                    Adviser:
                    <strong>
                      {
                        selectedAdviserName
                      }
                    </strong>
                  </span>
                )}

                {searchInput.trim() && (
                  <span>
                    Search:
                    <strong>
                      “
                      {searchInput.trim()}
                      ”
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ===============================================
              FILTER OPTION WARNING
          ================================================ */}

          {filterError && (
            <div className="attendance-filter-warning">
              <span
                aria-hidden="true"
              >
                !
              </span>

              <p>
                {
                  filterError
                }
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            SECTION REPORT DIRECTORY
        ================================================== */}

        <section className="attendance-directory-panel">
          {/* ===============================================
              DIRECTORY HEADER
          ================================================ */}

          <header className="attendance-directory-header">
            <div>
              <span>
                SECTION REPORTS
              </span>

              <h2>
                Attendance by
                Section
              </h2>

              <p>
                Sections are separated
                by attendance band to
                make report review
                faster and easier to
                prioritize.
              </p>
            </div>

            <div className="attendance-directory-summary">
              <div>
                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        sectionPage.totalElements,
                      )}
                </strong>

                <span>
                  Sections
                </span>
              </div>

              <div>
                <strong>
                  {loading
                    ? "—"
                    : formatNumber(
                        summary.sessions,
                      )}
                </strong>

                <span>
                  Sessions
                </span>
              </div>
            </div>
          </header>

          {/* ===============================================
              PERFORMANCE BAND NOTE
          ================================================ */}

          <div className="attendance-band-guide">
            <span>
              PERFORMANCE BANDS
            </span>

            <div>
              <span className="attendance-band-guide-high">
                <i />
                90%+
              </span>

              <span className="attendance-band-guide-moderate">
                <i />
                75–89.9%
              </span>

              <span className="attendance-band-guide-low">
                <i />
                Below 75%
              </span>
            </div>

            <small>
              Visual reporting aid
              only; thresholds can be
              adjusted to match
              official school policy.
            </small>
          </div>

          {/* ===============================================
              REPORT ERROR
          ================================================ */}

          {error && (
            <div
              className="councilor-error"
              role="alert"
            >
              <span
                aria-hidden="true"
              >
                !
              </span>

              <p>
                {error}
              </p>
            </div>
          )}

          {/* ===============================================
              LOADING
          ================================================ */}

          {loading && (
            <div className="attendance-loading">
              <div
                className="councilor-loading-spinner"
                aria-hidden="true"
              />

              <strong>
                Loading attendance
                reports
              </strong>

              <span>
                Preparing section
                performance and
                attendance records...
              </span>
            </div>
          )}

          {/* ===============================================
              EMPTY
          ================================================ */}

          {!loading &&
            !error &&
            attendanceSections.length ===
              0 && (
              <div className="attendance-empty">
                <div
                  className="attendance-empty-icon"
                  aria-hidden="true"
                >
                  ▦
                </div>

                <h3>
                  No attendance
                  reports found
                </h3>

                <p>
                  There are no
                  completed attendance
                  sessions matching the
                  selected report
                  period and filters.
                </p>

                {hasCustomFilters && (
                  <button
                    type="button"
                    onClick={
                      handleResetFilters
                    }
                  >
                    Reset Report
                    Filters
                  </button>
                )}
              </div>
            )}

          {/* ===============================================
              GROUPED SECTION REPORTS
          ================================================ */}

          {!loading &&
            !error &&
            attendanceSections.length >
              0 && (
              <>
                <div className="attendance-section-groups">
                  {sectionGroups.map(
                    (group) => (
                      <section
                        key={
                          group.key
                        }
                        className={`attendance-section-group attendance-section-group-${group.key}`}
                      >
                        {/* =================================
                            GROUP HEADER
                        ================================== */}

                        <header className="attendance-section-group-header">
                          <div className="attendance-section-group-title">
                            <span
                              className="attendance-section-group-dot"
                              aria-hidden="true"
                            />

                            <div>
                              <div>
                                <span>
                                  {
                                    group.label
                                  }
                                </span>

                                <strong>
                                  {
                                    group.sections
                                      .length
                                  }
                                </strong>
                              </div>

                              <h3>
                                {
                                  group.title
                                }
                              </h3>

                              <p>
                                {
                                  group.description
                                }
                              </p>
                            </div>
                          </div>
                        </header>

                        {/* =================================
                            SECTION CARDS
                        ================================== */}

                        <div className="attendance-section-grid">
                          {group.sections.map(
                            (
                              section,
                            ) =>
                              renderSectionCard(
                                section,
                              ),
                          )}
                        </div>
                      </section>
                    ),
                  )}
                </div>

                {/* =========================================
                    PAGINATION
                ========================================== */}

                <footer className="attendance-pagination">
                  <p>
                    Showing{" "}
                    <strong>
                      {
                        startRecord
                      }
                    </strong>
                    {" – "}
                    <strong>
                      {
                        endRecord
                      }
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
                </footer>
              </>
            )}
        </section>
      </section>
    </CouncilorLayout>
  );
}

export default AttendanceManagement;