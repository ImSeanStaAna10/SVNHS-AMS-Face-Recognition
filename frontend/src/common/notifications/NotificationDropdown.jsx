import {
  useEffect,
  useMemo,
  useState,
} from "react";

import NotificationItem from "./NotificationItem";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) =>
  Array.isArray(value)
    ? value
    : [];

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
   EMPTY ICON
========================================================= */

function EmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="m8.5 12 2.2 2.2 4.8-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   ERROR ICON
========================================================= */

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
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
}

/* =========================================================
   CHECK ICON
========================================================= */

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="m4.5 10 3.3 3.3 7.7-7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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

function NotificationDropdown({
  notifications = [],

  unreadCount = 0,

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
    manageMode,
    setManageMode,
  ] = useState(false);

  const [
    selectedIds,
    setSelectedIds,
  ] = useState(
    () => new Set(),
  );

  const [
    confirmDelete,
    setConfirmDelete,
  ] = useState(false);

  const [
    bulkDeleteBusy,
    setBulkDeleteBusy,
  ] = useState(false);

  const [
    localError,
    setLocalError,
  ] = useState("");

  /* =======================================================
     NORMALIZED NOTIFICATIONS
  ======================================================= */

  const normalizedNotifications =
    useMemo(
      () =>
        normalizeArray(
          notifications,
        ),
      [
        notifications,
      ],
    );

  const normalizedUnreadCount =
    Math.max(
      0,
      Number(unreadCount) ||
        0,
    );

  /* =======================================================
     VALID IDS
  ======================================================= */

  const visibleIds =
    useMemo(
      () =>
        normalizedNotifications
          .map(
            (notification) =>
              notification?.id,
          )
          .filter(Boolean),
      [
        normalizedNotifications,
      ],
    );

  const selectedCount =
    selectedIds.size;

  const allShownSelected =
    visibleIds.length > 0 &&
    visibleIds.every(
      (id) =>
        selectedIds.has(id),
    );

  const busy =
    actionsDisabled ||
    bulkDeleteBusy;

  /* =======================================================
     KEEP SELECTION VALID
  ======================================================= */

  useEffect(() => {
    const visibleIdSet =
      new Set(visibleIds);

    setSelectedIds(
      (current) => {
        const next =
          new Set(
            [...current].filter(
              (id) =>
                visibleIdSet.has(
                  id,
                ),
            ),
          );

        if (
          next.size ===
          current.size
        ) {
          return current;
        }

        return next;
      },
    );
  }, [
    visibleIds,
  ]);

  /* =======================================================
     EXIT CONFIRM IF NOTHING SELECTED
  ======================================================= */

  useEffect(() => {
    if (
      selectedIds.size ===
      0
    ) {
      setConfirmDelete(
        false,
      );
    }
  }, [
    selectedIds,
  ]);

  /* =======================================================
     MANAGE MODE
  ======================================================= */

  const enterManageMode =
    () => {
      setLocalError("");
      setConfirmDelete(false);
      setSelectedIds(
        new Set(),
      );
      setManageMode(true);
    };

  const exitManageMode =
    () => {
      if (bulkDeleteBusy) {
        return;
      }

      setManageMode(false);
      setConfirmDelete(false);
      setLocalError("");
      setSelectedIds(
        new Set(),
      );
    };

  /* =======================================================
     TOGGLE ITEM
  ======================================================= */

  const handleToggleSelect =
    (notification) => {
      const id =
        notification?.id;

      if (
        !id ||
        busy
      ) {
        return;
      }

      setConfirmDelete(false);

      setSelectedIds(
        (current) => {
          const next =
            new Set(current);

          if (
            next.has(id)
          ) {
            next.delete(id);
          } else {
            next.add(id);
          }

          return next;
        },
      );
    };

  /* =======================================================
     SELECT SHOWN / CLEAR
  ======================================================= */

  const handleToggleSelectAll =
    () => {
      if (busy) {
        return;
      }

      setConfirmDelete(false);

      if (
        allShownSelected
      ) {
        setSelectedIds(
          new Set(),
        );

        return;
      }

      setSelectedIds(
        new Set(
          visibleIds,
        ),
      );
    };

  /* =======================================================
     BULK DELETE
  ======================================================= */

  const handleRequestDeleteSelected =
    () => {
      if (
        selectedCount === 0 ||
        busy
      ) {
        return;
      }

      setLocalError("");
      setConfirmDelete(true);
    };

  const handleCancelDelete =
    () => {
      if (bulkDeleteBusy) {
        return;
      }

      setConfirmDelete(false);
    };

  const handleConfirmDelete =
    async () => {
      if (
        selectedCount === 0 ||
        typeof onBulkDelete !==
          "function"
      ) {
        return;
      }

      const ids =
        [...selectedIds];

      try {
        setBulkDeleteBusy(
          true,
        );

        setLocalError("");

        await onBulkDelete(
          ids,
        );

        setSelectedIds(
          new Set(),
        );

        setConfirmDelete(
          false,
        );

        setManageMode(
          false,
        );
      } catch (actionError) {
        console.error(
          "Unable to bulk delete notifications:",
          actionError,
        );

        setLocalError(
          getErrorMessage(
            actionError,
            "Unable to delete selected notifications.",
          ),
        );
      } finally {
        setBulkDeleteBusy(
          false,
        );
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      className={`app-notification-dropdown ${
        manageMode
          ? "is-managing"
          : ""
      }`}
      role="dialog"
      aria-label="Notifications"
    >
      {/* ===================================================
          HEADER
      ==================================================== */}

      <header className="app-notification-dropdown-header">
        <div className="app-notification-dropdown-heading">
          <div className="app-notification-dropdown-title-row">
            <div>
              <h3>
                Notifications
              </h3>

              {!manageMode ? (
                <p>
                  {normalizedUnreadCount >
                  0
                    ? `${normalizedUnreadCount} unread`
                    : "You're up to date"}
                </p>
              ) : (
                <p>
                  {selectedCount ===
                  0
                    ? "Select notifications"
                    : `${selectedCount} selected`}
                </p>
              )}
            </div>

            {!loading &&
              !error &&
              normalizedNotifications.length >
                0 && (
                <button
                  type="button"
                  className="app-notification-manage-button"
                  onClick={
                    manageMode
                      ? exitManageMode
                      : enterManageMode
                  }
                  disabled={
                    busy
                  }
                >
                  {manageMode
                    ? "Done"
                    : "Manage"}
                </button>
              )}
          </div>

          {/* ===============================================
              NORMAL ACTION
          =============================================== */}

          {!manageMode &&
            !loading &&
            !error &&
            normalizedUnreadCount >
              0 &&
            typeof onMarkAllRead ===
              "function" && (
              <button
                type="button"
                className="app-notification-mark-all"
                onClick={
                  onMarkAllRead
                }
                disabled={
                  markAllBusy ||
                  actionsDisabled
                }
              >
                <CheckIcon />

                <span>
                  {markAllBusy
                    ? "Updating..."
                    : "Mark all read"}
                </span>
              </button>
            )}

          {/* ===============================================
              MANAGE ACTIONS
          =============================================== */}

          {manageMode &&
            !loading &&
            !error &&
            visibleIds.length >
              0 && (
              <div className="app-notification-manage-row">
                <span>
                  {selectedCount ===
                  0
                    ? "Choose items to remove"
                    : `${selectedCount} of ${visibleIds.length} selected`}
                </span>

                <button
                  type="button"
                  onClick={
                    handleToggleSelectAll
                  }
                  disabled={
                    busy
                  }
                >
                  {allShownSelected
                    ? "Clear selection"
                    : "Select shown"}
                </button>
              </div>
            )}
        </div>
      </header>

      {/* ===================================================
          BODY
      ==================================================== */}

      <div className="app-notification-dropdown-body">
        {/* ===============================================
            LOADING
        =============================================== */}

        {loading && (
          <div className="app-notification-loading">
            <span
              className="app-notification-spinner"
              aria-hidden="true"
            />

            <div>
              <strong>
                Loading notifications
              </strong>

              <p>
                Checking for
                updates.
              </p>
            </div>
          </div>
        )}

        {/* ===============================================
            API ERROR
        =============================================== */}

        {!loading &&
          Boolean(error) && (
            <div className="app-notification-error">
              <span
                className="app-notification-error-icon"
                aria-hidden="true"
              >
                <ErrorIcon />
              </span>

              <div>
                <strong>
                  Notifications
                  unavailable
                </strong>

                <p>
                  {error}
                </p>
              </div>
            </div>
          )}

        {/* ===============================================
            EMPTY
        =============================================== */}

        {!loading &&
          !error &&
          normalizedNotifications.length ===
            0 && (
            <div className="app-notification-empty">
              <span
                className="app-notification-empty-icon"
                aria-hidden="true"
              >
                <EmptyIcon />
              </span>

              <strong>
                You're all caught up
              </strong>

              <p>
                New updates will
                appear here.
              </p>
            </div>
          )}

        {/* ===============================================
            LIST
        =============================================== */}

        {!loading &&
          !error &&
          normalizedNotifications.length >
            0 && (
            <div className="app-notification-list">
              {normalizedNotifications.map(
                (
                  notification,
                  index,
                ) => {
                  const id =
                    notification?.id;

                  return (
                    <NotificationItem
                      key={
                        id ||
                        `${notification?.createdAt || "notification"}-${index}`
                      }
                      notification={
                        notification
                      }
                      onSelect={
                        onNotificationSelect
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
                      manageMode={
                        manageMode
                      }
                      selected={
                        Boolean(
                          id &&
                            selectedIds.has(
                              id,
                            ),
                        )
                      }
                      onToggleSelect={
                        handleToggleSelect
                      }
                      actionsDisabled={
                        busy
                      }
                    />
                  );
                },
              )}
            </div>
          )}
      </div>

      {/* ===================================================
          LOCAL ACTION ERROR
      ==================================================== */}

      {manageMode &&
        localError && (
          <div className="app-notification-inline-error">
            {localError}
          </div>
        )}

      {/* ===================================================
          MANAGE FOOTER
      ==================================================== */}

      {manageMode &&
        !loading &&
        !error &&
        normalizedNotifications.length >
          0 && (
          <footer className="app-notification-manage-footer">
            {!confirmDelete ? (
              <button
                type="button"
                className="app-notification-delete-selected"
                onClick={
                  handleRequestDeleteSelected
                }
                disabled={
                  selectedCount ===
                    0 ||
                  busy
                }
              >
                <DeleteIcon />

                <span>
                  {selectedCount ===
                  0
                    ? "Delete selected"
                    : `Delete selected (${selectedCount})`}
                </span>
              </button>
            ) : (
              <div className="app-notification-delete-confirm">
                <div className="app-notification-delete-confirm-copy">
                  <strong>
                    Delete{" "}
                    {selectedCount}{" "}
                    notification
                    {selectedCount ===
                    1
                      ? ""
                      : "s"}
                    ?
                  </strong>

                  <span>
                    This will remove
                    the selected
                    notifications.
                  </span>
                </div>

                <div className="app-notification-delete-confirm-actions">
                  <button
                    type="button"
                    className="is-cancel"
                    onClick={
                      handleCancelDelete
                    }
                    disabled={
                      bulkDeleteBusy
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="is-delete"
                    onClick={
                      handleConfirmDelete
                    }
                    disabled={
                      bulkDeleteBusy
                    }
                  >
                    {bulkDeleteBusy
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </footer>
        )}
    </section>
  );
}

export default NotificationDropdown;