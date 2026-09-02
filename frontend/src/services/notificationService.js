import api from "./api";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const NOTIFICATION_UPDATED_EVENT =
  "notification-updated";

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];

const normalizeString = (value) =>
  String(value ?? "").trim();

const normalizeUpper = (value) =>
  normalizeString(value).toUpperCase();

const normalizePage = (value) => {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return DEFAULT_PAGE;
  }

  return Math.floor(parsed);
};

const normalizePageSize = (value) => {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    MAX_PAGE_SIZE,
    Math.floor(parsed),
  );
};

const normalizeIds = (values) => {
  const normalized = [
    ...new Set(
      normalizeArray(values)
        .map((value) =>
          normalizeString(value),
        )
        .filter(Boolean),
    ),
  ];

  if (normalized.length === 0) {
    throw new Error(
      "At least one notification ID is required.",
    );
  }

  if (normalized.length > 200) {
    throw new Error(
      "A maximum of 200 notifications may be updated at once.",
    );
  }

  return normalized;
};

/* =========================================================
   DATE PARAMETER
========================================================= */

const normalizeDateParameter = (value) => {
  if (!value) {
    return undefined;
  }

  /*
   * Already YYYY-MM-DD
   */
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim(),
    )
  ) {
    return value.trim();
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new Error(
      "Invalid notification date.",
    );
  }

  const year =
    parsed.getFullYear();

  const month =
    String(
      parsed.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      parsed.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* =========================================================
   READ FILTER
========================================================= */

const normalizeReadFilter = (value) => {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  if (
    value === "true" ||
    value === "TRUE"
  ) {
    return true;
  }

  if (
    value === "false" ||
    value === "FALSE"
  ) {
    return false;
  }

  return undefined;
};

/* =========================================================
   ROUTING HELPERS

   Backend stores business references only.
   Frontend owns application routes.
========================================================= */

const getTransferAction = (
  notification,
) => {
  const type =
    normalizeUpper(
      notification?.type,
    );

  const requestId =
    notification?.referenceId ||
    "";

  switch (type) {
    case "STUDENT_TRANSFER_REQUESTED":
      return {
        label: "Review Request",

        path:
          "/adviser/transfers",

        state: {
          tab: "INCOMING",
          requestId,
        },
      };

    case "STUDENT_TRANSFER_APPROVED":
      return {
        label: "View Transfer",

        path:
          "/adviser/transfers",

        state: {
          tab: "OUTGOING",
          requestId,
        },
      };

    case "STUDENT_TRANSFER_REJECTED":
      return {
        label: "View Transfer",

        path:
          "/adviser/transfers",

        state: {
          tab: "OUTGOING",
          requestId,
        },
      };

    case "STUDENT_TRANSFER_CANCELLED":
      return {
        label: "View Transfer",

        path:
          "/adviser/transfers",

        state: {
          tab: "INCOMING",
          requestId,
        },
      };

    default:
      return {
        label: "View Transfer",

        path:
          "/adviser/transfers",

        state: {
          tab: "INCOMING",
          requestId,
        },
      };
  }
};

const getReportAction = (
  notification,
) => ({
  label: "View Reports",

  path:
    "/adviser/attendance-records",

  state: {
    notificationReferenceId:
      notification?.referenceId ||
      null,

    notificationType:
      notification?.type ||
      null,
  },
});

const getAttendanceSessionAction = (
  notification,
) => ({
  label: "View Attendance",

  path:
    "/adviser/attendance/history",

  state: {
    sessionId:
      notification?.referenceId ||
      null,
  },
});

const getFaceConflictAction = (
  notification,
) => ({
  label: "Review Student",

  path:
    "/adviser/students",

  state: {
    faceConflictId:
      notification?.referenceId ||
      null,
  },
});

const getAccountAction = () => ({
  label: "View Account",

  path:
    "/adviser/dashboard",

  state: null,
});

/* =========================================================
   GENERIC ACTION RESOLVER
========================================================= */

const getNotificationAction = (
  notification,
) => {
  const referenceType =
    normalizeUpper(
      notification?.referenceType,
    );

  const type =
    normalizeUpper(
      notification?.type,
    );

  switch (referenceType) {
    case "STUDENT_TRANSFER":
      return getTransferAction(
        notification,
      );

    case "ATTENDANCE_REPORT":
      return getReportAction(
        notification,
      );

    case "ATTENDANCE_SESSION":
      return getAttendanceSessionAction(
        notification,
      );

    case "FACE_CONFLICT":
      return getFaceConflictAction(
        notification,
      );

    case "USER_ACCOUNT":
      return getAccountAction();

    default:
      break;
  }

  /*
   * Type fallback.
   *
   * Useful if a legacy notification does not have
   * referenceType populated.
   */
  if (
    type.startsWith(
      "STUDENT_TRANSFER_",
    )
  ) {
    return getTransferAction(
      notification,
    );
  }

  if (
    type === "WEEKLY_REPORT_READY" ||
    type === "MONTHLY_REPORT_READY" ||
    type === "REPORT_GENERATION_FAILED"
  ) {
    return getReportAction(
      notification,
    );
  }

  if (
    type ===
    "ATTENDANCE_SESSION_AUTO_ENDED"
  ) {
    return getAttendanceSessionAction(
      notification,
    );
  }

  if (
    type ===
    "FACE_CONFLICT_REVIEW_REQUIRED"
  ) {
    return getFaceConflictAction(
      notification,
    );
  }

  if (
    type ===
    "ACCOUNT_PASSWORD_RESET"
  ) {
    return getAccountAction();
  }

  /*
   * SYSTEM_NOTICE or unknown notification:
   * no forced navigation.
   */
  return null;
};

/* =========================================================
   UI TYPE

   Existing NotificationItem helpers currently understand
   broad categories such as STUDENT_TRANSFER, ATTENDANCE,
   ACCOUNT and SYSTEM.

   Keep that compatibility while retaining the full backend
   notification type separately as eventType.
========================================================= */

const getUiNotificationType = (
  notification,
) => {
  const type =
    normalizeUpper(
      notification?.type,
    );

  const referenceType =
    normalizeUpper(
      notification?.referenceType,
    );

  if (
    referenceType ===
      "STUDENT_TRANSFER" ||
    type.startsWith(
      "STUDENT_TRANSFER_",
    )
  ) {
    return "STUDENT_TRANSFER";
  }

  if (
    referenceType ===
      "ATTENDANCE_REPORT" ||
    referenceType ===
      "ATTENDANCE_SESSION" ||
    type.includes("REPORT") ||
    type.includes("ATTENDANCE")
  ) {
    return "ATTENDANCE";
  }

  if (
    referenceType ===
      "USER_ACCOUNT" ||
    type.includes("ACCOUNT") ||
    type.includes("PASSWORD")
  ) {
    return "ACCOUNT";
  }

  if (
    referenceType ===
      "FACE_CONFLICT" ||
    type.includes("FACE_CONFLICT")
  ) {
    return "SYSTEM";
  }

  return "SYSTEM";
};

/* =========================================================
   BACKEND -> FRONTEND NOTIFICATION MAPPER
========================================================= */

const mapNotification = (
  notification,
) => {
  if (!notification) {
    return null;
  }

  const read =
    notification?.read === true ||
    Boolean(
      notification?.readAt,
    );

  return {
    /*
     * Notification ID
     */
    id:
      notification?.id ||
      "",

    /*
     * Broad UI category for the existing icon/helper system.
     */
    type:
      getUiNotificationType(
        notification,
      ),

    /*
     * Exact backend event type.
     *
     * Example:
     * STUDENT_TRANSFER_APPROVED
     */
    eventType:
      notification?.type ||
      "SYSTEM_NOTICE",

    title:
      notification?.title ||
      "Notification",

    message:
      notification?.message ||
      "",

    referenceType:
      notification?.referenceType ||
      null,

    referenceId:
      notification?.referenceId ||
      null,

    createdAt:
      notification?.createdAt ||
      null,

    readAt:
      notification?.readAt ||
      null,

    read,

    unread:
      !read,

    /*
     * Keep compatibility with our current NotificationItem.
     *
     * Previously this meant "pending action".
     * Now it visually represents an unread notification.
     */
    requiresAction:
      !read,

    /*
     * We no longer receive student/section metadata directly
     * from NotificationResponse.
     *
     * Future specialized payload metadata may be added without
     * changing the basic notification API.
     */
    meta: {
      referenceType:
        notification?.referenceType ||
        null,

      referenceId:
        notification?.referenceId ||
        null,
    },

    action:
      getNotificationAction(
        notification,
      ),

    /*
     * Preserve original backend response for advanced screens.
     */
    raw:
      notification,
  };
};

/* =========================================================
   NORMALIZE PAGE RESPONSE
========================================================= */

const normalizeNotificationPage = (
  data,
) => {
  /*
   * Expected backend:
   *
   * {
   *   content: [],
   *   page,
   *   size,
   *   totalElements,
   *   totalPages,
   *   first,
   *   last
   * }
   */

  const content =
    normalizeArray(
      data?.content,
    )
      .map(
        mapNotification,
      )
      .filter(Boolean);

  return {
    content,

    page:
      Number(
        data?.page ?? 0,
      ),

    size:
      Number(
        data?.size ??
          content.length,
      ),

    totalElements:
      Number(
        data?.totalElements ??
          content.length,
      ),

    totalPages:
      Number(
        data?.totalPages ??
          (content.length
            ? 1
            : 0),
      ),

    first:
      data?.first !== false,

    last:
      data?.last !== false,
  };
};

/* =========================================================
   NOTIFICATION UPDATE EVENT

   AdviserTopbar can listen to this event and refresh
   immediately after read/delete/bulk operations.
========================================================= */

const dispatchNotificationUpdated =
  () => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    window.dispatchEvent(
      new Event(
        NOTIFICATION_UPDATED_EVENT,
      ),
    );
  };

