import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import NotificationBell from "../../common/notifications/NotificationBell";
import ThemeToggle from "../../common/themeToggle";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";
import notificationService from "../../services/notificationService";

import bagongPilipinasLogo from "../../assets/bagong-pilipinas-logo.svg";
import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import schoolDivisionLogo from "../../assets/school-division-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/common/notifications.css";

/* =========================================================
   CONSTANTS
========================================================= */

const NOTIFICATION_SYNC_INTERVAL_MS =
  30_000;

const TOPBAR_NOTIFICATION_LIMIT =
  10;

const TRANSFER_UPDATED_EVENT =
  "student-transfer-updated";

const DEFAULT_NOTIFICATION_UPDATED_EVENT =
  "notification-updated";

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

const normalizeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];

const normalizeCount = (value) => {
  let candidate =
    value;

  if (
    value !== null &&
    typeof value === "object"
  ) {
    candidate =
      value?.pendingCount ??
      value?.count ??
      value?.unreadCount ??
      value?.total ??
      0;
  }

  const parsed =
    Number(candidate);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
};

const getErrorMessage = (
  error,
  fallback,
) =>
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
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const user =
    authService.getUser();

  /* =======================================================
     NOTIFICATION STATE
  ======================================================= */

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  const [
    loadingNotifications,
    setLoadingNotifications,
  ] = useState(true);

  const [
    notificationError,
    setNotificationError,
  ] = useState("");

  const [
    notificationActionBusy,
    setNotificationActionBusy,
  ] = useState(false);

  const [
    markAllBusy,
    setMarkAllBusy,
  ] = useState(false);

  /* =======================================================
     REFS
  ======================================================= */

  const notificationCountCallbackRef =
    useRef(
      onNotificationCountChange,
    );

  const requestInFlightRef =
    useRef(false);

  const mountedRef =
    useRef(false);

  /* =======================================================
     USER
  ======================================================= */

  const userName =
    user?.name?.trim() ||
    "Adviser";

  const userInitial =
    userName
      .charAt(0)
      .toUpperCase() ||
    "A";

  const notificationUpdatedEvent =
    notificationService
      .getNotificationUpdatedEventName?.() ||
    DEFAULT_NOTIFICATION_UPDATED_EVENT;

  /* =======================================================
     CALLBACK REF
  ======================================================= */

  useEffect(() => {
    notificationCountCallbackRef.current =
      onNotificationCountChange;
  }, [
    onNotificationCountChange,
  ]);

  /* =======================================================
     MOUNT
  ======================================================= */

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  /* =======================================================
     LOAD TOPBAR DATA
  ======================================================= */

  const loadTopbarData =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          requestInFlightRef.current
        ) {
          return;
        }

        requestInFlightRef.current =
          true;

        try {
          if (
            !silent &&
            mountedRef.current
          ) {
            setLoadingNotifications(
              true,
            );
          }

          const [
            notificationResult,
            transferCountResult,
          ] =
            await Promise.allSettled([
              notificationService
                .getAdviserNotificationSummary(
                  {
                    size:
                      TOPBAR_NOTIFICATION_LIMIT,
                  },
                ),

              adviserService
                .getIncomingPendingTransferCount(),
            ]);

          if (
            !mountedRef.current
          ) {
            return;
          }

          /* ===============================================
             NOTIFICATIONS
          =============================================== */

          if (
            notificationResult.status ===
            "fulfilled"
          ) {
            const summary =
              notificationResult.value ||
              {};

            setNotifications(
              normalizeArray(
                summary?.notifications,
              ),
            );

            setUnreadNotificationCount(
              normalizeCount(
                summary?.unreadCount,
              ),
            );

            setNotificationError(
              "",
            );
          } else {
            const error =
              notificationResult.reason;

            if (silent) {
              console.warn(
                "Unable to automatically synchronize notifications:",
                error,
              );
            } else {
              console.error(
                "Unable to load notifications:",
                error,
              );

              setNotificationError(
                getErrorMessage(
                  error,
                  "Unable to load notifications.",
                ),
              );
            }
          }

          /* ===============================================
             PENDING TRANSFER SIDEBAR COUNT
          =============================================== */

          if (
            transferCountResult.status ===
            "fulfilled"
          ) {
            notificationCountCallbackRef
              .current?.(
                normalizeCount(
                  transferCountResult.value,
                ),
              );
          } else {
            console.warn(
              "Unable to synchronize pending transfer count:",
              transferCountResult.reason,
            );
          }
        } finally {
          requestInFlightRef.current =
            false;

          if (
            !silent &&
            mountedRef.current
          ) {
            setLoadingNotifications(
              false,
            );
          }
        }
      },
      [],
    );

  /* =======================================================
     INITIAL / ROUTE LOAD
  ======================================================= */

  useEffect(() => {
    void loadTopbarData();
  }, [
    loadTopbarData,
    location.pathname,
  ]);

  /* =======================================================
     AUTO SYNC
  ======================================================= */

  useEffect(() => {
    const synchronize = () => {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      void loadTopbarData({
        silent: true,
      });
    };

    const handleWindowFocus =
      () => {
        synchronize();
      };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          synchronize();
        }
      };

    const intervalId =
      window.setInterval(
        synchronize,
        NOTIFICATION_SYNC_INTERVAL_MS,
      );

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    window.addEventListener(
      TRANSFER_UPDATED_EVENT,
      synchronize,
    );

    window.addEventListener(
      notificationUpdatedEvent,
      synchronize,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      window.removeEventListener(
        TRANSFER_UPDATED_EVENT,
        synchronize,
      );

      window.removeEventListener(
        notificationUpdatedEvent,
        synchronize,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    loadTopbarData,
    notificationUpdatedEvent,
  ]);

  /* =======================================================
     REPLACE ONE LOCALLY
  ======================================================= */

  const replaceNotificationLocally =
    useCallback(
      (
        notificationId,
        updatedNotification,
      ) => {
        if (
          !notificationId ||
          !updatedNotification
        ) {
          return;
        }

        setNotifications(
          (current) =>
            current.map(
              (notification) =>
                notification?.id ===
                notificationId
                  ? updatedNotification
                  : notification,
            ),
        );
      },
      [],
    );

  /* =======================================================
     MARK ONE READ
  ======================================================= */

  const handleMarkRead =
    async (
      notification,
    ) => {
      if (
        !notification?.id ||
        notification?.read
      ) {
        return;
      }

      try {
        setNotificationActionBusy(
          true,
        );

        const updatedNotification =
          await notificationService
            .markNotificationRead(
              notification.id,
            );

        if (
          !mountedRef.current
        ) {
          return;
        }

        replaceNotificationLocally(
          notification.id,
          updatedNotification,
        );

        setUnreadNotificationCount(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        );
      } catch (error) {
        console.error(
          "Unable to mark notification as read:",
          error,
        );
      } finally {
        if (
          mountedRef.current
        ) {
          setNotificationActionBusy(
            false,
          );
        }
      }
    };

  /* =======================================================
     MARK ONE UNREAD
  ======================================================= */

  const handleMarkUnread =
    async (
      notification,
    ) => {
      if (
        !notification?.id ||
        !notification?.read
      ) {
        return;
      }

      try {
        setNotificationActionBusy(
          true,
        );

        const updatedNotification =
          await notificationService
            .markNotificationUnread(
              notification.id,
            );

        if (
          !mountedRef.current
        ) {
          return;
        }

        replaceNotificationLocally(
          notification.id,
          updatedNotification,
        );

        setUnreadNotificationCount(
          (current) =>
            current + 1,
        );
      } catch (error) {
        console.error(
          "Unable to mark notification as unread:",
          error,
        );
      } finally {
        if (
          mountedRef.current
        ) {
          setNotificationActionBusy(
            false,
          );
        }
      }
    };

  /* =======================================================
     DELETE ONE
  ======================================================= */

  const handleDeleteNotification =
    async (
      notification,
    ) => {
      if (!notification?.id) {
        return;
      }

      const wasUnread =
        notification?.read !==
        true;

      try {
        setNotificationActionBusy(
          true,
        );

        await notificationService
          .deleteNotification(
            notification.id,
          );

        if (
          !mountedRef.current
        ) {
          return;
        }

        setNotifications(
          (current) =>
            current.filter(
              (item) =>
                item?.id !==
                notification.id,
            ),
        );

        if (wasUnread) {
          setUnreadNotificationCount(
            (current) =>
              Math.max(
                0,
                current - 1,
              ),
          );
        }
      } catch (error) {
        console.error(
          "Unable to delete notification:",
          error,
        );
      } finally {
        if (
          mountedRef.current
        ) {
          setNotificationActionBusy(
            false,
          );
        }
      }
    };

  /* =======================================================
     BULK DELETE

     Uses the existing:
     POST /notifications/bulk/delete
  ======================================================= */

  const handleBulkDeleteNotifications =
    async (
      notificationIds,
    ) => {
      const ids =
        Array.isArray(
          notificationIds,
        )
          ? [
              ...new Set(
                notificationIds.filter(
                  Boolean,
                ),
              ),
            ]
          : [];

      if (
        ids.length === 0
      ) {
        return;
      }

      const idSet =
        new Set(ids);

      /*
       * Count how many selected items are currently unread
       * before removing them locally.
       */
      const selectedUnreadCount =
        notifications.reduce(
          (
            count,
            notification,
          ) => {
            if (
              !idSet.has(
                notification?.id,
              )
            ) {
              return count;
            }

            return notification?.read ===
              true
              ? count
              : count + 1;
          },
          0,
        );

      try {
        setNotificationActionBusy(
          true,
        );

        await notificationService
          .deleteNotifications(
            ids,
          );

        if (
          !mountedRef.current
        ) {
          return;
        }

        setNotifications(
          (current) =>
            current.filter(
              (notification) =>
                !idSet.has(
                  notification?.id,
                ),
            ),
        );

        if (
          selectedUnreadCount >
          0
        ) {
          setUnreadNotificationCount(
            (current) =>
              Math.max(
                0,
                current -
                  selectedUnreadCount,
              ),
          );
        }
      } catch (error) {
        console.error(
          "Unable to delete selected notifications:",
          error,
        );

        /*
         * Important:
         * Re-throw so NotificationDropdown knows the
         * operation failed and can keep Manage mode open.
         */
        throw error;
      } finally {
        if (
          mountedRef.current
        ) {
          setNotificationActionBusy(
            false,
          );
        }
      }
    };

  /* =======================================================
     MARK ALL READ
  ======================================================= */

  const handleMarkAllRead =
    async () => {
      if (
        unreadNotificationCount <=
        0
      ) {
        return;
      }

      try {
        setMarkAllBusy(
          true,
        );

        await notificationService
          .markAllNotificationsRead();

        if (
          !mountedRef.current
        ) {
          return;
        }

        const now =
          new Date().toISOString();

        setNotifications(
          (current) =>
            current.map(
              (notification) => ({
                ...notification,

                read: true,
                unread: false,

                requiresAction:
                  false,

                readAt:
                  notification?.readAt ||
                  now,
              }),
            ),
        );

        setUnreadNotificationCount(
          0,
        );
      } catch (error) {
        console.error(
          "Unable to mark all notifications as read:",
          error,
        );
      } finally {
        if (
          mountedRef.current
        ) {
          setMarkAllBusy(
            false,
          );
        }
      }
    };

  /* =======================================================
     OPEN NOTIFICATION

     Click:
     - mark read
     - navigate to feature
  ======================================================= */

  const handleNotificationSelect =
    async (
      notification,
    ) => {
      if (!notification) {
        return;
      }

      const action =
        notification?.action ||
        notificationService
          .getNotificationAction?.(
            notification,
          );

      if (
        notification?.id &&
        !notification?.read
      ) {
        try {
          const updatedNotification =
            await notificationService
              .markNotificationRead(
                notification.id,
              );

          if (
            mountedRef.current
          ) {
            replaceNotificationLocally(
              notification.id,
              updatedNotification,
            );

            setUnreadNotificationCount(
              (current) =>
                Math.max(
                  0,
                  current - 1,
                ),
            );
          }
        } catch (error) {
          console.warn(
            "Unable to mark notification as read:",
            error,
          );
        }
      }

      if (!action?.path) {
        return;
      }

      navigate(
        action.path,
        {
          state:
            action?.state ??
            null,
        },
      );
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
          onClick={
            onMenuOpen
          }
          aria-label="Open navigation menu"
          aria-expanded={
            menuOpen
          }
          aria-controls="adviser-mobile-sidebar"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="councilor-header-copy">
          <span className="councilor-eyebrow">
            {eyebrow}
          </span>

          <h1>
            {title}
          </h1>

          <p>
            {description}
          </p>
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
          {INSTITUTIONAL_LOGOS.map(
            (logo) => (
              <img
                key={logo.alt}
                src={logo.src}
                alt={logo.alt}
                title={logo.alt}
              />
            ),
          )}
        </div>

        <div
          className="councilor-header-divider"
          aria-hidden="true"
        />

        <ThemeToggle />

        <div
          className="councilor-header-divider"
          aria-hidden="true"
        />

        <NotificationBell
          notifications={
            notifications
          }
          badgeCount={
            unreadNotificationCount
          }
          loading={
            loadingNotifications
          }
          error={
            notificationError
          }
          onNotificationSelect={
            handleNotificationSelect
          }
          onMarkRead={
            handleMarkRead
          }
          onMarkUnread={
            handleMarkUnread
          }
          onDelete={
            handleDeleteNotification
          }
          onMarkAllRead={
            handleMarkAllRead
          }
          onBulkDelete={
            handleBulkDeleteNotifications
          }
          actionsDisabled={
            notificationActionBusy
          }
          markAllBusy={
            markAllBusy
          }
        />

        <div
          className="councilor-header-divider adviser-notification-divider"
          aria-hidden="true"
        />

        <div className="councilor-user">
          <div className="councilor-avatar">
            {userInitial}
          </div>

          <div className="councilor-user-copy">
            <strong>
              {userName}
            </strong>

            <span>
              Class Adviser
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdviserTopbar;