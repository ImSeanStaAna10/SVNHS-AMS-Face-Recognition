import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ThemeToggle from "../../common/themeToggle";

import authService from "../../services/authService";
import councilorService from "../../services/councilorService";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
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

const INITIAL_RESET_FORM = {
  newPassword: "",
  confirmPassword: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
   COMPONENT
========================================================= */

function Advisers() {
  const navigate = useNavigate();

  const user = authService.getUser();

  /* =======================================================
     DATA STATE
  ======================================================= */

  const [advisers, setAdvisers] = useState([]);
  const [search, setSearch] = useState("");

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  /* =======================================================
     FEEDBACK STATE
  ======================================================= */

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =======================================================
     ADD ADVISER MODAL STATE
  ======================================================= */

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  /* =======================================================
     RESET PASSWORD MODAL STATE
  ======================================================= */

  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedAdviser, setSelectedAdviser] = useState(null);

  const [resetFormData, setResetFormData] =
    useState(INITIAL_RESET_FORM);

  const [resetFormError, setResetFormError] = useState("");

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadAdvisers = async () => {
      try {
        const data = await councilorService.getAdvisers();

        if (!isMounted) {
          return;
        }

        setAdvisers(normalizeAdvisers(data));
        setError("");
      } catch (err) {
        console.error("Unable to load advisers:", err);

        if (!isMounted) {
          return;
        }

        setError(
          getErrorMessage(
            err,
            "Unable to load advisers.",
          ),
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAdvisers();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =======================================================
     MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    const hasOpenModal =
      showModal || showResetModal;

    if (!hasOpenModal) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (
        showModal &&
        !creating
      ) {
        setShowModal(false);
        setFormData(INITIAL_FORM);
        setFormError("");
      }

      if (
        showResetModal &&
        !resettingPassword
      ) {
        setShowResetModal(false);
        setSelectedAdviser(null);
        setResetFormData(INITIAL_RESET_FORM);
        setResetFormError("");
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
    showModal,
    showResetModal,
    creating,
    resettingPassword,
  ]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const filteredAdvisers = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return advisers;
    }

    return advisers.filter((adviser) => {
      const name =
        adviser.name?.toLowerCase() ?? "";

      const email =
        adviser.email?.toLowerCase() ?? "";

      return (
        name.includes(keyword) ||
        email.includes(keyword)
      );
    });
  }, [advisers, search]);

  const activeAdvisers = useMemo(
    () =>
      advisers.filter(
        (adviser) =>
          adviser.active !== false,
      ).length,
    [advisers],
  );

  const inactiveAdvisers =
    advisers.length - activeAdvisers;

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const goToDashboard = () => {
    navigate("/councilor/dashboard");
  };

  const goToSections = () => {
    navigate("/councilor/sections");
  };

  const goToAttendance = () => {
    navigate("/councilor/attendance");
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
     ADD ADVISER FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setFormError("");
  };

  const handleFormChange = (event) => {
    const { name, value } =
      event.target;

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
    const name =
      formData.name.trim();

    const email =
      formData.email
        .trim()
        .toLowerCase();

    const password =
      formData.password;

    if (!name || !email || !password) {
      return {
        valid: false,
        message:
          "Please complete all fields.",
      };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return {
        valid: false,
        message:
          "Please enter a valid email address.",
      };
    }

    if (password.length < 6) {
      return {
        valid: false,
        message:
          "Password must be at least 6 characters.",
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
     REFRESH ADVISERS
  ======================================================= */

  const refreshAdvisers = async () => {
    const data =
      await councilorService.getAdvisers();

    setAdvisers(
      normalizeAdvisers(data),
    );
  };

  /* =======================================================
     CREATE ADVISER
  ======================================================= */

  const handleCreateAdviser = async (
    event,
  ) => {
    event.preventDefault();

    const validation =
      validateForm();

    if (!validation.valid) {
      setFormError(
        validation.message,
      );

      return;
    }

    try {
      setCreating(true);

      setFormError("");
      setError("");
      setSuccess("");

      await councilorService.createAdviser(
        validation.data,
      );

      await refreshAdvisers();

      setShowModal(false);

      resetForm();

      setSuccess(
        "Adviser account created successfully.",
      );
    } catch (err) {
      console.error(
        "Unable to create adviser:",
        err,
      );

      setFormError(
        getErrorMessage(
          err,
          "Unable to create adviser account.",
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  /* =======================================================
     RESET PASSWORD HELPERS
  ======================================================= */

  const resetPasswordForm = () => {
    setResetFormData(
      INITIAL_RESET_FORM,
    );

    setResetFormError("");
  };

  const handleResetFormChange = (
    event,
  ) => {
    const { name, value } =
      event.target;

    setResetFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (resetFormError) {
      setResetFormError("");
    }
  };

  /* =======================================================
     RESET PASSWORD MODAL CONTROLS
  ======================================================= */

  const openResetModal = (
    adviser,
  ) => {
    resetPasswordForm();

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
    const newPassword =
      resetFormData.newPassword;

    const confirmPassword =
      resetFormData.confirmPassword;

    if (
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
          "Password must be at least 8 characters.",
      };
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return {
        valid: false,
        message:
          "Passwords do not match.",
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

  const handleResetAdviserPassword =
    async (event) => {
      event.preventDefault();

      if (!selectedAdviser?.id) {
        setResetFormError(
          "Unable to identify the selected adviser.",
        );

        return;
      }

      const validation =
        validateResetPassword();

      if (!validation.valid) {
        setResetFormError(
          validation.message,
        );

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

        const adviserName =
          selectedAdviser.name ||
          "Adviser";

        setShowResetModal(false);
        setSelectedAdviser(null);

        resetPasswordForm();

        setSuccess(
          `${adviserName}'s password was reset successfully.`,
        );
      } catch (err) {
        console.error(
          "Unable to reset adviser password:",
          err,
        );

        setResetFormError(
          getErrorMessage(
            err,
            "Unable to reset adviser password.",
          ),
        );
      } finally {
        setResettingPassword(false);
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="councilor-page">
      {/* ===================================================
          SIDEBAR
      ==================================================== */}

      <aside className="councilor-sidebar">
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

        <span className="councilor-nav-label">
          MAIN MENU
        </span>

        <nav
          className="councilor-nav"
          aria-label="Councilor navigation"
        >
          <button
            type="button"
            className="councilor-nav-item"
            onClick={goToDashboard}
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ▦
            </span>

            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className="councilor-nav-item active"
            aria-current="page"
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ♙
            </span>

            <span>Advisers</span>
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            onClick={goToSections}
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ▤
            </span>

            <span>Sections</span>
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            onClick={goToAttendance}
          >
            <span
              className="councilor-nav-icon"
              aria-hidden="true"
            >
              ◷
            </span>

            <span>Attendance</span>
          </button>
        </nav>

        <div className="councilor-sidebar-footer">
          <div className="councilor-sidebar-school">
            <span>SCHOOL SYSTEM</span>

            <strong>
              Signal Village National High
              School
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

            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ===================================================
          MAIN
      ==================================================== */}

      <section className="councilor-main">
        <header className="councilor-header">
          <div className="councilor-header-copy">
            <span className="councilor-eyebrow">
              ACCOUNT MANAGEMENT
            </span>

            <h1>Advisers</h1>

            <p>
              Manage adviser accounts for
              your school.
            </p>
          </div>

          <div className="councilor-header-actions">
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

            <div
              className="councilor-header-divider"
              aria-hidden="true"
            />

            <ThemeToggle />

            <div
              className="councilor-header-divider"
              aria-hidden="true"
            />

            <div className="councilor-user">
              <div className="councilor-avatar">
                {user?.name
                  ?.trim()
                  ?.charAt(0)
                  ?.toUpperCase() || "U"}
              </div>

              <div className="councilor-user-copy">
                <strong>
                  {user?.name ||
                    "Councilor"}
                </strong>

                <span>
                  School Councilor
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            CONTENT
        ================================================== */}

        <div className="councilor-content councilor-advisers-page">
          <section className="councilor-adviser-overview">
            <section className="councilor-welcome-card">
              <div className="councilor-welcome-copy">
                <span>
                  ADVISER MANAGEMENT
                </span>

                <h2>
                  Manage adviser accounts
                </h2>

                <p>
                  Create, organize, and
                  manage registered adviser
                  accounts for Signal Village
                  National High School.
                </p>

                <div className="councilor-welcome-meta">
                  <span>SVNHS</span>

                  <span
                    className="councilor-welcome-meta-dot"
                    aria-hidden="true"
                  />

                  <span>
                    Account Administration
                  </span>
                </div>
              </div>

              <div
                className="councilor-welcome-badge"
                aria-hidden="true"
              >
                <img
                  src={seniorHighSchoolLogo}
                  alt=""
                />
              </div>
            </section>

            {/* SUMMARY METRICS */}

            <section
              className="councilor-adviser-metrics"
              aria-label="Adviser statistics"
            >
              <article className="councilor-adviser-metric">
                <div
                  className="councilor-adviser-metric-icon"
                  aria-hidden="true"
                >
                  ♙
                </div>

                <div className="councilor-adviser-metric-copy">
                  <span>REGISTERED</span>

                  <p>
                    Total Advisers
                  </p>

                  <small>
                    All adviser accounts
                  </small>
                </div>

                <strong className="councilor-adviser-metric-value">
                  {loading
                    ? "—"
                    : advisers.length}
                </strong>
              </article>

              <article className="councilor-adviser-metric is-active">
                <div
                  className="councilor-adviser-metric-icon"
                  aria-hidden="true"
                >
                  ✓
                </div>

                <div className="councilor-adviser-metric-copy">
                  <span>ACTIVE</span>

                  <p>
                    Active Advisers
                  </p>

                  <small>
                    Currently enabled
                  </small>
                </div>

                <strong className="councilor-adviser-metric-value">
                  {loading
                    ? "—"
                    : activeAdvisers}
                </strong>
              </article>

              <article className="councilor-adviser-metric is-inactive">
                <div
                  className="councilor-adviser-metric-icon"
                  aria-hidden="true"
                >
                  —
                </div>

                <div className="councilor-adviser-metric-copy">
                  <span>INACTIVE</span>

                  <p>
                    Inactive Advisers
                  </p>

                  <small>
                    Disabled accounts
                  </small>
                </div>

                <strong className="councilor-adviser-metric-value">
                  {loading
                    ? "—"
                    : inactiveAdvisers}
                </strong>
              </article>
            </section>
          </section>

          {/* SUCCESS */}

          {success && (
            <div
              className="councilor-success"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">
                ✓
              </span>

              <p>{success}</p>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
                aria-label="Dismiss success message"
              >
                ×
              </button>
            </div>
          )}

          {/* ADVISER DIRECTORY */}

          <section className="councilor-panel councilor-adviser-directory">
            <div className="councilor-panel-header">
              <div>
                <span>
                  ACCOUNT MANAGEMENT
                </span>

                <h2>
                  Adviser Directory
                  {!loading && (
                    <small>
                      {advisers.length}
                    </small>
                  )}
                </h2>

                <p>
                  Search and manage
                  registered school adviser
                  accounts.
                </p>
              </div>

              <div className="councilor-panel-actions">
                <button
                  type="button"
                  className="councilor-primary-button"
                  onClick={openModal}
                >
                  <span aria-hidden="true">
                    +
                  </span>

                  Add Adviser
                </button>
              </div>
            </div>

            {/* TOOLBAR */}

            <div className="councilor-toolbar">
              <div className="councilor-search">
                <span aria-hidden="true">
                  ⌕
                </span>

                <input
                  type="search"
                  aria-label="Search advisers"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                />
              </div>

              <span className="councilor-result-count">
                {loading
                  ? "Loading..."
                  : `${
                      filteredAdvisers.length
                    } ${
                      filteredAdvisers.length ===
                      1
                        ? "adviser"
                        : "advisers"
                    }`}
              </span>
            </div>

            {/* ERROR */}

            {error && (
              <div
                className="councilor-error"
                role="alert"
              >
                <span aria-hidden="true">
                  !
                </span>

                <p>{error}</p>
              </div>
            )}

            {/* CONTENT */}

            {loading ? (
              <div className="councilor-empty">
                <div
                  className="councilor-loading-spinner"
                  aria-hidden="true"
                />

                <strong>
                  Loading advisers
                </strong>

                <p>
                  Fetching registered
                  adviser accounts...
                </p>
              </div>
            ) : filteredAdvisers.length ===
              0 ? (
              <div className="councilor-empty">
                <div
                  className="councilor-empty-icon"
                  aria-hidden="true"
                >
                  ♙
                </div>

                <strong>
                  {search
                    ? "No advisers found"
                    : "No advisers yet"}
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
                      <th scope="col">
                        ADVISER
                      </th>

                      <th scope="col">
                        EMAIL ADDRESS
                      </th>

                      <th scope="col">
                        ROLE
                      </th>

                      <th scope="col">
                        STATUS
                      </th>

                      <th scope="col">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAdvisers.map(
                      (adviser) => {
                        const adviserInitial =
                          adviser.name
                            ?.trim()
                            ?.charAt(0)
                            ?.toUpperCase() ||
                          "A";

                        const adviserRole =
                          adviser.role ||
                          "ADVISER";

                        const isActive =
                          adviser.active !==
                          false;

                        return (
                          <tr key={adviser.id}>
                            <td>
                              <div className="councilor-person">
                                <div className="councilor-person-avatar">
                                  {
                                    adviserInitial
                                  }
                                </div>

                                <div>
                                  <strong>
                                    {
                                      adviser.name
                                    }
                                  </strong>

                                  <span>
                                    School
                                    Adviser
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              {
                                adviser.email
                              }
                            </td>

                            <td>
                              <span className="councilor-role">
                                {
                                  adviserRole
                                }
                              </span>
                            </td>

                            <td>
                              <span
                                className={`councilor-status ${
                                  isActive
                                    ? ""
                                    : "inactive"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                />

                                {isActive
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </td>

                            {/* ACTIONS */}

                            <td>
                              <button
                                type="button"
                                className="councilor-table-action"
                                onClick={() =>
                                  openResetModal(
                                    adviser,
                                  )
                                }
                              >
                                Reset Password
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              filteredAdvisers.length >
                0 && (
                <div className="councilor-panel-footer">
                  <span>
                    Showing{" "}
                    {
                      filteredAdvisers.length
                    }{" "}
                    of {advisers.length}{" "}
                    {advisers.length === 1
                      ? "adviser"
                      : "advisers"}
                  </span>
                </div>
              )}
          </section>
        </div>
      </section>

      {/* ===================================================
          ADD ADVISER MODAL
      ==================================================== */}

      {showModal && (
        <div
          className="councilor-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
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
            <div className="councilor-modal-header">
              <div>
                <span>
                  ACCOUNT MANAGEMENT
                </span>

                <h2 id="add-adviser-title">
                  Add Adviser
                </h2>

                <p>
                  Create a new school
                  adviser account.
                </p>
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

            <form
              className="councilor-modal-form"
              onSubmit={
                handleCreateAdviser
              }
              noValidate
            >
              <div className="councilor-modal-field">
                <label htmlFor="adviser-name">
                  Full Name
                </label>

                <input
                  id="adviser-name"
                  name="name"
                  type="text"
                  placeholder="Enter adviser name"
                  value={formData.name}
                  onChange={
                    handleFormChange
                  }
                  autoComplete="name"
                  disabled={creating}
                  autoFocus
                />
              </div>

              <div className="councilor-modal-field">
                <label htmlFor="adviser-email">
                  Email Address
                </label>

                <input
                  id="adviser-email"
                  name="email"
                  type="email"
                  placeholder="Enter school email"
                  value={formData.email}
                  onChange={
                    handleFormChange
                  }
                  autoComplete="email"
                  disabled={creating}
                />
              </div>

              <div className="councilor-modal-field">
                <label htmlFor="adviser-password">
                  Temporary Password
                </label>

                <input
                  id="adviser-password"
                  name="password"
                  type="password"
                  placeholder="Enter temporary password"
                  value={
                    formData.password
                  }
                  onChange={
                    handleFormChange
                  }
                  autoComplete="new-password"
                  disabled={creating}
                />

                <span className="councilor-field-hint">
                  Minimum 6 characters.
                </span>
              </div>

              {formError && (
                <div
                  className="councilor-modal-error"
                  role="alert"
                >
                  <span aria-hidden="true">
                    !
                  </span>

                  <p>{formError}</p>
                </div>
              )}

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

                  {creating
                    ? "Creating..."
                    : "Create Adviser"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================
          RESET PASSWORD MODAL
      ==================================================== */}

      {showResetModal &&
        selectedAdviser && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
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
              {/* HEADER */}

              <div className="councilor-modal-header">
                <div>
                  <span>
                    ACCOUNT SECURITY
                  </span>

                  <h2 id="reset-password-title">
                    Reset Password
                  </h2>

                  <p>
                    Set a new temporary
                    password for this
                    adviser account.
                  </p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={
                    closeResetModal
                  }
                  disabled={
                    resettingPassword
                  }
                  aria-label="Close reset password modal"
                >
                  ×
                </button>
              </div>

              {/* FORM */}

              <form
                className="councilor-modal-form"
                onSubmit={
                  handleResetAdviserPassword
                }
                noValidate
              >
                {/* SELECTED ADVISER */}

                <div className="councilor-reset-account">
                  <div className="councilor-person-avatar">
                    {selectedAdviser.name
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "A"}
                  </div>

                  <div>
                    <span>
                      Resetting password
                      for
                    </span>

                    <strong>
                      {
                        selectedAdviser.name
                      }
                    </strong>

                    <small>
                      {
                        selectedAdviser.email
                      }
                    </small>
                  </div>
                </div>

                {/* NEW PASSWORD */}

                <div className="councilor-modal-field">
                  <label htmlFor="reset-new-password">
                    New Temporary Password
                  </label>

                  <input
                    id="reset-new-password"
                    name="newPassword"
                    type="password"
                    placeholder="Enter new temporary password"
                    value={
                      resetFormData.newPassword
                    }
                    onChange={
                      handleResetFormChange
                    }
                    autoComplete="new-password"
                    disabled={
                      resettingPassword
                    }
                    autoFocus
                  />

                  <span className="councilor-field-hint">
                    Minimum 8
                    characters.
                  </span>
                </div>

                {/* CONFIRM PASSWORD */}

                <div className="councilor-modal-field">
                  <label htmlFor="reset-confirm-password">
                    Confirm Password
                  </label>

                  <input
                    id="reset-confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter new password"
                    value={
                      resetFormData.confirmPassword
                    }
                    onChange={
                      handleResetFormChange
                    }
                    autoComplete="new-password"
                    disabled={
                      resettingPassword
                    }
                  />
                </div>

                {/* ERROR */}

                {resetFormError && (
                  <div
                    className="councilor-modal-error"
                    role="alert"
                  >
                    <span aria-hidden="true">
                      !
                    </span>

                    <p>
                      {resetFormError}
                    </p>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="councilor-modal-actions">
                  <button
                    type="button"
                    className="councilor-secondary-button"
                    onClick={
                      closeResetModal
                    }
                    disabled={
                      resettingPassword
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={
                      resettingPassword
                    }
                  >
                    {resettingPassword && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {resettingPassword
                      ? "Resetting..."
                      : "Reset Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
  );
}

export default Advisers;