/* =========================================================
   GET NOTIFICATIONS

   Supports:
   - pagination
   - read/unread filter
   - type filter
   - date range
========================================================= */

const getNotifications = async ({
  page = DEFAULT_PAGE,
  size = DEFAULT_PAGE_SIZE,
  read,
  type,
  fromDate,
  toDate,
} = {}) => {
  const params = {
    page:
      normalizePage(page),

    size:
      normalizePageSize(size),
  };

  const normalizedRead =
    normalizeReadFilter(read);

  if (
    normalizedRead !==
    undefined
  ) {
    params.read =
      normalizedRead;
  }

  const normalizedType =
    normalizeUpper(type);

  if (normalizedType) {
    params.type =
      normalizedType;
  }

  const normalizedFromDate =
    normalizeDateParameter(
      fromDate,
    );

  const normalizedToDate =
    normalizeDateParameter(
      toDate,
    );

  if (normalizedFromDate) {
    params.fromDate =
      normalizedFromDate;
  }

  if (normalizedToDate) {
    params.toDate =
      normalizedToDate;
  }

  const response =
    await api.get(
      "/notifications",
      {
        params,
      },
    );

  return normalizeNotificationPage(
    response.data,
  );
};

/* =========================================================
   UNREAD NOTIFICATIONS
========================================================= */

