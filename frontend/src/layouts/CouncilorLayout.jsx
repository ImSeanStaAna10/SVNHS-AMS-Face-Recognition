import { useEffect, useState } from "react";

import CouncilorSidebar from "../components/councilor/CouncilorSidebar";
import CouncilorTopbar from "../components/councilor/CouncilorTopbar";

import accountService from "../services/accountService";
import authService from "../services/authService";

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

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

/* =========================================================
   PASSWORD VISIBILITY ICON
========================================================= */

function PasswordVisibilityIcon({ visible }) {
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

function CouncilorLayout({ children }) {
  const user = authService.getUser();

  /* =======================================================
     PASSWORD STATE
  ======================================================= */

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);

  const [passwordForm, setPasswordForm] =
    useState(INITIAL_PASSWORD_FORM);

  const [passwordVisibility, setPasswordVisibility] =
    useState(INITIAL_PASSWORD_VISIBILITY);

  const [passwordError, setPasswordError] =
    useState("");

  const [passwordSuccess, setPasswordSuccess] =
    useState("");

  const [changingPassword, setChangingPassword] =
    useState(false);

  /* =======================================================
     USER
  ======================================================= */

  const userName =
    user?.name?.trim() ||
    "Councilor";

  const userEmail =
    user?.email ||
    "Councilor account";

  const userInitial =
    userName.charAt(0).toUpperCase() ||
    "C";

  /* =======================================================
     RESET PASSWORD MODAL STATE
  ======================================================= */

  const resetPasswordModalState = () => {
    setPasswordForm(
      INITIAL_PASSWORD_FORM,
    );

    setPasswordVisibility(
      INITIAL_PASSWORD_VISIBILITY,
    );

    setPasswordError("");
    setPasswordSuccess("");
  };

  /* =======================================================
     PASSWORD MODAL CONTROLS
  ======================================================= */

  const openPasswordModal = () => {
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
     PASSWORD MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    if (!showPasswordModal) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !changingPassword
      ) {
        setShowPasswordModal(false);

        setPasswordForm(
          INITIAL_PASSWORD_FORM,
        );

        setPasswordVisibility(
          INITIAL_PASSWORD_VISIBILITY,
        );

        setPasswordError("");
        setPasswordSuccess("");
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
     PASSWORD FORM CHANGE
  ======================================================= */

  const handlePasswordFormChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

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

  const togglePasswordVisibility = (
    fieldName,
  ) => {
    setPasswordVisibility(
      (current) => ({
        ...current,

        [fieldName]:
          !current[fieldName],
      }),
    );
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

  const handleChangePassword = async (
    event,
  ) => {
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
        "Your password has been changed successfully.",
      );
    } catch (error) {
      console.error(
        "Unable to change Councilor password:",
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
    <div className="councilor-layout">
      {/* =================================================
          SIDEBAR
      ================================================== */}

      <CouncilorSidebar
        onChangePassword={
          openPasswordModal
        }
      />

      {/* =================================================
          MAIN
      ================================================== */}

      <div className="councilor-main">
        <CouncilorTopbar />

        <main className="councilor-content">
          {children}
        </main>
      </div>

      {/* =================================================
          CHANGE PASSWORD MODAL
      ================================================== */}

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
            className="councilor-modal councilor-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="councilor-change-password-title"
          >
            {/* ===========================================
                MODAL HEADER
            ============================================ */}

            <div className="councilor-modal-header">
              <div>
                <span>
                  ACCOUNT SECURITY
                </span>

                <h2 id="councilor-change-password-title">
                  Change Password
                </h2>

                <p>
                  Update the password used to access
                  your Councilor account.
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

            {/* ===========================================
                FORM
            ============================================ */}

            <form
              className="councilor-modal-form councilor-password-form"
              onSubmit={
                handleChangePassword
              }
              noValidate
            >
              {/* =========================================
                  ACCOUNT INFORMATION
              ========================================== */}

              <div className="councilor-password-account">
                <div className="councilor-password-avatar">
                  {userInitial}
                </div>

                <div className="councilor-password-account-copy">
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
                  <strong>
                    Account security
                  </strong>

                  <p>
                    Use a secure password that is
                    different from your current
                    password. Keep your account
                    credentials private.
                  </p>
                </div>
              </div>

              {/* =========================================
                  CURRENT PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="councilor-current-password">
                  Current Password
                </label>

                <div className="councilor-password-input">
                  <input
                    id="councilor-current-password"
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
                    className="councilor-password-toggle"
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

              {/* =========================================
                  NEW PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="councilor-new-password">
                  New Password
                </label>

                <div className="councilor-password-input">
                  <input
                    id="councilor-new-password"
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
                    className="councilor-password-toggle"
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
                  Use at least 8 characters.
                </span>
              </div>

              {/* =========================================
                  CONFIRM PASSWORD
              ========================================== */}

              <div className="councilor-modal-field">
                <label htmlFor="councilor-confirm-password">
                  Confirm New Password
                </label>

                <div className="councilor-password-input">
                  <input
                    id="councilor-confirm-password"
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
                    className="councilor-password-toggle"
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

              {/* =========================================
                  ERROR
              ========================================== */}

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

              {/* =========================================
                  SUCCESS
              ========================================== */}

              {passwordSuccess && (
                <div
                  className="councilor-password-success"
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
                      {passwordSuccess}
                    </p>
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
    </div>
  );
}

export default CouncilorLayout;