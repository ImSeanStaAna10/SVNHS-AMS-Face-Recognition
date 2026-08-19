import {
  useEffect,
  useState,
} from "react";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import AttendanceRecords from "../attendance-records/AttendanceRecords";

import councilorService from "../../services/councilorService";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (value) => {
  return Array.isArray(value)
    ? value
    : [];
};

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallbackMessage;

/* =========================================================
   COMPONENT
========================================================= */

function CouncilorAttendanceRecords() {
  /* =======================================================
     STATE
  ======================================================= */

  const [
    sections,
    setSections,
  ] = useState([]);

  const [
    loadingSections,
    setLoadingSections,
  ] = useState(true);

  const [
    sectionError,
    setSectionError,
  ] = useState("");

  /* =======================================================
     LOAD SECTIONS

     Councilor needs sections only for the filter.

     AttendanceRecords itself loads the report archive.
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSections = async () => {
      try {
        setLoadingSections(true);
        setSectionError("");

        const response =
          await councilorService
            .getSections();

        if (!mounted) {
          return;
        }

        const normalizedSections =
          normalizeArray(
            response,
          )
            .filter(
              (section) =>
                section?.id,
            )
            .sort(
              (first, second) =>
                String(
                  first?.name || "",
                ).localeCompare(
                  String(
                    second?.name || "",
                  ),
                  "en",
                  {
                    sensitivity:
                      "base",
                  },
                ),
            );

        setSections(
          normalizedSections,
        );
      } catch (error) {
        console.error(
          "Unable to load sections for attendance records:",
          error,
        );

        if (!mounted) {
          return;
        }

        setSections([]);

        setSectionError(
          getErrorMessage(
            error,
            "Unable to load section filters.",
          ),
        );
      } finally {
        if (mounted) {
          setLoadingSections(
            false,
          );
        }
      }
    };

    void loadSections();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     RENDER
  ======================================================= */

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

      <AttendanceRecords
        role="COUNCILOR"
        sections={sections}
      />
    </CouncilorLayout>
  );
}

export default CouncilorAttendanceRecords;