const getUnreadNotifications =
  async ({
    page = DEFAULT_PAGE,
    size = DEFAULT_PAGE_SIZE,
  } = {}) =>
    getNotifications({
      page,
      size,
      read: false,
    });

/* =========================================================
   UNREAD COUNT
========================================================= */

const getUnreadCount =
  async () => {
    const response =
      await api.get(
        "/notifications/unread-count",
      );

    const value =
      response?.data?.unreadCount;

    const count =
      Number(value);

    return Number.isFinite(count)
      ? Math.max(
          0,
          count,
        )
      : 0;
  };

/* =========================================================
   MARK ONE AS READ
========================================================= */

const markNotificationRead =
  async (
    notificationId,
  ) => {
    const id =
      normalizeString(
        notificationId,
      );

    if (!id) {
      throw new Error(
        "Notification ID is required.",
      );
    }

    const response =
      await api.patch(
        `/notifications/${id}/read`,
      );

    dispatchNotificationUpdated();

    return mapNotification(
      response.data,
    );
  };

/* =========================================================
   MARK ONE AS UNREAD
========================================================= */

const markNotificationUnread =
  async (
    notificationId,
  ) => {
    const id =
      normalizeString(
        notificationId,
      );

    if (!id) {
      throw new Error(
        "Notification ID is required.",
      );
    }

    const response =
      await api.patch(
        `/notifications/${id}/unread`,
      );

    dispatchNotificationUpdated();

    return mapNotification(
      response.data,
    );
  };

/* =========================================================
   MARK ALL AS READ
========================================================= */

