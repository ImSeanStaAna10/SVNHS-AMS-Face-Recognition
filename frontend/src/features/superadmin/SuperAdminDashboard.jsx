import {
  useMemo,
} from "react";

import { useNavigate } from "react-router-dom";

import SuperAdminLayout from "../../layouts/SuperAdminLayout";

import authService from "../../services/authService";

import {
  useSuperAdminCouncilors,
  useSuperAdminDepartments,
} from "../../hooks/queries/useSuperAdminQueries";

import schoolBuilding from "../../assets/school-background.png";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/superadmin/dashboard.css";

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
  const number = Number(
    value ?? 0,
  );

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "en-PH",
  );
}

function formatPercentage(value) {
  const number = Number(
    value ?? 0,
  );

  if (!Number.isFinite(number)) {
    return "0.0%";
  }

  return `${number.toFixed(1)}%`;
}

function clampPercentage(value) {
  const number = Number(
    value ?? 0,
  );

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
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function SuperAdminDashboard() {
  const navigate =
    useNavigate();

  const user =
    authService.getUser();

  const today =
    useMemo(
      () => getToday(),
      [],
    );

  /* =======================================================
     REUSABLE SERVER CACHE
  ======================================================= */

  const departmentsQuery =
    useSuperAdminDepartments();

  const councilorsQuery =
    useSuperAdminCouncilors();

  const departments =
    useMemo(
      () =>
        Array.isArray(
          departmentsQuery.data,
        )
          ? departmentsQuery.data
          : [],
      [
        departmentsQuery.data,
      ],
    );

  const councilors =
    useMemo(
      () =>
        Array.isArray(
          councilorsQuery.data,
        )
          ? councilorsQuery.data
          : [],
      [
        councilorsQuery.data,
      ],
    );

  /*
   * Only block the dashboard during a fetch when no cached
   * copy exists yet. Background refetches keep cached data
   * visible.
   */
  const loading =
    (
      departmentsQuery.isFetching &&
      departmentsQuery.data ===
        undefined
    ) ||
    (
      councilorsQuery.isFetching &&
      councilorsQuery.data ===
        undefined
    );

  const error =
    useMemo(() => {
      const unavailable = [];

      if (
        departmentsQuery.isError &&
        departmentsQuery.data ===
          undefined
      ) {
        unavailable.push(
          "departments",
        );
      }

      if (
        councilorsQuery.isError &&
        councilorsQuery.data ===
          undefined
      ) {
        unavailable.push(
          "Councilor accounts",
        );
      }

      return unavailable.length >
        0
        ? `Some dashboard data could not be loaded: ${unavailable.join(
            ", ",
          )}.`
        : "";
    }, [
      departmentsQuery.data,
      departmentsQuery.isError,
      councilorsQuery.data,
      councilorsQuery.isError,
    ]);

  /* =======================================================
     USER
  ======================================================= */

  const firstName =
    user?.name
      ?.trim()
      ?.split(/\s+/)[0] ||
    "Administrator";

  /* =======================================================
     DATA FLAGS
  ======================================================= */

  const departmentsReady =
    departmentsQuery.data !==
    undefined;

  const councilorsReady =
    councilorsQuery.data !==
    undefined;

  /* =======================================================
     DEPARTMENT METRICS
  ======================================================= */

  const activeDepartments =
    useMemo(
      () =>
        departments.filter(
          (department) =>
            department.active !==
            false,
        ),
      [
        departments,
      ],
    );

  const inactiveDepartments =
    departments.length -
    activeDepartments.length;

  /* =======================================================
     COUNCILOR METRICS
  ======================================================= */

  const activeCouncilors =
    useMemo(
      () =>
        councilors.filter(
          (councilor) =>
            councilor.active !==
            false,
        ),
      [
        councilors,
      ],
    );

  const inactiveCouncilors =
    councilors.length -
    activeCouncilors.length;

  /* =======================================================
     ACTIVE COUNCILOR DEPARTMENT IDS
  ======================================================= */

  const activeCouncilorDepartmentIds =
    useMemo(
      () =>
        new Set(
          activeCouncilors
            .map(
              (councilor) =>
                councilor.departmentId,
            )
            .filter(Boolean),
        ),
      [
        activeCouncilors,
      ],
    );

  /* =======================================================
     DEPARTMENT COVERAGE
  ======================================================= */

  const coveredDepartments =
    useMemo(
      () =>
        activeDepartments.filter(
          (department) =>
            activeCouncilorDepartmentIds.has(
              department.id,
            ),
        ).length,
      [
        activeDepartments,
        activeCouncilorDepartmentIds,
      ],
    );

  const uncoveredDepartments =
    Math.max(
      activeDepartments.length -
        coveredDepartments,
      0,
    );

  /* =======================================================
     PERCENTAGES
  ======================================================= */

  const departmentActiveRate =
    departments.length > 0
      ? (activeDepartments.length /
          departments.length) *
        100
      : 0;

  const councilorActiveRate =
    councilors.length > 0
      ? (activeCouncilors.length /
          councilors.length) *
        100
      : 0;

  const coverageRate =
    activeDepartments.length > 0
      ? (coveredDepartments /
          activeDepartments.length) *
        100
      : 0;

  /* =======================================================
     SNAPSHOTS
  ======================================================= */

  const departmentSnapshot =
    useMemo(
      () =>
        [...departments]
          .sort(
            (first, second) =>
              (
                first.code ??
                first.name ??
                ""
              ).localeCompare(
                second.code ??
                  second.name ??
                  "",
              ),
          )
          .slice(
            0,
            5,
          ),
      [
        departments,
      ],
    );

  const councilorSnapshot =
    useMemo(
      () =>
        [...councilors]
          .sort(
            (first, second) =>
              (
                first.name ?? ""
              ).localeCompare(
                second.name ?? "",
              ),
          )
          .slice(
            0,
            5,
          ),
      [
        councilors,
      ],
    );

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const goToDepartments =
    () => {
      navigate(
        "/superadmin/departments",
      );
    };

  const goToCouncilors =
    () => {
      navigate(
        "/superadmin/councilors",
      );
    };

  /* =======================================================
     ERROR RETRY

     Retry only the two shared SuperAdmin queries.
  ======================================================= */

  const handleRetry = () => {
    if (loading) {
      return;
    }

    void Promise.all([
      departmentsQuery.refetch(),
      councilorsQuery.refetch(),
    ]);
  };

  /* =======================================================
     FIND ACTIVE COUNCILOR
  ======================================================= */

  const getDepartmentCouncilor =
    (departmentId) =>
      activeCouncilors.find(
        (councilor) =>
          councilor.departmentId ===
          departmentId,
      );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SuperAdminLayout
      title="Dashboard"
      eyebrow="SUPERADMIN PORTAL"
      description="System Administration"
    >
      <section className="superadmin-dashboard">
        {/* =================================================
            HERO
        ================================================== */}

        <section className="superadmin-dashboard-hero">
          <img
            src={schoolBuilding}
            alt=""
            className="superadmin-dashboard-hero-image"
          />

          <div
            className="superadmin-dashboard-hero-overlay"
            aria-hidden="true"
          />

          <div
            className="superadmin-dashboard-hero-pattern"
            aria-hidden="true"
          />

          <div className="superadmin-dashboard-hero-copy">
            <span className="superadmin-dashboard-hero-kicker">
              SYSTEM ADMINISTRATION
            </span>

            <h2>
              Good day, {firstName}.
            </h2>

            <p>
              Manage school departments,
              Councilor accounts, and
              administrative coverage
              across the SVNHS Attendance
              Management System.
            </p>

            <div className="superadmin-dashboard-hero-meta">
              <span>
                {formatDisplayDate(
                  today,
                )}
              </span>

              <span
                className="superadmin-dashboard-hero-dot"
                aria-hidden="true"
              />

              <span>
                Global Administration
              </span>
            </div>

            <div className="superadmin-dashboard-hero-actions">
              <button
                type="button"
                className="superadmin-dashboard-primary-button"
                onClick={
                  goToDepartments
                }
              >
                <span
                  aria-hidden="true"
                >
                  ▤
                </span>

                Manage Departments
              </button>

              <button
                type="button"
                className="superadmin-dashboard-secondary-button"
                onClick={
                  goToCouncilors
                }
              >
                Manage Councilors
              </button>
            </div>
          </div>

          <div
            className="superadmin-dashboard-hero-seal"
            aria-hidden="true"
          >
            <img
              src={
                seniorHighSchoolLogo
              }
              alt=""
            />
          </div>
        </section>

        {/* =================================================
            ERROR RECOVERY
        ================================================== */}

        {error && (
          <div
            className="superadmin-dashboard-warning"
            role="status"
          >
            <span
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Some information is
                unavailable
              </strong>

              <p>
                {error} Other
                available dashboard
                information is shown
                normally.
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleRetry
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Retrying..."
                : "Retry"}
            </button>
          </div>
        )}

        {/* =================================================
            KPI GRID
        ================================================== */}

        <section
          className="superadmin-dashboard-kpi-grid"
          aria-label="Super Administrator dashboard summary"
        >
          <article className="superadmin-dashboard-kpi-card">
            <div className="superadmin-dashboard-kpi-header">
              <span
                className="superadmin-dashboard-kpi-icon"
                aria-hidden="true"
              >
                ▤
              </span>

              <span className="superadmin-dashboard-kpi-tag">
                ORGANIZATION
              </span>
            </div>

            <strong className="superadmin-dashboard-kpi-value">
              {loading ||
              !departmentsReady
                ? "—"
                : formatNumber(
                    departments.length,
                  )}
            </strong>

            <h3>
              Departments
            </h3>

            <p>
              {departmentsReady
                ? `${formatNumber(
                    activeDepartments.length,
                  )} active · ${formatNumber(
                    inactiveDepartments,
                  )} inactive`
                : "Department information unavailable"}
            </p>
          </article>

          <article className="superadmin-dashboard-kpi-card">
            <div className="superadmin-dashboard-kpi-header">
              <span
                className="superadmin-dashboard-kpi-icon superadmin-dashboard-kpi-icon-success"
                aria-hidden="true"
              >
                ✓
              </span>

              <span className="superadmin-dashboard-kpi-tag">
                AVAILABILITY
              </span>
            </div>

            <strong className="superadmin-dashboard-kpi-value">
              {loading ||
              !departmentsReady
                ? "—"
                : formatNumber(
                    activeDepartments.length,
                  )}
            </strong>

            <h3>
              Active Departments
            </h3>

            <p>
              {departmentsReady
                ? `${formatPercentage(
                    departmentActiveRate,
                  )} of departments available`
                : "Availability unavailable"}
            </p>
          </article>

          <article className="superadmin-dashboard-kpi-card">
            <div className="superadmin-dashboard-kpi-header">
              <span
                className="superadmin-dashboard-kpi-icon"
                aria-hidden="true"
              >
                ♙
              </span>

              <span className="superadmin-dashboard-kpi-tag">
                ACCOUNTS
              </span>
            </div>

            <strong className="superadmin-dashboard-kpi-value">
              {loading ||
              !councilorsReady
                ? "—"
                : formatNumber(
                    councilors.length,
                  )}
            </strong>

            <h3>
              Councilor Accounts
            </h3>

            <p>
              {councilorsReady
                ? `${formatNumber(
                    activeCouncilors.length,
                  )} active · ${formatNumber(
                    inactiveCouncilors,
                  )} inactive`
                : "Councilor information unavailable"}
            </p>
          </article>

          <article className="superadmin-dashboard-kpi-card">
            <div className="superadmin-dashboard-kpi-header">
              <span
                className="superadmin-dashboard-kpi-icon superadmin-dashboard-kpi-icon-gold"
                aria-hidden="true"
              >
                ◎
              </span>

              <span className="superadmin-dashboard-kpi-tag">
                COVERAGE
              </span>
            </div>

            <strong className="superadmin-dashboard-kpi-value">
              {loading ||
              !departmentsReady ||
              !councilorsReady
                ? "—"
                : formatPercentage(
                    coverageRate,
                  )}
            </strong>

            <h3>
              Councilor Coverage
            </h3>

            <p>
              {departmentsReady &&
              councilorsReady
                ? `${formatNumber(
                    coveredDepartments,
                  )} of ${formatNumber(
                    activeDepartments.length,
                  )} active departments covered`
                : "Coverage information unavailable"}
            </p>
          </article>
        </section>

        {/* =================================================
            OPERATIONAL GRID
        ================================================== */}

        <section className="superadmin-dashboard-operational-grid">
          <article className="superadmin-dashboard-panel">
            <header className="superadmin-dashboard-panel-header">
              <div>
                <span className="superadmin-dashboard-panel-eyebrow">
                  ADMINISTRATIVE COVERAGE
                </span>

                <h2>
                  Department Coverage
                </h2>

                <p>
                  Active departments
                  should have an active
                  Councilor account
                  assigned.
                </p>
              </div>

              <button
                type="button"
                className="superadmin-dashboard-panel-action"
                onClick={
                  goToDepartments
                }
              >
                View Departments →
              </button>
            </header>

            <div className="superadmin-dashboard-coverage-body">
              <div className="superadmin-dashboard-coverage-score">
                <div className="superadmin-dashboard-coverage-ring">
                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? formatPercentage(
                          coverageRate,
                        )
                      : "—"}
                  </strong>

                  <span>
                    COVERAGE
                  </span>
                </div>

                <div className="superadmin-dashboard-coverage-copy">
                  <span>
                    ACTIVE DEPARTMENT
                    COVERAGE
                  </span>

                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? `${formatNumber(
                          coveredDepartments,
                        )} covered`
                      : "Data unavailable"}
                  </strong>

                  <p>
                    {departmentsReady &&
                    councilorsReady
                      ? uncoveredDepartments >
                        0
                        ? `${formatNumber(
                            uncoveredDepartments,
                          )} active department${
                            uncoveredDepartments ===
                            1
                              ? ""
                              : "s"
                          } currently without an active Councilor.`
                        : activeDepartments.length >
                            0
                          ? "Every active department currently has an active Councilor."
                          : "There are currently no active departments."
                      : "Department coverage could not be calculated."}
                  </p>
                </div>
              </div>

              <div className="superadmin-dashboard-coverage-progress">
                <div className="superadmin-dashboard-progress-head">
                  <span>
                    Coverage Progress
                  </span>

                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? formatPercentage(
                          coverageRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="superadmin-dashboard-progress-track">
                  <span
                    style={{
                      width: `${clampPercentage(
                        coverageRate,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="superadmin-dashboard-coverage-stats">
                <div>
                  <span>
                    Covered
                  </span>

                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? formatNumber(
                          coveredDepartments,
                        )
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Uncovered
                  </span>

                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? formatNumber(
                          uncoveredDepartments,
                        )
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Inactive
                  </span>

                  <strong>
                    {departmentsReady
                      ? formatNumber(
                          inactiveDepartments,
                        )
                      : "—"}
                  </strong>
                </div>
              </div>
            </div>
          </article>

          {/* ===============================================
              ADMINISTRATION HEALTH
          ================================================ */}

          <article className="superadmin-dashboard-panel">
            <header className="superadmin-dashboard-panel-header">
              <div>
                <span className="superadmin-dashboard-panel-eyebrow">
                  SYSTEM READINESS
                </span>

                <h2>
                  Administration Health
                </h2>

                <p>
                  Current administrative
                  availability across
                  departments and
                  Councilor accounts.
                </p>
              </div>
            </header>

            <div className="superadmin-dashboard-readiness">
              <div className="superadmin-dashboard-readiness-item">
                <div className="superadmin-dashboard-readiness-head">
                  <div>
                    <span>
                      Department
                      Availability
                    </span>

                    <small>
                      Active departments
                    </small>
                  </div>

                  <strong>
                    {departmentsReady
                      ? formatPercentage(
                          departmentActiveRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="superadmin-dashboard-readiness-progress">
                  <span
                    style={{
                      width: `${clampPercentage(
                        departmentActiveRate,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="superadmin-dashboard-readiness-item">
                <div className="superadmin-dashboard-readiness-head">
                  <div>
                    <span>
                      Councilor
                      Availability
                    </span>

                    <small>
                      Active Councilor
                      accounts
                    </small>
                  </div>

                  <strong>
                    {councilorsReady
                      ? formatPercentage(
                          councilorActiveRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="superadmin-dashboard-readiness-progress">
                  <span
                    style={{
                      width: `${clampPercentage(
                        councilorActiveRate,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="superadmin-dashboard-readiness-item">
                <div className="superadmin-dashboard-readiness-head">
                  <div>
                    <span>
                      Administrative
                      Coverage
                    </span>

                    <small>
                      Active departments
                      with Councilors
                    </small>
                  </div>

                  <strong>
                    {departmentsReady &&
                    councilorsReady
                      ? formatPercentage(
                          coverageRate,
                        )
                      : "—"}
                  </strong>
                </div>

                <div className="superadmin-dashboard-readiness-progress superadmin-dashboard-readiness-progress-gold">
                  <span
                    style={{
                      width: `${clampPercentage(
                        coverageRate,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="superadmin-dashboard-quick-actions">
              <button
                type="button"
                onClick={
                  goToDepartments
                }
              >
                <span
                  aria-hidden="true"
                >
                  ▤
                </span>

                <div>
                  <strong>
                    Departments
                  </strong>

                  <small>
                    Create, edit and
                    manage status
                  </small>
                </div>

                <span
                  aria-hidden="true"
                >
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={
                  goToCouncilors
                }
              >
                <span
                  aria-hidden="true"
                >
                  ♙
                </span>

                <div>
                  <strong>
                    Councilors
                  </strong>

                  <small>
                    Manage department
                    administrators
                  </small>
                </div>

                <span
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            </div>
          </article>
        </section>

        {/* =================================================
            DIRECTORY GRID
        ================================================== */}

        <section className="superadmin-dashboard-directory-grid">
          <article className="superadmin-dashboard-panel superadmin-dashboard-directory-panel">
            <header className="superadmin-dashboard-panel-header">
              <div>
                <span className="superadmin-dashboard-panel-eyebrow">
                  ORGANIZATION
                </span>

                <h2>
                  Department Snapshot
                </h2>

                <p>
                  Current department
                  availability and
                  Councilor coverage.
                </p>
              </div>

              <button
                type="button"
                className="superadmin-dashboard-panel-action"
                onClick={
                  goToDepartments
                }
              >
                Manage →
              </button>
            </header>

            {!departmentsReady ? (
              <div className="superadmin-dashboard-empty">
                <span
                  aria-hidden="true"
                >
                  !
                </span>

                <strong>
                  Department data
                  unavailable
                </strong>

                <p>
                  Use the Retry option
                  above to attempt loading
                  the department data
                  again.
                </p>
              </div>
            ) : departmentSnapshot.length ===
              0 ? (
              <div className="superadmin-dashboard-empty">
                <span
                  aria-hidden="true"
                >
                  ▤
                </span>

                <strong>
                  No departments yet
                </strong>

                <p>
                  Create the first
                  department to begin
                  organizing Councilor
                  accounts.
                </p>

                <button
                  type="button"
                  onClick={
                    goToDepartments
                  }
                >
                  Manage Departments
                </button>
              </div>
            ) : (
              <div className="superadmin-dashboard-department-list">
                {departmentSnapshot.map(
                  (department) => {
                    const isActive =
                      department.active !==
                      false;

                    const councilor =
                      getDepartmentCouncilor(
                        department.id,
                      );

                    return (
                      <article
                        key={
                          department.id
                        }
                        className="superadmin-dashboard-department-row"
                      >
                        <div className="superadmin-dashboard-department-identity">
                          <div className="superadmin-dashboard-department-code">
                            {department.code ??
                              "DEP"}
                          </div>

                          <div>
                            <strong>
                              {department.name}
                            </strong>

                            <span>
                              {councilor
                                ? councilor.name
                                : isActive
                                  ? "No active Councilor"
                                  : "Department inactive"}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`superadmin-dashboard-status ${
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

            {departmentsReady &&
              departments.length >
                5 && (
                <footer className="superadmin-dashboard-panel-footer">
                  <span>
                    Showing 5 of{" "}
                    {formatNumber(
                      departments.length,
                    )}{" "}
                    departments
                  </span>

                  <button
                    type="button"
                    onClick={
                      goToDepartments
                    }
                  >
                    View all departments
                    →
                  </button>
                </footer>
              )}
          </article>

          <article className="superadmin-dashboard-panel superadmin-dashboard-directory-panel">
            <header className="superadmin-dashboard-panel-header">
              <div>
                <span className="superadmin-dashboard-panel-eyebrow">
                  ADMINISTRATORS
                </span>

                <h2>
                  Councilor Snapshot
                </h2>

                <p>
                  Department Councilor
                  accounts and current
                  account status.
                </p>
              </div>

              <button
                type="button"
                className="superadmin-dashboard-panel-action"
                onClick={
                  goToCouncilors
                }
              >
                Manage →
              </button>
            </header>

            {!councilorsReady ? (
              <div className="superadmin-dashboard-empty">
                <span
                  aria-hidden="true"
                >
                  !
                </span>

                <strong>
                  Councilor data
                  unavailable
                </strong>

                <p>
                  Use the Retry option
                  above to attempt loading
                  the Councilor data
                  again.
                </p>
              </div>
            ) : councilorSnapshot.length ===
              0 ? (
              <div className="superadmin-dashboard-empty">
                <span
                  aria-hidden="true"
                >
                  ♙
                </span>

                <strong>
                  No Councilor accounts
                  yet
                </strong>

                <p>
                  Create a Councilor
                  account and assign it
                  to an active
                  department.
                </p>

                <button
                  type="button"
                  onClick={
                    goToCouncilors
                  }
                >
                  Manage Councilors
                </button>
              </div>
            ) : (
              <div className="superadmin-dashboard-councilor-list">
                {councilorSnapshot.map(
                  (councilor) => {
                    const isActive =
                      councilor.active !==
                      false;

                    const initial =
                      councilor.name
                        ?.trim()
                        ?.charAt(0)
                        ?.toUpperCase() ||
                      "C";

                    return (
                      <article
                        key={
                          councilor.id
                        }
                        className="superadmin-dashboard-councilor-row"
                      >
                        <div className="superadmin-dashboard-councilor-person">
                          <div className="superadmin-dashboard-councilor-avatar">
                            {initial}
                          </div>

                          <div>
                            <strong>
                              {
                                councilor.name
                              }
                            </strong>

                            <span>
                              {
                                councilor.email
                              }
                            </span>
                          </div>
                        </div>

                        <span className="superadmin-dashboard-department-badge">
                          {councilor.departmentCode ??
                            "—"}
                        </span>

                        <span
                          className={`superadmin-dashboard-status ${
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

            {councilorsReady &&
              councilors.length >
                5 && (
                <footer className="superadmin-dashboard-panel-footer">
                  <span>
                    Showing 5 of{" "}
                    {formatNumber(
                      councilors.length,
                    )}{" "}
                    Councilor accounts
                  </span>

                  <button
                    type="button"
                    onClick={
                      goToCouncilors
                    }
                  >
                    View all Councilors
                    →
                  </button>
                </footer>
              )}
          </article>
        </section>
      </section>
    </SuperAdminLayout>
  );
}

export default SuperAdminDashboard;