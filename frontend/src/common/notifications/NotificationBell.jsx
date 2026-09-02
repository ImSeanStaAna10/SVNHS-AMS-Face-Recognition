import {
  useEffect,
  useRef,
  useState,
} from "react";

import NotificationDropdown from "./NotificationDropdown";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];

const normalizeCount = (
  value,
  fallback = 0,
) => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return Math.floor(parsed);
};

/* =========================================================
   BELL ICON
========================================================= */

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10 21h4"
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

function NotificationBell({
  notifications = [],

  badgeCount,

  loading = false,
  error = "",

  onNotificationSelect,

  onMarkRead,
  onMarkUnread,
  onDelete,

  onMarkAllRead,
  onBulkDelete,

  actionsDisabled = false,
  markAllBusy = false,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const containerRef =
    useRef(null);

  const normalizedNotifications =
    normalizeArray(
      notifications,
    );

  const notificationCount =
    badgeCount !== undefined &&
    badgeCount !== null
      ? normalizeCount(
          badgeCount,
          0,
        )
      : normalizedNotifications.filter(
          (notification) =>
            notification?.read !==
            true,
        ).length;

  /* =======================================================
     OUTSIDE CLICK / ESC
  ======================================================= */

  useEffect(() => {
    if (!open) {
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
          setOpen(false);
        }
      };

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setOpen(false);
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
    open,
  ]);

  /* =======================================================
     SELECT NOTIFICATION
  ======================================================= */

  const handleNotificationSelect =
    (notification) => {
      setOpen(false);

      onNotificationSelect?.(
        notification,
      );
    };

  /* =======================================================
     ACCESSIBLE LABEL
  ======================================================= */

  const bellLabel =
    notificationCount > 0
      ? `${notificationCount} unread notification${
          notificationCount === 1
            ? ""
            : "s"
        }`
      : "Notifications";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      ref={containerRef}
      className="app-notification-bell-container"
    >
      <button
        type="button"
        className={`app-notification-bell ${
          open
            ? "is-open"
            : ""
        }`}
        aria-label={
          bellLabel
        }
        aria-haspopup="dialog"
        aria-expanded={
          open
        }
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
      >
        <BellIcon />

        {notificationCount > 0 && (
          <span
            className="app-notification-badge"
            aria-hidden="true"
          >
            {notificationCount >
            99
              ? "99+"
              : notificationCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={
            normalizedNotifications
          }
          unreadCount={
            notificationCount
          }
          loading={
            loading
          }
          error={
            error
          }
          onNotificationSelect={
            handleNotificationSelect
          }
          onMarkRead={
            onMarkRead
          }
          onMarkUnread={
            onMarkUnread
          }
          onDelete={
            onDelete
          }
          onMarkAllRead={
            onMarkAllRead
          }
          onBulkDelete={
            onBulkDelete
          }
          actionsDisabled={
            actionsDisabled
          }
          markAllBusy={
            markAllBusy
          }
        />
      )}
    </div>
  );
}

export default NotificationBell;