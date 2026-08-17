import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import authService from "../../services/authService";
import councilorService from "../../services/councilorService";

import schoolBuilding from "../../assets/school-background.png";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_ATTENDANCE_SUMMARY = {
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

const INITIAL_DATA_STATUS = {
  advisers: "loading",
  sections: "loading",
  attendance: "loading",
};

/* =========================================================
   HELPERS
========================================================= */

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
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("en-PH");
}

function formatPercentage(value) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0.0%";
  }

  return `${number.toFixed(1)}%`;
}

function clampPercentage(value) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    Math.max(number, 0),
    100,
  );
}

function formatDisplayDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(`${value}T00:00:00`),
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function CouncilorDashboard() {
  const navigate = useNavigate();

  const user = authService.getUser();

  const today = useMemo(
    () => getToday(),
    [],
  );

  /* =======================================================
     DATA STATE
  ======================================================= */

  const [advisers, setAdvisers] =
    useState([]);

  const [sections, setSections] =
    useState([]);

  const [attendanceReport, setAttendanceReport] =
    useState(null);

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [dataStatus, setDataStatus] =
    useState(INITIAL_DATA_STATUS);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const controller =
      new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      const [
        adviserResult,
        sectionResult,
        attendanceResult,
      ] = await Promise.allSettled([
        councilorService.getAdvisers(),

        councilorService.getSections(),

        councilorService.getAttendanceReport({
          from: today,
          to: today,
          sectionId: "",
          adviserId: "",
          search: "",
          page: 0,
          size: 5,
          signal: controller.signal,
        }),
      ]);

      if (!isMounted) {
        return;
      }

      const nextStatus = {
        advisers:
          adviserResult.status === "fulfilled"
            ? "ready"
            : "error",

        sections:
          sectionResult.status === "fulfilled"
            ? "ready"
            : "error",

        attendance:
          attendanceResult.status === "fulfilled"
            ? "ready"
            : "error",
      };

      /* =====================================================
         ADVISERS
      ===================================================== */

      if (adviserResult.status === "fulfilled") {
        const adviserData =
          Array.isArray(adviserResult.value)
            ? adviserResult.value.filter(
                (account) =>
                  account.role === "ADVISER",
              )
            : [];

        setAdvisers(adviserData);
      } else {
        setAdvisers([]);
      }

      /* =====================================================
         SECTIONS
      ===================================================== */

      if (sectionResult.status === "fulfilled") {
        setSections(
          Array.isArray(sectionResult.value)
            ? sectionResult.value
            : [],
        );
      } else {
        setSections([]);
      }

      /* =====================================================
         ATTENDANCE
      ===================================================== */

      if (
        attendanceResult.status ===
        "fulfilled"
      ) {
        setAttendanceReport(
          attendanceResult.value ?? null,
        );
      } else {
        setAttendanceReport(null);
      }

      setDataStatus(nextStatus);

      /* =====================================================
         PARTIAL FAILURE MESSAGE
      ===================================================== */

      const unavailableModules = [];

      if (nextStatus.advisers === "error") {
        unavailableModules.push("adviser accounts");
      }

      if (nextStatus.sections === "error") {
        unavailableModules.push("sections");
      }

      if (nextStatus.attendance === "error") {
        unavailableModules.push(
          "today's attendance",
        );
      }

      if (unavailableModules.length > 0) {
        setError(
          `Some dashboard data could not be loaded: ${unavailableModules.join(
            ", ",
          )}.`,
        );
      }

      setLoading(false);
    };

    void loadDashboard();

    return () => {
      isMounted = false;

      controller.abort();
    };
  }, [today]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const firstName =
    user?.name
      ?.trim()
      ?.split(/\s+/)[0] ||
    "Councilor";

  const attendanceSummary =
    attendanceReport?.summary ??
    DEFAULT_ATTENDANCE_SUMMARY;

  const activeAdvisers =
    useMemo(
      () =>
        advisers.filter(
          (adviser) =>
            adviser.active !== false,
        ).length,
      [advisers],
    );

  const inactiveAdvisers =
    advisers.length -
    activeAdvisers;

  const activeSections =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            section.active !== false,
        ).length,
      [sections],
    );

  const activeAdviserRate =
    advisers.length > 0
      ? (activeAdvisers /
          advisers.length) *
        100
      : 0;

  const activeSectionRate =
    sections.length > 0
      ? (activeSections /
          sections.length) *
        100
      : 0;

  const reportingCoverage =
    sections.length > 0
      ? Math.min(
          (Number(
            attendanceSummary.sections ??
              0,
          ) /
            sections.length) *
            100,
          100,
        )
      : 0;

  const adviserSnapshot =
    useMemo(
      () =>
        [...advisers]
          .sort((first, second) =>
            (first.name ?? "").localeCompare(
              second.name ?? "",
            ),
          )
          .slice(0, 5),
      [advisers],
    );

  /* =======================================================
     DATA FLAGS
  ======================================================= */

  const advisersReady =
    dataStatus.advisers === "ready";

  const sectionsReady =
    dataStatus.sections === "ready";

  const attendanceReady =
    dataStatus.attendance === "ready";

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const goToAdvisers = () => {
    navigate("/councilor/advisers");
  };

  const goToSections = () => {
    navigate("/councilor/sections");
  };

  const goToAttendance = () => {
    navigate("/councilor/attendance");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <CouncilorLayout>
      <section className="dashboard-page">
        {/* =================================================
            HERO
        ================================================== */}

        <section className="councilor-hero">
          <img
            src={schoolBuilding}
            alt=""
            className="councilor-hero-image"
          />

          <div
            className="councilor-hero-overlay"
            aria-hidden="true"
          />

          <div
            className="councilor-hero-pattern"
            aria-hidden="true"
          />

          <div className="councilor-hero-content">
            <span className="councilor-hero-kicker">
              SCHOOL OVERVIEW
            </span>

            <h2>
              Good day, {firstName}.
            </h2>

            <p>
              Review today's attendance activity,
              adviser accounts, and academic section
              operations across Signal Village
              National High School.
            </p>

            <div className="councilor-hero-meta">
              <span>
                {formatDisplayDate(today)}
              </span>

              <span
                className="councilor-hero-meta-dot"
                aria-hidden="true"
              />

              <span>
                SVNHS Attendance Management
              </span>
            </div>

            <div className="dashboard-hero-actions">
              <button
                type="button"
                className="dashboard-hero-primary"
                onClick={goToAttendance}
              >
                <span aria-hidden="true">
                  ◷
                </span>

                View Attendance
              </button>

              <button
                type="button"
                className="dashboard-hero-secondary"
                onClick={goToSections}
              >
                Manage Sections
              </button>
            </div>
          </div>

          <div
            className="councilor-hero-seal"
            aria-hidden="true"
          >
            <img
              src={seniorHighSchoolLogo}
              alt=""
            />
          </div>
        </section>

        {/* =================================================
            ERROR / PARTIAL DATA WARNING
        ================================================== */}

        {error && (
          <div
            className="dashboard-data-warning"
            role="status"
          >
            <span aria-hidden="true">
              !
            </span>

            <div>
              <strong>
                Some information is unavailable
              </strong>

              <p>
                {error} Other available dashboard
                information is shown normally.
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            KPI GRID
        ================================================== */}

        <section
          className="dashboard-kpi-grid"
          aria-label="School dashboard summary"
        >
          {/* ADVISERS */}

          <article className="dashboard-kpi-card">
            <div className="dashboard-kpi-header">
              <span
                className="dashboard-kpi-icon"
                aria-hidden="true"
              >
                ♙
              </span>

              <span className="dashboard-kpi-tag">
                ACCOUNTS
              </span>
            </div>

            <strong className="dashboard-kpi-value">
              {loading ||
              !advisersReady
                ? "—"
                : formatNumber(
                    advisers.length,
                  )}
            </strong>

            <h3>
              Adviser Accounts
            </h3>

            <p>
              {advisersReady
                ? `${formatNumber(
                    activeAdvisers,
                  )} active · ${formatNumber(
                    inactiveAdvisers,
                  )} inactive`
                : "Account information unavailable"}
            </p>
          </article>

          {/* SECTIONS */}

          <article className="dashboard-kpi-card">
            <div className="dashboard-kpi-header">
              <span
                className="dashboard-kpi-icon"
                aria-hidden="true"
              >
                ▤
              </span>

              <span className="dashboard-kpi-tag">
                ACADEMIC
              </span>
            </div>

            <strong className="dashboard-kpi-value">
              {loading ||
              !sectionsReady
                ? "—"
                : formatNumber(
                    sections.length,
                  )}
            </strong>

            <h3>
              School Sections
            </h3>

            <p>
              {sectionsReady
                ? `${formatNumber(
                    activeSections,
                  )} currently active`
                : "Section information unavailable"}
            </p>
          </article>

          {/* SESSIONS */}

          <article className="dashboard-kpi-card dashboard-kpi-accent">
            <div className="dashboard-kpi-header">
              <span
                className="dashboard-kpi-icon"
                aria-hidden="true"
              >
                ◷
              </span>

              <span className="dashboard-kpi-tag">
                TODAY
              </span>
            </div>

            <strong className="dashboard-kpi-value">
              {loading ||
              !attendanceReady
                ? "—"
                : formatNumber(
                    attendanceSummary.sessions,
                  )}
            </strong>

            <h3>
              Attendance Sessions
            </h3>

            <p>
              {attendanceReady
                ? `${formatNumber(
                    attendanceSummary.sections,
                  )} reporting sections today`
                : "Attendance information unavailable"}
            </p>
          </article>

          {/* ATTENDANCE RATE */}

          <article className="dashboard-kpi-card dashboard-kpi-success">
            <div className="dashboard-kpi-header">
              <span
                className="dashboard-kpi-icon"
                aria-hidden="true"
              >
                ✓
              </span>

              <span className="dashboard-kpi-tag">
                PERFORMANCE
              </span>
            </div>

            <strong className="dashboard-kpi-value">
              {loading ||
              !attendanceReady
                ? "—"
                : formatPercentage(
                    attendanceSummary.attendanceRate,
                  )}
            </strong>

            <h3>
              Attendance Today
            </h3>

            <p>
              {attendanceReady
                ? `${formatNumber(
                    attendanceSummary.totalRecords,
                  )} attendance records`
                : "Attendance information unavailable"}
            </p>
          </article>
        </section>

        {/* =================================================
            OPERATIONAL OVERVIEW
        ================================================== */}

        <section className="dashboard-operational-grid">
          {/* ===============================================
              TODAY'S ATTENDANCE
          ================================================ */}

          <article className="dashboard-panel dashboard-attendance-panel">
            <header className="dashboard-panel-header">
              <div>
                <span>
                  TODAY'S OPERATIONS
                </span>

                <h2>
                  Attendance Snapshot
                </h2>

                <p>
                  School-wide attendance performance
                  for {formatDisplayDate(today)}.
                </p>
              </div>

              <button
                type="button"
                className="dashboard-panel-link"
                onClick={goToAttendance}
              >
                Full Report
                <span aria-hidden="true">
                  →
                </span>
              </button>
            </header>

            {!attendanceReady ? (
              <div className="dashboard-panel-empty">
                <span aria-hidden="true">
                  ◷
                </span>

                <strong>
                  Attendance data unavailable
                </strong>

                <p>
                  Open Attendance Reports to review
                  available reporting information.
                </p>

                <button
                  type="button"
                  onClick={goToAttendance}
                >
                  Open Attendance
                </button>
              </div>
            ) : (
              <>
                {/* =========================================
                    OVERALL RATE
                ========================================== */}

                <div className="dashboard-attendance-overall">
                  <div>
                    <span>
                      OVERALL ATTENDANCE
                    </span>

                    <strong>
                      {formatPercentage(
                        attendanceSummary.attendanceRate,
                      )}
                    </strong>

                    <p>
                      Based on{" "}
                      {formatNumber(
                        attendanceSummary.totalRecords,
                      )}{" "}
                      attendance records today.
                    </p>
                  </div>

                  <div className="dashboard-attendance-session-box">
                    <strong>
                      {formatNumber(
                        attendanceSummary.sessions,
                      )}
                    </strong>

                    <span>
                      Sessions Today
                    </span>
                  </div>
                </div>

                <div className="dashboard-main-progress">
                  <div
                    style={{
                      "--dashboard-progress":
                        `${clampPercentage(
                          attendanceSummary.attendanceRate,
                        )}%`,
                    }}
                  />
                </div>

                {/* =========================================
                    ATTENDANCE BREAKDOWN
                ========================================== */}

                <div className="dashboard-attendance-breakdown">
                  {/* PRESENT */}

                  <div className="dashboard-attendance-metric dashboard-attendance-present">
                    <span
                      className="dashboard-attendance-dot"
                      aria-hidden="true"
                    />

                    <div>
                      <span>
                        Present
                      </span>

                      <strong>
                        {formatPercentage(
                          attendanceSummary.presentRate,
                        )}
                      </strong>

                      <small>
                        {formatNumber(
                          attendanceSummary.present,
                        )}{" "}
                        records
                      </small>
                    </div>
                  </div>

                  {/* LATE */}

                  <div className="dashboard-attendance-metric dashboard-attendance-late">
                    <span
                      className="dashboard-attendance-dot"
                      aria-hidden="true"
                    />

                    <div>
                      <span>
                        Late
                      </span>

                      <strong>
                        {formatPercentage(
                          attendanceSummary.lateRate,
                        )}
                      </strong>

                      <small>
                        {formatNumber(
                          attendanceSummary.late,
                        )}{" "}
                        records
                      </small>
                    </div>
                  </div>

                  {/* ABSENT */}

                  <div className="dashboard-attendance-metric dashboard-attendance-absent">
                    <span
                      className="dashboard-attendance-dot"
                      aria-hidden="true"
                    />

                    <div>
                      <span>
                        Absent
                      </span>

                      <strong>
                        {formatPercentage(
                          attendanceSummary.absenceRate,
                        )}
                      </strong>

                      <small>
                        {formatNumber(
                          attendanceSummary.absent,
                        )}{" "}
                        records
                      </small>
                    </div>
                  </div>
                </div>
              </>
            )}
          </article>

          {/* ===============================================
              SYSTEM READINESS
          ================================================ */}

          <article className="dashboard-panel dashboard-readiness-panel">
            <header className="dashboard-panel-header">
              <div>
                <span>
                  SYSTEM STATUS
                </span>

                <h2>
                  Operational Readiness
                </h2>

                <p>
                  Account, section, and reporting
                  availability.
                </p>
              </div>
            </header>

            <div className="dashboard-readiness-list">
              {/* ACTIVE ADVISERS */}

              <div className="dashboard-readiness-item">
                <div className="dashboard-readiness-top">
                  <div>
                    <strong>
                      Active Advisers
                    </strong>

                    <span>
                      {advisersReady
                        ? `${formatNumber(
                            activeAdvisers,
                          )} of ${formatNumber(
                            advisers.length,
                          )}`
                        : "Unavailable"}
                    </span>
                  </div>

                  <strong>
                    {advisersReady
                      ? formatPercentage(
                          activeAdviserRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="dashboard-readiness-progress">
                  <div
                    style={{
                      "--dashboard-progress":
                        `${clampPercentage(
                          activeAdviserRate,
                        )}%`,
                    }}
                  />
                </div>
              </div>

              {/* ACTIVE SECTIONS */}

              <div className="dashboard-readiness-item">
                <div className="dashboard-readiness-top">
                  <div>
                    <strong>
                      Active Sections
                    </strong>

                    <span>
                      {sectionsReady
                        ? `${formatNumber(
                            activeSections,
                          )} of ${formatNumber(
                            sections.length,
                          )}`
                        : "Unavailable"}
                    </span>
                  </div>

                  <strong>
                    {sectionsReady
                      ? formatPercentage(
                          activeSectionRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="dashboard-readiness-progress">
                  <div
                    style={{
                      "--dashboard-progress":
                        `${clampPercentage(
                          activeSectionRate,
                        )}%`,
                    }}
                  />
                </div>
              </div>

              {/* REPORTING COVERAGE */}

              <div className="dashboard-readiness-item">
                <div className="dashboard-readiness-top">
                  <div>
                    <strong>
                      Reporting Coverage
                    </strong>

                    <span>
                      {attendanceReady &&
                      sectionsReady
                        ? `${formatNumber(
                            attendanceSummary.sections,
                          )} of ${formatNumber(
                            sections.length,
                          )} sections`
                        : "Unavailable"}
                    </span>
                  </div>

                  <strong>
                    {attendanceReady &&
                    sectionsReady
                      ? formatPercentage(
                          reportingCoverage,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="dashboard-readiness-progress">
                  <div
                    style={{
                      "--dashboard-progress":
                        `${clampPercentage(
                          reportingCoverage,
                        )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* =============================================
                QUICK ACTIONS
            ============================================== */}

            <div className="dashboard-quick-actions">
              <button
                type="button"
                onClick={goToAdvisers}
              >
                <span aria-hidden="true">
                  ♙
                </span>

                <div>
                  <strong>
                    Adviser Accounts
                  </strong>

                  <small>
                    Manage school advisers
                  </small>
                </div>

                <span aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={goToSections}
              >
                <span aria-hidden="true">
                  ▤
                </span>

                <div>
                  <strong>
                    School Sections
                  </strong>

                  <small>
                    Manage section assignments
                  </small>
                </div>

                <span aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={goToAttendance}
              >
                <span aria-hidden="true">
                  ◷
                </span>

                <div>
                  <strong>
                    Attendance Reports
                  </strong>

                  <small>
                    Review school attendance
                  </small>
                </div>

                <span aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </article>
        </section>

        {/* =================================================
            ADVISER SNAPSHOT
        ================================================== */}

        <section className="dashboard-panel dashboard-adviser-panel">
          <header className="dashboard-panel-header dashboard-adviser-header">
            <div>
              <span>
                ACCOUNT OVERVIEW
              </span>

              <h2>
                Adviser Account Snapshot
              </h2>

              <p>
                Quick visibility into registered
                school adviser accounts.
              </p>
            </div>

            <button
              type="button"
              className="dashboard-panel-link"
              onClick={goToAdvisers}
            >
              Manage Advisers
              <span aria-hidden="true">
                →
              </span>
            </button>
          </header>

          {loading ? (
            <div className="dashboard-panel-empty">
              <div
                className="councilor-loading-spinner"
                aria-hidden="true"
              />

              <strong>
                Loading adviser accounts
              </strong>

              <p>
                Fetching current account information.
              </p>
            </div>
          ) : !advisersReady ? (
            <div className="dashboard-panel-empty">
              <span aria-hidden="true">
                !
              </span>

              <strong>
                Adviser accounts unavailable
              </strong>

              <p>
                Adviser information could not be
                loaded.
              </p>
            </div>
          ) : adviserSnapshot.length === 0 ? (
            <div className="dashboard-panel-empty">
              <span aria-hidden="true">
                ♙
              </span>

              <strong>
                No adviser accounts yet
              </strong>

              <p>
                Create an adviser account to begin
                assigning academic sections.
              </p>

              <button
                type="button"
                onClick={goToAdvisers}
              >
                Manage Advisers
              </button>
            </div>
          ) : (
            <div className="dashboard-adviser-list">
              {adviserSnapshot.map(
                (adviser) => {
                  const isActive =
                    adviser.active !== false;

                  const initial =
                    adviser.name
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() ||
                    "A";

                  return (
                    <article
                      key={adviser.id}
                      className="dashboard-adviser-row"
                    >
                      <div className="dashboard-adviser-person">
                        <div className="dashboard-adviser-avatar">
                          {initial}
                        </div>

                        <div>
                          <strong>
                            {adviser.name}
                          </strong>

                          <span>
                            {adviser.email}
                          </span>
                        </div>
                      </div>

                      <span className="dashboard-adviser-role">
                        ADVISER
                      </span>

                      <span
                        className={`dashboard-adviser-status ${
                          isActive
                            ? ""
                            : "inactive"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                        />

                        {isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </article>
                  );
                },
              )}
            </div>
          )}

          {advisersReady &&
            advisers.length > 5 && (
              <footer className="dashboard-adviser-footer">
                <span>
                  Showing 5 of{" "}
                  {formatNumber(
                    advisers.length,
                  )}{" "}
                  adviser accounts
                </span>

                <button
                  type="button"
                  onClick={goToAdvisers}
                >
                  View all advisers →
                </button>
              </footer>
            )}
        </section>
      </section>
    </CouncilorLayout>
  );
}

export default CouncilorDashboard;