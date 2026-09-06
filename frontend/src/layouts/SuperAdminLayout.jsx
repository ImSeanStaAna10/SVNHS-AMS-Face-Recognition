import { useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import ThemeToggle from "../common/themeToggle";

import accountService from "../services/accountService";
import authService from "../services/authService";

import bagongPilipinasLogo from "../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../assets/shs-logo.svg";

import "../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const INITIAL_PASSWORD_VISIBILITY = {
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
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
    path: "/superadmin/dashboard",
    exact: true,
  },
  {
    label: "Departments",
    icon: "▤",
    path: "/superadmin/departments",
    exact: true,
  },
  {
    label: "Councilors",
    icon: "♙",
    path: "/superadmin/councilors",
    exact: true,
  },
];

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const isNavigationActive = (pathname, item) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname.startsWith(item.path);
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

function SuperadminLayout({
  children,
  title = "Dashboard",
  eyebrow = "SUPERADMIN PORTAL",
  description = "System Administration",
}) {
  const navigate = useNavigate();

  const location = useLocation();

  const user = authService.getUser();

  /* =======================================================
     MOBILE SIDEBAR STATE
  ======================================================= */

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /* =======================================================
     PASSWORD STATE
  ======================================================= */

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);

  const [passwordVisibility, setPasswordVisibility] = useState(
    INITIAL_PASSWORD_VISIBILITY,
  );

  const [passwordError, setPasswordError] = useState("");

  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);

  /* =======================================================
     USER
  ======================================================= */

  const userName = user?.name?.trim() || "Super Administrator";

  const userEmail = user?.email || "Superadmin account";

  const userInitial = userName.charAt(0).toUpperCase() || "S";

  /* =======================================================
     MOBILE SIDEBAR CONTROLS
  ======================================================= */

  const openMobileSidebar = () => {
    setMobileSidebarOpen(true);
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  /* =======================================================
     CLOSE MOBILE SIDEBAR WHEN DESKTOP RETURNS
  ======================================================= */

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");

    const handleViewportChange = (event) => {
      if (!event.matches) {
        setMobileSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigate = (path) => {
    closeMobileSidebar();

    navigate(path);
  };

  /* =======================================================
     LOGOUT
  ======================================================= */
  const handleLogout = () => {
    closeMobileSidebar();

    authService.logout();

    window.location.replace("/login");
  };
  /* =======================================================
     RESET PASSWORD MODAL STATE
  ======================================================= */

  const resetPasswordModalState = () => {
    setPasswordForm(INITIAL_PASSWORD_FORM);

    setPasswordVisibility(INITIAL_PASSWORD_VISIBILITY);

    setPasswordError("");
    setPasswordSuccess("");
  };

  /* =======================================================
     PASSWORD MODAL CONTROLS
  ======================================================= */

  const openPasswordModal = () => {
    closeMobileSidebar();

    resetPasswordModalState();

    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) {
      return;
    }

    setShowPasswordModal(false);

    resetPasswordModalState();
  };

  /* =======================================================
     PAGE SCROLL LOCK
  ======================================================= */

  useEffect(() => {
    if (!mobileSidebarOpen && !showPasswordModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen, showPasswordModal]);

  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  useEffect(() => {
    if (!mobileSidebarOpen && !showPasswordModal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showPasswordModal) {
        if (changingPassword) {
          return;
        }

        setShowPasswordModal(false);

        resetPasswordModalState();

        return;
      }

      if (mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen, showPasswordModal, changingPassword]);

  /* =======================================================
     PASSWORD FORM CHANGE
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
     PASSWORD VISIBILITY
  ======================================================= */

  const togglePasswordVisibility = (fieldName) => {
    setPasswordVisibility((current) => ({
      ...current,

      [fieldName]: !current[fieldName],
    }));
  };

  /* =======================================================
     PASSWORD VALIDATION
  ======================================================= */

  const validatePasswordForm = () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return {
        valid: false,

        message: "Please complete all password fields.",
      };
    }

    if (newPassword.length < 8) {
      return {
        valid: false,

        message: "New password must be at least 8 characters.",
      };
    }

    if (newPassword === currentPassword) {
      return {
        valid: false,

        message: "New password must be different from your current password.",
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        valid: false,

        message: "New password and confirmation do not match.",
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

    const validation = validatePasswordForm();

    if (!validation.valid) {
      setPasswordError(validation.message);

      return;
    }

    try {
      setChangingPassword(true);

      setPasswordError("");
      setPasswordSuccess("");

      await accountService.changePassword(validation.data);

      setPasswordForm(INITIAL_PASSWORD_FORM);

      setPasswordVisibility(INITIAL_PASSWORD_VISIBILITY);

      setPasswordSuccess("Your password has been changed successfully.");
    } catch (error) {
      console.error("Unable to change Superadmin password:", error);

      setPasswordError(getErrorMessage(error, "Unable to change password."));
    } finally {
      setChangingPassword(false);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="councilor-layout superadmin-layout">
      {/* =================================================
          SIDEBAR
      ================================================== */}

      <aside
        id="superadmin-mobile-sidebar"
        className={`councilor-sidebar ${
          mobileSidebarOpen ? "is-mobile-open" : ""
        }`}
      >
        {/* ===============================================
            BRAND
        ================================================ */}

        <div className="councilor-brand">
          <div className="councilor-brand-logo">
            <img
              src={seniorHighSchoolLogo}
              alt="Signal Village National High School"
            />
          </div>

          <div className="councilor-brand-copy">
            <strong>SVNHS</strong>

            <span>Attendance Management System</span>
          </div>

          <button
            type="button"
            className="councilor-mobile-sidebar-close"
            onClick={closeMobileSidebar}
            aria-label="Close navigation menu"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* ===============================================
            NAVIGATION
        ================================================ */}

        <span className="councilor-nav-label">ADMINISTRATION</span>

        <nav className="councilor-nav" aria-label="Superadmin navigation">
          {NAVIGATION_ITEMS.map((item) => {
            const active = isNavigationActive(location.pathname, item);

            return (
              <button
                key={item.path}
                type="button"
                className={`councilor-nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => handleNavigate(item.path)}
              >
                <span className="councilor-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}

          {/* =============================================
              CHANGE PASSWORD
          ============================================== */}

          <button
            type="button"
            className="councilor-nav-item councilor-password-nav-item"
            onClick={openPasswordModal}
            aria-haspopup="dialog"
          >
            <span
              className="councilor-nav-icon councilor-password-nav-icon"
              aria-hidden="true"
            >
              ⚿
            </span>

            <span>Change Password</span>
          </button>
        </nav>

        {/* ===============================================
            SIDEBAR FOOTER
        ================================================ */}

        <div className="councilor-sidebar-footer">
          <div className="councilor-sidebar-school">
            <span>SYSTEM ADMINISTRATION</span>

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

      {/* =================================================
          MOBILE BACKDROP
      ================================================== */}

      {mobileSidebarOpen && (
        <div
          className="councilor-mobile-backdrop"
          role="presentation"
          onMouseDown={closeMobileSidebar}
        />
      )}

      {/* =================================================
          MAIN
      ================================================== */}

      <section className="councilor-main">
        {/* ===============================================
            TOPBAR
        ================================================ */}

        <header className="councilor-topbar">
          <div className="councilor-topbar-leading">
            <button
              type="button"
              className="councilor-mobile-menu-button"
              onClick={openMobileSidebar}
              aria-label="Open navigation menu"
              aria-expanded={mobileSidebarOpen}
              aria-controls="superadmin-mobile-sidebar"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>

            <div className="councilor-topbar-copy">
              <span className="councilor-eyebrow">{eyebrow}</span>

              <h1>{title}</h1>

              <p>{description}</p>
            </div>
          </div>

          <div className="councilor-topbar-actions">
            {/* ===========================================
                INSTITUTIONAL LOGOS
            ============================================ */}

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

            {/* ===========================================
                THEME
            ============================================ */}

            <ThemeToggle />

            <div className="councilor-topbar-divider" aria-hidden="true" />

            {/* ===========================================
                USER
            ============================================ */}

            <div className="councilor-user">
              <div className="councilor-avatar">{userInitial}</div>

              <div className="councilor-user-copy">
                <strong>{userName}</strong>

                <span>Super Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* ===============================================
            PAGE CONTENT
        ================================================ */}

        <main className="councilor-content">{children}</main>
      </section>

      {/* =================================================
          CHANGE PASSWORD MODAL
      ================================================== */}

      {showPasswordModal && (
        <div
          className="councilor-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <div
            className="councilor-modal councilor-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="superadmin-change-password-title"
          >
            {/* ===========================================
                MODAL HEADER
            ============================================ */}

            <div className="councilor-modal-header">
              <div>
                <span>ACCOUNT SECURITY</span>

                <h2 id="superadmin-change-password-title">Change Password</h2>

                <p>
                  Update the password used to access your Super Administrator
                  account.
                </p>
              </div>

              <button
                type="button"
                className="councilor-modal-close"
                onClick={closePasswordModal}
                disabled={changingPassword}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* ===========================================
                FORM
            ============================================ */}

            <form
              className="councilor-modal-form councilor-password-form"
              onSubmit={handleChangePassword}
              noValidate
            >
              {/* =========================================
                  ACCOUNT INFORMATION
              ========================================== */}

              <div className="councilor-password-account">
                <div className="councilor-password-avatar">{userInitial}</div>

                <div className="councilor-password-account-copy">
                  <span>SIGNED IN AS</span>

                  <strong>{userName}</strong>

                  <small>{userEmail}</small>
                </div>
              </div>

              {/* =========================================
                  SECURITY NOTICE
              ========================================== */}

              <div className="councilor-password-notice">
                <span
                  className="councilor-password-notice-icon"
                  aria-hidden="true"
                >
                  i
                </span>

                <div>
                  <strong>Administrative account security</strong>

                  <p>
                    This account has system-level administrative privileges. Use
                    a secure password and keep the credentials private.
                  </p>
                </div>
              </div>

              {/* =========================================
                  CURRENT PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="superadmin-current-password">
                  Current Password
                </label>

                <div className="councilor-password-input">
                  <input
                    id="superadmin-current-password"
                    name="currentPassword"
                    type={
                      passwordVisibility.currentPassword ? "text" : "password"
                    }
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordFormChange}
                    autoComplete="current-password"
                    disabled={changingPassword}
                    autoFocus
                  />

                  <button
                    type="button"
                    className="councilor-password-toggle"
                    onClick={() => togglePasswordVisibility("currentPassword")}
                    disabled={changingPassword}
                    aria-label={
                      passwordVisibility.currentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    aria-pressed={passwordVisibility.currentPassword}
                  >
                    <PasswordVisibilityIcon
                      visible={passwordVisibility.currentPassword}
                    />
                  </button>
                </div>
              </div>

              {/* =========================================
                  NEW PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="superadmin-new-password">New Password</label>

                <div className="councilor-password-input">
                  <input
                    id="superadmin-new-password"
                    name="newPassword"
                    type={passwordVisibility.newPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFormChange}
                    autoComplete="new-password"
                    disabled={changingPassword}
                  />

                  <button
                    type="button"
                    className="councilor-password-toggle"
                    onClick={() => togglePasswordVisibility("newPassword")}
                    disabled={changingPassword}
                    aria-label={
                      passwordVisibility.newPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    aria-pressed={passwordVisibility.newPassword}
                  >
                    <PasswordVisibilityIcon
                      visible={passwordVisibility.newPassword}
                    />
                  </button>
                </div>

                <span className="councilor-field-hint">
                  Use at least 8 characters.
                </span>
              </div>

              {/* =========================================
                  CONFIRM PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="superadmin-confirm-password">
                  Confirm New Password
                </label>

                <div className="councilor-password-input">
                  <input
                    id="superadmin-confirm-password"
                    name="confirmPassword"
                    type={
                      passwordVisibility.confirmPassword ? "text" : "password"
                    }
                    placeholder="Re-enter new password"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFormChange}
                    autoComplete="new-password"
                    disabled={changingPassword}
                  />

                  <button
                    type="button"
                    className="councilor-password-toggle"
                    onClick={() => togglePasswordVisibility("confirmPassword")}
                    disabled={changingPassword}
                    aria-label={
                      passwordVisibility.confirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                    aria-pressed={passwordVisibility.confirmPassword}
                  >
                    <PasswordVisibilityIcon
                      visible={passwordVisibility.confirmPassword}
                    />
                  </button>
                </div>
              </div>

              {/* =========================================
                  ERROR
              ========================================== */}

              {passwordError && (
                <div className="councilor-modal-error" role="alert">
                  <span aria-hidden="true">!</span>

                  <p>{passwordError}</p>
                </div>
              )}

              {/* =========================================
                  SUCCESS
              ========================================== */}

              {passwordSuccess && (
                <div
                  className="councilor-password-success"
                  role="status"
                  aria-live="polite"
                >
                  <span aria-hidden="true">✓</span>

                  <div>
                    <strong>Password updated</strong>

                    <p>{passwordSuccess}</p>
                  </div>
                </div>
              )}

              {/* =========================================
                  ACTIONS
              ========================================== */}

              <div className="councilor-modal-actions">
                <button
                  type="button"
                  className="councilor-secondary-button"
                  onClick={closePasswordModal}
                  disabled={changingPassword}
                >
                  {passwordSuccess ? "Done" : "Cancel"}
                </button>

                {!passwordSuccess && (
                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={changingPassword}
                  >
                    {changingPassword && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {changingPassword ? "Changing..." : "Change Password"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperadminLayout;
