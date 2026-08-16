import { NavLink, useNavigate } from "react-router-dom";

import shsLogo from "../../assets/shs-logo.svg";

import authService from "../../services/authService";

function CouncilorSidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="councilor-sidebar">
      <div className="councilor-sidebar-brand">
        <img
          src={shsLogo}
          alt="Signal Village National High School"
        />

        <div>
          <strong>SVNHS</strong>
          <span>Attendance System</span>
        </div>
      </div>

      <div className="councilor-sidebar-divider" />

      <nav className="councilor-navigation">
        <p className="councilor-nav-label">MAIN MENU</p>

        <NavLink
          to="/councilor/dashboard"
          className={({ isActive }) =>
            `councilor-nav-item ${
              isActive ? "active" : ""
            }`
          }
        >
          <span className="councilor-nav-icon">⌂</span>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/councilor/advisers"
          className="councilor-nav-item"
        >
          <span className="councilor-nav-icon">◉</span>
          <span>Advisers</span>
        </NavLink>

        <NavLink
          to="/councilor/sections"
          className="councilor-nav-item"
        >
          <span className="councilor-nav-icon">▦</span>
          <span>Sections</span>
        </NavLink>
      </nav>

      <div className="councilor-sidebar-bottom">
        <button
          type="button"
          className="councilor-logout"
          onClick={handleLogout}
        >
          <span>↪</span>
          <span>Logout</span>
        </button>

        <div className="councilor-sidebar-footer">
          <strong>SVNHS</strong>
          <span>Attendance Management System</span>
        </div>
      </div>
    </aside>
  );
}

export default CouncilorSidebar;