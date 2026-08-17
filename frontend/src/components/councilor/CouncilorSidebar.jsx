import { NavLink, useNavigate } from "react-router-dom";

import shsLogo from "../../assets/shs-logo.svg";

import authService from "../../services/authService";

function CouncilorSidebar() {
  const navigate = useNavigate();

  const getNavClassName = ({ isActive }) =>
    `councilor-nav-item ${isActive ? "active" : ""}`;

  const handleLogout = () => {
    authService.logout();

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <aside className="councilor-sidebar">
      {/* ===============================================
          BRAND
      ================================================ */}

      <div className="councilor-brand">
        <div className="councilor-brand-logo">
          <img src={shsLogo} alt="Signal Village National High School" />
        </div>

        <div className="councilor-brand-copy">
          <strong>SVNHS</strong>

          <span>Attendance Management System</span>
        </div>
      </div>

      {/* ===============================================
          NAVIGATION
      ================================================ */}

      <span className="councilor-nav-label">MAIN MENU</span>

      <nav className="councilor-nav" aria-label="Councilor navigation">
        {/* DASHBOARD */}

        <NavLink to="/councilor/dashboard" className={getNavClassName} end>
          <span className="councilor-nav-icon" aria-hidden="true">
            ▦
          </span>

          <span>Dashboard</span>
        </NavLink>

        {/* ADVISERS */}

        <NavLink to="/councilor/advisers" className={getNavClassName}>
          <span className="councilor-nav-icon" aria-hidden="true">
            ♙
          </span>

          <span>Advisers</span>
        </NavLink>

        {/* SECTIONS */}

        <NavLink to="/councilor/sections" className={getNavClassName}>
          <span className="councilor-nav-icon" aria-hidden="true">
            ▤
          </span>

          <span>Sections</span>
        </NavLink>

        {/* ATTENDANCE */}

        <NavLink to="/councilor/attendance" className={getNavClassName}>
          <span className="councilor-nav-icon" aria-hidden="true">
            ◷
          </span>

          <span>Attendance</span>
        </NavLink>
      </nav>

      {/* ===============================================
          SIDEBAR FOOTER
      ================================================ */}

      <div className="councilor-sidebar-footer">
        <div className="councilor-sidebar-school">
          <span>SCHOOL SYSTEM</span>

          <strong>Signal Village National High School</strong>
        </div>

        <button
          type="button"
          className="councilor-logout"
          onClick={handleLogout}
        >
          <span aria-hidden="true">↪</span>

          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default CouncilorSidebar;
