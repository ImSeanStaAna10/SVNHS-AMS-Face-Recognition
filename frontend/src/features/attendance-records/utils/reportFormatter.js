  /* =========================================================
   DATE FORMATTER
========================================================= */

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const formatReportDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
};

/* =========================================================
   REPORT PERIOD
========================================================= */

export const formatReportPeriod = (
  periodStart,
  periodEnd
) => {
  if (!periodStart && !periodEnd) {
    return "—";
  }

  if (periodStart === periodEnd) {
    return formatReportDate(periodStart);
  }

  return `${formatReportDate(periodStart)} – ${formatReportDate(
    periodEnd
  )}`;
};

/* =========================================================
   PERCENTAGE
========================================================= */

export const formatPercentage = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "0%";
  }

  return `${numericValue.toFixed(2)}%`;
};

/* =========================================================
   REPORT TYPE
========================================================= */

export const formatReportType = (value) => {
  if (!value) {
    return "Report";
  }

  if (value === "WEEKLY") {
    return "Weekly";
  }

  if (value === "MONTHLY") {
    return "Monthly";
  }

  return value;
};

/* =========================================================
   ATTENDANCE RATE CLASS
========================================================= */

export const getAttendanceRateClass = (value) => {
  const rate = Number(value);

  if (rate >= 90) {
    return "report-rate-good";
  }

  if (rate >= 75) {
    return "report-rate-warning";
  }

  return "report-rate-danger";
};

/* =========================================================
   REQUEST ERROR

   Handles:
   - normal JSON API errors
   - Axios blob response errors
========================================================= */

export const resolveRequestError = async (
  error,
  fallbackMessage = "Something went wrong."
) => {
  const responseData = error?.response?.data;

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();

      const parsed = JSON.parse(text);

      return (
        parsed?.message ||
        parsed?.error ||
        fallbackMessage
      );
    } catch {
      return fallbackMessage;
    }
  }

  return (
    responseData?.message ||
    responseData?.error ||
    error?.message ||
    fallbackMessage
  );
};