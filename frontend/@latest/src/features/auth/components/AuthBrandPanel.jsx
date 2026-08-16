import institutionalLogos from "./../../../assets/branding/institutional-logos.png";
import schoolBuilding from "./../../../assets/branding/school-building.webp";

function AuthBrandPanel() {
  return (
    <section
      className="auth-brand-panel"
      style={{
        backgroundImage: `url(${schoolBuilding})`,
      }}
    >
      <div className="auth-brand-overlay" />

      <div className="auth-brand-content">
        <img
          src={institutionalLogos}
          alt="Signal Village National High School institutional logos"
          className="auth-logos"
        />

        <div className="auth-brand-copy">
          <span className="auth-eyebrow">
            Signal Village National High School
          </span>

          <h1>
            Attendance
            <br />
            Management System
          </h1>

          <p>
            A centralized platform for managing students, sections, attendance
            sessions, and attendance records.
          </p>
        </div>
      </div>

      <div className="auth-red-accent" />
    </section>
  );
}

export default AuthBrandPanel;
