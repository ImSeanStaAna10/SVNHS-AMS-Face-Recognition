import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import shsLogo from "../../assets/shs-logo.svg";

import authService from "../../services/authService";

/* =========================================================
   COMPONENT
========================================================= */

function CouncilorSidebar({
  onChangePassword,
  isOpen = false,
  onClose,
}) {
  const navigate =
    useNavigate();

  /* =======================================================
     NAV LINK CLASS
  ======================================================= */

  const getNavClassName = ({
    isActive,
  }) =>
    `councilor-nav-item ${
      isActive ? "active" : ""
    }`;

  /* =======================================================
     CLOSE MOBILE SIDEBAR
  ======================================================= */

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  /* =======================================================
     CHANGE PASSWORD
  ======================================================= */

  const handleChangePassword = () => {
    handleClose();

    if (onChangePassword) {
      onChangePassword();
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    handleClose();

    authService.logout();

    navigate("/login", {
      replace: true,
    });
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <aside
      id="councilor-mobile-sidebar"
      className={`councilor-sidebar ${
        isOpen
          ? "is-mobile-open"
          : ""
      }`}
    >
      {/* ===============================================
          BRAND
      ================================================ */}

      <div className="councilor-brand">
        <div className="councilor-brand-logo">
          <img
            src={shsLogo}
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

        {/* =============================================
            MOBILE CLOSE BUTTON
        ============================================== */}

        <button
          type="button"
          className="councilor-mobile-sidebar-close"
          onClick={handleClose}
          aria-label="Close navigation menu"
        >
          <span
            aria-hidden="true"
          >
            ×
          </span>
        </button>
      </div>

      {/* ===============================================
          NAVIGATION
      ================================================ */}

      <span className="councilor-nav-label">
        MAIN MENU
      </span>

      <nav
        className="councilor-nav"
        aria-label="Councilor navigation"
      >
        {/* =============================================
            DASHBOARD
        ============================================== */}

        <NavLink
          to="/councilor/dashboard"
          className={
            getNavClassName
          }
          onClick={
            handleClose
          }
          end
        >
          <span
            className="councilor-nav-icon"
            aria-hidden="true"
          >
            ▦
          </span>

          <span>
            Dashboard
          </span>
        </NavLink>

        {/* =============================================
            ADVISERS
        ============================================== */}

        <NavLink
          to="/councilor/advisers"
          className={
            getNavClassName
          }
          onClick={
            handleClose
          }
          end
        >
          <span
            className="councilor-nav-icon"
            aria-hidden="true"
          >
            ♙
          </span>

          <span>
            Advisers
          </span>
        </NavLink>

        {/* =============================================
            SECTIONS
        ============================================== */}

        <NavLink
          to="/councilor/sections"
          className={
            getNavClassName
          }
          onClick={
            handleClose
          }
          end
        >
          <span
            className="councilor-nav-icon"
            aria-hidden="true"
          >
            ▤
          </span>

          <span>
            Sections
          </span>
        </NavLink>

        {/* =============================================
            ATTENDANCE
        ============================================== */}

        <NavLink
          to="/councilor/attendance"
          className={
            getNavClassName
          }
          onClick={
            handleClose
          }
          end
        >
          <span
            className="councilor-nav-icon"
            aria-hidden="true"
          >
            ◷
          </span>

          <span>
            Attendance
          </span>
        </NavLink>

        {/* =============================================
            ATTENDANCE RECORDS
        ============================================== */}

        <NavLink
          to="/councilor/attendance-records"
          className={
            getNavClassName
          }
          onClick={
            handleClose
          }
          end
        >
          <span
            className="councilor-nav-icon"
            aria-hidden="true"
          >
            ▥
          </span>

          <span>
            Attendance Records
          </span>
        </NavLink>

        {/* =============================================
            CHANGE PASSWORD
        ============================================== */}

        <button
          type="button"
          className="councilor-nav-item councilor-password-nav-item"
          onClick={
            handleChangePassword
          }
          aria-haspopup="dialog"
        >
          <span
            className="councilor-nav-icon councilor-password-nav-icon"
            aria-hidden="true"
          >
            ⚿
          </span>

          <span>
            Change Password
          </span>
        </button>
      </nav>

      {/* ===============================================
          SIDEBAR FOOTER
      ================================================ */}

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

          <span>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}

export default CouncilorSidebar;