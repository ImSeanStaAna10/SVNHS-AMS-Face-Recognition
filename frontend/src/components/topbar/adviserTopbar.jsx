import { useCallback, useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { useNavigate } from "react-router-dom";

import NotificationBell from "../../common/notifications/NotificationBell";
import ThemeToggle from "../../common/themeToggle";

import authService from "../../services/authService";
import notificationService from "../../services/notificationService";

import {
  useAdviserNotificationSummary,
  useIncomingPendingTransferCount,
} from "../../hooks/queries/useNotificationQueries";

import queryKeys from "../../lib/query/queryKeys";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/common/notifications.css";

/* =========================================================
   CONSTANTS
========================================================= */

const NOTIFICATION_SYNC_INTERVAL_MS = 60_000;

const TOPBAR_NOTIFICATION_LIMIT = 5;

const TRANSFER_UPDATED_EVENT = "student-transfer-updated";

const DEFAULT_NOTIFICATION_UPDATED_EVENT = "notification-updated";

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

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeCount = (value) => {
  let candidate = value;

  if (value !== null && typeof value === "object") {
    candidate =
      value?.pendingCount ??
      value?.count ??
      value?.unreadCount ??
      value?.total ??
      0;
  }

  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  fallback;

/* =========================================================
   COMPONENT
========================================================= */

function AdviserTopbar({
  title = "Dashboard",
  eyebrow = "ADVISER PORTAL",
  description = "Attendance Management System",

  onMenuOpen,
  menuOpen = false,

  /*
   * This still controls the pending
   * transfer sidebar badge.
   *
   * It is NOT the notification unread count.
   */
  onNotificationCountChange,
}) {
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const user = authService.getUser();

  /* =======================================================
     NOTIFICATION / BADGE QUERIES
  ======================================================= */

  const notificationSummaryQuery = useAdviserNotificationSummary(
    {
      size: TOPBAR_NOTIFICATION_LIMIT,
    },
    {
      refetchInterval: NOTIFICATION_SYNC_INTERVAL_MS,

      refetchIntervalInBackground: false,
    },
  );

  const pendingTransferCountQuery = useIncomingPendingTransferCount({
    refetchInterval: NOTIFICATION_SYNC_INTERVAL_MS,

    refetchIntervalInBackground: false,
  });

  const notificationSummary = notificationSummaryQuery.data || {};

  const notifications = normalizeArray(notificationSummary?.notifications);

  const unreadNotificationCount = normalizeCount(
    notificationSummary?.unreadCount,
  );

  /*
   * Initial uncached load only.
   * Background synchronization keeps the existing dropdown
   * content visible.
   */
  const loadingNotifications = notificationSummaryQuery.isLoading;

  const notificationError =
    notificationSummaryQuery.data == null && notificationSummaryQuery.error
      ? getErrorMessage(
          notificationSummaryQuery.error,
          "Unable to load notifications.",
        )
      : "";

  const [notificationActionBusy, setNotificationActionBusy] = useState(false);

  const [markAllBusy, setMarkAllBusy] = useState(false);

  /* =======================================================
     USER
  ======================================================= */

  const userName = user?.name?.trim() || "Adviser";

  const userInitial = userName.charAt(0).toUpperCase() || "A";

  const notificationUpdatedEvent =
    notificationService.getNotificationUpdatedEventName?.() ||
    DEFAULT_NOTIFICATION_UPDATED_EVENT;

  /* =======================================================
     PENDING TRANSFER SIDEBAR BADGE
  ======================================================= */

  useEffect(() => {
    if (pendingTransferCountQuery.data === undefined) {
      return;
    }

    onNotificationCountChange?.(normalizeCount(pendingTransferCountQuery.data));
  }, [pendingTransferCountQuery.data, onNotificationCountChange]);

  useEffect(() => {
    if (!pendingTransferCountQuery.error) {
      return;
    }

    console.warn(
      "Unable to synchronize pending transfer count:",
      pendingTransferCountQuery.error,
    );
  }, [pendingTransferCountQuery.error]);

  /* =======================================================
     CUSTOM UPDATE EVENTS

     TanStack Query already owns:
     - route cache reuse
     - window-focus refresh for stale data
     - reconnect refresh
     - 60-second polling

     Custom app events only invalidate the affected shared
     cache so active consumers can synchronize immediately.
  ======================================================= */

  useEffect(() => {
    const synchronizeTransfers = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.transfers.pendingCount(),
      });
    };

    window.addEventListener(TRANSFER_UPDATED_EVENT, synchronizeTransfers);

    return () => {
      window.removeEventListener(TRANSFER_UPDATED_EVENT, synchronizeTransfers);
    };
  }, [queryClient]);

  useEffect(() => {
    const synchronizeNotifications = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.notifications.all(),
      });
    };

    window.addEventListener(notificationUpdatedEvent, synchronizeNotifications);

    return () => {
      window.removeEventListener(
        notificationUpdatedEvent,
        synchronizeNotifications,
      );
    };
  }, [queryClient, notificationUpdatedEvent]);

  /* =======================================================
     TOPBAR SUMMARY CACHE UPDATE
  ======================================================= */

  const updateNotificationSummary = useCallback(
    (updater) => {
      queryClient.setQueryData(
        queryKeys.adviser.notifications.topbar(TOPBAR_NOTIFICATION_LIMIT),
        (current) => {
          if (!current) {
            return current;
          }

          return updater(current);
        },
      );
    },
    [queryClient],
  );

  /* =======================================================
     REPLACE ONE LOCALLY
  ======================================================= */

  const replaceNotificationLocally = useCallback(
    (notificationId, updatedNotification) => {
      if (!notificationId || !updatedNotification) {
        return;
      }

      updateNotificationSummary((current) => ({
        ...current,

        notifications: normalizeArray(current?.notifications).map(
          (notification) =>
            notification?.id === notificationId
              ? updatedNotification
              : notification,
        ),
      }));
    },
    [updateNotificationSummary],
  );

  /* =======================================================
     MARK ONE READ
  ======================================================= */

  const handleMarkRead = async (notification) => {
    if (!notification?.id || notification?.read) {
      return;
    }

    try {
      setNotificationActionBusy(true);

      const updatedNotification =
        await notificationService.markNotificationRead(notification.id);

      replaceNotificationLocally(notification.id, updatedNotification);

      updateNotificationSummary((current) => ({
        ...current,

        unreadCount: Math.max(0, normalizeCount(current?.unreadCount) - 1),
      }));
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    } finally {
      setNotificationActionBusy(false);
    }
  };

  /* =======================================================
     MARK ONE UNREAD
  ======================================================= */

  const handleMarkUnread = async (notification) => {
    if (!notification?.id || !notification?.read) {
      return;
    }

    try {
      setNotificationActionBusy(true);

      const updatedNotification =
        await notificationService.markNotificationUnread(notification.id);

      replaceNotificationLocally(notification.id, updatedNotification);

      updateNotificationSummary((current) => ({
        ...current,

        unreadCount: normalizeCount(current?.unreadCount) + 1,
      }));
    } catch (error) {
      console.error("Unable to mark notification as unread:", error);
    } finally {
      setNotificationActionBusy(false);
    }
  };

  /* =======================================================
     DELETE ONE
  ======================================================= */

  const handleDeleteNotification = async (notification) => {
    if (!notification?.id) {
      return;
    }

    const wasUnread = notification?.read !== true;

    try {
      setNotificationActionBusy(true);

      await notificationService.deleteNotification(notification.id);

      updateNotificationSummary((current) => ({
        ...current,

        notifications: normalizeArray(current?.notifications).filter(
          (item) => item?.id !== notification.id,
        ),

        unreadCount: wasUnread
          ? Math.max(0, normalizeCount(current?.unreadCount) - 1)
          : normalizeCount(current?.unreadCount),

        totalElements: Math.max(0, normalizeCount(current?.totalElements) - 1),
      }));
    } catch (error) {
      console.error("Unable to delete notification:", error);
    } finally {
      setNotificationActionBusy(false);
    }
  };

  /* =======================================================
     BULK DELETE

     Uses the existing:
     POST /notifications/bulk/delete
  ======================================================= */

  const handleBulkDeleteNotifications = async (notificationIds) => {
    const ids = Array.isArray(notificationIds)
      ? [...new Set(notificationIds.filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);

    /*
     * Count how many selected items are currently unread
     * before removing them locally.
     */
    const selectedUnreadCount = notifications.reduce((count, notification) => {
      if (!idSet.has(notification?.id)) {
        return count;
      }

      return notification?.read === true ? count : count + 1;
    }, 0);

    try {
      setNotificationActionBusy(true);

      await notificationService.deleteNotifications(ids);

      updateNotificationSummary((current) => ({
        ...current,

        notifications: normalizeArray(current?.notifications).filter(
          (notification) => !idSet.has(notification?.id),
        ),

        unreadCount: Math.max(
          0,
          normalizeCount(current?.unreadCount) - selectedUnreadCount,
        ),

        totalElements: Math.max(
          0,
          normalizeCount(current?.totalElements) - ids.length,
        ),
      }));
    } catch (error) {
      console.error("Unable to delete selected notifications:", error);

      /*
       * Important:
       * Re-throw so NotificationDropdown knows the
       * operation failed and can keep Manage mode open.
       */
      throw error;
    } finally {
      setNotificationActionBusy(false);
    }
  };

  /* =======================================================
     MARK ALL READ
  ======================================================= */

  const handleMarkAllRead = async () => {
    if (unreadNotificationCount <= 0) {
      return;
    }

    try {
      setMarkAllBusy(true);

      await notificationService.markAllNotificationsRead();

      const now = new Date().toISOString();

      updateNotificationSummary((current) => ({
        ...current,

        notifications: normalizeArray(current?.notifications).map(
          (notification) => ({
            ...notification,

            read: true,
            unread: false,

            requiresAction: false,

            readAt: notification?.readAt || now,
          }),
        ),

        unreadCount: 0,
      }));
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    } finally {
      setMarkAllBusy(false);
    }
  };

  /* =======================================================
     OPEN NOTIFICATION

     Click:
     - mark read
     - navigate to feature
  ======================================================= */

  const handleNotificationSelect = async (notification) => {
    if (!notification) {
      return;
    }

    const action =
      notification?.action ||
      notificationService.getNotificationAction?.(notification);

    if (notification?.id && !notification?.read) {
      try {
        const updatedNotification =
          await notificationService.markNotificationRead(notification.id);

        replaceNotificationLocally(notification.id, updatedNotification);

        updateNotificationSummary((current) => ({
          ...current,

          unreadCount: Math.max(0, normalizeCount(current?.unreadCount) - 1),
        }));
      } catch (error) {
        console.warn("Unable to mark notification as read:", error);
      }
    }

    if (!action?.path) {
      return;
    }

    navigate(action.path, {
      state: action?.state ?? null,
    });
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <header className="councilor-header adviser-header">
      {/* ===================================================
          LEADING
      ==================================================== */}

      <div className="adviser-header-leading">
        <button
          type="button"
          className="adviser-mobile-menu-button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="adviser-mobile-sidebar"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="councilor-header-copy">
          <span className="councilor-eyebrow">{eyebrow}</span>

          <h1>{title}</h1>

          <p>{description}</p>
        </div>
      </div>

      {/* ===================================================
          ACTIONS
      ==================================================== */}

      <div className="councilor-header-actions">
        <div
          className="councilor-header-logos"
          aria-label="Institutional logos"
        >
          {INSTITUTIONAL_LOGOS.map((logo) => (
            <img
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              title={logo.alt}
            />
          ))}
        </div>

        <div className="councilor-header-divider" aria-hidden="true" />

        <ThemeToggle />

        <div className="councilor-header-divider" aria-hidden="true" />

        <NotificationBell
          notifications={notifications}
          badgeCount={unreadNotificationCount}
          loading={loadingNotifications}
          error={notificationError}
          onNotificationSelect={handleNotificationSelect}
          onMarkRead={handleMarkRead}
          onMarkUnread={handleMarkUnread}
          onDelete={handleDeleteNotification}
          onMarkAllRead={handleMarkAllRead}
          onBulkDelete={handleBulkDeleteNotifications}
          actionsDisabled={notificationActionBusy}
          markAllBusy={markAllBusy}
        />

        <div
          className="councilor-header-divider adviser-notification-divider"
          aria-hidden="true"
        />

        <div className="councilor-user">
          <div className="councilor-avatar">{userInitial}</div>

          <div className="councilor-user-copy">
            <strong>{userName}</strong>

            <span>Class Adviser</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdviserTopbar;
