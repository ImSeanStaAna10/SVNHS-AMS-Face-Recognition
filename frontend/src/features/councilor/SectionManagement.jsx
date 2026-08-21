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

const INITIAL_EDIT_FORM = {
  name: "",
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

const validateSectionForm = (
  data,
) => {
  const name =
    data.name.trim();

  const adviserId =
    data.adviserId.trim();

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

/* =========================================================
   COMPONENT
========================================================= */

function SectionManagement() {
  /* =======================================================
     DATA STATE
  ======================================================= */

  const [
    sections,
    setSections,
  ] = useState([]);

  const [
    advisers,
    setAdvisers,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  /* =======================================================
     REQUEST STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    updating,
    setUpdating,
  ] = useState(false);

  const [
    dataStatus,
    setDataStatus,
  ] = useState(
    INITIAL_DATA_STATUS,
  );

  /* =======================================================
     FEEDBACK STATE
  ======================================================= */

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* =======================================================
     CREATE MODAL STATE
  ======================================================= */

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    formData,
    setFormData,
  ] = useState(
    INITIAL_FORM,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  /* =======================================================
     EDIT MODAL STATE
  ======================================================= */

  const [
    editingSection,
    setEditingSection,
  ] = useState(null);

  const [
    editFormData,
    setEditFormData,
  ] = useState(
    INITIAL_EDIT_FORM,
  );

  const [
    editError,
    setEditError,
  ] = useState("");

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

        setDataStatus(
          nextStatus,
        );

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

  const modalOpen =
    showModal ||
    Boolean(
      editingSection,
    );

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event,
    ) => {
      if (
        event.key !== "Escape"
      ) {
        return;
      }

      if (
        creating ||
        updating
      ) {
        return;
      }

      setShowModal(false);

      setEditingSection(
        null,
      );

      setFormData(
        INITIAL_FORM,
      );

      setEditFormData(
        INITIAL_EDIT_FORM,
      );

      setFormError("");

      setEditError("");
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
    modalOpen,
    creating,
    updating,
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

  /*
   * FRONTEND ADVISORY RULE:
   * One adviser can only have one ACTIVE advisory section.
   *
   * Advisers already assigned to an ACTIVE section are
   * removed from the Add Section dropdown. The backend is
   * intentionally left unchanged.
   */
  const assignedActiveAdviserIds =
    useMemo(() => {
      return new Set(
        sections
          .filter(
            (section) =>
              section.active !== false &&
              Boolean(section.adviserId),
          )
          .map(
            (section) =>
              section.adviserId,
          ),
      );
    }, [sections]);

  const availableAdvisers =
    useMemo(() => {
      return activeAdvisers.filter(
        (adviser) =>
          !assignedActiveAdviserIds.has(
            adviser.id,
          ),
      );
    }, [
      activeAdvisers,
      assignedActiveAdviserIds,
    ]);

  const hasAvailableAdviser =
    availableAdvisers.length > 0;

  const filteredSections =
    useMemo(() => {
      const keyword =
        search
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

            sections:
              "ready",
          }),
        );

        setError("");

        return data;
      } catch (err) {
        console.error(
          "Unable to refresh sections:",
          err,
        );

        setDataStatus(
          (current) => ({
            ...current,

            sections:
              "error",
          }),
        );

        throw err;
      }
    };

  /* =======================================================
     CREATE FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData(
      INITIAL_FORM,
    );

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

        [name]:
          value,
      }),
    );

    if (formError) {
      setFormError("");
    }
  };

  /* =======================================================
     CREATE MODAL CONTROLS
  ======================================================= */

  const openModal = () => {
    resetForm();

    setEditingSection(
      null,
    );

    setEditError("");

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
     CREATE SECTION
  ======================================================= */

  const handleCreateSection =
    async (event) => {
      event.preventDefault();

      const validation =
        validateSectionForm(
          formData,
        );

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
     EDIT SECTION FORM HELPERS
  ======================================================= */

  const resetEditForm = () => {
    setEditingSection(
      null,
    );

    setEditFormData(
      INITIAL_EDIT_FORM,
    );

    setEditError("");
  };

  const handleEditFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setEditFormData(
        (current) => ({
          ...current,

          [name]:
            value,
        }),
      );

      if (editError) {
        setEditError("");
      }
    };

  /* =======================================================
     EDIT SECTION MODAL
  ======================================================= */

  const openEditSection =
    (section) => {
      if (
        !section?.id ||
        section.active ===
          false
      ) {
        return;
      }

      setShowModal(false);

      setFormError("");

      setError("");

      setSuccess("");

      setEditingSection(
        section,
      );

      setEditFormData({
        name:
          section.name ||
          "",
      });

      setEditError("");
    };

  const closeEditSection =
    () => {
      if (updating) {
        return;
      }

      resetEditForm();
    };

  /* =======================================================
     UPDATE SECTION
     SECTION NAME ONLY
  ======================================================= */

  const handleUpdateSection =
    async (event) => {
      event.preventDefault();

      if (
        !editingSection?.id
      ) {
        setEditError(
          "Section information is unavailable.",
        );

        return;
      }

      const sectionName =
        editFormData.name.trim();

      if (!sectionName) {
        setEditError(
          "Please enter a section name.",
        );

        return;
      }

      /*
       * Adviser reassignment is intentionally NOT allowed
       * from Section Management.
       *
       * The current backend UpdateSectionRequest still
       * requires adviserId, so we safely send the section's
       * existing adviser ID unchanged.
       */
      const existingAdviserId =
        editingSection.adviserId;

      if (!existingAdviserId) {
        setEditError(
          "This section does not have a valid adviser assignment.",
        );

        return;
      }

      const sectionId =
        editingSection.id;

      try {
        setUpdating(true);

        setEditError("");

        setError("");

        setSuccess("");

        const updatedSection =
          await councilorService.updateSection(
            sectionId,
            {
              name:
                sectionName,

              adviserId:
                existingAdviserId,
            },
          );

        /*
         * Immediately update the local table
         * if the backend returns the updated
         * SectionResponse.
         */
        if (
          updatedSection?.id
        ) {
          setSections(
            (
              currentSections,
            ) =>
              currentSections.map(
                (section) =>
                  section.id ===
                  updatedSection.id
                    ? {
                        ...section,
                        ...updatedSection,
                      }
                    : section,
              ),
          );
        }

        /*
         * Refetch to keep everything fully
         * synchronized with the backend.
         */
        try {
          await refreshSections();
        } catch (
          refreshError
        ) {
          console.warn(
            "Unable to refresh sections after update:",
            refreshError,
          );
        }

        resetEditForm();

        setSuccess(
          `${sectionName} was updated successfully.`,
        );
      } catch (err) {
        console.error(
          "Unable to update section:",
          err,
        );

        setEditError(
          getErrorMessage(
            err,
            "Unable to update section.",
          ),
        );
      } finally {
        setUpdating(false);
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
                Organize school
                sections
              </h2>

              <p>
                Create and maintain
                reusable academic
                sections with fixed
                adviser assignments
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
                  Sections with
                  advisers
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
                  Available Advisers
                </p>

                <small>
                  Unassigned and active
                </small>
              </div>

              <strong>
                {loading ||
                !advisersReady
                  ? "—"
                  : formatNumber(
                      availableAdvisers.length,
                    )}
              </strong>
            </article>
          </section>
        </section>

        {/* =================================================
            ASSIGNMENT HEALTH
        ================================================== */}

        {sectionsReady &&
          sections.length >
            0 && (
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
                    Assignment
                    Coverage
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
                sections, fixed adviser
                assignments, and update
                section names when needed.
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
                  !advisersReady
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
                value={
                  search
                }
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
                Fetching school
                section and
                assignment
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
                advisersReady && (
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

                    <th scope="col">
                      ACTIONS
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

                          {/* ACTIONS */}

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",

                                alignItems:
                                  "center",

                                gap:
                                  "8px",

                                flexWrap:
                                  "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="councilor-table-action"
                                disabled={
                                  !isActive
                                }
                                onClick={() =>
                                  openEditSection(
                                    section,
                                  )
                                }
                              >
                                Edit
                              </button>

                            </div>
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
              {/* HEADER */}

              <div className="councilor-modal-header">
                <div>
                  <span>
                    ACADEMIC MANAGEMENT
                  </span>

                  <h2 id="add-section-title">
                    Add Section
                  </h2>

                  <p>
                    Create a new
                    academic section
                    and assign an
                    available adviser.
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

              {/* FORM */}

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
                      !hasAvailableAdviser
                    }
                  >
                    <option value="">
                      Select an
                      adviser
                    </option>

                    {availableAdvisers.map(
                      (adviser) => (
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
                    Only active advisers
                    without a current
                    active advisory class
                    can be selected.
                  </span>
                </div>

                {/* NO ACTIVE ADVISER */}

                {!hasAvailableAdviser && (
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
                      No adviser is
                      currently available.
                      The current backend
                      requires an adviser
                      when a section is
                      created, so another
                      section cannot be
                      created until an
                      eligible adviser is
                      available.
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
                      !hasAvailableAdviser
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

        {/* =================================================
            EDIT SECTION MODAL
        ================================================== */}

        {editingSection && (
          <div
            className="councilor-modal-backdrop"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeEditSection();
              }
            }}
          >
            <div
              className="councilor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-section-title"
            >
              {/* HEADER */}

              <div className="councilor-modal-header">
                <div>
                  <span>
                    ACADEMIC MANAGEMENT
                  </span>

                  <h2 id="edit-section-title">
                    Edit Section
                  </h2>

                  <p>
                    Update the
                    section name while
                    keeping its current
                    adviser assignment.
                  </p>
                </div>

                <button
                  type="button"
                  className="councilor-modal-close"
                  onClick={
                    closeEditSection
                  }
                  disabled={
                    updating
                  }
                  aria-label="Close edit section modal"
                >
                  ×
                </button>
              </div>

              {/* FORM */}

              <form
                className="councilor-modal-form"
                onSubmit={
                  handleUpdateSection
                }
                noValidate
              >
                {/* SECTION NAME */}

                <div className="councilor-modal-field">
                  <label htmlFor="edit-section-name">
                    Section Name
                  </label>

                  <input
                    id="edit-section-name"
                    name="name"
                    type="text"
                    placeholder="e.g. STEM 11 - Newton"
                    value={
                      editFormData.name
                    }
                    onChange={
                      handleEditFormChange
                    }
                    autoComplete="off"
                    disabled={
                      updating
                    }
                    autoFocus
                  />
                </div>

                {/* LOCKED ADVISER ASSIGNMENT */}

                <div className="councilor-modal-field">
                  <span className="section-edit-field-label">
                    Assigned Adviser
                  </span>

                  <div className="section-edit-assignment-lock">
                    <div
                      className="section-edit-assignment-avatar"
                      aria-hidden="true"
                    >
                      {editingSection.adviserName
                        ?.trim()
                        ?.charAt(0)
                        ?.toUpperCase() ||
                        "A"}
                    </div>

                    <div className="section-edit-assignment-copy">
                      <strong>
                        {editingSection.adviserName ||
                          "Assigned adviser unavailable"}
                      </strong>

                      <span>
                        Adviser assignment is locked for this section.
                      </span>
                    </div>

                    <span
                      className="section-edit-lock-badge"
                      aria-label="Adviser assignment locked"
                    >
                      LOCKED
                    </span>
                  </div>

                  <span className="councilor-field-hint">
                    One section is assigned to one adviser. Editing a section
                    only changes its section name.
                  </span>
                </div>

                {/* ERROR */}

                {editError && (
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
                        editError
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
                      closeEditSection
                    }
                    disabled={
                      updating
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="councilor-primary-button"
                    disabled={
                      updating ||
                      !editFormData.name.trim()
                    }
                  >
                    {updating && (
                      <span
                        className="councilor-button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    {updating
                      ? "Saving..."
                      : "Save Changes"}
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