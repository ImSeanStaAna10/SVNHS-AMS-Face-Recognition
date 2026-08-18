import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import ThemeToggle from "../common/themeToggle";

import authService from "../services/authService";

import bagongPilipinasLogo from "../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../assets/shs-logo.svg";

/*
 * Temporary reuse of the existing portal shell styles.
 * Adviser-specific page styles will live separately.
 */
import "../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

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

const NAVIGATION_ITEMS = [
  {
    label: "Dashboard",
    icon: "▦",
    path: "/adviser/dashboard",
    exact: true,
  },
  {
    label: "Students",
    icon: "♙",
    path: "/adviser/students",
    exact: true,
  },
  {
    label: "Attendance",
    icon: "◷",
    path: "/adviser/attendance",
    exact: true,
  },
  {
    label: "Attendance History",
    icon: "▤",
    path: "/adviser/attendance/history",
  },
];

/* =========================================================
   HELPERS
========================================================= */

const isNavigationActive = (
  pathname,
  item,
) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname.startsWith(
    item.path,
  );
};

/* =========================================================
   COMPONENT
========================================================= */

function AdviserLayout({
  children,
  title = "Dashboard",
  eyebrow = "ADVISER PORTAL",
  description = "Attendance Management System",
}) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const user =
    authService.getUser();

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigate = (
    path,
  ) => {
    navigate(path);
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    authService.logout();

    navigate("/login", {
      replace: true,
    });
  };

  /* =======================================================
     USER
  ======================================================= */

  const userName =
    user?.name?.trim() ||
    "Adviser";

  const userInitial =
    userName
      .charAt(0)
      .toUpperCase() ||
    "A";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="councilor-page adviser-layout">
      {/* ===================================================
          SIDEBAR
      ==================================================== */}

      <aside className="councilor-sidebar adviser-sidebar">
        {/* BRAND */}

        <div className="councilor-brand">
          <div className="councilor-brand-logo">
            <img
              src={
                seniorHighSchoolLogo
              }
              alt="Signal Village National High School"
            />
          </div>

          <div className="councilor-brand-copy">
            <strong>
              SVNHS
            </strong>

            <span>
              Attendance Management System
            </span>
          </div>
        </div>

        {/* NAVIGATION LABEL */}

        <span className="councilor-nav-label">
          MAIN MENU
        </span>

        {/* NAVIGATION */}

        <nav
          className="councilor-nav"
          aria-label="Adviser navigation"
        >
          {NAVIGATION_ITEMS.map(
            (item) => {
              const active =
                isNavigationActive(
                  location.pathname,
                  item,
                );

              return (
                <button
                  key={
                    item.path
                  }
                  type="button"
                  className={`councilor-nav-item ${
                    active
                      ? "active"
                      : ""
                  }`}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    handleNavigate(
                      item.path,
                    )
                  }
                >
                  <span
                    className="councilor-nav-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            },
          )}
        </nav>

        {/* =================================================
            SIDEBAR FOOTER
        ================================================== */}

        <div className="councilor-sidebar-footer">
          <div className="councilor-sidebar-school">
            <span>
              SCHOOL SYSTEM
            </span>

            <strong>
              Signal Village National
              High School
            </strong>
          </div>

          <button
            type="button"
            className="councilor-logout"
            onClick={
              handleLogout
            }
          >
            <span
              aria-hidden="true"
            >
              ↪
            </span>

            Logout
          </button>
        </div>
      </aside>

      {/* ===================================================
          MAIN
      ==================================================== */}

      <section className="councilor-main adviser-main">
        {/* =================================================
            HEADER
        ================================================== */}

        <header className="councilor-header adviser-header">
          {/* HEADER COPY */}

          <div className="councilor-header-copy">
            <span className="councilor-eyebrow">
              {eyebrow}
            </span>

            <h1>
              {title}
            </h1>

            <p>
              {description}
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
                    key={
                      logo.alt
                    }
                    src={
                      logo.src
                    }
                    alt={
                      logo.alt
                    }
                    title={
                      logo.alt
                    }
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
                {userInitial}
              </div>

              <div className="councilor-user-copy">
                <strong>
                  {userName}
                </strong>

                <span>
                  Class Adviser
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            PAGE CONTENT
        ================================================== */}

        <div className="councilor-content adviser-content">
          {children}
        </div>
      </section>
    </main>
  );
}

export default AdviserLayout;