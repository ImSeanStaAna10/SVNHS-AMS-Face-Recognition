import { useCallback, useEffect, useMemo, useState } from "react";

import AdviserLayout from "../../layouts/AdviserLayout";
import adviserService from "../../services/adviserService";

import "../../styles/adviser/StudentManagementFaceScanning/studentTransfer.css";

/* =========================================================
   CONSTANTS
========================================================= */

const AUTO_REFRESH_INTERVAL_MS = 30_000;

const TRANSFER_UPDATED_EVENT = "student-transfer-updated";

const DEFAULT_ROWS_PER_PAGE = 5;

const TAB_ITEMS = [
  {
    key: "INCOMING",
    label: "Incoming",
    description: "Requests coming into your section",
  },
  {
    key: "OUTGOING",
    label: "Outgoing",
    description: "Requests you sent to another section",
  },
  {
    key: "HISTORY",
    label: "History",
    description: "Completed and cancelled transfers",
  },
];

const STATUS_FILTERS = [
  {
    value: "ALL",
    label: "All statuses",
  },
  {
    value: "PENDING",
    label: "Pending",
  },
  {
    value: "APPROVED",
    label: "Approved",
  },
  {
    value: "REJECTED",
    label: "Rejected",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
  },
];

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  fallback;

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const getStudentInitial = (name) =>
  String(name || "S")
    .trim()
    .charAt(0)
    .toUpperCase() || "S";

const getStatusLabel = (status) => {
  switch (normalizeStatus(status)) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status || "Unknown";
  }
};

const getSearchText = (request) =>
  [
    request?.studentName,
    request?.studentNumber,
    request?.sourceSectionName,
    request?.destinationSectionName,
    request?.destinationAdviserName,
    request?.requestedByAdviserName,
    request?.reason,
    request?.reviewNote,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

/* =========================================================
   PAGINATION HELPER
========================================================= */

const buildPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 5) {
    return Array.from(
      {
        length: totalPages,
      },
      (_, index) => index + 1,
    );
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "RIGHT_ELLIPSIS", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "LEFT_ELLIPSIS",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "LEFT_ELLIPSIS",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "RIGHT_ELLIPSIS",
    totalPages,
  ];
};

/* =========================================================
   STATUS BADGE
========================================================= */

function TransferStatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  return (
    <span
      className={`student-transfer-status status-${normalized.toLowerCase()}`}
    >
      <span aria-hidden="true" />

      {getStatusLabel(normalized)}
    </span>
  );
}

/* =========================================================
   TRANSFER ROUTE
========================================================= */

