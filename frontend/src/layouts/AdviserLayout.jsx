import { useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import ThemeToggle from "../common/themeToggle";

import adviserService from "../services/adviserService";
import authService from "../services/authService";

import bagongPilipinasLogo from "../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../assets/shs-logo.svg";

/*
 * Shared portal shell styles.
 */
import "../styles/councilor.css";
import "../styles/adviser/account.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

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

const isNavigationActive = (pathname, item) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname.startsWith(item.path);
};

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

/* =========================================================
   COMPONENT
========================================================= */

function AdviserLayout({
  children,
  title = "Dashboard",
  eyebrow = "ADVISER PORTAL",
  description = "Attendance Management System",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const user = authService.getUser();

  /* =======================================================
     CHANGE PASSWORD STATE
  ======================================================= */

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [passwordForm, setPasswordForm] = useState(
    INITIAL_PASSWORD_FORM,
  );

  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);

  /* =======================================================
     PASSWORD MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    if (!showPasswordModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !changingPassword
      ) {
        setShowPasswordModal(false);

        setPasswordForm(INITIAL_PASSWORD_FORM);

        setPasswordError("");
        setPasswordSuccess("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    showPasswordModal,
    changingPassword,
  ]);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigate = (path) => {
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

  const userEmail =
    user?.email ||
    "Adviser account";

  /* =======================================================
     PASSWORD MODAL CONTROLS
  ======================================================= */

  const openPasswordModal = () => {
    setPasswordForm(
      INITIAL_PASSWORD_FORM,
    );

    setPasswordError("");
    setPasswordSuccess("");

    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) {
      return;
    }

    setShowPasswordModal(false);

    setPasswordForm(
      INITIAL_PASSWORD_FORM,
    );

    setPasswordError("");
    setPasswordSuccess("");
  };

  /* =======================================================
     PASSWORD FORM
  ======================================================= */

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (passwordError) {
      setPasswordError("");
    }

    if (passwordSuccess) {
      setPasswordSuccess("");
    }
  };

  /* =======================================================
     PASSWORD VALIDATION
  ======================================================= */

  const validatePasswordForm = () => {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = passwordForm;

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return {
        valid: false,
        message:
          "Please complete all password fields.",
      };
    }

    if (newPassword.length < 8) {
      return {
        valid: false,
        message:
          "New password must be at least 8 characters.",
      };
    }

    if (
      newPassword ===
      currentPassword
    ) {
      return {
        valid: false,
        message:
          "New password must be different from your current password.",
      };
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return {
        valid: false,
        message:
          "New password and confirmation do not match.",
      };
    }

    return {
      valid: true,

      data: {
        currentPassword,
        newPassword,
      },
    };
  };

  /* =======================================================
     CHANGE PASSWORD
  ======================================================= */

  const handleChangePassword = async (event) => {
    event.preventDefault();

    const validation =
      validatePasswordForm();

    if (!validation.valid) {
      setPasswordError(
        validation.message,
      );

      return;
    }

    try {
      setChangingPassword(true);

      setPasswordError("");
      setPasswordSuccess("");

      await adviserService.changePassword(
        validation.data,
      );

      setPasswordForm(
        INITIAL_PASSWORD_FORM,
      );

      setPasswordSuccess(
        "Password changed successfully.",
      );
    } catch (error) {
      console.error(
        "Unable to change password:",
        error,
      );

      setPasswordError(
        getErrorMessage(
          error,
          "Unable to change password.",
        ),
      );
    } finally {
      setChangingPassword(false);
    }
  };

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

        {/* NAVIGATION LABEL */}

        <span className="councilor-nav-label">
          MAIN MENU
        </span>

        {/* =================================================
            NAVIGATION
        ================================================== */}

        <nav
          className="councilor-nav"
          aria-label="Adviser navigation"
        >
          {NAVIGATION_ITEMS.map((item) => {
            const active =
              isNavigationActive(
                location.pathname,
                item,
              );

            return (
              <button
                key={item.path}
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
          })}

          {/* ===============================================
              CHANGE PASSWORD
          ================================================ */}

          <button
            type="button"
            className="councilor-nav-item adviser-password-nav-item"
            onClick={openPasswordModal}
            aria-haspopup="dialog"
          >
            <span
              className="councilor-nav-icon adviser-password-nav-icon"
              aria-hidden="true"
            >
              ⚿
            </span>

            <span>
              Change Password
            </span>
          </button>
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

            <span>
              Logout
            </span>
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

      {/* ===================================================
          CHANGE PASSWORD MODAL
      ==================================================== */}

      {showPasswordModal && (
        <div
          className="councilor-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePasswordModal();
            }
          }}
        >
          <div
            className="councilor-modal adviser-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            {/* =============================================
                MODAL HEADER
            ============================================== */}

            <div className="councilor-modal-header">
              <div>
                <span>
                  ACCOUNT SECURITY
                </span>

                <h2 id="change-password-title">
                  Change Password
                </h2>

                <p>
                  Keep your Adviser account secure by
                  regularly updating your password.
                </p>
              </div>

              <button
                type="button"
                className="councilor-modal-close"
                onClick={
                  closePasswordModal
                }
                disabled={
                  changingPassword
                }
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* =============================================
                FORM
            ============================================== */}

            <form
              className="councilor-modal-form adviser-password-form"
              onSubmit={
                handleChangePassword
              }
              noValidate
            >
              {/* ===========================================
                  ACCOUNT INFORMATION
              ============================================ */}

              <div className="adviser-password-account">
                <div className="adviser-password-avatar">
                  {userInitial}
                </div>

                <div className="adviser-password-account-copy">
                  <span>
                    SIGNED IN AS
                  </span>

                  <strong>
                    {userName}
                  </strong>

                  <small>
                    {userEmail}
                  </small>
                </div>
              </div>

              {/* ===========================================
                  PASSWORD RECOVERY INFORMATION
              ============================================ */}

              <div className="adviser-password-help">
                <span
                  className="adviser-password-help-icon"
                  aria-hidden="true"
                >
                  i
                </span>

                <div>
                  <strong>
                    Forgot your current password?
                  </strong>

                  <p>
                    Contact your Councilor to request a
                    password reset. The Councilor can provide
                    you with a temporary password that you
                    can change after signing in.
                  </p>
                </div>
              </div>

              {/* ===========================================
                  CURRENT PASSWORD
              ============================================ */}

              <div className="councilor-modal-field">
                <label htmlFor="current-password">
                  Current Password
                </label>

                <input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={
                    passwordForm.currentPassword
                  }
                  onChange={
                    handlePasswordFormChange
                  }
                  autoComplete="current-password"
                  disabled={
                    changingPassword
                  }
                  autoFocus
                />
              </div>

              {/* ===========================================
                  NEW PASSWORD
              ============================================ */}

              <div className="councilor-modal-field">
                <label htmlFor="new-password">
                  New Password
                </label>

                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={
                    passwordForm.newPassword
                  }
                  onChange={
                    handlePasswordFormChange
                  }
                  autoComplete="new-password"
                  disabled={
                    changingPassword
                  }
                />

                <span className="councilor-field-hint">
                  Use at least 8 characters.
                </span>
              </div>

              {/* ===========================================
                  CONFIRM NEW PASSWORD
              ============================================ */}

              <div className="councilor-modal-field">
                <label htmlFor="confirm-new-password">
                  Confirm New Password
                </label>

                <input
                  id="confirm-new-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter new password"
                  value={
                    passwordForm.confirmPassword
                  }
                  onChange={
                    handlePasswordFormChange
                  }
                  autoComplete="new-password"
                  disabled={
                    changingPassword
                  }
                />
              </div>

              {/* ===========================================
                  ERROR
              ============================================ */}

              {passwordError && (
                <div
                  className="councilor-modal-error"
                  role="alert"
                >
                  <span aria-hidden="true">
                    !
                  </span>

                  <p>
                    {passwordError}
                  </p>
                </div>
              )}

              {/* ===========================================
                  SUCCESS
              ============================================ */}

              {passwordSuccess && (
                <div
                  className="adviser-password-success"
                  role="status"
                  aria-live="polite"
                >
                  <span aria-hidden="true">
                    ✓
                  </span>

                  <div>
                    <strong>
                      Password updated
                    </strong>

                    <p>
                      Your password has been changed
                      successfully.
                    </p>
                  </div>
                </div>
              )}

              {/* ===========================================
                  ACTIONS
              ============================================ */}

              <div className="councilor-modal-actions">
                <button
                  type="button"
                  className="councilor-secondary-button"
                  onClick={
                    closePasswordModal
                  }
                  disabled={
                    changingPassword
                  }
                >
                  {passwordSuccess
                    ? "Done"
                    : "Cancel"}
                </button>

                {!passwordSuccess && (
                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={
                      changingPassword
                    }
                  >
                    {changingPassword && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {changingPassword
                      ? "Changing..."
                      : "Change Password"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdviserLayout;