import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import authService from "../../services/authService";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolBackground from "../../assets/school-background.png";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import shsLogo from "../../assets/shs-logo.svg";

import "./auth.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_FORM = {
  email: "",
  password: "",
};

/* =========================================================
   PASSWORD VISIBILITY ICON
========================================================= */

function PasswordVisibilityIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx="12"
          cy="12"
          r="2.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a14.8 14.8 0 0 1-2.4 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.2 7.2C3.9 9 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function Login() {
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  /* =======================================================
     FORGOT PASSWORD MODAL EFFECTS
  ======================================================= */

  useEffect(() => {
    if (!showForgotPasswordModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowForgotPasswordModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showForgotPasswordModal]);

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  /* =======================================================
     PASSWORD VISIBILITY
  ======================================================= */

  const togglePasswordVisibility = () => {
    setShowPassword((current) => !current);
  };

  /* =======================================================
     FORGOT PASSWORD MODAL
  ======================================================= */

  const openForgotPasswordModal = () => {
    setShowForgotPasswordModal(true);
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
  };

  /* =======================================================
     LOGIN
  ======================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = formData.email.trim();

    const password = formData.password;

    if (!email || !password) {
      setError("Please enter your email address and password.");

      return;
    }

    try {
      setLoading(true);

      setError("");

      const data = await authService.login({
        email,
        password,
      });

      const user = authService.saveSession(data);

      /* ===============================================
           ROLE-BASED REDIRECT
        ================================================ */

      switch (user.role) {
        case "SUPERADMIN":
          navigate("/superadmin/dashboard", {
            replace: true,
          });

          break;

        case "COUNCILOR":
          navigate("/councilor/dashboard", {
            replace: true,
          });

          break;

        case "ADVISER":
          navigate("/adviser/dashboard", {
            replace: true,
          });

          break;

        default:
          authService.logout();

          setError(
            "Your account role is not authorized to access this system.",
          );

          break;
      }
    } catch (err) {
      if (!err.response) {
        setError(
          "Unable to connect to the server. Please check if the backend is running.",
        );

        return;
      }

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid email address or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="auth-page auth-light-theme">
      {/* =================================================
          BACKGROUND
      ================================================== */}

      <img
        src={schoolBackground}
        alt=""
        className="auth-background"
        aria-hidden="true"
      />

      <div className="auth-background-overlay" aria-hidden="true" />

      {/* =================================================
          DECORATIVE WAVES
      ================================================== */}

      <div className="auth-decoration auth-decoration-left" aria-hidden="true">
        <span className="auth-wave auth-wave-red" />

        <span className="auth-wave auth-wave-blue" />
      </div>

      <div className="auth-decoration auth-decoration-right" aria-hidden="true">
        <span className="auth-wave auth-wave-red" />

        <span className="auth-wave auth-wave-blue" />
      </div>

      {/* =================================================
          MAIN CONTENT
      ================================================== */}

      <div className="auth-container">
        {/* ===============================================
            BRANDING
        ================================================ */}

        <section className="auth-brand">
          <div className="auth-institutional">
            <p className="auth-republic">REPUBLIC OF THE PHILIPPINES</p>

            <div className="auth-logos">
              <img src={depedLogo} alt="Department of Education" />

              <img src={bagongPilipinasLogo} alt="Bagong Pilipinas" />

              <img src={schoolDivisionLogo} alt="Schools Division" />

              <img
                src={shsLogo}
                alt="Signal Village National High School"
                className="auth-school-logo"
              />
            </div>
          </div>

          <div className="auth-school-title">
            <span className="auth-location">TAGUIG CITY</span>

            <h1>
              <span>SIGNAL VILLAGE</span>
              NATIONAL HIGH SCHOOL
            </h1>

            <div className="auth-title-divider">
              <span />

              <strong>SVNHS</strong>

              <span />
            </div>

            <p>ATTENDANCE MANAGEMENT SYSTEM</p>
          </div>
        </section>

        {/* ===============================================
            LOGIN CARD
        ================================================ */}

        <section className="auth-login-section">
          <div className="auth-login-card">
            <div className="auth-card-top-line" />

            {/* ===========================================
                HEADER
            ============================================ */}

            <header className="auth-login-header">
              <span className="auth-welcome">WELCOME BACK!</span>

              <h2>Sign in to your account</h2>

              <p>
                Enter your school account credentials to continue to the
                attendance system.
              </p>
            </header>

            {/* ===========================================
                LOGIN FORM
            ============================================ */}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* =========================================
                  EMAIL
              ========================================== */}

              <div className="auth-field">
                <label htmlFor="email">Email Address</label>

                <div className="auth-input-wrapper">
                  <span className="auth-input-icon" aria-hidden="true">
                    @
                  </span>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your school email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* =========================================
                  PASSWORD
              ========================================== */}

              <div className="auth-field">
                <label htmlFor="password">Password</label>

                <div className="auth-input-wrapper auth-password-input-wrapper">
                  <span className="auth-input-icon" aria-hidden="true">
                    •
                  </span>

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>

                {/* =======================================
                    FORGOT PASSWORD
                ======================================== */}

                <button
                  type="button"
                  className="auth-forgot-password"
                  onClick={openForgotPasswordModal}
                  aria-haspopup="dialog"
                >
                  Forgot your password?
                </button>
              </div>

              {/* =========================================
                  ERROR
              ========================================== */}

              {error && (
                <div className="auth-error" role="alert">
                  <span aria-hidden="true">!</span>

                  <p>{error}</p>
                </div>
              )}

              {/* =========================================
                  LOGIN BUTTON
              ========================================== */}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && (
                  <span className="auth-spinner" aria-hidden="true" />
                )}

                {loading ? "Signing In..." : "Login"}
              </button>
            </form>

            {/* ===========================================
                FOOTER
            ============================================ */}

            <footer className="auth-login-footer">
              <span>SVNHS</span>

              <span className="auth-footer-divider" />

              <span>Attendance Management System</span>
            </footer>
          </div>
        </section>

        {/* ===============================================
            MOBILE-ONLY FOOTER
        ================================================ */}

        <footer className="auth-mobile-footer" aria-label="SVNHS system information">
          <div className="auth-mobile-footer-brand">
            <span className="auth-mobile-footer-logo">
              <img
                src={shsLogo}
                alt=""
                aria-hidden="true"
              />
            </span>

            <div>
              <strong>SVNHS</strong>
              <span>Attendance Management System</span>
            </div>
          </div>

          <div className="auth-mobile-footer-divider-line" />

          <p>
            Department of Education
            <span aria-hidden="true">•</span>
            Schools Division of Taguig City and Pateros
          </p>

          <small>
            Secure school access
            <span aria-hidden="true">•</span>
            © 2026 Signal Village National High School
          </small>
        </footer>
      </div>

      {/* =================================================
          BOTTOM LABEL
      ================================================== */}

      <div className="auth-bottom-label">
        <span>Department of Education</span>

        <strong>•</strong>

        <span>Schools Division of Taguig City and Pateros</span>
      </div>

      {/* =================================================
          FLOATING FORGOT PASSWORD MODAL
      ================================================== */}

      {showForgotPasswordModal && (
        <div
          className="auth-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForgotPasswordModal();
            }
          }}
        >
          <section
            className="auth-recovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-recovery-title"
            aria-describedby="auth-recovery-description"
          >
            {/* ===========================================
                MODAL HEADER
            ============================================ */}

            <header className="auth-recovery-modal-header">
              <div className="auth-recovery-header-copy">
                <span>ACCOUNT RECOVERY</span>

                <h2 id="auth-recovery-title">Forgot your password?</h2>

                <p id="auth-recovery-description">
                  Password recovery follows the system administration hierarchy.
                  Find your account role below.
                </p>
              </div>

              <button
                type="button"
                className="auth-modal-close"
                onClick={closeForgotPasswordModal}
                aria-label="Close password recovery modal"
              >
                ×
              </button>
            </header>

            {/* ===========================================
                INTRODUCTION
            ============================================ */}

            <div className="auth-recovery-intro">
              <span className="auth-recovery-intro-icon" aria-hidden="true">
                i
              </span>

              <p>
                Passwords cannot be recovered or viewed. An authorized
                administrator must reset the password and provide the account
                holder with a new credential.
              </p>
            </div>

            {/* ===========================================
                RECOVERY HIERARCHY
            ============================================ */}

            <div
              className="auth-recovery-hierarchy"
              aria-label="Account recovery hierarchy"
            >
              <div>
                <span>ADVISER</span>

                <strong>→</strong>

                <span>COUNCILOR</span>

                <strong>→</strong>

                <span>SUPER ADMIN</span>
              </div>

              <p>
                Recovery requests are handled by the authorized role directly
                above the account whenever applicable.
              </p>
            </div>

            {/* ===========================================
                RECOVERY OPTIONS
            ============================================ */}

            <div className="auth-recovery-options">
              {/* =========================================
                  ADVISER
              ========================================== */}

              <article className="auth-recovery-card auth-recovery-adviser">
                <div className="auth-recovery-role-icon" aria-hidden="true">
                  A
                </div>

                <div className="auth-recovery-role-copy">
                  <span>ADVISER ACCOUNT</span>

                  <h3>Contact your Department Councilor</h3>

                  <p>
                    If you forgot your Adviser password, contact the Councilor
                    responsible for your department. The Councilor can securely
                    reset your password and provide a new temporary credential.
                  </p>
                </div>
              </article>

              {/* =========================================
                  COUNCILOR
              ========================================== */}

              <article className="auth-recovery-card auth-recovery-councilor">
                <div className="auth-recovery-role-icon" aria-hidden="true">
                  C
                </div>

                <div className="auth-recovery-role-copy">
                  <span>COUNCILOR ACCOUNT</span>

                  <h3>Contact the Super Administrator</h3>

                  <p>
                    If you forgot your Councilor password, contact the system's
                    Super Administrator. The Super Administrator can reset your
                    Councilor account password through the Councilor Management
                    page and provide a new temporary credential.
                  </p>

                  <div className="auth-recovery-role-note">
                    <span aria-hidden="true">✓</span>

                    <p>
                      A password reset does not automatically activate an
                      inactive Councilor account. Account status is managed
                      separately by the Super Administrator.
                    </p>
                  </div>
                </div>
              </article>

              {/* =========================================
                  SUPERADMIN
              ========================================== */}

              <article className="auth-recovery-card auth-recovery-superadmin">
                <div className="auth-recovery-role-icon" aria-hidden="true">
                  S
                </div>

                <div className="auth-recovery-role-copy">
                  <span>SUPER ADMIN ACCOUNT</span>

                  <h3>Contact the authorized technical administrator</h3>

                  <p>
                    The Super Administrator is the highest administrative role
                    inside the attendance system. If this account password is
                    forgotten, recovery must be handled through the authorized
                    technical administration process.
                  </p>
                </div>
              </article>
            </div>

            {/* ===========================================
                SECURITY REMINDER
            ============================================ */}

            <div className="auth-recovery-security-note">
              <div className="auth-recovery-security-icon" aria-hidden="true">
                !
              </div>

              <div>
                <strong>Security Reminder</strong>

                <p>
                  Never send or disclose your current password. Administrators
                  should reset credentials, not request the user's existing
                  password.
                </p>
              </div>
            </div>

            {/* ===========================================
                ACCOUNT STATUS NOTE
            ============================================ */}

            <div className="auth-recovery-status-note">
              <span aria-hidden="true">i</span>

              <div>
                <strong>Unable to sign in after a password reset?</strong>

                <p>
                  Your account may be inactive. Contact the authorized
                  administrator for your role to verify the account status.
                </p>
              </div>
            </div>

            {/* ===========================================
                ACTION
            ============================================ */}

            <footer className="auth-recovery-actions">
              <button
                type="button"
                className="auth-recovery-button"
                onClick={closeForgotPasswordModal}
              >
                Back to Login
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default Login;