const markAllNotificationsRead =
  async () => {
    const response =
      await api.patch(
        "/notifications/read-all",
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   BULK MARK READ
========================================================= */

const markNotificationsRead =
  async (
    notificationIds,
  ) => {
    const ids =
      normalizeIds(
        notificationIds,
      );

    const response =
      await api.patch(
        "/notifications/bulk/read",
        {
          notificationIds:
            ids,
        },
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   BULK MARK UNREAD
========================================================= */

const markNotificationsUnread =
  async (
    notificationIds,
  ) => {
    const ids =
      normalizeIds(
        notificationIds,
      );

    const response =
      await api.patch(
        "/notifications/bulk/unread",
        {
          notificationIds:
            ids,
        },
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   DELETE ONE

   Backend performs soft delete.
========================================================= */

const deleteNotification =
  async (
    notificationId,
  ) => {
    const id =
      normalizeString(
        notificationId,
      );

    if (!id) {
      throw new Error(
        "Notification ID is required.",
      );
    }

    const response =
      await api.delete(
        `/notifications/${id}`,
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            1,
        ),
    };
  };

/* =========================================================
   BULK DELETE

   POST is intentional because backend uses:
   POST /notifications/bulk/delete
========================================================= */

const deleteNotifications =
  async (
    notificationIds,
  ) => {
    const ids =
      normalizeIds(
        notificationIds,
      );

    const response =
      await api.post(
        "/notifications/bulk/delete",
        {
          notificationIds:
            ids,
        },
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   DELETE ALL READ
========================================================= */

const deleteAllReadNotifications =
  async () => {
    const response =
      await api.delete(
        "/notifications/read",
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   DELETE ALL
========================================================= */

const deleteAllNotifications =
  async () => {
    const response =
      await api.delete(
        "/notifications/all",
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   DELETE BEFORE DATE

   Example:
   deleteNotificationsBefore("2026-08-01")
========================================================= */

const deleteNotificationsBefore =
  async (
    date,
  ) => {
    const normalizedDate =
      normalizeDateParameter(
        date,
      );

    if (!normalizedDate) {
      throw new Error(
        "Date is required.",
      );
    }

    const response =
      await api.delete(
        "/notifications/before",
        {
          params: {
            date:
              normalizedDate,
          },
        },
      );

    dispatchNotificationUpdated();

    return {
      affected:
        Number(
          response?.data?.affected ??
            0,
        ),
    };
  };

/* =========================================================
   ADVISER TOPBAR COMPATIBILITY

   IMPORTANT:

   The old NotificationBell expects:

       notificationService
         .getAdviserNotifications()

   and expects an ARRAY.

   Keep this method so AdviserTopbar does not break yet.

   The backend is now the real source of truth.

   Only latest notifications are returned here.
========================================================= */

const getAdviserNotifications =
  async () => {
    const result =
      await getNotifications({
        page: 0,
        size: 10,
      });

    return result.content;
  };

/* =========================================================
   ADVISER UNREAD TOPBAR DATA

   This will be used when we update AdviserTopbar next.

   It fetches:
   - latest notifications
   - actual unread count

   The unread badge therefore remains correct even when
   more notifications exist than are displayed in dropdown.
========================================================= */

const getAdviserNotificationSummary =
  async ({
    size = 10,
  } = {}) => {
    const [
      pageResult,
      unreadCount,
    ] = await Promise.all([
      getNotifications({
        page: 0,
        size,
      }),

      getUnreadCount(),
    ]);

    return {
      notifications:
        pageResult.content,

      unreadCount,

      totalElements:
        pageResult.totalElements,
    };
  };

/* =========================================================
   MARK READ + RETURN ACTION

   Handy helper for clicking a notification.

   UI may:
   1. mark notification read
   2. receive the route action
   3. navigate
========================================================= */

const openNotification =
  async (
    notification,
  ) => {
    if (!notification) {
      return {
        notification:
          null,

        action:
          null,
      };
    }

    let updatedNotification =
      notification;

    if (
      !notification.read &&
      notification.id
    ) {
      updatedNotification =
        await markNotificationRead(
          notification.id,
        );
    }

    return {
      notification:
        updatedNotification,

      action:
        getNotificationAction(
          updatedNotification,
        ),
    };
  };

/* =========================================================
   EXPORTED EVENT NAME

   Useful for AdviserTopbar / Notification Center listeners.
========================================================= */

const getNotificationUpdatedEventName =
  () =>
    NOTIFICATION_UPDATED_EVENT;

/* =========================================================
   EXPORT
========================================================= */

const notificationService = {
  /* TOPBAR COMPATIBILITY */

  getAdviserNotifications,
  getAdviserNotificationSummary,

  /* LIST */

  getNotifications,
  getUnreadNotifications,
  getUnreadCount,

  /* SINGLE READ / UNREAD */

  markNotificationRead,
  markNotificationUnread,

  /* BULK READ / UNREAD */

  markAllNotificationsRead,
  markNotificationsRead,
  markNotificationsUnread,

  /* DELETE */

  deleteNotification,
  deleteNotifications,
  deleteAllReadNotifications,
  deleteAllNotifications,
  deleteNotificationsBefore,

  /* OPEN / NAVIGATION */

  openNotification,
  getNotificationAction,

  /* UI MAPPER */

  mapNotification,

  /* EVENT */

  getNotificationUpdatedEventName,
};

export default notificationService;