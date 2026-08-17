import {
  useEffect,
  useMemo,
  useState,
} from "react";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import councilorService from "../../services/councilorService";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_FORM = {
  name: "",
  adviserId: "",
};

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const fetchSections = async () => {
  const data =
    await councilorService.getSections();

  return Array.isArray(data)
    ? data
    : [];
};

const fetchAdvisers = async () => {
  const data =
    await councilorService.getAdvisers();

  return Array.isArray(data)
    ? data
    : [];
};

/* =========================================================
   COMPONENT
========================================================= */

function SectionManagement() {
  /* =======================================================
     DATA STATE
  ======================================================= */

  const [sections, setSections] =
    useState([]);

  const [advisers, setAdvisers] =
    useState([]);

  const [search, setSearch] =
    useState("");

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  /* =======================================================
     FEEDBACK STATE
  ======================================================= */

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =======================================================
     MODAL STATE
  ======================================================= */

  const [showModal, setShowModal] =
    useState(false);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const [formError, setFormError] =
    useState("");

  /* =======================================================
     INITIAL DATA LOAD
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadInitialData =
      async () => {
        try {
          const [
            sectionData,
            adviserData,
          ] = await Promise.all([
            fetchSections(),
            fetchAdvisers(),
          ]);

          if (!isMounted) {
            return;
          }

          setSections(sectionData);
          setAdvisers(adviserData);

          setError("");
        } catch (err) {
          console.error(
            "Unable to load section management data:",
            err,
          );

          if (!isMounted) {
            return;
          }

          setError(
            getErrorMessage(
              err,
              "Unable to load section management data.",
            ),
          );
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =======================================================
     MODAL SIDE EFFECTS
  ======================================================= */

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !creating
      ) {
        setShowModal(false);
        setFormData(INITIAL_FORM);
        setFormError("");
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
  }, [showModal, creating]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const activeAdvisers =
    useMemo(() => {
      return advisers.filter(
        (adviser) =>
          adviser.role === "ADVISER" &&
          adviser.active !== false,
      );
    }, [advisers]);

  const filteredSections =
    useMemo(() => {
      const keyword = search
        .trim()
        .toLowerCase();

      if (!keyword) {
        return sections;
      }

      return sections.filter(
        (section) => {
          const sectionName =
            section.name
              ?.toLowerCase() ?? "";

          const adviserName =
            section.adviserName
              ?.toLowerCase() ?? "";

          return (
            sectionName.includes(keyword) ||
            adviserName.includes(keyword)
          );
        },
      );
    }, [sections, search]);

  const activeSectionCount =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            section.active !== false,
        ).length,
      [sections],
    );

  const inactiveSectionCount =
    sections.length -
    activeSectionCount;

  /* =======================================================
     REFRESH SECTIONS
  ======================================================= */

  const refreshSections =
    async () => {
      const data =
        await fetchSections();

      setSections(data);
      setError("");
    };

  /* =======================================================
     FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setFormError("");
  };

  const handleFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  };

  /* =======================================================
     MODAL CONTROLS
  ======================================================= */

  const openModal = () => {
    resetForm();

    setError("");
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

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validateForm = () => {
    const name =
      formData.name.trim();

    const adviserId =
      formData.adviserId.trim();

    if (!name) {
      return {
        valid: false,
        message:
          "Please enter a section name.",
      };
    }

    if (!adviserId) {
      return {
        valid: false,
        message:
          "Please select an adviser.",
      };
    }

    return {
      valid: true,

      data: {
        name,
        adviserId,
      },
    };
  };

  /* =======================================================
     CREATE SECTION
  ======================================================= */

  const handleCreateSection =
    async (event) => {
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

        await councilorService.createSection(
          validation.data,
        );

        await refreshSections();

        setShowModal(false);

        resetForm();

        setSuccess(
          "Section created successfully.",
        );
      } catch (err) {
        console.error(
          "Unable to create section:",
          err,
        );

        setFormError(
          getErrorMessage(
            err,
            "Unable to create section.",
          ),
        );
      } finally {
        setCreating(false);
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <CouncilorLayout>
      {/* ===================================================
          PAGE HERO
      ==================================================== */}

      <section className="section-welcome-card">
        <div className="section-welcome-content">
          <span>
            SECTION MANAGEMENT
          </span>

          <h2>
            Manage school sections
          </h2>

          <p>
            Create and organize academic sections
            and manage adviser assignments for
            Signal Village National High School.
          </p>
        </div>

        <div
          className="section-welcome-badge"
          aria-hidden="true"
        >
          SVNHS
        </div>
      </section>

      {/* ===================================================
          OVERVIEW STATISTICS
      ==================================================== */}

      <section
        className="section-stat-grid"
        aria-label="Section statistics"
      >
        {/* TOTAL SECTIONS */}

        <article className="section-stat-card">
          <div className="section-stat-header">
            <div
              className="section-stat-icon"
              aria-hidden="true"
            >
              ▦
            </div>

            <span>
              SECTIONS
            </span>
          </div>

          <strong>
            {loading
              ? "—"
              : sections.length}
          </strong>

          <h3>
            Total Sections
          </h3>

          <p>
            Registered school sections
          </p>
        </article>

        {/* ACTIVE SECTIONS */}

        <article className="section-stat-card">
          <div className="section-stat-header">
            <div
              className="section-stat-icon"
              aria-hidden="true"
            >
              ✓
            </div>

            <span>
              ACTIVE
            </span>
          </div>

          <strong>
            {loading
              ? "—"
              : activeSectionCount}
          </strong>

          <h3>
            Active Sections
          </h3>

          <p>
            Sections currently active
          </p>
        </article>

        {/* INACTIVE SECTIONS */}

        <article className="section-stat-card">
          <div className="section-stat-header">
            <div
              className="section-stat-icon"
              aria-hidden="true"
            >
              —
            </div>

            <span>
              INACTIVE
            </span>
          </div>

          <strong>
            {loading
              ? "—"
              : inactiveSectionCount}
          </strong>

          <h3>
            Inactive Sections
          </h3>

          <p>
            Sections currently inactive
          </p>
        </article>
      </section>

      {/* ===================================================
          SUCCESS MESSAGE
      ==================================================== */}

      {success && (
        <div
          className="councilor-success"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            ✓
          </span>

          <p>
            {success}
          </p>

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

      {/* ===================================================
          SECTION DIRECTORY
      ==================================================== */}

      <section className="councilor-panel">
        {/* =================================================
            PANEL HEADER
        ================================================== */}

        <div className="councilor-panel-header">
          <div>
            <span>
              ACADEMIC MANAGEMENT
            </span>

            <h2>
              Section Directory

              {!loading && (
                <small>
                  {sections.length}
                </small>
              )}
            </h2>

            <p>
              View and manage registered school
              sections and adviser assignments.
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

              Add Section
            </button>
          </div>
        </div>

        {/* =================================================
            TOOLBAR
        ================================================== */}

        <div className="councilor-toolbar">
          <div className="councilor-search">
            <span aria-hidden="true">
              ⌕
            </span>

            <input
              type="search"
              aria-label="Search sections"
              placeholder="Search by section or adviser..."
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
              : `${filteredSections.length} ${
                  filteredSections.length === 1
                    ? "section"
                    : "sections"
                }`}
          </span>
        </div>

        {/* =================================================
            ERROR STATE
        ================================================== */}

        {error && (
          <div
            className="councilor-error"
            role="alert"
          >
            <span aria-hidden="true">
              !
            </span>

            <p>
              {error}
            </p>
          </div>
        )}

        {/* =================================================
            LOADING / EMPTY / TABLE
        ================================================== */}

        {loading ? (
          <div className="councilor-empty">
            <div
              className="councilor-loading-spinner"
              aria-hidden="true"
            />

            <strong>
              Loading sections
            </strong>

            <p>
              Fetching registered school
              sections...
            </p>
          </div>
        ) : filteredSections.length ===
          0 ? (
          /* =============================================
             EMPTY STATE
          ============================================== */

          <div className="councilor-empty">
            <div
              className="councilor-empty-icon"
              aria-hidden="true"
            >
              ▦
            </div>

            <strong>
              {search
                ? "No sections found"
                : "No sections yet"}
            </strong>

            <p>
              {search
                ? "Try searching with a different section or adviser name."
                : "Create your first school section to get started."}
            </p>

            {!search && (
              <button
                type="button"
                className="councilor-primary-button"
                onClick={openModal}
              >
                + Add Section
              </button>
            )}
          </div>
        ) : (
          /* =============================================
             SECTION TABLE
          ============================================== */

          <div className="councilor-table-wrapper">
            <table className="councilor-table">
              <thead>
                <tr>
                  <th scope="col">
                    SECTION
                  </th>

                  <th scope="col">
                    ADVISER
                  </th>

                  <th scope="col">
                    STATUS
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSections.map(
                  (section) => {
                    const isActive =
                      section.active !==
                      false;

                    const sectionInitial =
                      section.name
                        ?.trim()
                        ?.charAt(0)
                        ?.toUpperCase() ||
                      "S";

                    const adviserInitial =
                      section.adviserName
                        ?.trim()
                        ?.charAt(0)
                        ?.toUpperCase() ||
                      "A";

                    return (
                      <tr
                        key={section.id}
                      >
                        {/* SECTION */}

                        <td>
                          <div className="councilor-person">
                            <div className="councilor-person-avatar">
                              {
                                sectionInitial
                              }
                            </div>

                            <div>
                              <strong>
                                {section.name}
                              </strong>

                              <span>
                                School Section
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ADVISER */}

                        <td>
                          {section.adviserName ? (
                            <div className="councilor-person">
                              <div className="councilor-person-avatar">
                                {
                                  adviserInitial
                                }
                              </div>

                              <div>
                                <strong>
                                  {
                                    section.adviserName
                                  }
                                </strong>

                                <span>
                                  Assigned Adviser
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="section-unassigned">
                              No adviser assigned
                            </span>
                          )}
                        </td>

                        {/* STATUS */}

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
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* =================================================
            PANEL FOOTER
        ================================================== */}

        {!loading &&
          filteredSections.length >
            0 && (
            <div className="councilor-panel-footer">
              <span>
                Showing{" "}
                {
                  filteredSections.length
                }{" "}
                of{" "}
                {sections.length}{" "}
                {sections.length === 1
                  ? "section"
                  : "sections"}
              </span>
            </div>
          )}
      </section>

      {/* ===================================================
          ADD SECTION MODAL
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
            aria-labelledby="add-section-title"
          >
            {/* ===========================================
                MODAL HEADER
            ============================================ */}

            <div className="councilor-modal-header">
              <div>
                <span>
                  ACADEMIC MANAGEMENT
                </span>

                <h2 id="add-section-title">
                  Add Section
                </h2>

                <p>
                  Create a new school section
                  and assign an adviser.
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

            {/* ===========================================
                FORM
            ============================================ */}

            <form
              className="councilor-modal-form"
              onSubmit={
                handleCreateSection
              }
              noValidate
            >
              {/* SECTION NAME */}

              <div className="councilor-modal-field">
                <label htmlFor="section-name">
                  Section Name
                </label>

                <input
                  id="section-name"
                  name="name"
                  type="text"
                  placeholder="e.g. STEM 11 - Newton"
                  value={
                    formData.name
                  }
                  onChange={
                    handleFormChange
                  }
                  autoComplete="off"
                  disabled={creating}
                  autoFocus
                />
              </div>

              {/* ADVISER */}

              <div className="councilor-modal-field">
                <label htmlFor="section-adviser">
                  Assign Adviser
                </label>

                <select
                  id="section-adviser"
                  name="adviserId"
                  value={
                    formData.adviserId
                  }
                  onChange={
                    handleFormChange
                  }
                  disabled={
                    creating ||
                    activeAdvisers.length ===
                      0
                  }
                >
                  <option value="">
                    Select an adviser
                  </option>

                  {activeAdvisers.map(
                    (adviser) => (
                      <option
                        key={adviser.id}
                        value={adviser.id}
                      >
                        {adviser.name} —{" "}
                        {adviser.email}
                      </option>
                    ),
                  )}
                </select>

                <span className="councilor-field-hint">
                  Only active adviser accounts
                  can be assigned to a section.
                </span>
              </div>

              {/* NO ACTIVE ADVISER */}

              {activeAdvisers.length ===
                0 && (
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
                    No active adviser accounts
                    are available. Create or
                    activate an adviser first.
                  </p>
                </div>
              )}

              {/* FORM ERROR */}

              {formError && (
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
                    {formError}
                  </p>
                </div>
              )}

              {/* =========================================
                  ACTIONS
              ========================================== */}

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
                  disabled={
                    creating ||
                    activeAdvisers.length ===
                      0
                  }
                >
                  {creating && (
                    <span
                      className="councilor-button-spinner"
                      aria-hidden="true"
                    />
                  )}

                  {creating
                    ? "Creating..."
                    : "Create Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CouncilorLayout>
  );
}

export default SectionManagement;