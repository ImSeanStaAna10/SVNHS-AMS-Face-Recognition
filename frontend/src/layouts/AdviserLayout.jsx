import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import AdviserTopbar from "../components/topbar/adviserTopbar";

import accountService from "../services/accountService";
import authService from "../services/authService";

import seniorHighSchoolLogo from "../assets/shs-logo.svg";

/*
 * Shared portal shell styles.
 */
import "../styles/councilor.css";
import "../styles/adviser/account.css";

/*
 * Student transfer styles currently own
 * the Transfers sidebar badge styling.
 */
import "../styles/adviser/StudentManagementFaceScanning/studentTransfer.css";

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
  {
    label: "Attendance Records",
    icon: "▥",
    path: "/adviser/attendance-records",
    exact: true,
  },
  {
    label: "Transfers",
    icon: "↔",
    path: "/adviser/transfers",
    exact: true,
    transferBadge: true,
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

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const normalizePendingTransferCount = (
  value,
) => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
};

/* =========================================================
   PASSWORD VISIBILITY ICON
========================================================= */

function PasswordVisibilityIcon({
  visible,
}) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
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
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
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
     MOBILE SIDEBAR STATE
  ======================================================= */

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  /* =======================================================
     TRANSFER BADGE STATE

     IMPORTANT:
     AdviserTopbar already loads the incoming
     actionable notifications.

     Instead of making another API request here,
     AdviserTopbar reports its notification count
     back to this layout.

     This keeps:
     - Bell badge
     - Transfers sidebar badge

     synchronized using the same source.
  ======================================================= */

  const [
    incomingTransferCount,
    setIncomingTransferCount,
  ] = useState(0);

  /* =======================================================
     CHANGE PASSWORD STATE
  ======================================================= */

  const [
    showPasswordModal,
    setShowPasswordModal,
  ] = useState(false);

  const [
    passwordForm,
    setPasswordForm,
  ] = useState(
    INITIAL_PASSWORD_FORM,
  );

  const [
    passwordVisibility,
    setPasswordVisibility,
  ] = useState(
    INITIAL_PASSWORD_VISIBILITY,
  );

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState("");

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

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
     NOTIFICATION COUNT CALLBACK

     AdviserTopbar calls this whenever its notification
     collection changes.

     The sidebar uses the same count for the Transfers badge.
  ======================================================= */

  const handleNotificationCountChange =
    (count) => {
      setIncomingTransferCount(
        normalizePendingTransferCount(
          count,
        ),
      );
    };

  /* =======================================================
     MOBILE SIDEBAR CONTROLS
  ======================================================= */

  const openMobileSidebar =
    () => {
      setMobileSidebarOpen(
        true,
      );
    };

  const closeMobileSidebar =
    () => {
      setMobileSidebarOpen(
        false,
      );
    };

  /* =======================================================
     CLOSE SIDEBAR WHEN RETURNING TO DESKTOP
  ======================================================= */

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(max-width: 720px)",
      );

    const handleViewportChange =
      (event) => {
        if (
          !event.matches
        ) {
          setMobileSidebarOpen(
            false,
          );
        }
      };

    /*
     * Modern browsers.
     */
    if (
      typeof mediaQuery.addEventListener ===
      "function"
    ) {
      mediaQuery.addEventListener(
        "change",
        handleViewportChange,
      );

      return () => {
        mediaQuery.removeEventListener(
          "change",
          handleViewportChange,
        );
      };
    }

    /*
     * Compatibility fallback.
     */
    mediaQuery.addListener?.(
      handleViewportChange,
    );

    return () => {
      mediaQuery.removeListener?.(
        handleViewportChange,
      );
    };
  }, []);

  /* =======================================================
     MOBILE SIDEBAR SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    if (
      !mobileSidebarOpen
    ) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setMobileSidebarOpen(
            false,
          );
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    mobileSidebarOpen,
  ]);

  /* =======================================================
     PASSWORD MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    if (
      !showPasswordModal
    ) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
            "Escape" &&
          !changingPassword
        ) {
          setShowPasswordModal(
            false,
          );

          setPasswordForm(
            INITIAL_PASSWORD_FORM,
          );

          setPasswordVisibility(
            INITIAL_PASSWORD_VISIBILITY,
          );

          setPasswordError(
            "",
          );

          setPasswordSuccess(
            "",
          );
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

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

  const handleNavigate = (
    path,
  ) => {
    closeMobileSidebar();

    navigate(
      path,
    );
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    () => {
      closeMobileSidebar();

      authService.logout();

      navigate(
        "/login",
        {
          replace: true,
        },
      );
    };

  /* =======================================================
     RESET PASSWORD MODAL STATE
  ======================================================= */

  const resetPasswordModalState =
    () => {
      setPasswordForm(
        INITIAL_PASSWORD_FORM,
      );

      setPasswordVisibility(
        INITIAL_PASSWORD_VISIBILITY,
      );

      setPasswordError(
        "",
      );

      setPasswordSuccess(
        "",
      );
    };

  /* =======================================================
     PASSWORD MODAL CONTROLS
  ======================================================= */

  const openPasswordModal =
    () => {
      /*
       * Close mobile sidebar before opening
       * the account security modal.
       */
      closeMobileSidebar();

      resetPasswordModalState();

      setShowPasswordModal(
        true,
      );
    };

  const closePasswordModal =
    () => {
      if (
        changingPassword
      ) {
        return;
      }

      setShowPasswordModal(
        false,
      );

      resetPasswordModalState();
    };

  /* =======================================================
     PASSWORD FORM
  ======================================================= */

  const handlePasswordFormChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setPasswordForm(
        (current) => ({
          ...current,

          [name]:
            value,
        }),
      );

      if (
        passwordError
      ) {
        setPasswordError(
          "",
        );
      }

      if (
        passwordSuccess
      ) {
        setPasswordSuccess(
          "",
        );
      }
    };

  /* =======================================================
     PASSWORD VISIBILITY
  ======================================================= */

  const togglePasswordVisibility =
    (fieldName) => {
      setPasswordVisibility(
        (current) => ({
          ...current,

          [fieldName]:
            !current[
              fieldName
            ],
        }),
      );
    };

  /* =======================================================
     PASSWORD VALIDATION
  ======================================================= */

  const validatePasswordForm =
    () => {
      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } =
        passwordForm;

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

      if (
        newPassword.length <
        8
      ) {
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

  const handleChangePassword =
    async (event) => {
      event.preventDefault();

      const validation =
        validatePasswordForm();

      if (
        !validation.valid
      ) {
        setPasswordError(
          validation.message,
        );

        return;
      }

      try {
        setChangingPassword(
          true,
        );

        setPasswordError(
          "",
        );

        setPasswordSuccess(
          "",
        );

        await accountService.changePassword(
          validation.data,
        );

        setPasswordForm(
          INITIAL_PASSWORD_FORM,
        );

        setPasswordVisibility(
          INITIAL_PASSWORD_VISIBILITY,
        );

        setPasswordSuccess(
          "Password changed successfully.",
        );
      } catch (
        error
      ) {
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
        setChangingPassword(
          false,
        );
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

      <aside
        id="adviser-mobile-sidebar"
        className={`councilor-sidebar adviser-sidebar ${
          mobileSidebarOpen
            ? "is-mobile-open"
            : ""
        }`}
      >
        {/* =================================================
            BRAND
        ================================================== */}

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
              Attendance Management
              System
            </span>
          </div>

          {/* ===============================================
              MOBILE CLOSE BUTTON
          ================================================ */}

          <button
            type="button"
            className="adviser-mobile-sidebar-close"
            onClick={
              closeMobileSidebar
            }
            aria-label="Close navigation menu"
          >
            <span
              aria-hidden="true"
            >
              ×
            </span>
          </button>
        </div>

        {/* =================================================
            NAVIGATION
        ================================================== */}

        <span className="councilor-nav-label">
          MAIN MENU
        </span>

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
                    {
                      item.icon
                    }
                  </span>

                  {item.transferBadge ? (
                    <span className="adviser-nav-transfer-label">
                      <span>
                        {
                          item.label
                        }
                      </span>

                      {incomingTransferCount >
                        0 && (
                        <span
                          className="adviser-nav-transfer-badge"
                          aria-label={`${incomingTransferCount} pending incoming transfer request${
                            incomingTransferCount ===
                            1
                              ? ""
                              : "s"
                          }`}
                        >
                          {incomingTransferCount >
                          99
                            ? "99+"
                            : incomingTransferCount}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>
                      {
                        item.label
                      }
                    </span>
                  )}
                </button>
              );
            },
          )}

          {/* ===============================================
              CHANGE PASSWORD
          ================================================ */}

          <button
            type="button"
            className="councilor-nav-item adviser-password-nav-item"
            onClick={
              openPasswordModal
            }
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

      {/* ===================================================
          MOBILE SIDEBAR BACKDROP
      ==================================================== */}

      {mobileSidebarOpen && (
        <div
          className="adviser-mobile-sidebar-backdrop"
          role="presentation"
          onMouseDown={
            closeMobileSidebar
          }
        />
      )}

      {/* ===================================================
          MAIN
      ==================================================== */}

      <section className="councilor-main adviser-main">
        {/* =================================================
            REUSABLE TOPBAR

            AdviserTopbar owns:
            - Page heading
            - Mobile menu trigger
            - Institutional logos
            - Theme toggle
            - Notification bell
            - Notification dropdown
            - Adviser user information

            It reports the actionable notification count
            back here for the Transfers sidebar badge.
        ================================================== */}

        <AdviserTopbar
          title={
            title
          }
          eyebrow={
            eyebrow
          }
          description={
            description
          }
          onMenuOpen={
            openMobileSidebar
          }
          menuOpen={
            mobileSidebarOpen
          }
          onNotificationCountChange={
            handleNotificationCountChange
          }
        />

        {/* =================================================
            CONTENT
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
          onMouseDown={(
            event,
          ) => {
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
            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="councilor-modal-header">
              <div>
                <span>
                  ACCOUNT SECURITY
                </span>

                <h2 id="change-password-title">
                  Change Password
                </h2>

                <p>
                  Keep your Adviser
                  account secure by
                  regularly updating
                  your password.
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

            {/* =================================================
                FORM
            ================================================= */}

            <form
              className="councilor-modal-form adviser-password-form"
              onSubmit={
                handleChangePassword
              }
              noValidate
            >
              {/* ===============================================
                  ACCOUNT INFORMATION
              =============================================== */}

              <div className="adviser-password-account">
                <div className="adviser-password-avatar">
                  {
                    userInitial
                  }
                </div>

                <div className="adviser-password-account-copy">
                  <span>
                    SIGNED IN AS
                  </span>

                  <strong>
                    {
                      userName
                    }
                  </strong>

                  <small>
                    {
                      userEmail
                    }
                  </small>
                </div>
              </div>

              {/* ===============================================
                  PASSWORD RECOVERY INFORMATION
              =============================================== */}

              <div className="adviser-password-help">
                <span
                  className="adviser-password-help-icon"
                  aria-hidden="true"
                >
                  i
                </span>

                <div>
                  <strong>
                    Forgot your current
                    password?
                  </strong>

                  <p>
                    Contact your
                    Councilor to request
                    a password reset.
                    The Councilor can
                    provide you with a
                    temporary password
                    that you can change
                    after signing in.
                  </p>
                </div>
              </div>

              {/* ===============================================
                  CURRENT PASSWORD
              =============================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="current-password">
                  Current Password
                </label>

                <div className="adviser-password-input">
                  <input
                    id="current-password"
                    name="currentPassword"
                    type={
                      passwordVisibility.currentPassword
                        ? "text"
                        : "password"
                    }
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

                  <button
                    type="button"
                    className="adviser-password-toggle"
                    onClick={() =>
                      togglePasswordVisibility(
                        "currentPassword",
                      )
                    }
                    disabled={
                      changingPassword
                    }
                    aria-label={
                      passwordVisibility.currentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    aria-pressed={
                      passwordVisibility.currentPassword
                    }
                    title={
                      passwordVisibility.currentPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <PasswordVisibilityIcon
                      visible={
                        passwordVisibility.currentPassword
                      }
                    />
                  </button>
                </div>
              </div>

              {/* ===============================================
                  NEW PASSWORD
              =============================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="new-password">
                  New Password
                </label>

                <div className="adviser-password-input">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={
                      passwordVisibility.newPassword
                        ? "text"
                        : "password"
                    }
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

                  <button
                    type="button"
                    className="adviser-password-toggle"
                    onClick={() =>
                      togglePasswordVisibility(
                        "newPassword",
                      )
                    }
                    disabled={
                      changingPassword
                    }
                    aria-label={
                      passwordVisibility.newPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    aria-pressed={
                      passwordVisibility.newPassword
                    }
                    title={
                      passwordVisibility.newPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <PasswordVisibilityIcon
                      visible={
                        passwordVisibility.newPassword
                      }
                    />
                  </button>
                </div>

                <span className="councilor-field-hint">
                  Use at least 8
                  characters.
                </span>
              </div>

              {/* ===============================================
                  CONFIRM NEW PASSWORD
              =============================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="confirm-new-password">
                  Confirm New Password
                </label>

                <div className="adviser-password-input">
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type={
                      passwordVisibility.confirmPassword
                        ? "text"
                        : "password"
                    }
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

                  <button
                    type="button"
                    className="adviser-password-toggle"
                    onClick={() =>
                      togglePasswordVisibility(
                        "confirmPassword",
                      )
                    }
                    disabled={
                      changingPassword
                    }
                    aria-label={
                      passwordVisibility.confirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                    aria-pressed={
                      passwordVisibility.confirmPassword
                    }
                    title={
                      passwordVisibility.confirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <PasswordVisibilityIcon
                      visible={
                        passwordVisibility.confirmPassword
                      }
                    />
                  </button>
                </div>
              </div>

              {/* ===============================================
                  ERROR
              =============================================== */}

              {passwordError && (
                <div
                  className="councilor-modal-error"
                  role="alert"
                >
                  <span
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <p>
                    {
                      passwordError
                    }
                  </p>
                </div>
              )}

              {/* ===============================================
                  SUCCESS
              =============================================== */}

              {passwordSuccess && (
                <div
                  className="adviser-password-success"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <div>
                    <strong>
                      Password updated
                    </strong>

                    <p>
                      Your password has
                      been changed
                      successfully.
                    </p>
                  </div>
                </div>
              )}

              {/* ===============================================
                  ACTIONS
              =============================================== */}

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