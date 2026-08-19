import { useLocation } from "react-router-dom";

import ThemeToggle from "../../common/themeToggle";

import authService from "../../services/authService";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

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

const PAGE_CONFIG = {
  "/councilor/dashboard": {
    eyebrow: "COUNCILOR PORTAL",
    title: "Dashboard",
    description: "Attendance Management System",
  },

  "/councilor/advisers": {
    eyebrow: "ACCOUNT MANAGEMENT",
    title: "Advisers",
    description: "Manage adviser accounts for your school.",
  },

  "/councilor/sections": {
    eyebrow: "ACADEMIC MANAGEMENT",
    title: "Sections",
    description: "Manage school sections and adviser assignments.",
  },

  "/councilor/attendance": {
    eyebrow: "ATTENDANCE REPORTING",
    title: "Attendance",
    description: "Monitor school attendance and generate detailed reports.",
  },
};

function CouncilorTopbar() {
  const location = useLocation();

  const user = authService.getUser();

  const page =
    PAGE_CONFIG[location.pathname] || PAGE_CONFIG["/councilor/dashboard"];

  const userInitial = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="councilor-topbar">
      {/* ===============================================
          PAGE INFORMATION
      ================================================ */}

      <div className="councilor-topbar-copy">
        <span className="councilor-eyebrow">{page.eyebrow}</span>

        <h1>{page.title}</h1>

        <p>{page.description}</p>
      </div>

      {/* ===============================================
          ACTIONS
      ================================================ */}

      <div className="councilor-topbar-actions">
        {/* INSTITUTIONAL LOGOS */}

        <div
          className="councilor-topbar-logos"
          aria-label="Institutional logos"
        >
          {INSTITUTIONAL_LOGOS.map((logo) => (
            <img
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              title={logo.alt}
            />
          ))}
        </div>

        <div className="councilor-topbar-divider" aria-hidden="true" />

        {/* LIGHT / DARK MODE */}

        <ThemeToggle />

        <div className="councilor-topbar-divider" aria-hidden="true" />

        {/* USER */}

        <div className="councilor-user">
          <div className="councilor-avatar">{userInitial}</div>

          <div className="councilor-user-copy">
            <strong>{user?.name || "Councilor"}</strong>

            <span>School Councilor</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default CouncilorTopbar;
