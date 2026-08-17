import {
  useEffect,
  useMemo,
  useState,
} from "react";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import councilorService from "../../services/councilorService";

import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_FORM = {
  name: "",
  adviserId: "",
};

const INITIAL_DATA_STATUS = {
  sections: "loading",
  advisers: "loading",
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

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString(
    "en-PH",
  );

const formatPercentage = (value) => {
  const number =
    Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0.0%";
  }

  return `${number.toFixed(1)}%`;
};

const clampPercentage = (value) =>
  Math.min(
    Math.max(
      Number(value ?? 0),
      0,
    ),
    100,
  );

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

  const [dataStatus, setDataStatus] =
    useState(INITIAL_DATA_STATUS);

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
        setLoading(true);
        setError("");

        const [
          sectionResult,
          adviserResult,
        ] =
          await Promise.allSettled([
            fetchSections(),
            fetchAdvisers(),
          ]);

        if (!isMounted) {
          return;
        }

        const nextStatus = {
          sections:
            sectionResult.status ===
            "fulfilled"
              ? "ready"
              : "error",

          advisers:
            adviserResult.status ===
            "fulfilled"
              ? "ready"
              : "error",
        };

        if (
          sectionResult.status ===
          "fulfilled"
        ) {
          setSections(
            sectionResult.value,
          );
        } else {
          setSections([]);
        }

        if (
          adviserResult.status ===
          "fulfilled"
        ) {
          setAdvisers(
            adviserResult.value,
          );
        } else {
          setAdvisers([]);
        }

        setDataStatus(nextStatus);

        const unavailable = [];

        if (
          nextStatus.sections ===
          "error"
        ) {
          unavailable.push(
            "sections",
          );
        }

        if (
          nextStatus.advisers ===
          "error"
        ) {
          unavailable.push(
            "adviser accounts",
          );
        }

        if (
          unavailable.length > 0
        ) {
          setError(
            `Some section management data could not be loaded: ${unavailable.join(
              ", ",
            )}.`,
          );
        }

        setLoading(false);
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

    const handleKeyDown = (
      event,
    ) => {
      if (
        event.key === "Escape" &&
        !creating
      ) {
        setShowModal(false);

        setFormData(
          INITIAL_FORM,
        );

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
  }, [
    showModal,
    creating,
  ]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const sectionsReady =
    dataStatus.sections ===
    "ready";

  const advisersReady =
    dataStatus.advisers ===
    "ready";

  const activeAdvisers =
    useMemo(() => {
      return advisers.filter(
        (adviser) =>
          adviser.role ===
            "ADVISER" &&
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
              ?.toLowerCase() ??
            "";

          const adviserName =
            section.adviserName
              ?.toLowerCase() ??
            "";

          return (
            sectionName.includes(
              keyword,
            ) ||
            adviserName.includes(
              keyword,
            )
          );
        },
      );
    }, [
      sections,
      search,
    ]);

  const activeSectionCount =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            section.active !==
            false,
        ).length,
      [sections],
    );

  const inactiveSectionCount =
    sections.length -
    activeSectionCount;

  const assignedSectionCount =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            Boolean(
              section.adviserId ||
                section.adviserName,
            ),
        ).length,
      [sections],
    );

  const unassignedSectionCount =
    sections.length -
    assignedSectionCount;

  const assignmentCoverage =
    sections.length > 0
      ? (assignedSectionCount /
          sections.length) *
        100
      : 0;

  /* =======================================================
     REFRESH SECTIONS
  ======================================================= */

  const refreshSections =
    async () => {
      try {
        const data =
          await fetchSections();

        setSections(data);

        setDataStatus(
          (current) => ({
            ...current,
            sections: "ready",
          }),
        );

        setError("");
      } catch (err) {
        console.error(
          "Unable to refresh sections:",
          err,
        );

        setDataStatus(
          (current) => ({
            ...current,
            sections: "error",
          }),
        );

        throw err;
      }
    };

  /* =======================================================
     FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData(INITIAL_FORM);

    setFormError("");
  };

  const handleFormChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

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
      <div className="section-management-page">
        {/* =================================================
            PAGE OVERVIEW
        ================================================== */}

        <section className="section-management-overview">
          {/* ===============================================
              HERO
          ================================================ */}

          <section className="section-welcome-card">
            <div className="section-welcome-content">
              <span>
                ACADEMIC MANAGEMENT
              </span>

              <h2>
                Organize school sections
              </h2>

              <p>
                Create academic sections,
                assign active advisers, and
                monitor section readiness
                across Signal Village
                National High School.
              </p>

              <div className="section-welcome-meta">
                <span>
                  {sectionsReady
                    ? `${formatNumber(
                        sections.length,
                      )} Sections`
                    : "Sections unavailable"}
                </span>

                <span
                  className="section-welcome-meta-dot"
                  aria-hidden="true"
                />

                <span>
                  {advisersReady
                    ? `${formatNumber(
                        activeAdvisers.length,
                      )} Active Advisers`
                    : "Adviser data unavailable"}
                </span>
              </div>
            </div>

            <div
              className="section-welcome-badge"
              aria-hidden="true"
            >
              <img
                src={
                  seniorHighSchoolLogo
                }
                alt=""
              />
            </div>
          </section>

          {/* ===============================================
              OPERATIONAL METRICS
          ================================================ */}

          <section
            className="section-management-metrics"
            aria-label="Section management summary"
          >
            {/* ACTIVE */}

            <article className="section-management-metric">
              <div
                className="section-management-metric-icon"
                aria-hidden="true"
              >
                ▦
              </div>

              <div className="section-management-metric-copy">
                <span>
                  ACTIVE
                </span>

                <p>
                  Active Sections
                </p>

                <small>
                  Currently enabled
                </small>
              </div>

              <strong>
                {loading ||
                !sectionsReady
                  ? "—"
                  : formatNumber(
                      activeSectionCount,
                    )}
              </strong>
            </article>

            {/* ASSIGNED */}

            <article className="section-management-metric is-assigned">
              <div
                className="section-management-metric-icon"
                aria-hidden="true"
              >
                ✓
              </div>

              <div className="section-management-metric-copy">
                <span>
                  ASSIGNMENT
                </span>

                <p>
                  Adviser Coverage
                </p>

                <small>
                  Sections with advisers
                </small>
              </div>

              <strong>
                {loading ||
                !sectionsReady
                  ? "—"
                  : formatPercentage(
                      assignmentCoverage,
                    )}
              </strong>
            </article>

            {/* ADVISERS */}

            <article className="section-management-metric is-adviser">
              <div
                className="section-management-metric-icon"
                aria-hidden="true"
              >
                ♙
              </div>

              <div className="section-management-metric-copy">
                <span>
                  AVAILABLE
                </span>

                <p>
                  Active Advisers
                </p>

                <small>
                  Eligible for assignment
                </small>
              </div>

              <strong>
                {loading ||
                !advisersReady
                  ? "—"
                  : formatNumber(
                      activeAdvisers.length,
                    )}
              </strong>
            </article>
          </section>
        </section>

        {/* =================================================
            ASSIGNMENT HEALTH
        ================================================== */}

        {sectionsReady &&
          sections.length > 0 && (
            <section
              className={`section-assignment-health ${
                unassignedSectionCount >
                0
                  ? "has-warning"
                  : "is-complete"
              }`}
            >
              <div className="section-assignment-health-icon">
                {unassignedSectionCount >
                0
                  ? "!"
                  : "✓"}
              </div>

              <div className="section-assignment-health-copy">
                <span>
                  ADVISER ASSIGNMENT
                </span>

                <strong>
                  {unassignedSectionCount >
                  0
                    ? `${formatNumber(
                        unassignedSectionCount,
                      )} ${
                        unassignedSectionCount ===
                        1
                          ? "section needs"
                          : "sections need"
                      } an adviser`
                    : "All sections have assigned advisers"}
                </strong>

                <p>
                  {unassignedSectionCount >
                  0
                    ? `${formatNumber(
                        assignedSectionCount,
                      )} of ${formatNumber(
                        sections.length,
                      )} sections currently have adviser assignments.`
                    : `${formatNumber(
                        assignedSectionCount,
                      )} of ${formatNumber(
                        sections.length,
                      )} sections are covered by adviser assignments.`}
                </p>
              </div>

              <div className="section-assignment-health-progress">
                <div className="section-assignment-health-progress-top">
                  <span>
                    Assignment Coverage
                  </span>

                  <strong>
                    {formatPercentage(
                      assignmentCoverage,
                    )}
                  </strong>
                </div>

                <div className="section-assignment-progress-track">
                  <div
                    style={{
                      "--section-progress": `${clampPercentage(
                        assignmentCoverage,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </section>
          )}

        {/* =================================================
            SUCCESS MESSAGE
        ================================================== */}

        {success && (
          <div
            className="councilor-success"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
            >
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

        {/* =================================================
            PARTIAL DATA ERROR
        ================================================== */}

        {error && (
          <div
            className="section-data-warning"
            role="status"
          >
            <span
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Some information is
                unavailable
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            SECTION DIRECTORY
        ================================================== */}

        <section className="councilor-panel section-directory-panel">
          {/* ===============================================
              PANEL HEADER
          ================================================ */}

          <div className="councilor-panel-header">
            <div>
              <span>
                ACADEMIC DIRECTORY
              </span>

              <h2>
                Section Directory

                {!loading &&
                  sectionsReady && (
                    <small>
                      {
                        sections.length
                      }
                    </small>
                  )}
              </h2>

              <p>
                Review registered
                sections, adviser
                assignments, and
                operational status.
              </p>
            </div>

            <div className="councilor-panel-actions">
              <button
                type="button"
                className="councilor-primary-button"
                onClick={
                  openModal
                }
                disabled={
                  !advisersReady ||
                  activeAdvisers.length ===
                    0
                }
              >
                <span
                  aria-hidden="true"
                >
                  +
                </span>

                Add Section
              </button>
            </div>
          </div>

          {/* ===============================================
              TOOLBAR
          ================================================ */}

          <div className="councilor-toolbar">
            <div className="councilor-search">
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                aria-label="Search sections"
                placeholder="Search by section or adviser..."
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
              />
            </div>

            <div className="section-directory-summary">
              {!loading &&
                sectionsReady && (
                  <>
                    <span>
                      {
                        filteredSections.length
                      }{" "}
                      {filteredSections.length ===
                      1
                        ? "section"
                        : "sections"}
                    </span>

                    <span
                      aria-hidden="true"
                    >
                      •
                    </span>

                    <span>
                      {formatNumber(
                        inactiveSectionCount,
                      )}{" "}
                      inactive
                    </span>
                  </>
                )}
            </div>
          </div>

          {/* ===============================================
              LOADING / ERROR / EMPTY / TABLE
          ================================================ */}

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
                Fetching school section
                and assignment
                information...
              </p>
            </div>
          ) : !sectionsReady ? (
            <div className="councilor-empty">
              <div
                className="councilor-empty-icon"
                aria-hidden="true"
              >
                !
              </div>

              <strong>
                Sections unavailable
              </strong>

              <p>
                Section information
                could not be loaded.
              </p>
            </div>
          ) : filteredSections.length ===
            0 ? (
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
                  : "Create your first school section to begin organizing academic assignments."}
              </p>

              {!search &&
                advisersReady &&
                activeAdvisers.length >
                  0 && (
                  <button
                    type="button"
                    className="councilor-primary-button"
                    onClick={
                      openModal
                    }
                  >
                    + Add Section
                  </button>
                )}
            </div>
          ) : (
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
                      ASSIGNMENT
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

                      const hasAdviser =
                        Boolean(
                          section.adviserId ||
                            section.adviserName,
                        );

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
                          key={
                            section.id
                          }
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
                                  {
                                    section.name
                                  }
                                </strong>

                                <span>
                                  Academic
                                  Section
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
                                    Assigned
                                    Adviser
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="section-unassigned">
                                No adviser
                                assigned
                              </span>
                            )}
                          </td>

                          {/* ASSIGNMENT */}

                          <td>
                            <span
                              className={`section-assignment-status ${
                                hasAdviser
                                  ? "assigned"
                                  : "unassigned"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                              />

                              {hasAdviser
                                ? "Assigned"
                                : "Unassigned"}
                            </span>
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

          {/* ===============================================
              PANEL FOOTER
          ================================================ */}

          {!loading &&
            sectionsReady &&
            filteredSections.length >
              0 && (
              <div className="councilor-panel-footer">
                <span>
                  Showing{" "}
                  {
                    filteredSections.length
                  }{" "}
                  of{" "}
                  {
                    sections.length
                  }{" "}
                  {sections.length ===
                  1
                    ? "section"
                    : "sections"}
                </span>

                <span>
                  {formatNumber(
                    assignedSectionCount,
                  )}{" "}
                  assigned ·{" "}
                  {formatNumber(
                    unassignedSectionCount,
                  )}{" "}
                  unassigned
                </span>
              </div>
            )}
        </section>

        {/* =================================================
            ADD SECTION MODAL
        ================================================== */}

        {showModal && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(
              event,
            ) => {
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
              {/* =========================================
                  MODAL HEADER
              ========================================== */}

              <div className="councilor-modal-header">
                <div>
                  <span>
                    ACADEMIC
                    MANAGEMENT
                  </span>

                  <h2 id="add-section-title">
                    Add Section
                  </h2>

                  <p>
                    Create a new
                    academic section
                    and assign an active
                    adviser.
                  </p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={
                    closeModal
                  }
                  disabled={
                    creating
                  }
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              {/* =========================================
                  FORM
              ========================================== */}

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
                    disabled={
                      creating
                    }
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
                      Select an
                      adviser
                    </option>

                    {activeAdvisers.map(
                      (
                        adviser,
                      ) => (
                        <option
                          key={
                            adviser.id
                          }
                          value={
                            adviser.id
                          }
                        >
                          {
                            adviser.name
                          }{" "}
                          —{" "}
                          {
                            adviser.email
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <span className="councilor-field-hint">
                    Only active
                    adviser accounts
                    can be assigned to
                    a section.
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
                      No active
                      adviser accounts
                      are available.
                      Create or activate
                      an adviser first.
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
                      {
                        formError
                      }
                    </p>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="councilor-modal-actions">
                  <button
                    type="button"
                    className="councilor-secondary-button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      creating
                    }
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
      </div>
    </CouncilorLayout>
  );
}

export default SectionManagement;