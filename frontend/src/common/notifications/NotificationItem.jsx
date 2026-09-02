import {
  useEffect,
  useRef,
  useState,
} from "react";

/* =========================================================
   HELPERS
========================================================= */

const normalizeUpper = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

/* =========================================================
   RELATIVE TIME
========================================================= */

const formatNotificationTime = (value) => {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const difference =
    Math.max(
      0,
      Date.now() -
        date.getTime(),
    );

  const seconds =
    Math.floor(
      difference / 1000,
    );

  if (seconds < 45) {
    return "Just now";
  }

  const minutes =
    Math.floor(
      seconds / 60,
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  ).format(date);
};

/* =========================================================
   PRESENTATION
========================================================= */

const getNotificationPresentation = (
  notification,
) => {
  const eventType =
    normalizeUpper(
      notification?.eventType ||
        notification?.raw?.type ||
        notification?.type,
    );

  switch (eventType) {
    case "STUDENT_TRANSFER_REQUESTED":
      return {
        label: "Transfer request",
        tone: "info",
        icon: "transfer",
      };

    case "STUDENT_TRANSFER_APPROVED":
      return {
        label: "Transfer approved",
        tone: "success",
        icon: "check",
      };

    case "STUDENT_TRANSFER_REJECTED":
      return {
        label: "Transfer rejected",
        tone: "danger",
        icon: "close",
      };

    case "STUDENT_TRANSFER_CANCELLED":
      return {
        label: "Transfer cancelled",
        tone: "neutral",
        icon: "cancel",
      };

    case "WEEKLY_REPORT_READY":
    case "MONTHLY_REPORT_READY":
      return {
        label: "Report ready",
        tone: "success",
        icon: "report",
      };

    case "REPORT_GENERATION_FAILED":
      return {
        label: "Report failed",
        tone: "danger",
        icon: "alert",
      };

    case "ATTENDANCE_SESSION_AUTO_ENDED":
      return {
        label: "Attendance",
        tone: "info",
        icon: "clock",
      };

    case "FACE_CONFLICT_REVIEW_REQUIRED":
      return {
        label: "Review required",
        tone: "warning",
        icon: "alert",
      };

    case "ACCOUNT_PASSWORD_RESET":
      return {
        label: "Account",
        tone: "info",
        icon: "account",
      };

    default:
      return {
        label: "System",
        tone: "neutral",
        icon: "bell",
      };
  }
};

/* =========================================================
   NOTIFICATION ICON
========================================================= */

function NotificationIcon({
  type,
}) {
  switch (type) {
    case "transfer":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "check":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="m6 12 4 4 8-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "close":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="m8 8 8 8m0-8-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    case "cancel":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />

          <path
            d="m9 9 6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case "report":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M7 3h7l4 4v14H7V3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />

          <path
            d="M14 3v5h4M10 13h5M10 17h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case "clock":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />

          <path
            d="M12 8v5l3 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case "alert":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 4 3.8 19h16.4L12 4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />

          <path
            d="M12 9v4m0 3h.01"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case "account":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="8"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />

          <path
            d="M6 19c.7-3.3 2.8-5 6-5s5.3 1.7 6 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case "bell":
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 6-2.5 7-2.5 9h17c0-2-2.5-3-2.5-9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M10 20h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

/* =========================================================
   MORE ICON
========================================================= */

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="5"
        cy="12"
        r="1.5"
        fill="currentColor"
      />

      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="currentColor"
      />

      <circle
        cx="19"
        cy="12"
        r="1.5"
        fill="currentColor"
      />
    </svg>
  );
}

/* =========================================================
   READ ICON
========================================================= */

function ReadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m6 12 4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   UNREAD ICON
========================================================= */

function UnreadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M4 6h16v12H4V6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="m5 7 7 6 7-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   DELETE ICON
========================================================= */

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10 11v5m4-5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function NotificationItem({
  notification,

  onSelect,

  onMarkRead,
  onMarkUnread,
  onDelete,

  manageMode = false,
  selected = false,
  onToggleSelect,

  actionsDisabled = false,
}) {
  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const containerRef =
    useRef(null);

  /* =======================================================
     CLOSE MENU IF MANAGE MODE STARTS
  ======================================================= */

  useEffect(() => {
    if (manageMode) {
      setMenuOpen(false);
    }
  }, [
    manageMode,
  ]);

  /* =======================================================
     OUTSIDE CLICK / ESC
  ======================================================= */

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown =
      (event) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(
            event.target,
          )
        ) {
          setMenuOpen(false);
        }
      };

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setMenuOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    menuOpen,
  ]);

  if (!notification) {
    return null;
  }

  const presentation =
    getNotificationPresentation(
      notification,
    );

  const unread =
    notification?.read !== true;

  const time =
    formatNotificationTime(
      notification?.createdAt,
    );

  /* =======================================================
     MAIN CLICK
  ======================================================= */

  const handleMainClick = () => {
    if (actionsDisabled) {
      return;
    }

    setMenuOpen(false);

    if (manageMode) {
      onToggleSelect?.(
        notification,
      );

      return;
    }

    onSelect?.(
      notification,
    );
  };

  /* =======================================================
     MENU
  ======================================================= */

  const handleMenuToggle = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      actionsDisabled ||
      manageMode
    ) {
      return;
    }

    setMenuOpen(
      (current) =>
        !current,
    );
  };

  const handleMarkRead = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setMenuOpen(false);

    onMarkRead?.(
      notification,
    );
  };

  const handleMarkUnread = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setMenuOpen(false);

    onMarkUnread?.(
      notification,
    );
  };

  const handleDelete = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setMenuOpen(false);

    onDelete?.(
      notification,
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      ref={containerRef}
      className={[
        "app-notification-item",

        unread
          ? "is-unread"
          : "is-read",

        `is-${presentation.tone}`,

        manageMode
          ? "is-managing"
          : "",

        selected
          ? "is-selected"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =================================================
          MAIN AREA
      ================================================== */}

      <button
        type="button"
        className="app-notification-item-main"
        onClick={
          handleMainClick
        }
        aria-pressed={
          manageMode
            ? selected
            : undefined
        }
        disabled={
          actionsDisabled
        }
      >
        {/* ===============================================
            MANAGE CHECK
        =============================================== */}

        {manageMode && (
          <span
            className="app-notification-select-indicator"
            aria-hidden="true"
          >
            {selected && (
              <svg
                viewBox="0 0 20 20"
              >
                <path
                  d="m4.5 10 3.3 3.3 7.7-7.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        )}

        {/* ===============================================
            ICON
        =============================================== */}

        <span
          className="app-notification-item-icon"
          aria-hidden="true"
        >
          <NotificationIcon
            type={
              presentation.icon
            }
          />
        </span>

        {/* ===============================================
            CONTENT
        =============================================== */}

        <span className="app-notification-item-content">
          <span className="app-notification-item-topline">
            <span className="app-notification-item-category">
              {
                presentation.label
              }
            </span>

            {unread &&
              !manageMode && (
                <span className="app-notification-new-label">
                  New
                </span>
              )}
          </span>

          <strong className="app-notification-item-title">
            {notification?.title ||
              "Notification"}
          </strong>

          {notification?.message && (
            <span className="app-notification-item-message">
              {
                notification.message
              }
            </span>
          )}

          <span className="app-notification-item-time">
            {time}
          </span>
        </span>

        {/* ===============================================
            UNREAD DOT
        =============================================== */}

        {unread &&
          !manageMode && (
            <span
              className="app-notification-item-dot"
              aria-hidden="true"
            />
          )}
      </button>

      {/* =================================================
          NORMAL MORE MENU
      ================================================== */}

      {!manageMode && (
        <div className="app-notification-item-menu-wrap">
          <button
            type="button"
            className={`app-notification-more-button ${
              menuOpen
                ? "is-open"
                : ""
            }`}
            onClick={
              handleMenuToggle
            }
            aria-label="Notification options"
            aria-haspopup="menu"
            aria-expanded={
              menuOpen
            }
            disabled={
              actionsDisabled
            }
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div
              className="app-notification-item-menu"
              role="menu"
            >
              {unread ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={
                    handleMarkRead
                  }
                  disabled={
                    actionsDisabled
                  }
                >
                  <ReadIcon />

                  <span>
                    Mark as read
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={
                    handleMarkUnread
                  }
                  disabled={
                    actionsDisabled
                  }
                >
                  <UnreadIcon />

                  <span>
                    Mark as unread
                  </span>
                </button>
              )}

              <div
                className="app-notification-menu-divider"
                aria-hidden="true"
              />

              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={
                  handleDelete
                }
                disabled={
                  actionsDisabled
                }
              >
                <DeleteIcon />

                <span>
                  Delete
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationItem;