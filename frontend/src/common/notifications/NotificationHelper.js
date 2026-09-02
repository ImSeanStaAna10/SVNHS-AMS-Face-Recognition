/* =========================================================
   NOTIFICATION HELPERS
========================================================= */

export const normalizeNotificationArray = (value) =>
  Array.isArray(value) ? value : [];

/* =========================================================
   RELATIVE TIME
========================================================= */

export const formatNotificationTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const difference = Date.now() - date.getTime();

  const seconds = Math.max(0, Math.floor(difference / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

/* =========================================================
   NOTIFICATION TYPE LABEL
========================================================= */

export const getNotificationTypeLabel = (type) => {
  switch (
    String(type || "")
      .trim()
      .toUpperCase()
  ) {
    case "STUDENT_TRANSFER":
      return "Student Transfer";

    case "ATTENDANCE":
      return "Attendance";

    case "ACCOUNT":
      return "Account";

    case "SYSTEM":
      return "System";

    default:
      return "Notification";
  }
};

/* =========================================================
   NOTIFICATION ICON
========================================================= */

export const getNotificationIcon = (type) => {
  switch (
    String(type || "")
      .trim()
      .toUpperCase()
  ) {
    case "STUDENT_TRANSFER":
      return "↔";

    case "ATTENDANCE":
      return "◷";

    case "ACCOUNT":
      return "♙";

    case "SYSTEM":
      return "i";

    default:
      return "•";
  }
};
