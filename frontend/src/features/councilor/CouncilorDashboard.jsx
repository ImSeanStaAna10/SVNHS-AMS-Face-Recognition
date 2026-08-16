import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ThemeToggle from "../../common/themeToggle";

import authService from "../../services/authService";
import councilorService from "../../services/councilorService";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolBuilding from "../../assets/school-background.png";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

const INSTITUTIONAL_LOGOS = [
  {
    src: bagongPilipinasLogo,
    alt: "Bagong Pilipinas",
  },
  {
    src: depedLogo,
    alt: "Department of Education",
  },
  {
    src: schoolDivisionLogo,
    alt: "Schools Division Office",
  },
  {
    src: seniorHighSchoolLogo,
    alt: "Signal Village National High School",
  },
];

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

function CouncilorDashboard() {
  const navigate = useNavigate();

  const user = authService.getUser();

  const [advisers, setAdvisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =========================
  // LOAD DASHBOARD
  // =========================

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data =
          await councilorService.getAdvisers();

        setAdvisers(
          Array.isArray(data)
            ? data
            : [],
        );

        setError("");
      } catch (err) {
        console.error(
          "Councilor dashboard error:",
          err,
        );

        setError(
          getErrorMessage(
            err,
            "Unable to load councilor dashboard.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  // =========================
  // NAVIGATION
  // =========================

  const goToAdvisers = () => {
    navigate("/councilor/advisers");
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    authService.logout();

    navigate("/login", {
      replace: true,
    });
  };

  // =========================
  // DERIVED DATA
  // =========================

  const firstName =
    user?.name?.trim()?.split(/\s+/)[0] ||
    "Councilor";

  const recentAdvisers =
    advisers.slice(0, 5);

  // =========================
  // RENDER
  // =========================

  return (
    <main className="councilor-page">
      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="councilor-sidebar">
        {/* BRAND */}

        <div className="councilor-brand">
          <div className="councilor-brand-logo">
            <img
              src={seniorHighSchoolLogo}
              alt="Signal Village National High School"
            />
          </div>

          <div className="councilor-brand-copy">
            <strong>SVNHS</strong>

            <span>
              Attendance Management System
            </span>
          </div>
        </div>

        {/* NAV LABEL */}

        <span className="councilor-nav-label">
          MAIN MENU
        </span>

        {/* NAVIGATION */}

        <nav
          className="councilor-nav"
          aria-label="Councilor navigation"
        >
          <button
            type="button"
            className="councilor-nav-item active"
            aria-current="page"
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ▦
            </span>

            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            onClick={goToAdvisers}
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ♙
            </span>

            <span>Advisers</span>
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            disabled
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ▤
            </span>

            <span>Sections</span>

            <small>SOON</small>
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            disabled
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ◷
            </span>

            <span>Attendance</span>

            <small>SOON</small>
          </button>
        </nav>

        {/* SIDEBAR FOOTER */}

        <div className="councilor-sidebar-footer">
          <div className="councilor-sidebar-school">
            <span>
              SCHOOL SYSTEM
            </span>

            <strong>
              Signal Village National High School
            </strong>
          </div>

          <button
            type="button"
            className="councilor-logout"
            onClick={handleLogout}
          >
            <span aria-hidden="true">
              ↪
            </span>

            Logout
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <section className="councilor-main">
        {/* ===================================================
            HEADER
        ==================================================== */}

        <header className="councilor-header">
          {/* HEADER TITLE */}

          <div className="councilor-header-copy">
            <span className="councilor-eyebrow">
              COUNCILOR PORTAL
            </span>

            <h1>Dashboard</h1>

            <p>
              Attendance Management System
            </p>
          </div>

          {/* HEADER ACTIONS */}

          <div className="councilor-header-actions">
            {/* INSTITUTIONAL LOGOS */}

            <div
              className="councilor-header-logos"
              aria-label="Institutional logos"
            >
              {INSTITUTIONAL_LOGOS.map(
                (logo) => (
                  <img
                    key={logo.alt}
                    src={logo.src}
                    alt={logo.alt}
                    title={logo.alt}
                  />
                ),
              )}
            </div>

            {/* DIVIDER */}

            <div
              className="councilor-header-divider"
              aria-hidden="true"
            />

            {/* THEME TOGGLE */}

            <ThemeToggle />

            {/* DIVIDER */}

            <div
              className="councilor-header-divider"
              aria-hidden="true"
            />

            {/* USER */}

            <div className="councilor-user">
              <div className="councilor-avatar">
                {user?.name
                  ?.charAt(0)
                  ?.toUpperCase() || "U"}
              </div>

              <div className="councilor-user-copy">
                <strong>
                  {user?.name ||
                    "Councilor"}
                </strong>

                <span>
                  School Councilor
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ===================================================
            CONTENT
        ==================================================== */}

        <div className="councilor-content">
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

            {/* HERO CONTENT */}

            <div className="councilor-hero-content">
              <span className="councilor-hero-kicker">
                WELCOME BACK
              </span>

              <h2>
                Good day, {firstName}.
              </h2>

              <p>
                Monitor advisers, sections, and
                attendance activity across Signal
                Village National High School.
              </p>

              <div className="councilor-hero-meta">
                <span>SVNHS</span>

                <span
                  className="councilor-hero-meta-dot"
                  aria-hidden="true"
                />

                <span>
                  Attendance Management
                </span>
              </div>
            </div>

            {/* SCHOOL SEAL */}

            <div className="councilor-hero-seal">
              <img
                src={seniorHighSchoolLogo}
                alt=""
                aria-hidden="true"
              />
            </div>
          </section>

          {/* =================================================
              STATISTICS
          ================================================== */}

          <section
            className="councilor-stat-grid"
            aria-label="Dashboard statistics"
          >
            {/* TOTAL ADVISERS */}

            <article className="councilor-stat-card">
              <div className="councilor-stat-top">
                <span
                  className="councilor-stat-icon"
                  aria-hidden="true"
                >
                  ♙
                </span>

                <span className="councilor-stat-tag">
                  USERS
                </span>
              </div>

              <div className="councilor-stat-content">
                <strong>
                  {loading
                    ? "—"
                    : advisers.length}
                </strong>

                <p>Total Advisers</p>
              </div>

              <span className="councilor-stat-description">
                Registered adviser accounts
              </span>
            </article>

            {/* TOTAL SECTIONS */}

            <article className="councilor-stat-card">
              <div className="councilor-stat-top">
                <span
                  className="councilor-stat-icon"
                  aria-hidden="true"
                >
                  ▤
                </span>

                <span className="councilor-stat-tag">
                  ACADEMIC
                </span>
              </div>

              <div className="councilor-stat-content">
                <strong>—</strong>

                <p>Total Sections</p>
              </div>

              <span className="councilor-stat-description">
                Managed school sections
              </span>
            </article>

            {/* ATTENDANCE SESSIONS */}

            <article className="councilor-stat-card">
              <div className="councilor-stat-top">
                <span
                  className="councilor-stat-icon"
                  aria-hidden="true"
                >
                  ✓
                </span>

                <span className="councilor-stat-tag">
                  RECORDS
                </span>
              </div>

              <div className="councilor-stat-content">
                <strong>—</strong>

                <p>Sessions</p>
              </div>

              <span className="councilor-stat-description">
                Attendance sessions recorded
              </span>
            </article>

            {/* ATTENDANCE RATE */}

            <article className="councilor-stat-card">
              <div className="councilor-stat-top">
                <span
                  className="councilor-stat-icon"
                  aria-hidden="true"
                >
                  %
                </span>

                <span className="councilor-stat-tag">
                  PERFORMANCE
                </span>
              </div>

              <div className="councilor-stat-content">
                <strong>—</strong>

                <p>Attendance Rate</p>
              </div>

              <span className="councilor-stat-description">
                Overall student attendance
              </span>
            </article>
          </section>

          {/* =================================================
              ADVISER PANEL
          ================================================== */}

          <section className="councilor-panel">
            {/* PANEL HEADER */}

            <div className="councilor-panel-header">
              <div>
                <span>
                  ACCOUNT MANAGEMENT
                </span>

                <h2>
                  Adviser Overview

                  {!loading && (
                    <small>
                      {advisers.length}
                    </small>
                  )}
                </h2>

                <p>
                  Recently registered adviser
                  accounts.
                </p>
              </div>

              <div className="councilor-panel-actions">
                <button
                  type="button"
                  className="councilor-secondary-button"
                  onClick={goToAdvisers}
                >
                  View All
                </button>

                <button
                  type="button"
                  className="councilor-primary-button"
                  onClick={goToAdvisers}
                >
                  + Add Adviser
                </button>
              </div>
            </div>

            {/* =================================================
                ERROR
            ================================================== */}

            {error && (
              <div
                className="councilor-error"
                role="alert"
              >
                <span aria-hidden="true">
                  !
                </span>

                <p>{error}</p>
              </div>
            )}

            {/* =================================================
                LOADING / EMPTY / TABLE
            ================================================== */}

            {loading ? (
              /* LOADING */

              <div className="councilor-empty">
                <div
                  className="councilor-loading-spinner"
                  aria-hidden="true"
                />

                <strong>
                  Loading advisers
                </strong>

                <p>
                  Fetching adviser accounts...
                </p>
              </div>
            ) : advisers.length === 0 ? (
              /* EMPTY */

              <div className="councilor-empty">
                <div
                  className="councilor-empty-icon"
                  aria-hidden="true"
                >
                  ♙
                </div>

                <strong>
                  No advisers yet
                </strong>

                <p>
                  Create your first adviser account
                  to get started.
                </p>

                <button
                  type="button"
                  className="councilor-primary-button"
                  onClick={goToAdvisers}
                >
                  + Add Adviser
                </button>
              </div>
            ) : (
              /* TABLE */

              <div className="councilor-table-wrapper">
                <table className="councilor-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        ADVISER
                      </th>

                      <th scope="col">
                        EMAIL ADDRESS
                      </th>

                      <th scope="col">
                        ROLE
                      </th>

                      <th scope="col">
                        STATUS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentAdvisers.map(
                      (adviser) => (
                        <tr key={adviser.id}>
                          {/* ADVISER */}

                          <td>
                            <div className="councilor-person">
                              <div className="councilor-person-avatar">
                                {adviser.name
                                  ?.charAt(0)
                                  ?.toUpperCase() ||
                                  "A"}
                              </div>

                              <div>
                                <strong>
                                  {adviser.name}
                                </strong>

                                <span>
                                  School Adviser
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* EMAIL */}

                          <td>
                            {adviser.email}
                          </td>

                          {/* ROLE */}

                          <td>
                            <span className="councilor-role">
                              {adviser.role ||
                                "ADVISER"}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`councilor-status ${
                                adviser.active ===
                                false
                                  ? "inactive"
                                  : ""
                              }`}
                            >
                              <span
                                aria-hidden="true"
                              />

                              {adviser.active ===
                              false
                                ? "Inactive"
                                : "Active"}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* =================================================
                PANEL FOOTER
            ================================================== */}

            {!loading &&
              advisers.length > 5 && (
                <div className="councilor-panel-footer">
                  <span>
                    Showing 5 of{" "}
                    {advisers.length} advisers
                  </span>

                  <button
                    type="button"
                    onClick={goToAdvisers}
                  >
                    View all advisers →
                  </button>
                </div>
              )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default CouncilorDashboard;