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
  invalidateSuperAdminCouncilorCache,
} from "../../hooks/queries/invalidateSuperAdminCache";

import "../../styles/superadmin/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_CREATE_FORM = {
  name: "",
  email: "",
  password: "",
  departmentId: "",
};

const INITIAL_EDIT_FORM = {
  name: "",
  email: "",
  departmentId: "",
};

const INITIAL_PASSWORD_FORM = {
  newPassword: "",
  confirmPassword: "",
};

const STATUS_FILTERS = [
  {
    value: "ALL",
    label: "All Councilors",
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

const sortCouncilors = (
  items,
) =>
  [...items].sort(
    (first, second) =>
      (
        first.name ??
        first.email ??
        ""
      ).localeCompare(
        second.name ??
          second.email ??
          "",
      ),
  );

const sortDepartments = (
  items,
) =>
  [...items].sort(
    (first, second) =>
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

function CouncilorManagement() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  /* =======================================================
     REUSABLE SERVER CACHE
  ======================================================= */

  const councilorsQuery =
    useSuperAdminCouncilors();

  const departmentsQuery =
    useSuperAdminDepartments();

  /* =======================================================
     DATA
  ======================================================= */

  const [
    councilors,
    setCouncilors,
  ] = useState([]);

  const [
    departments,
    setDepartments,
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
     FILTERS
  ======================================================= */

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("ALL");


  /* =======================================================
     PAGINATION
  ======================================================= */

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  /* =======================================================
     CREATE MODAL
  ======================================================= */

  const [
    showCreateModal,
    setShowCreateModal,
  ] = useState(false);

  const [
    createForm,
    setCreateForm,
  ] = useState(
    INITIAL_CREATE_FORM,
  );

  const [
    createError,
    setCreateError,
  ] = useState("");

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    showCreatePassword,
    setShowCreatePassword,
  ] = useState(false);

  /* =======================================================
     EDIT MODAL
  ======================================================= */

  const [
    showEditModal,
    setShowEditModal,
  ] = useState(false);

  const [
    editTarget,
    setEditTarget,
  ] = useState(null);

  const [
    editForm,
    setEditForm,
  ] = useState(
    INITIAL_EDIT_FORM,
  );

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  /* =======================================================
     STATUS MODAL
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
     RESET PASSWORD MODAL
  ======================================================= */

  const [
    showPasswordModal,
    setShowPasswordModal,
  ] = useState(false);

  const [
    passwordTarget,
    setPasswordTarget,
  ] = useState(null);

  const [
    passwordForm,
    setPasswordForm,
  ] = useState(
    INITIAL_PASSWORD_FORM,
  );

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

  const [
    passwordVisibility,
    setPasswordVisibility,
  ] = useState({
    newPassword: false,
    confirmPassword: false,
  });

  /* =======================================================
     SERVER CACHE → LOCAL VIEW STATE

     The page keeps its existing local arrays because the
     create/edit/status UI already updates those arrays
     immediately. TanStack Query is now the shared server
     state source used across SuperAdmin pages.
  ======================================================= */

  useEffect(() => {
    if (
      councilorsQuery.data !==
      undefined
    ) {
      setCouncilors(
        sortCouncilors(
          Array.isArray(
            councilorsQuery.data,
          )
            ? councilorsQuery.data
            : [],
        ),
      );
    } else if (
      councilorsQuery.isError
    ) {
      setCouncilors([]);
    }

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

    const initialLoading =
      (
        councilorsQuery.isFetching &&
        councilorsQuery.data ===
          undefined
      ) ||
      (
        departmentsQuery.isFetching &&
        departmentsQuery.data ===
          undefined
      );

    setLoading(
      initialLoading,
    );

    if (
      councilorsQuery.isError &&
      councilorsQuery.data ===
        undefined
    ) {
      setError(
        getErrorMessage(
          councilorsQuery.error,
          "Unable to load Councilor accounts.",
        ),
      );

      return;
    }

    if (
      departmentsQuery.isError &&
      departmentsQuery.data ===
        undefined
    ) {
      setError(
        "Councilor accounts loaded, but department information is temporarily unavailable.",
      );

      return;
    }

    setError("");
  }, [
    councilorsQuery.data,
    councilorsQuery.error,
    councilorsQuery.isError,
    councilorsQuery.isFetching,
    departmentsQuery.data,
    departmentsQuery.error,
    departmentsQuery.isError,
    departmentsQuery.isFetching,
  ]);

  /* =======================================================
     AUTO-HIDE SUCCESS
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

  const anyModalOpen =
    showCreateModal ||
    showEditModal ||
    showStatusModal ||
    showPasswordModal;

  useEffect(() => {
    if (!anyModalOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    anyModalOpen,
  ]);

  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  useEffect(() => {
    if (!anyModalOpen) {
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
        showCreateModal &&
        !creating
      ) {
        setShowCreateModal(
          false,
        );

        setCreateForm(
          INITIAL_CREATE_FORM,
        );

        setCreateError("");

        setShowCreatePassword(
          false,
        );

        return;
      }

      if (
        showEditModal &&
        !savingEdit
      ) {
        setShowEditModal(
          false,
        );

        setEditTarget(
          null,
        );

        setEditForm(
          INITIAL_EDIT_FORM,
        );

        setEditError("");

        return;
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

        return;
      }

      if (
        showPasswordModal &&
        !resettingPassword
      ) {
        setShowPasswordModal(
          false,
        );

        setPasswordTarget(
          null,
        );

        setPasswordForm(
          INITIAL_PASSWORD_FORM,
        );

        setPasswordError("");

        setPasswordVisibility({
          newPassword: false,
          confirmPassword: false,
        });
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
    anyModalOpen,
    showCreateModal,
    showEditModal,
    showStatusModal,
    showPasswordModal,
    creating,
    savingEdit,
    changingStatus,
    resettingPassword,
  ]);

  /* =======================================================
     METRICS
  ======================================================= */

  const activeCouncilors =
    useMemo(
      () =>
        councilors.filter(
          (councilor) =>
            councilor.active !==
            false,
        ),
      [
        councilors,
      ],
    );

  const inactiveCouncilors =
    councilors.length -
    activeCouncilors.length;

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

  const occupiedDepartmentIds =
    useMemo(
      () =>
        new Set(
          activeCouncilors
            .map(
              (councilor) =>
                councilor.departmentId,
            )
            .filter(Boolean),
        ),
      [
        activeCouncilors,
      ],
    );

  const availableDepartments =
    useMemo(
      () =>
        activeDepartments.filter(
          (department) =>
            !occupiedDepartmentIds.has(
              department.id,
            ),
        ),
      [
        activeDepartments,
        occupiedDepartmentIds,
      ],
    );

  /* =======================================================
     DEPARTMENT LOOKUP
  ======================================================= */

  const departmentMap =
    useMemo(
      () =>
        new Map(
          departments.map(
            (department) => [
              department.id,
              department,
            ],
          ),
        ),
      [
        departments,
      ],
    );

  /* =======================================================
     FILTERED COUNCILORS
  ======================================================= */

  const filteredCouncilors =
    useMemo(
      () => {
        const normalizedSearch =
          searchTerm
            .trim()
            .toLowerCase();

        return councilors.filter(
          (councilor) => {
            const isActive =
              councilor.active !==
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
              departmentFilter !==
                "ALL" &&
              councilor.departmentId !==
                departmentFilter
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
                councilor.name,
                councilor.email,
                councilor.departmentCode,
                councilor.departmentName,
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
        councilors,
        searchTerm,
        statusFilter,
        departmentFilter,
      ],
    );

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredCouncilors.length /
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

  const paginatedCouncilors =
    useMemo(
      () =>
        filteredCouncilors.slice(
          pageStartIndex,
          pageEndIndex,
        ),
      [
        filteredCouncilors,
        pageStartIndex,
        pageEndIndex,
      ],
    );

  const firstVisibleItem =
    filteredCouncilors.length > 0
      ? pageStartIndex + 1
      : 0;

  const lastVisibleItem =
    Math.min(
      pageEndIndex,
      filteredCouncilors.length,
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

  const handleDepartmentFilterChange =
    (event) => {
      setDepartmentFilter(
        event.target.value,
      );

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
     CREATE MODAL
  ======================================================= */

  const openCreateModal = () => {
    setCreateForm(
      INITIAL_CREATE_FORM,
    );

    setCreateError("");
    setSuccess("");

    setShowCreatePassword(
      false,
    );

    setShowCreateModal(
      true,
    );
  };

  const closeCreateModal = () => {
    if (creating) {
      return;
    }

    setShowCreateModal(
      false,
    );

    setCreateForm(
      INITIAL_CREATE_FORM,
    );

    setCreateError("");

    setShowCreatePassword(
      false,
    );
  };

  const handleCreateChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    setCreateForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

    if (createError) {
      setCreateError("");
    }
  };

  const validateCreateForm =
    () => {
      const name =
        createForm.name.trim();

      const email =
        createForm.email
          .trim()
          .toLowerCase();

      const password =
        createForm.password;

      const departmentId =
        createForm.departmentId;

      if (
        !name ||
        !email ||
        !password ||
        !departmentId
      ) {
        return {
          valid: false,
          message:
            "Name, email, password, and department are required.",
        };
      }

      if (
        name.length > 150
      ) {
        return {
          valid: false,
          message:
            "Councilor name must not exceed 150 characters.",
        };
      }

      if (
        !email.includes("@")
      ) {
        return {
          valid: false,
          message:
            "Enter a valid email address.",
        };
      }

      if (
        password.length < 8
      ) {
        return {
          valid: false,
          message:
            "Password must be at least 8 characters.",
        };
      }

      const department =
        departmentMap.get(
          departmentId,
        );

      if (!department) {
        return {
          valid: false,
          message:
            "Selected department was not found.",
        };
      }

      if (
        department.active ===
        false
      ) {
        return {
          valid: false,
          message:
            "The selected department is inactive.",
        };
      }

      if (
        occupiedDepartmentIds.has(
          departmentId,
        )
      ) {
        return {
          valid: false,
          message:
            "The selected department already has an active Councilor.",
        };
      }

      return {
        valid: true,
        data: {
          name,
          email,
          password,
          departmentId,
        },
      };
    };

  const handleCreateCouncilor =
    async (event) => {
      event.preventDefault();

      const validation =
        validateCreateForm();

      if (
        !validation.valid
      ) {
        setCreateError(
          validation.message,
        );

        return;
      }

      try {
        setCreating(true);
        setCreateError("");
        setError("");
        setSuccess("");

        const created =
          await superAdminService.createCouncilor(
            validation.data,
          );

        setCouncilors(
          (current) =>
            sortCouncilors([
              ...current,
              created,
            ]),
        );

        /*
         * Keep every SuperAdmin page synchronized.
         */
        void invalidateSuperAdminCouncilorCache(
          queryClient,
        );

        setSuccess(
          `${created.name} was created successfully.`,
        );

        setShowCreateModal(
          false,
        );

        setCreateForm(
          INITIAL_CREATE_FORM,
        );

        setShowCreatePassword(
          false,
        );
      } catch (createRequestError) {
        setCreateError(
          getErrorMessage(
            createRequestError,
            "Unable to create Councilor account.",
          ),
        );
      } finally {
        setCreating(false);
      }
    };

  /* =======================================================
     EDIT MODAL
  ======================================================= */

  const openEditModal = (
    councilor,
  ) => {
    setEditTarget(
      councilor,
    );

    setEditForm({
      name:
        councilor.name ??
        "",
      email:
        councilor.email ??
        "",
      departmentId:
        councilor.departmentId ??
        "",
    });

    setEditError("");
    setSuccess("");

    setShowEditModal(
      true,
    );
  };

  const closeEditModal = () => {
    if (savingEdit) {
      return;
    }

    setShowEditModal(
      false,
    );

    setEditTarget(
      null,
    );

    setEditForm(
      INITIAL_EDIT_FORM,
    );

    setEditError("");
  };

  const handleEditChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    setEditForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

    if (editError) {
      setEditError("");
    }
  };

  /* =======================================================
     EDIT DEPARTMENT CONFLICT
  ======================================================= */

  const editTargetIsActive =
    editTarget?.active !==
    false;

  const editDepartmentOccupiedByOther =
    (
      departmentId,
    ) =>
      activeCouncilors.some(
        (councilor) =>
          councilor.departmentId ===
            departmentId &&
          councilor.id !==
            editTarget?.id,
      );

  const validateEditForm =
    () => {
      const name =
        editForm.name.trim();

      const email =
        editForm.email
          .trim()
          .toLowerCase();

      const departmentId =
        editForm.departmentId;

      if (
        !name ||
        !email ||
        !departmentId
      ) {
        return {
          valid: false,
          message:
            "Name, email, and department are required.",
        };
      }

      if (
        name.length > 150
      ) {
        return {
          valid: false,
          message:
            "Councilor name must not exceed 150 characters.",
        };
      }

      if (
        !email.includes("@")
      ) {
        return {
          valid: false,
          message:
            "Enter a valid email address.",
        };
      }

      const department =
        departmentMap.get(
          departmentId,
        );

      if (!department) {
        return {
          valid: false,
          message:
            "Selected department was not found.",
        };
      }

      if (
        department.active ===
        false
      ) {
        return {
          valid: false,
          message:
            "Councilors can only be assigned to active departments.",
        };
      }

      if (
        editTargetIsActive &&
        editDepartmentOccupiedByOther(
          departmentId,
        )
      ) {
        return {
          valid: false,
          message:
            "The selected department already has another active Councilor.",
        };
      }

      return {
        valid: true,
        data: {
          name,
          email,
          departmentId,
        },
      };
    };

  const handleSaveEdit =
    async (event) => {
      event.preventDefault();

      if (!editTarget) {
        return;
      }

      const validation =
        validateEditForm();

      if (
        !validation.valid
      ) {
        setEditError(
          validation.message,
        );

        return;
      }

      try {
        setSavingEdit(true);
        setEditError("");
        setError("");
        setSuccess("");

        const updated =
          await superAdminService.updateCouncilor(
            editTarget.id,
            validation.data,
          );

        setCouncilors(
          (current) =>
            sortCouncilors(
              current.map(
                (councilor) =>
                  councilor.id ===
                  updated.id
                    ? updated
                    : councilor,
              ),
            ),
        );

        void invalidateSuperAdminCouncilorCache(
          queryClient,
        );

        setSuccess(
          `${updated.name} was updated successfully.`,
        );

        setShowEditModal(
          false,
        );

        setEditTarget(
          null,
        );

        setEditForm(
          INITIAL_EDIT_FORM,
        );
      } catch (editRequestError) {
        setEditError(
          getErrorMessage(
            editRequestError,
            "Unable to update Councilor account.",
          ),
        );
      } finally {
        setSavingEdit(false);
      }
    };

  /* =======================================================
     STATUS MODAL
  ======================================================= */

  const openStatusModal = (
    councilor,
  ) => {
    setStatusTarget(
      councilor,
    );

    setStatusError("");
    setSuccess("");

    setShowStatusModal(
      true,
    );
  };

  const closeStatusModal = () => {
    if (changingStatus) {
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

  const statusTargetIsActive =
    statusTarget?.active !==
    false;

  const statusTargetDepartment =
    statusTarget
      ? departmentMap.get(
          statusTarget.departmentId,
        )
      : null;

  const statusTargetDepartmentInactive =
    statusTarget &&
    !statusTargetIsActive &&
    (
      !statusTargetDepartment ||
      statusTargetDepartment.active ===
        false
    );

  const statusTargetHasConflict =
    Boolean(
      statusTarget &&
        !statusTargetIsActive &&
        activeCouncilors.some(
          (councilor) =>
            councilor.id !==
              statusTarget.id &&
            councilor.departmentId ===
              statusTarget.departmentId,
        ),
    );

  const activationBlocked =
    statusTargetDepartmentInactive ||
    statusTargetHasConflict;

  const handleStatusChange =
    async () => {
      if (
        !statusTarget ||
        (
          !statusTargetIsActive &&
          activationBlocked
        )
      ) {
        return;
      }

      const nextActive =
        !statusTargetIsActive;

      try {
        setChangingStatus(
          true,
        );

        setStatusError("");
        setError("");
        setSuccess("");

        const updated =
          await superAdminService.updateCouncilorStatus(
            statusTarget.id,
            nextActive,
          );

        setCouncilors(
          (current) =>
            sortCouncilors(
              current.map(
                (councilor) =>
                  councilor.id ===
                  updated.id
                    ? updated
                    : councilor,
              ),
            ),
        );

        void invalidateSuperAdminCouncilorCache(
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
      } catch (statusRequestError) {
        setStatusError(
          getErrorMessage(
            statusRequestError,
            "Unable to update Councilor status.",
          ),
        );
      } finally {
        setChangingStatus(
          false,
        );
      }
    };

  /* =======================================================
     PASSWORD RESET MODAL
  ======================================================= */

  const openPasswordModal = (
    councilor,
  ) => {
    setPasswordTarget(
      councilor,
    );

    setPasswordForm(
      INITIAL_PASSWORD_FORM,
    );

    setPasswordError("");
    setSuccess("");

    setPasswordVisibility({
      newPassword: false,
      confirmPassword: false,
    });

    setShowPasswordModal(
      true,
    );
  };

  const closePasswordModal = () => {
    if (resettingPassword) {
      return;
    }

    setShowPasswordModal(
      false,
    );

    setPasswordTarget(
      null,
    );

    setPasswordForm(
      INITIAL_PASSWORD_FORM,
    );

    setPasswordError("");

    setPasswordVisibility({
      newPassword: false,
      confirmPassword: false,
    });
  };

  const handlePasswordChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    setPasswordForm(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

    if (passwordError) {
      setPasswordError("");
    }
  };

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

  const validatePasswordForm =
    () => {
      const {
        newPassword,
        confirmPassword,
      } = passwordForm;

      if (
        !newPassword ||
        !confirmPassword
      ) {
        return {
          valid: false,
          message:
            "Enter and confirm the new password.",
        };
      }

      if (
        newPassword.length < 8
      ) {
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
            "New password and confirmation do not match.",
        };
      }

      return {
        valid: true,
        newPassword,
      };
    };

  const handleResetPassword =
    async (event) => {
      event.preventDefault();

      if (!passwordTarget) {
        return;
      }

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
        setResettingPassword(
          true,
        );

        setPasswordError("");
        setError("");
        setSuccess("");

        await superAdminService.resetCouncilorPassword(
          passwordTarget.id,
          validation.newPassword,
        );

        setSuccess(
          `Password for ${passwordTarget.name} was reset successfully.`,
        );

        setShowPasswordModal(
          false,
        );

        setPasswordTarget(
          null,
        );

        setPasswordForm(
          INITIAL_PASSWORD_FORM,
        );

        setPasswordVisibility({
          newPassword: false,
          confirmPassword: false,
        });
      } catch (passwordRequestError) {
        setPasswordError(
          getErrorMessage(
            passwordRequestError,
            "Unable to reset Councilor password.",
          ),
        );
      } finally {
        setResettingPassword(
          false,
        );
      }
    };

  /* =======================================================
     DEPARTMENT MANAGEMENT
  ======================================================= */

  const goToDepartments = () => {
    closeStatusModal();

    navigate(
      "/superadmin/departments",
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SuperAdminLayout
      title="Councilors"
      eyebrow="SUPERADMIN PORTAL"
      description="Councilor Administration"
    >
      <section className="superadmin-councilors">
        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <header className="superadmin-councilors-header">
          <div className="superadmin-councilors-header-copy">
            <span className="superadmin-councilors-kicker">
              ADMINISTRATIVE ACCOUNTS
            </span>

            <h2>
              Councilor Management
            </h2>

            <p>
              Create and maintain
              department Councilor
              accounts, control account
              availability, manage
              assignments, and reset
              credentials when needed.
            </p>
          </div>

          <div className="superadmin-councilors-header-actions">
            <button
              type="button"
              className="superadmin-councilors-create"
              onClick={
                openCreateModal
              }
            >
              <span
                aria-hidden="true"
              >
                +
              </span>

              New Councilor
            </button>
          </div>
        </header>

        {/* =================================================
            ALERTS
        ================================================== */}

        {success && (
          <div
            className="superadmin-councilors-alert success"
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
            className="superadmin-councilors-alert error"
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
          className="superadmin-councilors-summary"
          aria-label="Councilor summary"
        >
          <article>
            <div className="superadmin-councilors-summary-icon">
              ♙
            </div>

            <div>
              <span>
                TOTAL
              </span>

              <strong>
                {loading
                  ? "—"
                  : councilors.length}
              </strong>

              <p>
                Councilor accounts
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-councilors-summary-icon active">
              ✓
            </div>

            <div>
              <span>
                ACTIVE
              </span>

              <strong>
                {loading
                  ? "—"
                  : activeCouncilors.length}
              </strong>

              <p>
                Available accounts
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-councilors-summary-icon inactive">
              —
            </div>

            <div>
              <span>
                INACTIVE
              </span>

              <strong>
                {loading
                  ? "—"
                  : inactiveCouncilors}
              </strong>

              <p>
                Disabled accounts
              </p>
            </div>
          </article>

          <article>
            <div className="superadmin-councilors-summary-icon available">
              ◎
            </div>

            <div>
              <span>
                AVAILABLE
              </span>

              <strong>
                {loading
                  ? "—"
                  : availableDepartments.length}
              </strong>

              <p>
                Departments without
                active Councilor
              </p>
            </div>
          </article>
        </section>

        {/* =================================================
            DIRECTORY
        ================================================== */}

        <section className="superadmin-councilors-panel">
          <div className="superadmin-councilors-panel-header">
            <div>
              <span>
                COUNCILOR DIRECTORY
              </span>

              <h3>
                Department Administrators
              </h3>

              <p>
                Review Councilor account
                status, department
                assignment, and account
                management actions.
              </p>
            </div>

            <div className="superadmin-councilors-result-count">
              {loading
                ? "Loading Councilors..."
                : `${filteredCouncilors.length} result${
                    filteredCouncilors.length ===
                    1
                      ? ""
                      : "s"
                  }`}
            </div>
          </div>

          {/* ===============================================
              FILTER TOOLBAR
          ================================================ */}

          <div className="superadmin-councilors-toolbar">
            <div className="superadmin-councilors-search">
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
                placeholder="Search name, email, or department..."
                aria-label="Search Councilors"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  aria-label="Clear Councilor search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="superadmin-councilors-filter">
              <label htmlFor="councilor-department-filter">
                Department
              </label>

              <select
                id="councilor-department-filter"
                value={
                  departmentFilter
                }
                onChange={
                  handleDepartmentFilterChange
                }
              >
                <option value="ALL">
                  All Departments
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {department.code} —{" "}
                      {department.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="superadmin-councilors-filter">
              <label htmlFor="councilor-status-filter">
                Status
              </label>

              <select
                id="councilor-status-filter"
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
              LOADING
          ================================================ */}

          {loading ? (
            <div className="superadmin-councilors-loading">
              <div className="superadmin-councilors-spinner" />

              <strong>
                Loading Councilors
              </strong>

              <p>
                Retrieving the current
                Councilor directory.
              </p>
            </div>
          ) : filteredCouncilors.length ===
            0 ? (
            <div className="superadmin-councilors-empty">
              <div className="superadmin-councilors-empty-icon">
                ♙
              </div>

              <strong>
                {councilors.length ===
                0
                  ? "No Councilor accounts yet"
                  : "No matching Councilors"}
              </strong>

              <p>
                {councilors.length ===
                0
                  ? "Create the first Councilor account and assign it to an active department."
                  : "Try changing your search, department, or status filters."}
              </p>

              {councilors.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                >
                  Create Councilor
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="superadmin-councilors-table-wrapper">
              <table className="superadmin-councilors-table">
                <thead>
                  <tr>
                    <th>
                      Councilor
                    </th>

                    <th>
                      Department
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
                  {paginatedCouncilors.map(
                    (
                      councilor,
                      index,
                    ) => {
                      const isActive =
                        councilor.active !==
                        false;

                      return (
                        <tr
                          key={
                            councilor.id
                          }
                          style={{
                            "--councilor-row-index":
                              index,
                          }}
                        >
                          <td
                            data-label="Councilor"
                          >
                            <div className="superadmin-councilors-identity">
                              <div className="superadmin-councilors-avatar">
                                {councilor.name
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
                                    councilor.name
                                  }
                                </strong>

                                <span>
                                  {
                                    councilor.email
                                  }
                                </span>
                              </div>
                            </div>
                          </td>

                          <td
                            data-label="Department"
                          >
                            <div className="superadmin-councilors-department">
                              <span className="superadmin-councilors-department-code">
                                {councilor.departmentCode ??
                                  "—"}
                              </span>

                              <div>
                                <strong>
                                  {councilor.departmentName ??
                                    "Unassigned"}
                                </strong>

                                <span>
                                  Department
                                  assignment
                                </span>
                              </div>
                            </div>
                          </td>

                          <td
                            data-label="Status"
                          >
                            <span
                              className={`superadmin-councilors-status ${
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

                          <td
                            data-label="Actions"
                          >
                            <div className="superadmin-councilors-actions">
                              <button
                                type="button"
                                className="edit"
                                onClick={() =>
                                  openEditModal(
                                    councilor,
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="password"
                                onClick={() =>
                                  openPasswordModal(
                                    councilor,
                                  )
                                }
                              >
                                Reset Password
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
                                    councilor,
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

              <nav
                className="superadmin-councilors-pagination"
                aria-label="Councilor pagination"
              >
                <div className="superadmin-councilors-pagination-info">
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
                      filteredCouncilors.length
                    }
                  </strong>
                </div>

                <div className="superadmin-councilors-pagination-controls">
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

                  <div className="superadmin-councilors-pagination-pages">
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
            councilors.length >
              0 && (
              <footer className="superadmin-councilors-panel-footer">
                <div>
                  <span>
                    {
                      activeCouncilors.length
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
                      inactiveCouncilors
                    }{" "}
                    inactive
                  </span>
                </div>

                <p>
                  Councilor accounts are
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
          CREATE MODAL
      ================================================== */}

      {showCreateModal && (
        <div
          className="superadmin-councilors-modal-backdrop"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <section
            className="superadmin-councilors-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-councilor-title"
          >
            <header className="superadmin-councilors-modal-header">
              <div>
                <span>
                  NEW COUNCILOR
                </span>

                <h2 id="create-councilor-title">
                  Create Councilor
                  Account
                </h2>

                <p>
                  Create an administrative
                  account and assign it
                  to an available active
                  department.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={
                  creating
                }
                aria-label="Close create Councilor form"
              >
                ×
              </button>
            </header>

            <form
              className="superadmin-councilors-form"
              onSubmit={
                handleCreateCouncilor
              }
              noValidate
            >
              <div className="superadmin-councilors-form-notice">
                <span
                  aria-hidden="true"
                >
                  i
                </span>

                <div>
                  <strong>
                    Department
                    administrator
                  </strong>

                  <p>
                    A newly created
                    Councilor account is
                    active and must be
                    assigned to an active
                    department without
                    another active
                    Councilor.
                  </p>
                </div>
              </div>

              <div className="superadmin-councilors-field">
                <label htmlFor="create-councilor-name">
                  Full Name
                </label>

                <input
                  id="create-councilor-name"
                  name="name"
                  type="text"
                  value={
                    createForm.name
                  }
                  onChange={
                    handleCreateChange
                  }
                  maxLength={150}
                  placeholder="Example: ICT Department Councilor"
                  autoComplete="name"
                  disabled={
                    creating
                  }
                  autoFocus
                />
              </div>

              <div className="superadmin-councilors-field">
                <label htmlFor="create-councilor-email">
                  Email Address
                </label>

                <input
                  id="create-councilor-email"
                  name="email"
                  type="email"
                  value={
                    createForm.email
                  }
                  onChange={
                    handleCreateChange
                  }
                  placeholder="councilor@example.com"
                  autoComplete="email"
                  disabled={
                    creating
                  }
                />
              </div>

              <div className="superadmin-councilors-field">
                <label htmlFor="create-councilor-department">
                  Department
                </label>

                <select
                  id="create-councilor-department"
                  name="departmentId"
                  value={
                    createForm.departmentId
                  }
                  onChange={
                    handleCreateChange
                  }
                  disabled={
                    creating
                  }
                >
                  <option value="">
                    Select department
                  </option>

                  {activeDepartments.map(
                    (department) => {
                      const occupied =
                        occupiedDepartmentIds.has(
                          department.id,
                        );

                      return (
                        <option
                          key={
                            department.id
                          }
                          value={
                            department.id
                          }
                          disabled={
                            occupied
                          }
                        >
                          {department.code} —{" "}
                          {department.name}
                          {occupied
                            ? " — Active Councilor assigned"
                            : ""}
                        </option>
                      );
                    },
                  )}
                </select>

                {activeDepartments.length ===
                  0 && (
                  <span className="superadmin-councilors-field-warning">
                    No active departments
                    are currently
                    available.
                  </span>
                )}

                {activeDepartments.length >
                  0 &&
                  availableDepartments.length ===
                    0 && (
                    <span className="superadmin-councilors-field-warning">
                      Every active
                      department already
                      has an active
                      Councilor.
                    </span>
                  )}
              </div>

              <div className="superadmin-councilors-field">
                <label htmlFor="create-councilor-password">
                  Temporary Password
                </label>

                <div className="superadmin-councilors-password-input">
                  <input
                    id="create-councilor-password"
                    name="password"
                    type={
                      showCreatePassword
                        ? "text"
                        : "password"
                    }
                    value={
                      createForm.password
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={
                      creating
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreatePassword(
                        (current) =>
                          !current,
                      )
                    }
                    disabled={
                      creating
                    }
                    aria-label={
                      showCreatePassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <PasswordVisibilityIcon
                      visible={
                        showCreatePassword
                      }
                    />
                  </button>
                </div>

                <span>
                  The Councilor can change
                  this password after
                  signing in.
                </span>
              </div>

              {createError && (
                <div
                  className="superadmin-councilors-form-error"
                  role="alert"
                >
                  <span
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <p>
                    {createError}
                  </p>
                </div>
              )}

              <div className="superadmin-councilors-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={
                    closeCreateModal
                  }
                  disabled={
                    creating
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    creating ||
                    availableDepartments.length ===
                      0
                  }
                >
                  {creating && (
                    <span className="superadmin-councilors-button-spinner" />
                  )}

                  {creating
                    ? "Creating..."
                    : "Create Councilor"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* =================================================
          EDIT MODAL
      ================================================== */}

      {showEditModal &&
        editTarget && (
          <div
            className="superadmin-councilors-modal-backdrop"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeEditModal();
              }
            }}
          >
            <section
              className="superadmin-councilors-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-councilor-title"
            >
              <header className="superadmin-councilors-modal-header">
                <div>
                  <span>
                    COUNCILOR DETAILS
                  </span>

                  <h2 id="edit-councilor-title">
                    Edit Councilor
                  </h2>

                  <p>
                    Update the Councilor
                    identity, email
                    address, or department
                    assignment.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    savingEdit
                  }
                  aria-label="Close edit Councilor form"
                >
                  ×
                </button>
              </header>

              <form
                className="superadmin-councilors-form"
                onSubmit={
                  handleSaveEdit
                }
                noValidate
              >
                <div className="superadmin-councilors-account-card">
                  <div className="superadmin-councilors-account-avatar">
                    {editTarget.name
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "C"}
                  </div>

                  <div>
                    <span>
                      CURRENT ACCOUNT
                    </span>

                    <strong>
                      {editTarget.name}
                    </strong>

                    <small>
                      {editTarget.email}
                    </small>
                  </div>

                  <span
                    className={`superadmin-councilors-status ${
                      editTargetIsActive
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    <span />

                    {editTargetIsActive
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>

                <div className="superadmin-councilors-field">
                  <label htmlFor="edit-councilor-name">
                    Full Name
                  </label>

                  <input
                    id="edit-councilor-name"
                    name="name"
                    type="text"
                    value={
                      editForm.name
                    }
                    onChange={
                      handleEditChange
                    }
                    maxLength={150}
                    disabled={
                      savingEdit
                    }
                    autoFocus
                  />
                </div>

                <div className="superadmin-councilors-field">
                  <label htmlFor="edit-councilor-email">
                    Email Address
                  </label>

                  <input
                    id="edit-councilor-email"
                    name="email"
                    type="email"
                    value={
                      editForm.email
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      savingEdit
                    }
                  />
                </div>

                <div className="superadmin-councilors-field">
                  <label htmlFor="edit-councilor-department">
                    Department
                  </label>

                  <select
                    id="edit-councilor-department"
                    name="departmentId"
                    value={
                      editForm.departmentId
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      savingEdit
                    }
                  >
                    <option value="">
                      Select department
                    </option>

                    {activeDepartments.map(
                      (department) => {
                        const occupiedByOther =
                          editDepartmentOccupiedByOther(
                            department.id,
                          );

                        const shouldDisable =
                          editTargetIsActive &&
                          occupiedByOther;

                        return (
                          <option
                            key={
                              department.id
                            }
                            value={
                              department.id
                            }
                            disabled={
                              shouldDisable
                            }
                          >
                            {department.code} —{" "}
                            {department.name}
                            {shouldDisable
                              ? " — Active Councilor assigned"
                              : ""}
                          </option>
                        );
                      },
                    )}
                  </select>

                  {!editTargetIsActive && (
                    <span>
                      Inactive Councilors
                      may share a
                      department assignment
                      with an active
                      Councilor, but only
                      one account may be
                      active at a time.
                    </span>
                  )}
                </div>

                {editError && (
                  <div
                    className="superadmin-councilors-form-error"
                    role="alert"
                  >
                    <span
                      aria-hidden="true"
                    >
                      !
                    </span>

                    <p>
                      {editError}
                    </p>
                  </div>
                )}

                <div className="superadmin-councilors-modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={
                      closeEditModal
                    }
                    disabled={
                      savingEdit
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      savingEdit
                    }
                  >
                    {savingEdit && (
                      <span className="superadmin-councilors-button-spinner" />
                    )}

                    {savingEdit
                      ? "Saving..."
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
            className="superadmin-councilors-modal-backdrop"
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
              className="superadmin-councilors-status-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="councilor-status-title"
            >
              <div
                className={`superadmin-councilors-status-modal-icon ${
                  statusTargetIsActive
                    ? "deactivate"
                    : "activate"
                }`}
              >
                {statusTargetIsActive
                  ? "!"
                  : "✓"}
              </div>

              <span className="superadmin-councilors-status-modal-kicker">
                ACCOUNT STATUS
              </span>

              <h2 id="councilor-status-title">
                {statusTargetIsActive
                  ? "Deactivate Councilor?"
                  : "Activate Councilor?"}
              </h2>

              <p>
                {statusTargetIsActive
                  ? `You are about to deactivate ${statusTarget.name}.`
                  : `You are about to reactivate ${statusTarget.name}.`}
              </p>

              <div className="superadmin-councilors-status-summary">
                <div>
                  <span>
                    DEPARTMENT
                  </span>

                  <strong>
                    {statusTarget.departmentCode ??
                      "—"}
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

              {!statusTargetIsActive &&
                activationBlocked && (
                  <div className="superadmin-councilors-blocked">
                    <span
                      aria-hidden="true"
                    >
                      !
                    </span>

                    <div>
                      <strong>
                        Activation blocked
                      </strong>

                      <p>
                        {statusTargetDepartmentInactive
                          ? "This Councilor cannot be activated because the assigned department is inactive."
                          : "This department already has another active Councilor. Deactivate or reassign that Councilor first."}
                      </p>
                    </div>
                  </div>
                )}

              {!activationBlocked && (
                <div className="superadmin-councilors-status-notice">
                  <span
                    aria-hidden="true"
                  >
                    i
                  </span>

                  <p>
                    {statusTargetIsActive
                      ? "The account will remain in the system, but the Councilor will no longer be able to sign in while inactive."
                      : "The Councilor will regain access to the system after activation."}
                  </p>
                </div>
              )}

              {statusError && (
                <div
                  className="superadmin-councilors-form-error"
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

              <div className="superadmin-councilors-status-actions">
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

                {!statusTargetIsActive &&
                statusTargetDepartmentInactive ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={
                      goToDepartments
                    }
                  >
                    Manage Departments
                  </button>
                ) : !statusTargetIsActive &&
                  statusTargetHasConflict ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={
                      closeStatusModal
                    }
                  >
                    Review Councilors
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
                      <span className="superadmin-councilors-button-spinner" />
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

      {/* =================================================
          RESET PASSWORD MODAL
      ================================================== */}

      {showPasswordModal &&
        passwordTarget && (
          <div
            className="superadmin-councilors-modal-backdrop"
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
            <section
              className="superadmin-councilors-modal superadmin-councilors-password-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-councilor-password-title"
            >
              <header className="superadmin-councilors-modal-header">
                <div>
                  <span>
                    ACCOUNT SECURITY
                  </span>

                  <h2 id="reset-councilor-password-title">
                    Reset Councilor
                    Password
                  </h2>

                  <p>
                    Replace the password
                    used by this Councilor
                    account.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closePasswordModal
                  }
                  disabled={
                    resettingPassword
                  }
                  aria-label="Close password reset form"
                >
                  ×
                </button>
              </header>

              <form
                className="superadmin-councilors-form"
                onSubmit={
                  handleResetPassword
                }
                noValidate
              >
                <div className="superadmin-councilors-account-card">
                  <div className="superadmin-councilors-account-avatar">
                    {passwordTarget.name
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "C"}
                  </div>

                  <div>
                    <span>
                      RESET PASSWORD FOR
                    </span>

                    <strong>
                      {
                        passwordTarget.name
                      }
                    </strong>

                    <small>
                      {
                        passwordTarget.email
                      }
                    </small>
                  </div>
                </div>

                <div className="superadmin-councilors-security-notice">
                  <span
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <strong>
                      Credential reset
                    </strong>

                    <p>
                      The previous
                      password will stop
                      working immediately
                      after this change.
                    </p>
                  </div>
                </div>

                <div className="superadmin-councilors-field">
                  <label htmlFor="reset-councilor-new-password">
                    New Password
                  </label>

                  <div className="superadmin-councilors-password-input">
                    <input
                      id="reset-councilor-new-password"
                      name="newPassword"
                      type={
                        passwordVisibility.newPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        passwordForm.newPassword
                      }
                      onChange={
                        handlePasswordChange
                      }
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      disabled={
                        resettingPassword
                      }
                      autoFocus
                    />

                    <button
                      type="button"
                      onClick={() =>
                        togglePasswordVisibility(
                          "newPassword",
                        )
                      }
                      disabled={
                        resettingPassword
                      }
                      aria-label={
                        passwordVisibility.newPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      <PasswordVisibilityIcon
                        visible={
                          passwordVisibility.newPassword
                        }
                      />
                    </button>
                  </div>
                </div>

                <div className="superadmin-councilors-field">
                  <label htmlFor="reset-councilor-confirm-password">
                    Confirm Password
                  </label>

                  <div className="superadmin-councilors-password-input">
                    <input
                      id="reset-councilor-confirm-password"
                      name="confirmPassword"
                      type={
                        passwordVisibility.confirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        passwordForm.confirmPassword
                      }
                      onChange={
                        handlePasswordChange
                      }
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      disabled={
                        resettingPassword
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        togglePasswordVisibility(
                          "confirmPassword",
                        )
                      }
                      disabled={
                        resettingPassword
                      }
                      aria-label={
                        passwordVisibility.confirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
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

                {passwordError && (
                  <div
                    className="superadmin-councilors-form-error"
                    role="alert"
                  >
                    <span
                      aria-hidden="true"
                    >
                      !
                    </span>

                    <p>
                      {passwordError}
                    </p>
                  </div>
                )}

                <div className="superadmin-councilors-modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={
                      closePasswordModal
                    }
                    disabled={
                      resettingPassword
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      resettingPassword
                    }
                  >
                    {resettingPassword && (
                      <span className="superadmin-councilors-button-spinner" />
                    )}

                    {resettingPassword
                      ? "Resetting..."
                      : "Reset Password"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
    </SuperAdminLayout>
  );
}

export default CouncilorManagement;