import { useMemo } from "react";

import CouncilorLayout from "../../layouts/CouncilorLayout";
import AttendanceRecords from "../attendance-records/AttendanceRecords";

import {
  useCouncilorSections,
} from "../../hooks/queries/useCouncilorQueries";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallbackMessage;

/* =========================================================
   COMPONENT
========================================================= */

function CouncilorAttendanceRecords() {
  const sectionsQuery = useCouncilorSections();

  const sections = useMemo(
    () =>
      normalizeArray(sectionsQuery.data)
        .filter((section) => section?.id)
        .sort((first, second) =>
          String(first?.name || "").localeCompare(
            String(second?.name || ""),
            "en",
            { sensitivity: "base" },
          ),
        ),
    [sectionsQuery.data],
  );

  const loadingSections = sectionsQuery.isLoading;

  const sectionError =
    sectionsQuery.data === undefined && sectionsQuery.error
      ? getErrorMessage(
          sectionsQuery.error,
          "Unable to load section filters.",
        )
      : "";

  return (
    <CouncilorLayout>
      {sectionError && (
        <div
          className="attendance-records-alert attendance-records-alert-error"
          role="alert"
        >
          {sectionError}
        </div>
      )}

      {loadingSections && (
        <div
          className="attendance-records-alert"
          role="status"
          aria-live="polite"
        >
          Loading section filters...
        </div>
      )}

      <AttendanceRecords role="COUNCILOR" sections={sections} />
    </CouncilorLayout>
  );
}

export default CouncilorAttendanceRecords;
