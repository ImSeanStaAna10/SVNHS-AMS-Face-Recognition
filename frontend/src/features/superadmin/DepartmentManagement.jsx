import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useQueryClient,
} from "@tanstack/react-query";

import SuperAdminLayout from "../../layouts/SuperAdminLayout";

import superAdminService from "../../services/superAdminService";

import {
  useSuperAdminCouncilors,
  useSuperAdminDepartments,
} from "../../hooks/queries/useSuperAdminQueries";

import {
  invalidateSuperAdminDepartmentCache,
} from "../../hooks/queries/invalidateSuperAdminCache";

import "../../styles/superadmin/departments.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_FORM = {
  code: "",
  name: "",
};

const STATUS_FILTERS = [
  {
    value: "ALL",
    label: "All Departments",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "INACTIVE",
    label: "Inactive",
  },
];

const PAGE_SIZE = 10;

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

const sortDepartments = (
  items,
) =>
  [...items].sort(
    (
      first,
      second,
    ) =>
      (
        first.code ??
        first.name ??
        ""
      ).localeCompare(
        second.code ??
          second.name ??
          "",
      ),
  );

/* =========================================================
   PAGINATION HELPER
========================================================= */

const getPaginationItems = (
  currentPage,
  totalPages,
) => {
  if (totalPages <= 5) {
    return Array.from(
      {
        length: totalPages,
      },
      (_, index) =>
        index + 1,
    );
  }

  if (currentPage <= 3) {
    return [
      1,
      2,
      3,
      4,
      "end-ellipsis",
      totalPages,
    ];
  }

  if (
    currentPage >=
    totalPages - 2
  ) {
    return [
      1,
      "start-ellipsis",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "start-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end-ellipsis",
    totalPages,
  ];
};

/* =========================================================
   COMPONENT
========================================================= */

function DepartmentManagement() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  /* =======================================================
     REUSABLE SERVER CACHE
  ======================================================= */

  const departmentsQuery =
    useSuperAdminDepartments();

  const councilorsQuery =
    useSuperAdminCouncilors();

  /* =======================================================
     DATA
  ======================================================= */

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    councilors,
    setCouncilors,
  ] = useState([]);

  /* =======================================================
     PAGE STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  /* =======================================================
     PAGINATION STATE
  ======================================================= */

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  /* =======================================================
     FORM MODAL STATE
  ======================================================= */

  const [
    showFormModal,
    setShowFormModal,
  ] = useState(false);

  const [
    formMode,
    setFormMode,
  ] = useState("create");

  const [
    selectedDepartment,
    setSelectedDepartment,
  ] = useState(null);

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

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* =======================================================
     STATUS MODAL STATE
  ======================================================= */

  const [
    showStatusModal,
    setShowStatusModal,
  ] = useState(false);

  const [
    statusTarget,
    setStatusTarget,
  ] = useState(null);

  const [
    statusError,
    setStatusError,
  ] = useState("");

  const [
    changingStatus,
    setChangingStatus,
  ] = useState(false);

  /* =======================================================
     SERVER CACHE → LOCAL VIEW STATE
  ======================================================= */

  useEffect(() => {
    if (
      departmentsQuery.data !==
      undefined
    ) {
      setDepartments(
        sortDepartments(
          Array.isArray(
            departmentsQuery.data,
          )
            ? departmentsQuery.data
            : [],
        ),
      );
    } else if (
      departmentsQuery.isError
    ) {
      setDepartments([]);
    }

    if (
      councilorsQuery.data !==
      undefined
    ) {
      setCouncilors(
        Array.isArray(
          councilorsQuery.data,
        )
          ? councilorsQuery.data
          : [],
      );
    } else if (
      councilorsQuery.isError
    ) {
      setCouncilors([]);
    }

    const initialLoading =
      (
        departmentsQuery.isFetching &&
        departmentsQuery.data ===
          undefined
      ) ||
      (
        councilorsQuery.isFetching &&
        councilorsQuery.data ===
          undefined
      );

    setLoading(
      initialLoading,
    );

    if (
      departmentsQuery.isError &&
      departmentsQuery.data ===
        undefined
    ) {
      setError(
        getErrorMessage(
          departmentsQuery.error,
          "Unable to load departments.",
        ),
      );

      return;
    }

    if (
      councilorsQuery.isError &&
      councilorsQuery.data ===
        undefined
    ) {
      setError(
        "Departments loaded, but Councilor assignment information is temporarily unavailable.",
      );

      return;
    }

    setError("");
  }, [
    departmentsQuery.data,
    departmentsQuery.error,
    departmentsQuery.isError,
    departmentsQuery.isFetching,
    councilorsQuery.data,
    councilorsQuery.error,
    councilorsQuery.isError,
    councilorsQuery.isFetching,
  ]);

  /* =======================================================
     AUTO-HIDE SUCCESS MESSAGE
  ======================================================= */

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setSuccess("");
        },
        4500,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    success,
  ]);

  /* =======================================================
     MODAL SCROLL LOCK
  ======================================================= */

  useEffect(() => {
    if (
      !showFormModal &&
      !showStatusModal
    ) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    showFormModal,
    showStatusModal,
  ]);

  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  useEffect(() => {
    if (
      !showFormModal &&
      !showStatusModal
    ) {
      return undefined;
    }

    const handleKeyDown = (
      event,
    ) => {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      if (
        showFormModal &&
        !saving
      ) {
        setShowFormModal(
          false,
        );

        setSelectedDepartment(
          null,
        );

        setFormData(
          INITIAL_FORM,
        );

        setFormError("");
      }

      if (
        showStatusModal &&
        !changingStatus
      ) {
        setShowStatusModal(
          false,
        );

        setStatusTarget(
          null,
        );

        setStatusError("");
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    showFormModal,
    showStatusModal,
    saving,
    changingStatus,
  ]);

  /* =======================================================
     METRICS
  ======================================================= */

  const activeDepartments =
    useMemo(
      () =>
        departments.filter(
          (department) =>
            department.active !==
            false,
        ),
      [
        departments,
      ],
    );

  const inactiveDepartments =
    departments.length -
    activeDepartments.length;

  const activeCouncilorDepartmentIds =
    useMemo(
      () =>
        new Set(
          councilors
            .filter(
              (councilor) =>
                councilor.active !==
                false,
            )
            .map(
              (councilor) =>
                councilor.departmentId,
            )
            .filter(Boolean),
        ),
      [
        councilors,
      ],
    );

  const coveredDepartments =
    useMemo(
      () =>
        activeDepartments.filter(
          (department) =>
            activeCouncilorDepartmentIds.has(
              department.id,
            ),
        ).length,
      [
        activeDepartments,
        activeCouncilorDepartmentIds,
      ],
    );

  /* =======================================================
     FILTERED DEPARTMENTS
  ======================================================= */

  const filteredDepartments =
    useMemo(
      () => {
        const normalizedSearch =
          searchTerm
            .trim()
            .toLowerCase();

        return departments.filter(
          (department) => {
            const isActive =
              department.active !==
              false;

            const matchesStatus =
              statusFilter ===
                "ALL" ||
              (
                statusFilter ===
                  "ACTIVE" &&
                isActive
              ) ||
              (
                statusFilter ===
                  "INACTIVE" &&
                !isActive
              );

            if (
              !matchesStatus
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const searchableText =
              [
                department.code,
                department.name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(
              normalizedSearch,
            );
          },
        );
      },
      [
        departments,
        searchTerm,
        statusFilter,
      ],
    );

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredDepartments.length /
          PAGE_SIZE,
      ),
    );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages,
    );

  const pageStartIndex =
    (
      safeCurrentPage - 1
    ) * PAGE_SIZE;

  const pageEndIndex =
    pageStartIndex +
    PAGE_SIZE;

  const paginatedDepartments =
    useMemo(
      () =>
        filteredDepartments.slice(
          pageStartIndex,
          pageEndIndex,
        ),
      [
        filteredDepartments,
        pageStartIndex,
        pageEndIndex,
      ],
    );

  const firstVisibleItem =
    filteredDepartments.length > 0
      ? pageStartIndex + 1
      : 0;

  const lastVisibleItem =
    Math.min(
      pageEndIndex,
      filteredDepartments.length,
    );

  const paginationItems =
    useMemo(
      () =>
        getPaginationItems(
          safeCurrentPage,
          totalPages,
        ),
      [
        safeCurrentPage,
        totalPages,
      ],
    );

  const goToPage = (
    page,
  ) => {
    const nextPage =
      Math.min(
        Math.max(page, 1),
        totalPages,
      );

    setCurrentPage(
      nextPage,
    );
  };

  const handleSearchChange = (
    event,
  ) => {
    setSearchTerm(
      event.target.value,
    );

    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleStatusFilterChange =
    (event) => {
      setStatusFilter(
        event.target.value,
      );

      setCurrentPage(1);
    };

  /* =======================================================
     ACTIVE COUNCILOR LOOKUP
  ======================================================= */

  const getActiveCouncilor = (
    departmentId,
  ) =>
    councilors.find(
      (councilor) =>
        councilor.departmentId ===
          departmentId &&
        councilor.active !==
          false,
    ) ?? null;

  /* =======================================================
     CREATE MODAL
  ======================================================= */

  const openCreateModal = () => {
    setFormMode("create");

    setSelectedDepartment(
      null,
    );

    setFormData(
      INITIAL_FORM,
    );

    setFormError("");
    setSuccess("");

    setShowFormModal(
      true,
    );
  };

  /* =======================================================
     EDIT MODAL
  ======================================================= */

  const openEditModal = (
    department,
  ) => {
    setFormMode("edit");

    setSelectedDepartment(
      department,
    );

    setFormData({
      code:
        department.code ??
        "",
      name:
        department.name ??
        "",
    });

    setFormError("");
    setSuccess("");

    setShowFormModal(
      true,
    );
  };

  /* =======================================================
     CLOSE FORM MODAL
  ======================================================= */

  const closeFormModal = () => {
    if (saving) {
      return;
    }

    setShowFormModal(
      false,
    );

    setSelectedDepartment(
      null,
    );

    setFormData(
      INITIAL_FORM,
    );

    setFormError("");
  };

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const handleFormChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    const nextValue =
      name === "code"
        ? value.toUpperCase()
        : value;

    setFormData(
      (current) => ({
        ...current,
        [name]: nextValue,
      }),
    );

    if (formError) {
      setFormError("");
    }
  };

  /* =======================================================
     FORM VALIDATION
  ======================================================= */

  const validateForm = () => {
    const code =
      formData.code
        .trim()
        .toUpperCase();

    const name =
      formData.name.trim();

    if (
      !code ||
      !name
    ) {
      return {
        valid: false,
        message:
          "Department code and name are required.",
      };
    }

    if (
      code.length > 50
    ) {
      return {
        valid: false,
        message:
          "Department code must not exceed 50 characters.",
      };
    }

    if (
      name.length > 150
    ) {
      return {
        valid: false,
        message:
          "Department name must not exceed 150 characters.",
      };
    }

    return {
      valid: true,
      data: {
        code,
        name,
      },
    };
  };

  /* =======================================================
     SAVE DEPARTMENT
  ======================================================= */

  const handleSaveDepartment =
    async (event) => {
      event.preventDefault();

      const validation =
        validateForm();

      if (
        !validation.valid
      ) {
        setFormError(
          validation.message,
        );

        return;
      }

      try {
        setSaving(true);
        setFormError("");
        setError("");
        setSuccess("");

        if (
          formMode ===
          "create"
        ) {
          const created =
            await superAdminService.createDepartment(
              validation.data,
            );

          setDepartments(
            (current) =>
              sortDepartments([
                ...current,
                created,
              ]),
          );

          void invalidateSuperAdminDepartmentCache(
            queryClient,
          );

          setSuccess(
            `${created.name} was created successfully.`,
          );
        } else {
          const updated =
            await superAdminService.updateDepartment(
              selectedDepartment.id,
              validation.data,
            );

          setDepartments(
            (current) =>
              sortDepartments(
                current.map(
                  (department) =>
                    department.id ===
                    updated.id
                      ? updated
                      : department,
                ),
              ),
          );

          void invalidateSuperAdminDepartmentCache(
            queryClient,
          );

          setSuccess(
            `${updated.name} was updated successfully.`,
          );
        }

        setShowFormModal(
          false,
        );

        setSelectedDepartment(
          null,
        );

        setFormData(
          INITIAL_FORM,
        );
      } catch (saveError) {
        setFormError(
          getErrorMessage(
            saveError,
            formMode ===
              "create"
              ? "Unable to create department."
              : "Unable to update department.",
          ),
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     OPEN STATUS MODAL
  ======================================================= */

  const openStatusModal = (
    department,
  ) => {
    setStatusTarget(
      department,
    );

    setStatusError("");
    setSuccess("");

    setShowStatusModal(
      true,
    );
  };

  /* =======================================================
     CLOSE STATUS MODAL
  ======================================================= */

  const closeStatusModal = () => {
    if (
      changingStatus
    ) {
      return;
    }

    setShowStatusModal(
      false,
    );

    setStatusTarget(
      null,
    );

    setStatusError("");
  };

  /* =======================================================
     STATUS DETAILS
  ======================================================= */

  const statusTargetIsActive =
    statusTarget?.active !==
    false;

  const statusTargetCouncilor =
    statusTarget
      ? getActiveCouncilor(
          statusTarget.id,
        )
      : null;

  const deactivationBlocked =
    Boolean(
      statusTarget &&
        statusTargetIsActive &&
        statusTargetCouncilor,
    );

  /* =======================================================
     UPDATE STATUS
  ======================================================= */

  const handleStatusChange =
    async () => {
      if (
        !statusTarget ||
        deactivationBlocked
      ) {
        return;
      }

      const newActiveStatus =
        !statusTargetIsActive;

      try {
        setChangingStatus(
          true,
        );

        setStatusError("");
        setError("");
        setSuccess("");

        const updated =
          await superAdminService.updateDepartmentStatus(
            statusTarget.id,
            newActiveStatus,
          );

        setDepartments(
          (current) =>
            sortDepartments(
              current.map(
                (department) =>
                  department.id ===
                  updated.id
                    ? updated
                    : department,
              ),
            ),
        );

        void invalidateSuperAdminDepartmentCache(
          queryClient,
        );

        setSuccess(
          `${updated.name} is now ${
            updated.active
              ? "active"
              : "inactive"
          }.`,
        );

        setShowStatusModal(
          false,
        );

        setStatusTarget(
          null,
        );
      } catch (
        statusChangeError
      ) {
        setStatusError(
          getErrorMessage(
            statusChangeError,
            "Unable to update department status.",
          ),
        );
      } finally {
        setChangingStatus(
          false,
        );
      }
    };

  /* =======================================================
     MANAGE COUNCILORS
  ======================================================= */

  const handleManageCouncilors =
    () => {
      setShowStatusModal(
        false,
      );

      setStatusTarget(
        null,
      );

      navigate(
        "/superadmin/councilors",
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SuperAdminLayout
      title="Departments"
      eyebrow="SUPERADMIN PORTAL"
      description="Department Administration"
    >
      <section className="superadmin-departments">
        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <header className="superadmin-departments-header">
          <div className="superadmin-departments-header-copy">
            <span className="superadmin-departments-kicker">
              ORGANIZATIONAL STRUCTURE
            </span>

            <h2>
              Department Management
            </h2>

            <p>
              Create and maintain the
              departments that organize
              Councilor accounts and
              school attendance
              administration.
            </p>
          </div>

          <div className="superadmin-departments-header-actions">
            <button
              type="button"
              className="superadmin-departments-create"
              onClick={
                openCreateModal
              }
            >
              <span
                aria-hidden="true"
              >
                +
              </span>

              New Department
            </button>
          </div>
        </header>

        {/* =================================================
            ALERTS
        ================================================== */}

        {success && (
          <div
            className="superadmin-departments-alert success"
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
                Update successful
              </strong>

              <p>
                {success}
              </p>
            </div>

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

        {error && (
          <div
            className="superadmin-departments-alert error"
            role="alert"
          >
            <span
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Unable to load all
                information
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Dismiss error message"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================== */}

        <section
          className="superadmin-departments-summary"
          aria-label="Department summary"
        >
          <article>
            <div className="superadmin-departments-summary-icon">
              ▤
            </div>

            <div>
              <span>
                TOTAL
              </span>

              <strong>
                {loading
                  ? "—"
                  : departments.length}
              </strong>

              <p>
                Registered departments
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-departments-summary-icon active">
              ✓
            </div>

            <div>
              <span>
                ACTIVE
              </span>

              <strong>
                {loading
                  ? "—"
                  : activeDepartments.length}
              </strong>

              <p>
                Available departments
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-departments-summary-icon inactive">
              —
            </div>

            <div>
              <span>
                INACTIVE
              </span>

              <strong>
                {loading
                  ? "—"
                  : inactiveDepartments}
              </strong>

              <p>
                Disabled departments
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-departments-summary-icon coverage">
              ◎
            </div>

            <div>
              <span>
                COVERED
              </span>

              <strong>
                {loading
                  ? "—"
                  : coveredDepartments}
              </strong>

              <p>
                With active Councilor
              </p>
            </div>
          </article>
        </section>

        {/* =================================================
            DIRECTORY PANEL
        ================================================== */}

        <section className="superadmin-departments-panel">
          <div className="superadmin-departments-panel-header">
            <div>
              <span>
                DEPARTMENT DIRECTORY
              </span>

              <h3>
                School Departments
              </h3>

              <p>
                Manage department
                identity, Councilor
                assignment visibility,
                and availability.
              </p>
            </div>

            <div className="superadmin-departments-result-count">
              {loading
                ? "Loading departments..."
                : `${filteredDepartments.length} result${
                    filteredDepartments.length ===
                    1
                      ? ""
                      : "s"
                  }`}
            </div>
          </div>

          {/* ===============================================
              TOOLBAR
          ================================================ */}

          <div className="superadmin-departments-toolbar">
            <div className="superadmin-departments-search">
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  searchTerm
                }
                onChange={
                  handleSearchChange
                }
                placeholder="Search by code or department name..."
                aria-label="Search departments"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  aria-label="Clear department search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="superadmin-departments-filter">
              <label htmlFor="department-status-filter">
                Status
              </label>

              <select
                id="department-status-filter"
                value={
                  statusFilter
                }
                onChange={
                  handleStatusFilterChange
                }
              >
                {STATUS_FILTERS.map(
                  (filter) => (
                    <option
                      key={
                        filter.value
                      }
                      value={
                        filter.value
                      }
                    >
                      {
                        filter.label
                      }
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {/* ===============================================
              CONTENT
          ================================================ */}

          {loading ? (
            <div className="superadmin-departments-loading">
              <div className="superadmin-departments-spinner" />

              <strong>
                Loading departments
              </strong>

              <p>
                Retrieving the current
                department directory.
              </p>
            </div>
          ) : filteredDepartments.length ===
            0 ? (
            <div className="superadmin-departments-empty">
              <div className="superadmin-departments-empty-icon">
                ▤
              </div>

              <strong>
                {departments.length ===
                0
                  ? "No departments yet"
                  : "No matching departments"}
              </strong>

              <p>
                {departments.length ===
                0
                  ? "Create the first department to begin organizing Councilor accounts."
                  : "Try changing your search or status filter."}
              </p>

              {departments.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                >
                  Create Department
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="superadmin-departments-table-wrapper">
                <table className="superadmin-departments-table">
                  <thead>
                    <tr>
                      <th>
                        Department
                      </th>

                      <th>
                        Code
                      </th>

                      <th>
                        Active Councilor
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedDepartments.map(
                      (
                        department,
                        index,
                      ) => {
                        const isActive =
                          department.active !==
                          false;

                        const activeCouncilor =
                          getActiveCouncilor(
                            department.id,
                          );

                        return (
                          <tr
                            key={
                              department.id
                            }
                            style={{
                              "--department-row-index":
                                index,
                            }}
                          >
                            <td data-label="Department">
                              <div className="superadmin-departments-identity">
                                <div className="superadmin-departments-code-avatar">
                                  {department.code
                                    ?.trim()
                                    ?.charAt(
                                      0,
                                    )
                                    ?.toUpperCase() ||
                                    "D"}
                                </div>

                                <div>
                                  <strong>
                                    {
                                      department.name
                                    }
                                  </strong>

                                  <span>
                                    Department
                                    administration
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td data-label="Code">
                              <span className="superadmin-departments-code-badge">
                                {
                                  department.code
                                }
                              </span>
                            </td>

                            <td data-label="Active Councilor">
                              {activeCouncilor ? (
                                <div className="superadmin-departments-councilor">
                                  <div className="superadmin-departments-councilor-avatar">
                                    {activeCouncilor.name
                                      ?.trim()
                                      ?.charAt(
                                        0,
                                      )
                                      ?.toUpperCase() ||
                                      "C"}
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        activeCouncilor.name
                                      }
                                    </strong>

                                    <span>
                                      {
                                        activeCouncilor.email
                                      }
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="superadmin-departments-unassigned">
                                  <span
                                    aria-hidden="true"
                                  />

                                  No active
                                  Councilor
                                </span>
                              )}
                            </td>

                            <td data-label="Status">
                              <span
                                className={`superadmin-departments-status ${
                                  isActive
                                    ? "active"
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

                            <td data-label="Actions">
                              <div className="superadmin-departments-actions">
                                <button
                                  type="button"
                                  className="edit"
                                  onClick={() =>
                                    openEditModal(
                                      department,
                                    )
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className={
                                    isActive
                                      ? "deactivate"
                                      : "activate"
                                  }
                                  onClick={() =>
                                    openStatusModal(
                                      department,
                                    )
                                  }
                                >
                                  {isActive
                                    ? "Deactivate"
                                    : "Activate"}
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

              {/* ===========================================
                  PAGINATION
              ============================================ */}

              <nav
                className="superadmin-departments-pagination"
                aria-label="Department pagination"
              >
                <div className="superadmin-departments-pagination-info">
                  Showing{" "}
                  <strong>
                    {firstVisibleItem}
                  </strong>
                  {" – "}
                  <strong>
                    {lastVisibleItem}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {
                      filteredDepartments.length
                    }
                  </strong>
                </div>

                <div className="superadmin-departments-pagination-controls">
                  <button
                    type="button"
                    className="pagination-nav"
                    onClick={() =>
                      goToPage(
                        safeCurrentPage -
                          1,
                      )
                    }
                    disabled={
                      safeCurrentPage ===
                      1
                    }
                    aria-label="Previous page"
                  >
                    ‹
                    <span>
                      Previous
                    </span>
                  </button>

                  <div className="superadmin-departments-pagination-pages">
                    {paginationItems.map(
                      (item) => {
                        if (
                          typeof item !==
                          "number"
                        ) {
                          return (
                            <span
                              key={
                                item
                              }
                              className="pagination-ellipsis"
                              aria-hidden="true"
                            >
                              …
                            </span>
                          );
                        }

                        return (
                          <button
                            key={
                              item
                            }
                            type="button"
                            className={`pagination-page ${
                              item ===
                              safeCurrentPage
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              goToPage(
                                item,
                              )
                            }
                            aria-label={`Go to page ${item}`}
                            aria-current={
                              item ===
                              safeCurrentPage
                                ? "page"
                                : undefined
                            }
                          >
                            {item}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <button
                    type="button"
                    className="pagination-nav"
                    onClick={() =>
                      goToPage(
                        safeCurrentPage +
                          1,
                      )
                    }
                    disabled={
                      safeCurrentPage ===
                      totalPages
                    }
                    aria-label="Next page"
                  >
                    <span>
                      Next
                    </span>
                    ›
                  </button>
                </div>
              </nav>
            </>
          )}

          {!loading &&
            departments.length >
              0 && (
              <footer className="superadmin-departments-panel-footer">
                <div>
                  <span>
                    {
                      activeDepartments.length
                    }{" "}
                    active
                  </span>

                  <span
                    aria-hidden="true"
                  >
                    •
                  </span>

                  <span>
                    {
                      inactiveDepartments
                    }{" "}
                    inactive
                  </span>
                </div>

                <p>
                  Departments are
                  deactivated rather than
                  permanently deleted to
                  preserve administrative
                  history.
                </p>
              </footer>
            )}
        </section>
      </section>

      {/* =================================================
          CREATE / EDIT MODAL
      ================================================== */}

      {showFormModal && (
        <div
          className="superadmin-departments-modal-backdrop"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeFormModal();
            }
          }}
        >
          <section
            className="superadmin-departments-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="department-form-title"
          >
            <header className="superadmin-departments-modal-header">
              <div>
                <span>
                  {formMode ===
                  "create"
                    ? "NEW DEPARTMENT"
                    : "DEPARTMENT DETAILS"}
                </span>

                <h2 id="department-form-title">
                  {formMode ===
                  "create"
                    ? "Create Department"
                    : "Edit Department"}
                </h2>

                <p>
                  {formMode ===
                  "create"
                    ? "Add a new organizational department to the attendance management system."
                    : "Update the department code or official department name."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeFormModal
                }
                disabled={
                  saving
                }
                aria-label="Close department form"
              >
                ×
              </button>
            </header>

            <form
              className="superadmin-departments-form"
              onSubmit={
                handleSaveDepartment
              }
              noValidate
            >
              <div className="superadmin-departments-form-notice">
                <span
                  aria-hidden="true"
                >
                  i
                </span>

                <div>
                  <strong>
                    Department identity
                  </strong>

                  <p>
                    Department codes
                    should be short and
                    recognizable, such
                    as ICT or TVL.
                  </p>
                </div>
              </div>

              <div className="superadmin-departments-field">
                <label htmlFor="department-code">
                  Department Code
                </label>

                <input
                  id="department-code"
                  name="code"
                  type="text"
                  value={
                    formData.code
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Example: ICT"
                  maxLength={50}
                  autoComplete="off"
                  disabled={
                    saving
                  }
                  autoFocus
                />

                <span>
                  Maximum 50 characters.
                </span>
              </div>

              <div className="superadmin-departments-field">
                <label htmlFor="department-name">
                  Department Name
                </label>

                <input
                  id="department-name"
                  name="name"
                  type="text"
                  value={
                    formData.name
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Example: ICT Department"
                  maxLength={150}
                  autoComplete="off"
                  disabled={
                    saving
                  }
                />

                <span>
                  Use the official
                  department name.
                </span>
              </div>

              {formError && (
                <div
                  className="superadmin-departments-form-error"
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

              <div className="superadmin-departments-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={
                    closeFormModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    saving
                  }
                >
                  {saving && (
                    <span className="superadmin-departments-button-spinner" />
                  )}

                  {saving
                    ? formMode ===
                      "create"
                      ? "Creating..."
                      : "Saving..."
                    : formMode ===
                        "create"
                      ? "Create Department"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* =================================================
          STATUS MODAL
      ================================================== */}

      {showStatusModal &&
        statusTarget && (
          <div
            className="superadmin-departments-modal-backdrop"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeStatusModal();
              }
            }}
          >
            <section
              className="superadmin-departments-status-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="department-status-title"
            >
              <div
                className={`superadmin-departments-status-modal-icon ${
                  statusTargetIsActive
                    ? "deactivate"
                    : "activate"
                }`}
                aria-hidden="true"
              >
                {statusTargetIsActive
                  ? "!"
                  : "✓"}
              </div>

              <span className="superadmin-departments-status-modal-kicker">
                DEPARTMENT STATUS
              </span>

              <h2 id="department-status-title">
                {statusTargetIsActive
                  ? "Deactivate Department?"
                  : "Activate Department?"}
              </h2>

              <p>
                {statusTargetIsActive
                  ? `You are about to deactivate ${statusTarget.name}.`
                  : `You are about to reactivate ${statusTarget.name}.`}
              </p>

              <div className="superadmin-departments-status-summary">
                <div>
                  <span>
                    CODE
                  </span>

                  <strong>
                    {
                      statusTarget.code
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    CURRENT STATUS
                  </span>

                  <strong>
                    {statusTargetIsActive
                      ? "Active"
                      : "Inactive"}
                  </strong>
                </div>
              </div>

              {deactivationBlocked && (
                <div className="superadmin-departments-blocked">
                  <span
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <strong>
                      Deactivation
                      blocked
                    </strong>

                    <p>
                      {
                        statusTargetCouncilor.name
                      }{" "}
                      is currently the
                      active Councilor
                      for this department.
                      Deactivate or
                      reassign the
                      Councilor first.
                    </p>
                  </div>
                </div>
              )}

              {!deactivationBlocked && (
                <div className="superadmin-departments-status-notice">
                  <span
                    aria-hidden="true"
                  >
                    i
                  </span>

                  <p>
                    {statusTargetIsActive
                      ? "The department will remain in the system and historical records will be preserved."
                      : "The department will become available again for administrative assignment."}
                  </p>
                </div>
              )}

              {statusError && (
                <div
                  className="superadmin-departments-form-error"
                  role="alert"
                >
                  <span
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <p>
                    {statusError}
                  </p>
                </div>
              )}

              <div className="superadmin-departments-status-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={
                    closeStatusModal
                  }
                  disabled={
                    changingStatus
                  }
                >
                  Cancel
                </button>

                {deactivationBlocked ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={
                      handleManageCouncilors
                    }
                  >
                    Manage Councilors
                  </button>
                ) : (
                  <button
                    type="button"
                    className={
                      statusTargetIsActive
                        ? "danger"
                        : "primary"
                    }
                    onClick={
                      handleStatusChange
                    }
                    disabled={
                      changingStatus
                    }
                  >
                    {changingStatus && (
                      <span className="superadmin-departments-button-spinner" />
                    )}

                    {changingStatus
                      ? "Updating..."
                      : statusTargetIsActive
                        ? "Deactivate"
                        : "Activate"}
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
    </SuperAdminLayout>
  );
}

export default DepartmentManagement;