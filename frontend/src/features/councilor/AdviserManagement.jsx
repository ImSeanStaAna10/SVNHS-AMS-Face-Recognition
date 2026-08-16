import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import authService from "../../services/authService";
import councilorService from "../../services/councilorService";

import "../../styles/councilor.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

function Advisers() {
  const navigate = useNavigate();
  const user = authService.getUser();

  // =========================
  // DATA STATE
  // =========================

  const [advisers, setAdvisers] = useState([]);
  const [search, setSearch] = useState("");

  // =========================
  // UI STATE
  // =========================

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =========================
  // MODAL STATE
  // =========================

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  // =========================
  // LOAD ADVISERS
  // =========================

  const loadAdvisers = useCallback(async () => {
    try {
      const data = await councilorService.getAdvisers();

      setAdvisers(
        Array.isArray(data)
          ? data
          : [],
      );

      setError("");
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load advisers.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================
  // INITIAL LOAD
  // =========================

  useEffect(() => {
    // Defer calling loadAdvisers to avoid triggering synchronous setState inside the effect
    const t = setTimeout(() => {
      void loadAdvisers();
    }, 0);

    return () => clearTimeout(t);
  }, [loadAdvisers]);

  // =========================
  // FILTERED ADVISERS
  // =========================

  const filteredAdvisers = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

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

  // =========================
  // FORM
  // =========================

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

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setFormError("");
  };

  const openModal = () => {
    resetForm();

    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (creating) {
      return;
    }

    setShowModal(false);
    resetForm();
  };

  // =========================
  // VALIDATE FORM
  // =========================

  const validateForm = () => {
    const name = formData.name.trim();
    const email = formData.email
      .trim()
      .toLowerCase();

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

  // =========================
  // CREATE ADVISER
  // =========================

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

      await councilorService.createAdviser(
        validation.data,
      );

      setShowModal(false);
      resetForm();

      setSuccess(
        "Adviser account created successfully.",
      );

      await loadAdvisers();
    } catch (err) {
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

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    authService.logout();

    navigate("/login", {
      replace: true,
    });
  };

  // =========================
  // NAVIGATION
  // =========================

  const goToDashboard = () => {
    navigate("/councilor/dashboard");
  };

  // =========================
  // RENDER
  // =========================

  return (
    <main className="councilor-page">
      {/* =========================
          SIDEBAR
      ========================== */}

      <aside className="councilor-sidebar">
        <div className="councilor-brand">
          <div className="councilor-brand-mark">
            S
          </div>

          <div>
            <strong>SVNHS</strong>
            <span>Attendance System</span>
          </div>
        </div>

        <nav
          className="councilor-nav"
          aria-label="Councilor navigation"
        >
          <button
            type="button"
            className="councilor-nav-item"
            onClick={goToDashboard}
          >
            <span aria-hidden="true">▦</span>
            Dashboard
          </button>

          <button
            type="button"
            className="councilor-nav-item active"
            aria-current="page"
          >
            <span aria-hidden="true">♙</span>
            Advisers
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            disabled
          >
            <span aria-hidden="true">▤</span>
            Sections
          </button>

          <button
            type="button"
            className="councilor-nav-item"
            disabled
          >
            <span aria-hidden="true">◷</span>
            Attendance
          </button>
        </nav>

        <div className="councilor-sidebar-footer">
          <button
            type="button"
            className="councilor-logout"
            onClick={handleLogout}
          >
            <span aria-hidden="true">↪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* =========================
          MAIN CONTENT
      ========================== */}

      <section className="councilor-main">
        {/* HEADER */}

        <header className="councilor-header">
          <div>
            <span className="councilor-eyebrow">
              COUNCILOR PORTAL
            </span>

            <h1>Advisers</h1>

            <p>
              Manage adviser accounts for your school.
            </p>
          </div>

          <div className="councilor-user">
            <div className="councilor-avatar">
              {user?.name
                ?.charAt(0)
                ?.toUpperCase() || "U"}
            </div>

            <div>
              <strong>
                {user?.name || "Councilor"}
              </strong>

              <span>School Councilor</span>
            </div>
          </div>
        </header>

        {/* CONTENT */}

        <div className="councilor-content">
          {/* WELCOME CARD */}

          <section className="councilor-welcome-card">
            <div>
              <span>
                ADVISER MANAGEMENT
              </span>

              <h2>
                Manage your advisers
              </h2>

              <p>
                Create and manage school adviser
                accounts for the attendance system.
              </p>
            </div>

            <div className="councilor-welcome-badge">
              SVNHS
            </div>
          </section>

          {/* SUCCESS MESSAGE */}

          {success && (
            <div
              className="councilor-success"
              role="status"
            >
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

          {/* ADVISER PANEL */}

          <section className="councilor-panel">
            {/* PANEL HEADER */}

            <div className="councilor-panel-header">
              <div>
                <span>
                  ACCOUNT MANAGEMENT
                </span>

                <h2>
                  Advisers

                  {!loading && (
                    <small>
                      {advisers.length}
                    </small>
                  )}
                </h2>
              </div>

              <button
                type="button"
                className="councilor-primary-button"
                onClick={openModal}
              >
                + Add Adviser
              </button>
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
                  placeholder="Search advisers..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <span className="councilor-result-count">
                {loading
                  ? "Loading..."
                  : `${filteredAdvisers.length} adviser${
                      filteredAdvisers.length === 1
                        ? ""
                        : "s"
                    }`}
              </span>
            </div>

            {/* ERROR MESSAGE */}

            {error && (
              <div
                className="councilor-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* LOADING STATE */}

            {loading ? (
              <div className="councilor-empty">
                <div
                  className="councilor-loading-spinner"
                  aria-hidden="true"
                />

                <p>
                  Loading advisers...
                </p>
              </div>
            ) : filteredAdvisers.length === 0 ? (
              /* EMPTY STATE */

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
                    ? "Try a different search term."
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
              /* TABLE */

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
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAdvisers.map(
                      (adviser) => {
                        const adviserInitial =
                          adviser.name
                            ?.charAt(0)
                            ?.toUpperCase() ||
                          "A";

                        const adviserRole =
                          adviser.role ||
                          "ADVISER";

                        const adviserStatus =
                          adviser.active === false
                            ? "Inactive"
                            : "Active";

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
                                    Adviser
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              {adviser.email}
                            </td>

                            <td>
                              <span className="councilor-role">
                                {
                                  adviserRole
                                }
                              </span>
                            </td>

                            <td>
                              <span className="councilor-status">
                                {
                                  adviserStatus
                                }
                              </span>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>

      {/* =========================
          ADD ADVISER MODAL
      ========================== */}

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
            {/* MODAL HEADER */}

            <div className="councilor-modal-header">
              <div>
                <span>
                  ACCOUNT MANAGEMENT
                </span>

                <h2 id="add-adviser-title">
                  Add Adviser
                </h2>

                <p>
                  Create a new adviser account.
                </p>
              </div>

              <button
                type="button"
                className="councilor-modal-close"
                onClick={closeModal}
                disabled={creating}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form
              className="councilor-modal-form"
              onSubmit={handleCreateAdviser}
              noValidate
            >
              {/* NAME */}

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
                  onChange={handleFormChange}
                  autoComplete="name"
                  disabled={creating}
                />
              </div>

              {/* EMAIL */}

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
                  onChange={handleFormChange}
                  autoComplete="email"
                  disabled={creating}
                />
              </div>

              {/* PASSWORD */}

              <div className="councilor-modal-field">
                <label htmlFor="adviser-password">
                  Temporary Password
                </label>

                <input
                  id="adviser-password"
                  name="password"
                  type="password"
                  placeholder="Enter temporary password"
                  value={formData.password}
                  onChange={handleFormChange}
                  autoComplete="new-password"
                  disabled={creating}
                />

                <span className="councilor-field-hint">
                  Minimum 6 characters.
                </span>
              </div>

              {/* FORM ERROR */}

              {formError && (
                <div
                  className="councilor-modal-error"
                  role="alert"
                >
                  <span aria-hidden="true">
                    !
                  </span>

                  <p>
                    {formError}
                  </p>
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

                  {creating
                    ? "Creating..."
                    : "Create Adviser"}
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