function TransferRoute({ request }) {
  return (
    <div className="student-transfer-route">
      <div className="student-transfer-route-section">
        <small>FROM</small>

        <strong>{request?.sourceSectionName || "Unknown section"}</strong>
      </div>

      <div className="student-transfer-route-arrow" aria-hidden="true">
        →
      </div>

      <div className="student-transfer-route-section is-destination">
        <small>TO</small>

        <strong>{request?.destinationSectionName || "Unknown section"}</strong>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function TransferEmptyState({ activeTab, hasFilters, onReset }) {
  const content = {
    INCOMING: {
      icon: "↓",
      title: "No incoming transfer requests",
      description:
        "Requests from other Advisers to move students into your section will appear here.",
    },

    OUTGOING: {
      icon: "↑",
      title: "No outgoing transfer requests",
      description:
        "Transfer requests you create from Student Management will appear here.",
    },

    HISTORY: {
      icon: "▤",
      title: "No transfer history yet",
      description:
        "Approved, rejected, and cancelled student transfers will appear here.",
    },
  };

  const current = content[activeTab] || content.INCOMING;

  return (
    <div className="student-transfer-empty">
      <span className="student-transfer-empty-icon" aria-hidden="true">
        {hasFilters ? "⌕" : current.icon}
      </span>

      <h3>{hasFilters ? "No matching transfers" : current.title}</h3>

      <p>
        {hasFilters
          ? "Try changing your search or transfer filters."
          : current.description}
      </p>

      {hasFilters && (
        <button
          type="button"
          className="student-transfer-secondary-button"
          onClick={onReset}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}

/* =========================================================
   TRANSFER REQUEST CARD
========================================================= */

function TransferRequestCard({ request, activeTab, onOpen }) {
  const status = normalizeStatus(request?.status);

  const pending = status === "PENDING";

  const isIncoming = activeTab === "INCOMING";

  const isOutgoing = activeTab === "OUTGOING";

  return (
    <article className={`student-transfer-card ${pending ? "is-pending" : ""}`}>
      <div className="student-transfer-card-main">
        {/* =================================================
            STUDENT
        ================================================= */}

        <div className="student-transfer-student">
          <div className="student-transfer-avatar">
            {getStudentInitial(request?.studentName)}
          </div>

          <div className="student-transfer-student-copy">
            <small>STUDENT</small>

            <strong>{request?.studentName || "Unnamed Student"}</strong>

            <span>{request?.studentNumber || "No student number"}</span>
          </div>
        </div>

        {/* =================================================
            ROUTE
        ================================================= */}

        <TransferRoute request={request} />

        {/* =================================================
            STATUS
        ================================================= */}

        <div className="student-transfer-card-status">
          <TransferStatusBadge status={status} />

          <span className="student-transfer-card-date">
            {formatDateTime(request?.createdAt)}
          </span>
        </div>
      </div>

      {/* ===================================================
          CARD FOOTER
      ==================================================== */}

      <div className="student-transfer-card-footer">
        <div className="student-transfer-meta">
          {isIncoming && (
            <div>
              <small>REQUESTED BY</small>

              <strong>
                {request?.requestedByAdviserName || "Source Adviser"}
              </strong>
            </div>
          )}

          {isOutgoing && (
            <div>
              <small>DESTINATION ADVISER</small>

              <strong>
                {request?.destinationAdviserName || "Destination Adviser"}
              </strong>
            </div>
          )}

          {activeTab === "HISTORY" && (
            <>
              <div>
                <small>RESULT</small>

                <strong>{getStatusLabel(request?.status)}</strong>
              </div>

              <div>
                <small>DIRECTION</small>

                <strong>
                  {request?.direction === "INCOMING" ? "Incoming" : "Outgoing"}
                </strong>
              </div>
            </>
          )}

          {request?.reason && (
            <div className="student-transfer-meta-reason">
              <small>REASON</small>

              <strong>{request.reason}</strong>
            </div>
          )}
        </div>

        <div className="student-transfer-card-actions">
          <button
            type="button"
            className={
              pending && isIncoming
                ? "student-transfer-primary-button"
                : "student-transfer-secondary-button"
            }
            title={
              pending && isIncoming
                ? "Review this incoming transfer request"
                : pending && isOutgoing
                  ? "View details or cancel this pending request"
                  : "View the full transfer details"
            }
            onClick={() => onOpen(request)}
          >
            {pending && isIncoming
              ? "Review Request"
              : pending && isOutgoing
                ? "View / Cancel"
                : "View Details"}
          </button>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function StudentTransfers() {
  /* =======================================================
     DATA
  ======================================================= */

  const [incomingRequests, setIncomingRequests] = useState([]);

  const [outgoingRequests, setOutgoingRequests] = useState([]);

  /* =======================================================
     VIEW
  ======================================================= */

  const [activeTab, setActiveTab] = useState("INCOMING");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  /* =======================================================
     FILTERS
  ======================================================= */

  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [historyDirection, setHistoryDirection] = useState("ALL");

  /* =======================================================
     PAGINATION
  ======================================================= */

  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const [currentPage, setCurrentPage] = useState(1);

  /* =======================================================
     MODAL
  ======================================================= */

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [reviewNote, setReviewNote] = useState("");

  const [actionError, setActionError] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  /* =======================================================
     LOAD DATA

     silent=true:
     Used by automatic synchronization so the full-page
     loading state does not flash every 30 seconds.
  ======================================================= */

  const loadTransfers = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);

        setError("");
      }

      const [incoming, outgoing] = await Promise.all([
        adviserService.getIncomingStudentTransferRequests(),
        adviserService.getOutgoingStudentTransferRequests(),
      ]);

      setIncomingRequests(normalizeArray(incoming));

      setOutgoingRequests(normalizeArray(outgoing));

      /*
       * Successful automatic sync may clear an earlier
       * initial-load error if one was being displayed.
       */
      setError("");
    } catch (requestError) {
      if (silent) {
        /*
         * Silent auto-sync failure must not destroy
         * already visible transfer data.
         */
        console.warn(
          "Automatic transfer synchronization failed:",
          requestError,
        );

        return;
      }

      console.error("Unable to load transfer requests:", requestError);

      setError(
        getErrorMessage(
          requestError,
          "Unable to load student transfer requests.",
        ),
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  /* =======================================================
     AUTOMATIC SYNCHRONIZATION

     Refreshes:
     - every 30 seconds while this page is open
     - when browser window gets focus
     - when browser tab becomes visible again
     - when transfer update event fires
  ======================================================= */

  useEffect(() => {
    const synchronize = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadTransfers({
        silent: true,
      });
    };

    const handleFocus = () => {
      synchronize();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        synchronize();
      }
    };

    const handleTransferUpdated = () => {
      synchronize();
    };

    const intervalId = window.setInterval(
      synchronize,
      AUTO_REFRESH_INTERVAL_MS,
    );

    window.addEventListener("focus", handleFocus);

    window.addEventListener(TRANSFER_UPDATED_EVENT, handleTransferUpdated);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);

      window.removeEventListener("focus", handleFocus);

      window.removeEventListener(TRANSFER_UPDATED_EVENT, handleTransferUpdated);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadTransfers]);

  /* =======================================================
     COUNTS
  ======================================================= */

  const incomingPendingCount = useMemo(
    () =>
      incomingRequests.filter(
        (request) => normalizeStatus(request?.status) === "PENDING",
      ).length,
    [incomingRequests],
  );

  const outgoingPendingCount = useMemo(
    () =>
      outgoingRequests.filter(
        (request) => normalizeStatus(request?.status) === "PENDING",
      ).length,
    [outgoingRequests],
  );

  /* =======================================================
     HISTORY

     Merge resolved outgoing and incoming requests.
     Request ID prevents duplicate entries.
  ======================================================= */

  const historyRequests = useMemo(() => {
    const byId = new Map();

    outgoingRequests.forEach((request) => {
      const status = normalizeStatus(request?.status);

      if (status === "PENDING") {
        return;
      }

      const key = request?.id || `${request?.studentId}-${request?.createdAt}`;

      byId.set(String(key), {
        ...request,

        direction: "OUTGOING",
      });
    });

    incomingRequests.forEach((request) => {
      const status = normalizeStatus(request?.status);

      if (status === "PENDING") {
        return;
      }

      const key = request?.id || `${request?.studentId}-${request?.createdAt}`;

      const normalizedKey = String(key);

      if (!byId.has(normalizedKey)) {
        byId.set(normalizedKey, {
          ...request,

          direction: "INCOMING",
        });
      }
    });

    return Array.from(byId.values()).sort(
      (first, second) =>
        new Date(second?.reviewedAt || second?.createdAt || 0).getTime() -
        new Date(first?.reviewedAt || first?.createdAt || 0).getTime(),
    );
  }, [incomingRequests, outgoingRequests]);

  const completedCount = historyRequests.length;

  /* =======================================================
     CURRENT TAB DATA
  ======================================================= */

  const currentRequests = useMemo(() => {
    if (activeTab === "INCOMING") {
      return [...incomingRequests];
    }

    if (activeTab === "OUTGOING") {
      return [...outgoingRequests];
    }

    return [...historyRequests];
  }, [activeTab, incomingRequests, outgoingRequests, historyRequests]);

  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return currentRequests
      .filter((request) => {
        const status = normalizeStatus(request?.status);

        const matchesSearch = !query || getSearchText(request).includes(query);

        const matchesStatus = statusFilter === "ALL" || status === statusFilter;

        const matchesDirection =
          activeTab !== "HISTORY" ||
          historyDirection === "ALL" ||
          request?.direction === historyDirection;

        return matchesSearch && matchesStatus && matchesDirection;
      })
      .sort((first, second) => {
        const firstPending = normalizeStatus(first?.status) === "PENDING";

        const secondPending = normalizeStatus(second?.status) === "PENDING";

        /*
         * Pending first.
         */
        if (firstPending !== secondPending) {
          return firstPending ? -1 : 1;
        }

        return (
          new Date(second?.createdAt || 0).getTime() -
          new Date(first?.createdAt || 0).getTime()
        );
      });
  }, [currentRequests, searchQuery, statusFilter, activeTab, historyDirection]);

  const hasFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "ALL" ||
    (activeTab === "HISTORY" && historyDirection !== "ALL");

  /* =======================================================
     PAGINATION CALCULATIONS
  ======================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / rowsPerPage),
  );

  const safePage = Math.min(currentPage, totalPages);

  const pageStartIndex = (safePage - 1) * rowsPerPage;

  const paginatedRequests = filteredRequests.slice(
    pageStartIndex,
    pageStartIndex + rowsPerPage,
  );

  const visibleStart = filteredRequests.length > 0 ? pageStartIndex + 1 : 0;

  const visibleEnd = Math.min(
    pageStartIndex + rowsPerPage,
    filteredRequests.length,
  );

  const paginationItems = useMemo(
    () => buildPaginationItems(safePage, totalPages),
    [safePage, totalPages],
  );

  /* =======================================================
     RESET PAGE WHEN VIEW CHANGES
  ======================================================= */

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, statusFilter, historyDirection, rowsPerPage]);

  /* =======================================================
     PROTECT AGAINST PAGE BECOMING INVALID
     AFTER APPROVE / REJECT / CANCEL / AUTO SYNC
  ======================================================= */

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* =======================================================
     RESET FILTERS
  ======================================================= */

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setHistoryDirection("ALL");
    setCurrentPage(1);
  };

  /* =======================================================
     CHANGE TAB
  ======================================================= */

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    setSearchQuery("");

    setStatusFilter("ALL");

    setHistoryDirection("ALL");

    setCurrentPage(1);
  };

  /* =======================================================
     OPEN REQUEST
  ======================================================= */

  const openRequest = (request) => {
    setSelectedRequest(request);

    setReviewNote(request?.reviewNote || "");

    setActionError("");

    setSuccessMessage("");
  };

  /* =======================================================
     CLOSE REQUEST
  ======================================================= */

  const closeRequest = () => {
    if (actionBusy) {
      return;
    }

    setSelectedRequest(null);

    setReviewNote("");

    setActionError("");
  };

  /* =======================================================
     NOTIFY OTHER UI PARTS THAT TRANSFER DATA CHANGED

     AdviserLayout listens to this so the sidebar
     pending count can refresh immediately.
  ======================================================= */

  const announceTransferUpdated = () => {
    window.dispatchEvent(new Event(TRANSFER_UPDATED_EVENT));
  };

  /* =======================================================
     APPROVE
  ======================================================= */

  const handleApprove = async () => {
    if (!selectedRequest?.id) {
      return;
    }

    try {
      setActionBusy(true);

      setActionError("");

      await adviserService.approveStudentTransferRequest(
        selectedRequest.id,
        reviewNote.trim() || null,
      );

      const studentName = selectedRequest?.studentName || "Student";

      const destination =
        selectedRequest?.destinationSectionName || "the destination section";

      setSelectedRequest(null);

      setReviewNote("");

      setSuccessMessage(
        `${studentName}'s transfer to ${destination} was approved successfully.`,
      );

      /*
       * Reload this page immediately.
       */
      await loadTransfers({
        silent: true,
      });

      /*
       * Tell layout/sidebar to refresh its pending count.
       */
      announceTransferUpdated();
    } catch (requestError) {
      console.error("Unable to approve transfer request:", requestError);

      if (requestError?.response?.status === 409) {
        setActionError(
          "This transfer request is no longer pending. The latest transfer status is being synchronized.",
        );

        void loadTransfers({
          silent: true,
        });

        return;
      }

      setActionError(
        getErrorMessage(
          requestError,
          "Unable to approve this transfer request.",
        ),
      );
    } finally {
      setActionBusy(false);
    }
  };

  /* =======================================================
     REJECT
  ======================================================= */

  const handleReject = async () => {
    if (!selectedRequest?.id) {
      return;
    }

    try {
      setActionBusy(true);

      setActionError("");

      await adviserService.rejectStudentTransferRequest(
        selectedRequest.id,
        reviewNote.trim() || null,
      );

      const studentName = selectedRequest?.studentName || "Student";

      setSelectedRequest(null);

      setReviewNote("");

      setSuccessMessage(
        `${studentName}'s transfer request was rejected. The student remains in the original section.`,
      );

      await loadTransfers({
        silent: true,
      });

      announceTransferUpdated();
    } catch (requestError) {
      console.error("Unable to reject transfer request:", requestError);

      if (requestError?.response?.status === 409) {
        setActionError(
          "This transfer request is no longer pending. The latest transfer status is being synchronized.",
        );

        void loadTransfers({
          silent: true,
        });

        return;
      }

      setActionError(
        getErrorMessage(
          requestError,
          "Unable to reject this transfer request.",
        ),
      );
    } finally {
      setActionBusy(false);
    }
  };

  /* =======================================================
     CANCEL
  ======================================================= */

  const handleCancel = async () => {
    if (!selectedRequest?.id) {
      return;
    }

    try {
      setActionBusy(true);

      setActionError("");

      await adviserService.cancelStudentTransferRequest(selectedRequest.id);

      const studentName = selectedRequest?.studentName || "Student";

      setSelectedRequest(null);

      setReviewNote("");

      setSuccessMessage(
        `${studentName}'s pending transfer was cancelled successfully. The student is active in the original section again.`,
      );

      await loadTransfers({
        silent: true,
      });

      announceTransferUpdated();
    } catch (requestError) {
      console.error("Unable to cancel transfer request:", requestError);

      if (requestError?.response?.status === 409) {
        setActionError(
          "This request was already approved, rejected, or cancelled and can no longer be cancelled.",
        );

        void loadTransfers({
          silent: true,
        });

        return;
      }

      setActionError(
        getErrorMessage(
          requestError,
          "Unable to cancel this transfer request.",
        ),
      );
    } finally {
      setActionBusy(false);
    }
  };

  /* =======================================================
     SELECTED REQUEST STATE
  ======================================================= */

  const selectedStatus = normalizeStatus(selectedRequest?.status);

  const selectedPending = selectedStatus === "PENDING";

  const selectedIncoming =
    selectedRequest &&
    incomingRequests.some(
      (request) => String(request?.id) === String(selectedRequest?.id),
    );

  const selectedOutgoing =
    selectedRequest &&
    outgoingRequests.some(
      (request) => String(request?.id) === String(selectedRequest?.id),
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Student Transfers"
      eyebrow="ADVISER PORTAL"
      description="Review incoming transfers, manage outgoing requests, and view student transfer history"
    >
      <section className="student-transfers">
        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div className="student-transfer-alert is-error" role="alert">
            <span aria-hidden="true">!</span>

            <div>
              <strong>Transfer data unavailable</strong>

              <p>{error}</p>
            </div>

            <button type="button" onClick={() => void loadTransfers()}>
              Retry
            </button>
          </div>
        )}

        {successMessage && (
          <div className="student-transfer-alert is-success" role="status">
            <span aria-hidden="true">✓</span>

            <div>
              <strong>Transfer updated</strong>

              <p>{successMessage}</p>
            </div>

            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setSuccessMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            OVERVIEW
        ================================================= */}

        <section className="student-transfer-overview">
          <div className="student-transfer-overview-copy">
            <span>TRANSFER CENTER</span>

            <h2>Student Transfers</h2>

            <p>
              Manage student movement between sections without losing face
              identity or attendance history.
            </p>
          </div>

          <div className="student-transfer-overview-stats">
            <button
              type="button"
              className={activeTab === "INCOMING" ? "is-active" : ""}
              onClick={() => handleTabChange("INCOMING")}
            >
              <span>INCOMING PENDING</span>

              <strong>{loading ? "—" : incomingPendingCount}</strong>

              <small>Awaiting your review</small>
            </button>

            <button
              type="button"
              className={activeTab === "OUTGOING" ? "is-active" : ""}
              onClick={() => handleTabChange("OUTGOING")}
            >
              <span>OUTGOING PENDING</span>

              <strong>{loading ? "—" : outgoingPendingCount}</strong>

              <small>Awaiting destination</small>
            </button>

            <button
              type="button"
              className={activeTab === "HISTORY" ? "is-active" : ""}
              onClick={() => handleTabChange("HISTORY")}
            >
              <span>HISTORY</span>

              <strong>{loading ? "—" : completedCount}</strong>

              <small>Resolved requests</small>
            </button>
          </div>
        </section>

        {/* =================================================
            MAIN PANEL
        ================================================= */}

        <section className="student-transfer-panel">
          <header className="student-transfer-panel-header">
            <div>
              <span>TRANSFER WORKSPACE</span>

              <h2>Manage Requests</h2>

              <p>
                Pending transfers are temporarily excluded from attendance until
                resolved.
              </p>

              <div className="student-transfer-workspace-state">
                <span aria-hidden="true" />

                <strong>
                  {activeTab === "INCOMING"
                    ? "Reviewing incoming requests"
                    : activeTab === "OUTGOING"
                      ? "Tracking outgoing requests"
                      : "Viewing transfer history"}
                </strong>
              </div>
            </div>

            {/* =============================================
                AUTO SYNC INDICATOR
            ============================================== */}

            <div
              className="student-transfer-auto-sync"
              title="Transfer data automatically synchronizes every 30 seconds"
            >
              <span aria-hidden="true" />

              <div>
                <strong>Auto sync</strong>

                <small>Every 30 seconds</small>
              </div>
            </div>
          </header>

          {/* =================================================
              TABS
          ================================================= */}

          <div className="student-transfer-tabs">
            {TAB_ITEMS.map((tab) => {
              const active = activeTab === tab.key;

              let count = 0;

              if (tab.key === "INCOMING") {
                count = incomingPendingCount;
              }

              if (tab.key === "OUTGOING") {
                count = outgoingPendingCount;
              }

              if (tab.key === "HISTORY") {
                count = completedCount;
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => handleTabChange(tab.key)}
                >
                  <span>{tab.label}</span>

                  <small>{tab.description}</small>

                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>

          {/* =================================================
              TOOLBAR
          ================================================= */}

          <div className="student-transfer-toolbar">
            <label className="student-transfer-search">
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                placeholder="Search student, section, adviser..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </label>

            <div className="student-transfer-toolbar-controls">
              {/* ===========================================
                  STATUS
              ============================================ */}

              <label>
                <span>Status</span>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* ===========================================
                  HISTORY DIRECTION
              ============================================ */}

              {activeTab === "HISTORY" && (
                <label>
                  <span>Direction</span>

                  <select
                    value={historyDirection}
                    onChange={(event) =>
                      setHistoryDirection(event.target.value)
                    }
                  >
                    <option value="ALL">All directions</option>

                    <option value="INCOMING">Incoming</option>

                    <option value="OUTGOING">Outgoing</option>
                  </select>
                </label>
              )}

              {/* ===========================================
                  ROWS PER PAGE
              ============================================ */}

              <label>
                <span>Rows</span>

                <select
                  value={rowsPerPage}
                  onChange={(event) =>
                    setRowsPerPage(Number(event.target.value))
                  }
                >
                  <option value={5}>5 per page</option>

                  <option value={10}>10 per page</option>

                  <option value={20}>20 per page</option>
                </select>
              </label>

              {hasFilters && (
                <button
                  type="button"
                  className="student-transfer-toolbar-reset"
                  onClick={resetFilters}
                >
                  Reset filters
                </button>
              )}

              <span className="student-transfer-result-count">
                <strong>{filteredRequests.length}</strong> request
                {filteredRequests.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* =================================================
              BODY
          ================================================= */}

          <div className="student-transfer-list">
            {loading ? (
              <div className="student-transfer-loading">
                <div className="student-transfer-loading-heading">
                  <span className="student-transfer-spinner" />

                  <div>
                    <strong>Loading transfers...</strong>

                    <p>Retrieving the latest student transfer requests.</p>
                  </div>
                </div>

                <div
                  className="student-transfer-skeleton-list"
                  aria-hidden="true"
                >
                  {[0, 1, 2].map((item) => (
                    <div className="student-transfer-skeleton-card" key={item}>
                      <span className="student-transfer-skeleton-avatar" />

                      <div className="student-transfer-skeleton-copy">
                        <span />
                        <span />
                      </div>

                      <div className="student-transfer-skeleton-route">
                        <span />
                        <i />
                        <span />
                      </div>

                      <span className="student-transfer-skeleton-status" />
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <TransferEmptyState
                activeTab={activeTab}
                hasFilters={hasFilters}
                onReset={resetFilters}
              />
            ) : (
              paginatedRequests.map((request, index) => (
                <TransferRequestCard
                  key={
                    request?.id ||
                    `${request?.studentId}-${pageStartIndex + index}`
                  }
                  request={request}
                  activeTab={activeTab}
                  onOpen={openRequest}
                />
              ))
            )}
          </div>

          {/* =================================================
              PAGINATION
          ================================================= */}

          {!loading && filteredRequests.length > 0 && (
            <footer className="student-transfer-pagination">
              <div className="student-transfer-pagination-summary">
                Showing{" "}
                <strong>
                  {visibleStart}–{visibleEnd}
                </strong>{" "}
                of <strong>{filteredRequests.length}</strong> request
                {filteredRequests.length === 1 ? "" : "s"}
              </div>

              <nav
                className="student-transfer-pagination-controls"
                aria-label="Transfer requests pagination"
              >
                <button
                  type="button"
                  className="student-transfer-pagination-nav"
                  disabled={safePage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  <span aria-hidden="true">‹</span>

                  <span className="student-transfer-pagination-nav-label">
                    Previous
                  </span>
                </button>

                <div className="student-transfer-pagination-pages">
                  {paginationItems.map((item, index) => {
                    if (typeof item === "string") {
                      return (
                        <span
                          key={`${item}-${index}`}
                          className="student-transfer-pagination-ellipsis"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      );
                    }

                    return (
                      <button
                        key={item}
                        type="button"
                        className={`student-transfer-pagination-page ${
                          safePage === item ? "is-active" : ""
                        }`}
                        aria-current={safePage === item ? "page" : undefined}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="student-transfer-pagination-nav"
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  <span className="student-transfer-pagination-nav-label">
                    Next
                  </span>

                  <span aria-hidden="true">›</span>
                </button>
              </nav>
            </footer>
          )}
        </section>
      </section>

      {/* ===================================================
          REQUEST DETAILS MODAL
      ==================================================== */}

      {selectedRequest && (
        <div
          className="student-transfer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRequest();
            }
          }}
        >
          <section
            className="student-transfer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-transfer-modal-title"
          >
            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <header className="student-transfer-modal-header">
              <div className="student-transfer-modal-heading">
                <span className="student-transfer-modal-icon">↔</span>

                <div>
                  <small>STUDENT TRANSFER</small>

                  <h2 id="student-transfer-modal-title">Transfer Request</h2>

                  <p>
                    Review the student, source section, and destination before
                    taking action.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-transfer-modal-close"
                disabled={actionBusy}
                onClick={closeRequest}
                aria-label="Close transfer request"
              >
                ×
              </button>
            </header>

            {/* =================================================
                MODAL BODY
            ================================================= */}

            <div className="student-transfer-modal-body">
              {/* ===========================================
                  STUDENT
              ============================================ */}

              <div className="student-transfer-modal-student">
                <div className="student-transfer-avatar is-large">
                  {getStudentInitial(selectedRequest?.studentName)}
                </div>

                <div>
                  <small>STUDENT</small>

                  <strong>
                    {selectedRequest?.studentName || "Unnamed Student"}
                  </strong>

                  <span>
                    {selectedRequest?.studentNumber || "No student number"}
                  </span>
                </div>

                <TransferStatusBadge status={selectedRequest?.status} />
              </div>

              {/* ===========================================
                  ROUTE
              ============================================ */}

              <div className="student-transfer-modal-route">
                <div>
                  <small>CURRENT / SOURCE</small>

                  <strong>
                    {selectedRequest?.sourceSectionName || "Unknown section"}
                  </strong>

                  <span>
                    {selectedRequest?.requestedByAdviserName ||
                      "Source Adviser"}
                  </span>
                </div>

                <span aria-hidden="true">→</span>

                <div>
                  <small>DESTINATION</small>

                  <strong>
                    {selectedRequest?.destinationSectionName ||
                      "Unknown section"}
                  </strong>

                  <span>
                    {selectedRequest?.destinationAdviserName ||
                      "Destination Adviser"}
                  </span>
                </div>
              </div>

              {/* ===========================================
                  DETAILS
              ============================================ */}

              <div className="student-transfer-detail-grid">
                <div>
                  <small>REQUESTED</small>

                  <strong>{formatDateTime(selectedRequest?.createdAt)}</strong>
                </div>

                <div>
                  <small>REVIEWED</small>

                  <strong>{formatDateTime(selectedRequest?.reviewedAt)}</strong>
                </div>
              </div>

              {/* ===========================================
                  REASON
              ============================================ */}

              {selectedRequest?.reason && (
                <div className="student-transfer-note-card">
                  <small>TRANSFER REASON</small>

                  <p>{selectedRequest.reason}</p>
                </div>
              )}

              {/* ===========================================
                  REVIEW NOTE
              ============================================ */}

              {selectedRequest?.reviewNote && !selectedPending && (
                <div className="student-transfer-note-card">
                  <small>REVIEW NOTE</small>

                  <p>{selectedRequest.reviewNote}</p>
                </div>
              )}

              {/* ===========================================
                  INCOMING REVIEW NOTE INPUT
              ============================================ */}

              {selectedPending && selectedIncoming && (
                <label className="student-transfer-review-note">
                  <span>
                    Review Note
                    <small>Optional</small>
                  </span>

                  <textarea
                    rows={4}
                    maxLength={500}
                    value={reviewNote}
                    disabled={actionBusy}
                    placeholder="Add an optional note for the requesting Adviser..."
                    onChange={(event) => {
                      setReviewNote(event.target.value);

                      setActionError("");
                    }}
                  />

                  <small>
                    {reviewNote.length}
                    /500 characters
                  </small>
                </label>
              )}

              {/* ===========================================
                  PENDING INFORMATION
              ============================================ */}

              {selectedPending && (
                <div className="student-transfer-pending-note">
                  <span aria-hidden="true">i</span>

                  <div>
                    <strong>Attendance is temporarily paused</strong>

                    <p>
                      While this transfer remains pending, the student cannot be
                      used in attendance. Approving, rejecting, or cancelling
                      the request resolves the temporary hold.
                    </p>
                  </div>
                </div>
              )}

              {/* ===========================================
                  ACTION ERROR
              ============================================ */}

              {actionError && (
                <div className="student-transfer-modal-error" role="alert">
                  <span aria-hidden="true">!</span>

                  <p>{actionError}</p>
                </div>
              )}
            </div>

            {/* =================================================
                MODAL ACTIONS
            ================================================= */}

            <footer className="student-transfer-modal-actions">
              <div>
                <strong>
                  {selectedPending
                    ? selectedIncoming
                      ? "Your review is required"
                      : "Awaiting destination approval"
                    : "Transfer request resolved"}
                </strong>

                <span>Request ID: {selectedRequest?.id || "Unavailable"}</span>
              </div>

              <div>
                <button
                  type="button"
                  className="student-transfer-secondary-button"
                  disabled={actionBusy}
                  onClick={closeRequest}
                >
                  Close
                </button>

                {/* =========================================
                    DESTINATION ADVISER ACTIONS
                ========================================== */}

                {selectedPending && selectedIncoming && (
                  <>
                    <button
                      type="button"
                      className="student-transfer-reject-button"
                      disabled={actionBusy}
                      onClick={() => void handleReject()}
                    >
                      {actionBusy ? "Processing..." : "Reject"}
                    </button>

                    <button
                      type="button"
                      className="student-transfer-approve-button"
                      disabled={actionBusy}
                      onClick={() => void handleApprove()}
                    >
                      {actionBusy ? "Processing..." : "Approve Transfer"}
                    </button>
                  </>
                )}

                {/* =========================================
                    SOURCE ADVISER ACTION
                ========================================== */}

                {selectedPending && selectedOutgoing && !selectedIncoming && (
                  <button
                    type="button"
                    className="student-transfer-cancel-button"
                    disabled={actionBusy}
                    onClick={() => void handleCancel()}
                  >
                    {actionBusy ? "Cancelling..." : "Cancel Transfer"}
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}
    </AdviserLayout>
  );
}

export default StudentTransfers;
