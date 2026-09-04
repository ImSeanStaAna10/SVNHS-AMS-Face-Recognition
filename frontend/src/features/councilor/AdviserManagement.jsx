import { useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import councilorService from "../../services/councilorService";

import { useCouncilorAdvisers } from "../../hooks/queries/useCouncilorQueries";
import { invalidateCouncilorAdviserCache } from "../../hooks/queries/invalidateCouncilorCache";
import queryKeys from "../../lib/query/queryKeys";

import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
};

const INITIAL_EDIT_FORM = {
  name: "",
  email: "",
};

const INITIAL_RESET_FORM = {
  newPassword: "",
  confirmPassword: "",
};

const INITIAL_RESET_PASSWORD_VISIBILITY = {
  newPassword: false,
  confirmPassword: false,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const normalizeAdvisers = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((account) => account.role === "ADVISER");
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

function Advisers() {
  /* =======================================================
     DATA STATE
  ======================================================= */

  const queryClient = useQueryClient();

  const advisersQuery = useCouncilorAdvisers();

  const advisers = useMemo(
    () => normalizeAdvisers(advisersQuery.data),
    [advisersQuery.data],
  );

  const [search, setSearch] = useState("");

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const loading = advisersQuery.isLoading;

  const [creating, setCreating] = useState(false);

  const [updating, setUpdating] = useState(false);

  const [resettingPassword, setResettingPassword] = useState(false);

  /* =======================================================
     FEEDBACK STATE
  ======================================================= */

  const [error, setError] = useState("");

  const adviserQueryError =
    advisersQuery.data === undefined && advisersQuery.error
      ? getErrorMessage(advisersQuery.error, "Unable to load advisers.")
      : "";

  const displayedError = error || adviserQueryError;

  const [success, setSuccess] = useState("");

  /* =======================================================
     ADD ADVISER MODAL STATE
  ======================================================= */

  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [formError, setFormError] = useState("");

  const [showCreatePassword, setShowCreatePassword] = useState(false);

  /* =======================================================
     RESET PASSWORD MODAL STATE
  ======================================================= */

  const [showResetModal, setShowResetModal] = useState(false);

  const [selectedAdviser, setSelectedAdviser] = useState(null);

  const [resetFormData, setResetFormData] = useState(INITIAL_RESET_FORM);

  const [resetFormError, setResetFormError] = useState("");

  const [resetPasswordVisibility, setResetPasswordVisibility] = useState(
    INITIAL_RESET_PASSWORD_VISIBILITY,
  );

  /* =======================================================
     EDIT ADVISER MODAL STATE
  ======================================================= */

  const [editingAdviser, setEditingAdviser] = useState(null);

  const [editFormData, setEditFormData] = useState(INITIAL_EDIT_FORM);

  const [editFormError, setEditFormError] = useState("");

  /* =======================================================
     MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    const hasOpenModal =
      showModal ||
      showResetModal ||
      Boolean(editingAdviser);

    if (!hasOpenModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (creating || updating || resettingPassword) {
        return;
      }

      setShowModal(false);
      setShowResetModal(false);

      setSelectedAdviser(null);
      setEditingAdviser(null);

      setFormData(INITIAL_FORM);
      setEditFormData(INITIAL_EDIT_FORM);
      setResetFormData(INITIAL_RESET_FORM);

      setFormError("");
      setEditFormError("");
      setResetFormError("");

      setShowCreatePassword(false);
      setResetPasswordVisibility(INITIAL_RESET_PASSWORD_VISIBILITY);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showModal,
    showResetModal,
    editingAdviser,
    creating,
    updating,
    resettingPassword,
  ]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const filteredAdvisers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return advisers;
    }

    return advisers.filter((adviser) => {
      const name = adviser.name?.toLowerCase() ?? "";

      const email = adviser.email?.toLowerCase() ?? "";

      return name.includes(keyword) || email.includes(keyword);
    });
  }, [advisers, search]);

  const activeAdvisers = useMemo(
    () => advisers.filter((adviser) => adviser.active !== false).length,
    [advisers],
  );

  const inactiveAdvisers = advisers.length - activeAdvisers;

  /* =======================================================
     ADD ADVISER FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData(INITIAL_FORM);

    setFormError("");

    setShowCreatePassword(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  };

  /* =======================================================
     ADD ADVISER MODAL CONTROLS
  ======================================================= */

  const openModal = () => {
    resetForm();

    setShowResetModal(false);
    setSelectedAdviser(null);

    setEditingAdviser(null);
    setEditFormData(INITIAL_EDIT_FORM);
    setEditFormError("");

    setSuccess("");
    setError("");

    setShowModal(true);
  };

  const closeModal = () => {
    if (creating) {
      return;
    }

    setShowModal(false);

    resetForm();
  };

  /* =======================================================
     ADD ADVISER VALIDATION
  ======================================================= */

  const validateForm = () => {
    const name = formData.name.trim();

    const email = formData.email.trim().toLowerCase();

    const password = formData.password;

    if (!name || !email || !password) {
      return {
        valid: false,

        message: "Please complete all fields.",
      };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return {
        valid: false,

        message: "Please enter a valid email address.",
      };
    }

    if (password.length < 6) {
      return {
        valid: false,

        message: "Password must be at least 6 characters.",
      };
    }

    return {
      valid: true,

      data: {
        name,
        email,
        password,
      },
    };
  };

  /* =======================================================
     CREATE ADVISER
  ======================================================= */

  const handleCreateAdviser = async (event) => {
    event.preventDefault();

    const validation = validateForm();

    if (!validation.valid) {
      setFormError(validation.message);

      return;
    }

    try {
      setCreating(true);

      setFormError("");
      setError("");
      setSuccess("");

      await councilorService.createAdviser(validation.data);

      await invalidateCouncilorAdviserCache(queryClient);

      setShowModal(false);

      resetForm();

      setSuccess("Adviser account created successfully.");
    } catch (err) {
      console.error("Unable to create adviser:", err);

      setFormError(getErrorMessage(err, "Unable to create adviser account."));
    } finally {
      setCreating(false);
    }
  };

  /* =======================================================
     RESET PASSWORD HELPERS
  ======================================================= */

  const resetPasswordForm = () => {
    setResetFormData(INITIAL_RESET_FORM);

    setResetFormError("");

    setResetPasswordVisibility(INITIAL_RESET_PASSWORD_VISIBILITY);
  };

  const handleResetFormChange = (event) => {
    const { name, value } = event.target;

    setResetFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (resetFormError) {
      setResetFormError("");
    }
  };

  const toggleResetPasswordVisibility = (fieldName) => {
    setResetPasswordVisibility((current) => ({
      ...current,

      [fieldName]: !current[fieldName],
    }));
  };

  /* =======================================================
     RESET PASSWORD MODAL CONTROLS
  ======================================================= */

  const openResetModal = (adviser) => {
    if (!adviser?.id || adviser.active === false) {
      return;
    }

    resetPasswordForm();

    setShowModal(false);

    setEditingAdviser(null);
    setEditFormData(INITIAL_EDIT_FORM);
    setEditFormError("");

    setError("");
    setSuccess("");

    setSelectedAdviser(adviser);

    setShowResetModal(true);
  };

  const closeResetModal = () => {
    if (resettingPassword) {
      return;
    }

    setShowResetModal(false);

    setSelectedAdviser(null);

    resetPasswordForm();
  };

  /* =======================================================
     RESET PASSWORD VALIDATION
  ======================================================= */

  const validateResetPassword = () => {
    const newPassword = resetFormData.newPassword;

    const confirmPassword = resetFormData.confirmPassword;

    if (!newPassword || !confirmPassword) {
      return {
        valid: false,

        message: "Please complete all password fields.",
      };
    }

    if (newPassword.length < 8) {
      return {
        valid: false,

        message: "Password must be at least 8 characters.",
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        valid: false,

        message: "Passwords do not match.",
      };
    }

    return {
      valid: true,

      data: {
        newPassword,
      },
    };
  };

  /* =======================================================
     RESET ADVISER PASSWORD
  ======================================================= */

  const handleResetAdviserPassword = async (event) => {
    event.preventDefault();

    if (!selectedAdviser?.id) {
      setResetFormError("Unable to identify the selected adviser.");

      return;
    }

    const validation = validateResetPassword();

    if (!validation.valid) {
      setResetFormError(validation.message);

      return;
    }

    try {
      setResettingPassword(true);

      setResetFormError("");
      setError("");
      setSuccess("");

      await councilorService.resetAdviserPassword(
        selectedAdviser.id,
        validation.data,
      );

      const adviserName = selectedAdviser.name || "Adviser";

      setShowResetModal(false);

      setSelectedAdviser(null);

      resetPasswordForm();

      setSuccess(`${adviserName}'s password was reset successfully.`);
    } catch (err) {
      console.error("Unable to reset adviser password:", err);

      setResetFormError(
        getErrorMessage(err, "Unable to reset adviser password."),
      );
    } finally {
      setResettingPassword(false);
    }
  };

  /* =======================================================
     EDIT ADVISER FORM HELPERS
  ======================================================= */

  const resetEditForm = () => {
    setEditingAdviser(null);

    setEditFormData(INITIAL_EDIT_FORM);

    setEditFormError("");
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;

    setEditFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (editFormError) {
      setEditFormError("");
    }
  };

  const validateEditForm = () => {
    const name = editFormData.name.trim();

    const email = editFormData.email.trim().toLowerCase();

    if (!name || !email) {
      return {
        valid: false,

        message: "Please complete all fields.",
      };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return {
        valid: false,

        message: "Please enter a valid email address.",
      };
    }

    return {
      valid: true,

      data: {
        name,
        email,
      },
    };
  };

  /* =======================================================
     EDIT ADVISER MODAL CONTROLS
  ======================================================= */

  const openEditModal = (adviser) => {
    if (!adviser?.id || adviser.active === false) {
      return;
    }

    setShowModal(false);

    setShowResetModal(false);
    setSelectedAdviser(null);
    resetPasswordForm();

    setEditingAdviser(adviser);

    setEditFormData({
      name: adviser.name || "",
      email: adviser.email || "",
    });

    setEditFormError("");

    setError("");
    setSuccess("");
  };

  const closeEditModal = () => {
    if (updating) {
      return;
    }

    resetEditForm();
  };

  /* =======================================================
     UPDATE ADVISER
  ======================================================= */

  const handleUpdateAdviser = async (event) => {
    event.preventDefault();

    if (!editingAdviser?.id) {
      setEditFormError("Unable to identify the selected adviser.");

      return;
    }

    const validation = validateEditForm();

    if (!validation.valid) {
      setEditFormError(validation.message);

      return;
    }

    const adviserId = editingAdviser.id;

    const adviserName = validation.data.name;

    try {
      setUpdating(true);

      setEditFormError("");
      setError("");
      setSuccess("");

      const updatedAdviser = await councilorService.updateAdviser(
        adviserId,
        validation.data,
      );

      if (updatedAdviser?.id) {
        queryClient.setQueryData(
          queryKeys.councilor.advisers(),
          (current) =>
            Array.isArray(current)
              ? current.map((adviser) =>
                  adviser.id === updatedAdviser.id
                    ? {
                        ...adviser,
                        ...updatedAdviser,
                      }
                    : adviser,
                )
              : current,
        );
      }

      try {
        await invalidateCouncilorAdviserCache(queryClient);
      } catch (refreshError) {
        console.warn(
          "Unable to synchronize adviser cache after update:",
          refreshError,
        );
      }

      resetEditForm();

      setSuccess(`${adviserName}'s account was updated successfully.`);
    } catch (err) {
      console.error("Unable to update adviser:", err);

      if (err?.response?.status === 409) {
        setEditFormError(
          getErrorMessage(
            err,
            "That email address already belongs to another account.",
          ),
        );

        return;
      }

      setEditFormError(
        getErrorMessage(err, "Unable to update adviser account."),
      );
    } finally {
      setUpdating(false);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <CouncilorLayout
      eyebrow="ACCOUNT MANAGEMENT"
      title="Advisers"
      description="Manage adviser accounts for your school."
    >
      <section className="councilor-advisers-page">
        {/* =================================================
            ADVISER OVERVIEW
        ================================================== */}

        <section className="councilor-adviser-overview">
          {/* ===============================================
              WELCOME CARD
          ================================================ */}

          <section className="councilor-welcome-card">
            <div className="councilor-welcome-copy">
              <span>ADVISER MANAGEMENT</span>

              <h2>Manage adviser accounts</h2>

              <p>
                Create and maintain reusable adviser accounts for Signal
                Village National High School. When staffing changes, update the
                account details and password for the next assigned adviser.
              </p>

              <div className="councilor-welcome-meta">
                <span>SVNHS</span>

                <span
                  className="councilor-welcome-meta-dot"
                  aria-hidden="true"
                />

                <span>Account Administration</span>
              </div>
            </div>

            <div className="councilor-welcome-badge" aria-hidden="true">
              <img src={seniorHighSchoolLogo} alt="" />
            </div>
          </section>

          {/* ===============================================
              SUMMARY METRICS
          ================================================ */}

          <section
            className="councilor-adviser-metrics"
            aria-label="Adviser statistics"
          >
            {/* REGISTERED */}

            <article className="councilor-adviser-metric">
              <div className="councilor-adviser-metric-icon" aria-hidden="true">
                ♙
              </div>

              <div className="councilor-adviser-metric-copy">
                <span>REGISTERED</span>

                <p>Total Advisers</p>

                <small>All adviser accounts</small>
              </div>

              <strong className="councilor-adviser-metric-value">
                {loading ? "—" : advisers.length}
              </strong>
            </article>

            {/* ACTIVE */}

            <article className="councilor-adviser-metric is-active">
              <div className="councilor-adviser-metric-icon" aria-hidden="true">
                ✓
              </div>

              <div className="councilor-adviser-metric-copy">
                <span>ACTIVE</span>

                <p>Active Advisers</p>

                <small>Currently enabled</small>
              </div>

              <strong className="councilor-adviser-metric-value">
                {loading ? "—" : activeAdvisers}
              </strong>
            </article>

            {/* INACTIVE */}

            <article className="councilor-adviser-metric is-inactive">
              <div className="councilor-adviser-metric-icon" aria-hidden="true">
                —
              </div>

              <div className="councilor-adviser-metric-copy">
                <span>INACTIVE</span>

                <p>Inactive Advisers</p>

                <small>Disabled accounts</small>
              </div>

              <strong className="councilor-adviser-metric-value">
                {loading ? "—" : inactiveAdvisers}
              </strong>
            </article>
          </section>
        </section>

        {/* =================================================
            SUCCESS MESSAGE
        ================================================== */}

        {success && (
          <div className="councilor-success" role="status" aria-live="polite">
            <span aria-hidden="true">✓</span>

            <p>{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            ADVISER DIRECTORY
        ================================================== */}

        <section className="councilor-panel councilor-adviser-directory">
          {/* ===============================================
              PANEL HEADER
          ================================================ */}

          <div className="councilor-panel-header">
            <div>
              <span>ACCOUNT MANAGEMENT</span>

              <h2>
                Adviser Directory
                {!loading && <small>{advisers.length}</small>}
              </h2>

              <p>Search and manage registered school adviser accounts.</p>
            </div>

            <div className="councilor-panel-actions">
              <button
                type="button"
                className="councilor-primary-button"
                onClick={openModal}
              >
                <span aria-hidden="true">+</span>
                Add Adviser
              </button>
            </div>
          </div>

          {/* ===============================================
              TOOLBAR
          ================================================ */}

          <div className="councilor-toolbar">
            <div className="councilor-search">
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                aria-label="Search advisers"
                placeholder="Search by name or email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <span className="councilor-result-count">
              {loading
                ? "Loading..."
                : `${filteredAdvisers.length} ${
                    filteredAdvisers.length === 1 ? "adviser" : "advisers"
                  }`}
            </span>
          </div>

          {/* ===============================================
              ERROR
          ================================================ */}

          {displayedError && (
            <div className="councilor-error" role="alert">
              <span aria-hidden="true">!</span>

              <p>{displayedError}</p>
            </div>
          )}

          {/* ===============================================
              LOADING / EMPTY / TABLE
          ================================================ */}

          {loading ? (
            <div className="councilor-empty">
              <div className="councilor-loading-spinner" aria-hidden="true" />

              <strong>Loading advisers</strong>

              <p>Fetching registered adviser accounts...</p>
            </div>
          ) : filteredAdvisers.length === 0 ? (
            <div className="councilor-empty">
              <div className="councilor-empty-icon" aria-hidden="true">
                ♙
              </div>

              <strong>
                {search ? "No advisers found" : "No advisers yet"}
              </strong>

              <p>
                {search
                  ? "Try searching with a different name or email address."
                  : "Create your first adviser account to get started."}
              </p>

              {!search && (
                <button
                  type="button"
                  className="councilor-primary-button"
                  onClick={openModal}
                >
                  + Add Adviser
                </button>
              )}
            </div>
          ) : (
            <div className="councilor-table-wrapper">
              <table className="councilor-table">
                <thead>
                  <tr>
                    <th scope="col">ADVISER</th>

                    <th scope="col">EMAIL ADDRESS</th>

                    <th scope="col">ROLE</th>

                    <th scope="col">STATUS</th>

                    <th scope="col">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdvisers.map((adviser) => {
                    const adviserInitial =
                      adviser.name?.trim()?.charAt(0)?.toUpperCase() || "A";

                    const adviserRole = adviser.role || "ADVISER";

                    const isActive = adviser.active !== false;

                    return (
                      <tr
                        key={adviser.id}
                        className={isActive ? "" : "is-inactive-row"}
                      >
                        {/* ADVISER */}

                        <td>
                          <div className="councilor-person">
                            <div className="councilor-person-avatar">
                              {adviserInitial}
                            </div>

                            <div>
                              <strong>{adviser.name}</strong>

                              <span>School Adviser</span>
                            </div>
                          </div>
                        </td>

                        {/* EMAIL */}

                        <td>{adviser.email}</td>

                        {/* ROLE */}

                        <td>
                          <span className="councilor-role">{adviserRole}</span>
                        </td>

                        {/* STATUS */}

                        <td>
                          <span
                            className={`councilor-status ${
                              isActive ? "" : "inactive"
                            }`}
                          >
                            <span aria-hidden="true" />

                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* ACTIONS */}

                        <td>
                          <div className="councilor-adviser-actions">
                            <button
                              type="button"
                              className="councilor-table-action is-edit"
                              disabled={!isActive}
                              onClick={() => openEditModal(adviser)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="councilor-table-action is-security"
                              disabled={!isActive}
                              onClick={() => openResetModal(adviser)}
                            >
                              Reset Password
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ===============================================
              PANEL FOOTER
          ================================================ */}

          {!loading && filteredAdvisers.length > 0 && (
            <div className="councilor-panel-footer">
              <span>
                Showing {filteredAdvisers.length} of {advisers.length}{" "}
                {advisers.length === 1 ? "adviser" : "advisers"}
              </span>
            </div>
          )}
        </section>

        {/* =================================================
            ADD ADVISER MODAL
        ================================================== */}

        {showModal && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div
              className="councilor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-adviser-title"
            >
              {/* ===========================================
                  HEADER
              ============================================ */}

              <div className="councilor-modal-header">
                <div>
                  <span>ACCOUNT MANAGEMENT</span>

                  <h2 id="add-adviser-title">Add Adviser</h2>

                  <p>Create a new school adviser account.</p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={closeModal}
                  disabled={creating}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              {/* ===========================================
                  FORM
              ============================================ */}

              <form
                className="councilor-modal-form"
                onSubmit={handleCreateAdviser}
                noValidate
              >
                {/* NAME */}

                <div className="councilor-modal-field">
                  <label htmlFor="adviser-name">Full Name</label>

                  <input
                    id="adviser-name"
                    name="name"
                    type="text"
                    placeholder="Enter adviser name"
                    value={formData.name}
                    onChange={handleFormChange}
                    autoComplete="name"
                    disabled={creating}
                    autoFocus
                  />
                </div>

                {/* EMAIL */}

                <div className="councilor-modal-field">
                  <label htmlFor="adviser-email">Email Address</label>

                  <input
                    id="adviser-email"
                    name="email"
                    type="email"
                    placeholder="Enter school email"
                    value={formData.email}
                    onChange={handleFormChange}
                    autoComplete="email"
                    disabled={creating}
                  />
                </div>

                {/* TEMPORARY PASSWORD */}

                <div className="councilor-modal-field">
                  <label htmlFor="adviser-password">Temporary Password</label>

                  <div className="councilor-password-input">
                    <input
                      id="adviser-password"
                      name="password"
                      type={showCreatePassword ? "text" : "password"}
                      placeholder="Enter temporary password"
                      value={formData.password}
                      onChange={handleFormChange}
                      autoComplete="new-password"
                      disabled={creating}
                    />

                    <button
                      type="button"
                      className="councilor-password-toggle"
                      onClick={() =>
                        setShowCreatePassword((current) => !current)
                      }
                      disabled={creating}
                      aria-label={
                        showCreatePassword
                          ? "Hide temporary password"
                          : "Show temporary password"
                      }
                      aria-pressed={showCreatePassword}
                      title={
                        showCreatePassword ? "Hide password" : "Show password"
                      }
                    >
                      <PasswordVisibilityIcon visible={showCreatePassword} />
                    </button>
                  </div>

                  <span className="councilor-field-hint">
                    Minimum 6 characters.
                  </span>
                </div>

                {/* ERROR */}

                {formError && (
                  <div className="councilor-modal-error" role="alert">
                    <span aria-hidden="true">!</span>

                    <p>{formError}</p>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="councilor-modal-actions">
                  <button
                    type="button"
                    className="councilor-secondary-button"
                    onClick={closeModal}
                    disabled={creating}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={creating}
                  >
                    {creating && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {creating ? "Creating..." : "Create Adviser"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================
            RESET PASSWORD MODAL
        ================================================== */}

        {showResetModal && selectedAdviser && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeResetModal();
              }
            }}
          >
            <div
              className="councilor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-password-title"
            >
              {/* =========================================
                    HEADER
                ========================================== */}

              <div className="councilor-modal-header">
                <div>
                  <span>ACCOUNT SECURITY</span>

                  <h2 id="reset-password-title">Reset Password</h2>

                  <p>Set a new temporary password for this adviser account.</p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={closeResetModal}
                  disabled={resettingPassword}
                  aria-label="Close reset password modal"
                >
                  ×
                </button>
              </div>

              {/* =========================================
                    FORM
                ========================================== */}

              <form
                className="councilor-modal-form"
                onSubmit={handleResetAdviserPassword}
                noValidate
              >
                {/* =======================================
                      SELECTED ADVISER
                  ======================================== */}

                <div className="councilor-reset-account">
                  <div className="councilor-person-avatar">
                    {selectedAdviser.name?.trim()?.charAt(0)?.toUpperCase() ||
                      "A"}
                  </div>

                  <div>
                    <span>Resetting password for</span>

                    <strong>{selectedAdviser.name}</strong>

                    <small>{selectedAdviser.email}</small>
                  </div>
                </div>

                {/* =======================================
                      NEW TEMPORARY PASSWORD
                  ======================================== */}

                <div className="councilor-modal-field">
                  <label htmlFor="reset-new-password">
                    New Temporary Password
                  </label>

                  <div className="councilor-password-input">
                    <input
                      id="reset-new-password"
                      name="newPassword"
                      type={
                        resetPasswordVisibility.newPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Enter new temporary password"
                      value={resetFormData.newPassword}
                      onChange={handleResetFormChange}
                      autoComplete="new-password"
                      disabled={resettingPassword}
                      autoFocus
                    />

                    <button
                      type="button"
                      className="councilor-password-toggle"
                      onClick={() =>
                        toggleResetPasswordVisibility("newPassword")
                      }
                      disabled={resettingPassword}
                      aria-label={
                        resetPasswordVisibility.newPassword
                          ? "Hide new temporary password"
                          : "Show new temporary password"
                      }
                      aria-pressed={resetPasswordVisibility.newPassword}
                      title={
                        resetPasswordVisibility.newPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <PasswordVisibilityIcon
                        visible={resetPasswordVisibility.newPassword}
                      />
                    </button>
                  </div>

                  <span className="councilor-field-hint">
                    Minimum 8 characters.
                  </span>
                </div>

                {/* =======================================
                      CONFIRM PASSWORD
                  ======================================== */}

                <div className="councilor-modal-field">
                  <label htmlFor="reset-confirm-password">
                    Confirm Password
                  </label>

                  <div className="councilor-password-input">
                    <input
                      id="reset-confirm-password"
                      name="confirmPassword"
                      type={
                        resetPasswordVisibility.confirmPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Re-enter new password"
                      value={resetFormData.confirmPassword}
                      onChange={handleResetFormChange}
                      autoComplete="new-password"
                      disabled={resettingPassword}
                    />

                    <button
                      type="button"
                      className="councilor-password-toggle"
                      onClick={() =>
                        toggleResetPasswordVisibility("confirmPassword")
                      }
                      disabled={resettingPassword}
                      aria-label={
                        resetPasswordVisibility.confirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
                      }
                      aria-pressed={resetPasswordVisibility.confirmPassword}
                      title={
                        resetPasswordVisibility.confirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <PasswordVisibilityIcon
                        visible={resetPasswordVisibility.confirmPassword}
                      />
                    </button>
                  </div>
                </div>

                {/* =======================================
                      ERROR
                  ======================================== */}

                {resetFormError && (
                  <div className="councilor-modal-error" role="alert">
                    <span aria-hidden="true">!</span>

                    <p>{resetFormError}</p>
                  </div>
                )}

                {/* =======================================
                      ACTIONS
                  ======================================== */}

                <div className="councilor-modal-actions">
                  <button
                    type="button"
                    className="councilor-secondary-button"
                    onClick={closeResetModal}
                    disabled={resettingPassword}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={resettingPassword}
                  >
                    {resettingPassword && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {resettingPassword ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================
            EDIT ADVISER MODAL
        ================================================== */}

        {editingAdviser && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeEditModal();
              }
            }}
          >
            <div
              className="councilor-modal councilor-adviser-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-adviser-title"
            >
              <div className="councilor-modal-header">
                <div>
                  <span>ACCOUNT MANAGEMENT</span>

                  <h2 id="edit-adviser-title">Edit Adviser</h2>

                  <p>
                    Update the adviser's account name and school email address.
                  </p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={closeEditModal}
                  disabled={updating}
                  aria-label="Close edit adviser modal"
                >
                  ×
                </button>
              </div>

              <form
                className="councilor-modal-form"
                onSubmit={handleUpdateAdviser}
                noValidate
              >
                <div className="councilor-reset-account">
                  <div className="councilor-person-avatar">
                    {editingAdviser.name?.trim()?.charAt(0)?.toUpperCase() ||
                      "A"}
                  </div>

                  <div>
                    <span>Editing adviser account</span>

                    <strong>{editingAdviser.name}</strong>

                    <small>{editingAdviser.email}</small>
                  </div>
                </div>

                <div className="councilor-modal-field">
                  <label htmlFor="edit-adviser-name">Full Name</label>

                  <input
                    id="edit-adviser-name"
                    name="name"
                    type="text"
                    placeholder="Enter adviser name"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    autoComplete="name"
                    disabled={updating}
                    autoFocus
                  />
                </div>

                <div className="councilor-modal-field">
                  <label htmlFor="edit-adviser-email">Email Address</label>

                  <input
                    id="edit-adviser-email"
                    name="email"
                    type="email"
                    placeholder="Enter school email"
                    value={editFormData.email}
                    onChange={handleEditFormChange}
                    autoComplete="email"
                    disabled={updating}
                  />

                  <span className="councilor-field-hint">
                    The email address must remain unique across all user
                    accounts.
                  </span>
                </div>

                {editFormError && (
                  <div className="councilor-modal-error" role="alert">
                    <span aria-hidden="true">!</span>

                    <p>{editFormError}</p>
                  </div>
                )}

                <div className="councilor-modal-actions">
                  <button
                    type="button"
                    className="councilor-secondary-button"
                    onClick={closeEditModal}
                    disabled={updating}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={
                      updating ||
                      !editFormData.name.trim() ||
                      !editFormData.email.trim()
                    }
                  >
                    {updating && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {updating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </section>
    </CouncilorLayout>
  );
}

export default Advisers;
