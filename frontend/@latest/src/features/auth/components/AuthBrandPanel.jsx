import schoolBuilding from "../../../assets/branding/school-building.webp";

import bagongPilipinasLogo from "../../../assets/branding/Bagong-Pilipinas-Logo.svg";
import depedLogo from "../../../assets/branding/Kagawaran-Edukasyon-Logo.svg";
import schoolDivisionLogo from "../../../assets/branding/School-Division-Logo.svg";
import seniorHighSchoolLogo from "../../../assets/branding/Senior-HighSchool-Logo.svg";

const institutionalLogos = [
  {
    src: depedLogo,
    alt: "Department of Education",
  },
  {
    src: bagongPilipinasLogo,
    alt: "Bagong Pilipinas",
  },
  {
    src: seniorHighSchoolLogo,
    alt: "Senior High School",
  },
  {
    src: schoolDivisionLogo,
    alt: "Schools Division of Taguig City and Pateros",
  },
];

function AuthBrandPanel() {
  return (
    <section className="auth-brand-panel" aria-labelledby="auth-brand-title">
      <img
        src={schoolBuilding}
        alt=""
        className="auth-school-image"
        aria-hidden="true"
      />

      <div className="auth-photo-overlay" aria-hidden="true" />
      <div className="auth-brand-pattern" aria-hidden="true" />

      <div className="auth-ribbon auth-ribbon-primary" aria-hidden="true" />
      <div className="auth-ribbon auth-ribbon-secondary" aria-hidden="true" />

      <div className="auth-brand-content">
        <header className="auth-brand-header">
          <div className="auth-logo-row" aria-label="Institutional logos">
            {institutionalLogos.map((logo) => (
              <div className="auth-logo-item" key={logo.alt}>
                <img src={logo.src} alt={logo.alt} />
              </div>
            ))}
          </div>
        </header>

        <div className="auth-brand-spacer" />

        <div className="auth-brand-copy">
          <div className="auth-brand-kicker">
            <span className="auth-brand-kicker-line" />

            <span>Signal Village National High School</span>
          </div>

          <h1 id="auth-brand-title">
            Attendance
            <span>Management System</span>
          </h1>

          <p>
            A secure and efficient attendance management platform designed for
            the Signal Village National High School community.
          </p>

          <div className="auth-brand-meta">
            <div className="auth-brand-status">
              <span className="auth-meta-dot" />

              <span>Authorized personnel access</span>
            </div>

            <span className="auth-meta-divider" />

            <span>SVNHS</span>
          </div>
        </div>
      </div>

      <div className="auth-brand-bottom-line" aria-hidden="true" />
    </section>
  );
}

export default AuthBrandPanel;
