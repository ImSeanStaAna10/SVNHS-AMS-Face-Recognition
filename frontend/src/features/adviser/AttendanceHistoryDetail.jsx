import { useEffect, useMemo, useState } from "react";

import * as XLSX from "xlsx";

import { useLocation, useNavigate, useParams } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/adviser/attendanceHistoryDetail.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PH_TIME_ZONE = "Asia/Manila";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  return [];
};

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

const getRecordStudentId = (record) =>
  record?.studentId || record?.student?.id || "";

const getRecordStudentName = (record) =>
  record?.studentName || record?.student?.name || "Unnamed Student";

const getRecordStudentNumber = (record) =>
  record?.studentNumber || record?.student?.studentNumber || "—";

const getRecordSectionName = (record) =>
  record?.sectionName ||
  record?.student?.sectionName ||
  record?.student?.section?.name ||
  record?.section?.name ||
  "";

const getRecordTime = (record) =>
  record?.recordedAt ||
  record?.attendanceTime ||
  record?.createdAt ||
  record?.timestamp ||
  "";

const getRecordMethod = (record) => {
  const raw = String(
    record?.method || record?.attendanceMethod || record?.source || "",
  )
    .trim()
    .toUpperCase();

  if (!raw) {
    return "—";
  }

  if (raw.includes("FACE")) {
    return "Face Recognition";
  }

  if (raw.includes("MANUAL")) {
    return "Manual";
  }

  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const getRecordStatus = (record) =>
  String(record?.status || "PRESENT")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const parsed = Number(value);

  return Number.isNaN(parsed) ? 0 : parsed;
};

const twoDigits = (value) => String(value).padStart(2, "0");

const toTwelveHourTime = (
  hourValue,
  minuteValue,
  secondValue,
  includeSeconds = true,
) => {
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) {
    return "—";
  }

  const period = hour >= 12 ? "PM" : "AM";

  const normalizedHour = hour % 12 || 12;

  const minute = twoDigits(minuteValue || 0);

  const second = includeSeconds ? `:${twoDigits(secondValue || 0)}` : "";

  return `${normalizedHour}:${minute}${second} ${period}`;
};

const hasExplicitTimezone = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const raw = value.trim();

  if (raw.endsWith("Z")) {
    return true;
  }

  /*
   * Date portion already contains "-".
   * We only inspect the time/offset portion.
   */
  const suffix = raw.length > 10 ? raw.slice(10) : "";

  return suffix.includes("+") || suffix.includes("-");
};

const formatTime = (value, includeSeconds = true) => {
  if (!value) {
    return "—";
  }

  /*
   * Spring LocalDateTime has no timezone.
   * Treat it as school-local time so the
   * browser cannot shift it accidentally.
   */
  if (typeof value === "string" && !hasExplicitTimezone(value)) {
    const raw = value.trim();

    const looksLikeLocalDateTime =
      raw.length >= 16 &&
      raw[4] === "-" &&
      raw[7] === "-" &&
      (raw[10] === "T" || raw[10] === " ");

    if (looksLikeLocalDateTime) {
      return toTwelveHourTime(
        raw.slice(11, 13),
        raw.slice(14, 16),
        raw.length >= 19 ? raw.slice(17, 19) : "00",
        includeSeconds,
      );
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(date);
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  /*
   * A yyyy-MM-dd value is already a school
   * calendar date. Noon prevents accidental
   * previous/next-day shifts in browsers.
   */
  if (
    typeof value === "string" &&
    value.length === 10 &&
    value[4] === "-" &&
    value[7] === "-"
  ) {
    const date = new Date(`${value}T12:00:00`);

    return new Intl.DateTimeFormat("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  /*
   * LocalDateTime from Spring: use only the
   * date portion because it is already local.
   */
  if (
    typeof value === "string" &&
    !hasExplicitTimezone(value) &&
    value.length >= 10 &&
    value[4] === "-" &&
    value[7] === "-"
  ) {
    return formatDate(value.slice(0, 10));
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const sanitizeFileName = (value) => {
  /*
   * Deliberately no regex here.
   * This avoids the escaping issue that caused
   * errors in the previous filename sanitizer.
   */
  const invalidCharacters = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];

  let result = String(value || "attendance-record").trim();

  invalidCharacters.forEach((character) => {
    result = result.split(character).join("-");
  });

  return result.split(" ").filter(Boolean).join("_").slice(0, 90);
};

const readStoredSession = (storageKey) => {
  try {
    const stored = window.sessionStorage.getItem(storageKey);

    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceHistoryDetail() {
  const { sessionId } = useParams();

  const location = useLocation();

  const navigate = useNavigate();

  const user = authService.getUser();

  /* =======================================================
     DATA / UI
  ======================================================= */

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  /* =======================================================
     SESSION METADATA

     We do not keep duplicate session state here.

     Priority:
     1. React Router state from History page
     2. sessionStorage for refresh resilience
     3. Safe values derived from attendance records
  ======================================================= */

  const storageKey = `attendance-history-session-${sessionId}`;

  const navigationSession = location.state?.session || null;

  const storedSession = useMemo(
    () => navigationSession || readStoredSession(storageKey),
    [navigationSession, storageKey],
  );

  /*
   * Persist metadata passed from the History list.
   * This contains no setState call, so it avoids
   * the set-state-in-effect lint problem.
   */
  useEffect(() => {
    if (!navigationSession) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(navigationSession),
      );
    } catch {
      // Browser storage is only a convenience.
    }
  }, [navigationSession, storageKey]);

  /* =======================================================
     LOAD RECORDS
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        if (!sessionId) {
          throw new Error("Attendance session ID is missing.");
        }

        const data = await adviserService.getSessionRecords(sessionId);

        if (!mounted) {
          return;
        }

        setRecords(normalizeArray(data));
      } catch (requestError) {
        console.error(
          "Unable to load historical attendance record:",
          requestError,
        );

        if (!mounted) {
          return;
        }

        setRecords([]);

        setError(
          getErrorMessage(
            requestError,
            requestError?.message || "Unable to load the attendance record.",
          ),
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  /* =======================================================
     SAFE METADATA FALLBACK
  ======================================================= */

  const derivedSession = useMemo(() => {
    if (storedSession || records.length === 0) {
      return null;
    }

    const recordWithTime = records.find((record) =>
      Boolean(getRecordTime(record)),
    );

    const firstRecord = records[0];

    const recordedAt = recordWithTime ? getRecordTime(recordWithTime) : "";

    return {
      sessionId,
      sectionName: getRecordSectionName(firstRecord) || "Assigned Section",
      attendanceDate: recordedAt ? String(recordedAt).slice(0, 10) : "",
      status: "ENDED",
      studentCount: records.length,
    };
  }, [records, sessionId, storedSession]);

  const session = storedSession || derivedSession || null;

  /* =======================================================
     DERIVED COUNTS
  ======================================================= */

  const statusCounts = useMemo(() => {
    return records.reduce(
      (totals, record) => {
        const status = getRecordStatus(record);

        if (status === "PRESENT") {
          totals.present += 1;
        } else if (status === "LATE") {
          totals.late += 1;
        } else if (status === "ABSENT") {
          totals.absent += 1;
        }

        return totals;
      },
      {
        present: 0,
        late: 0,
        absent: 0,
      },
    );
  }, [records]);

  const presentCount = statusCounts.present;

  const lateCount = statusCounts.late;

  const absentCount = statusCounts.absent;

  const totalStudents =
    session?.studentCount != null
      ? safeNumber(session.studentCount)
      : records.length;

  const attendedCount = presentCount + lateCount;

  const attendanceRate =
    totalStudents > 0
      ? Math.round((attendedCount / totalStudents) * 10000) / 100
      : 0;

  const sectionName = session?.sectionName || "Assigned Section";

  const attendanceDate = session?.attendanceDate || "";

  const adviserName = user?.name?.trim() || "Class Adviser";

  /* =======================================================
     FILTER RECORDS
  ======================================================= */

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return records.filter((record) => {
      const status = getRecordStatus(record);

      if (statusFilter !== "ALL" && status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const name = getRecordStudentName(record).toLowerCase();

      const number = String(getRecordStudentNumber(record)).toLowerCase();

      return name.includes(query) || number.includes(query);
    });
  }, [records, searchQuery, statusFilter]);

  /* =======================================================
     EXPORT ROWS
  ======================================================= */

  const exportRows = useMemo(
    () =>
      records.map((record, index) => ({
        No: index + 1,
        "Student Number": getRecordStudentNumber(record),
        "Student Name": getRecordStudentName(record),
        Status: getRecordStatus(record),
        "Recorded At": getRecordTime(record)
          ? formatTime(getRecordTime(record))
          : "",
        Method: getRecordMethod(record),
      })),
    [records],
  );

  /* =======================================================
     EXPORT EXCEL
  ======================================================= */

  const handleExportExcel = () => {
    if (records.length === 0) {
      return;
    }

    const workbook = XLSX.utils.book_new();

    const recordSheet = XLSX.utils.json_to_sheet(exportRows);

    recordSheet["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(workbook, recordSheet, "Attendance Record");

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["SVNHS Attendance Management System"],
      ["Official Attendance Record"],
      [],
      ["Section", sectionName],
      ["Attendance Date", formatDate(attendanceDate)],
      ["Adviser", adviserName],
      ["Session Started", formatTime(session?.startedAt)],
      ["Session Ended", formatTime(session?.endedAt)],
      ["Total Students", totalStudents],
      ["Present", presentCount],
      ["Late", lateCount],
      ["Absent", absentCount],
      ["Attendance Rate", `${attendanceRate}%`],
    ]);

    summarySheet["!cols"] = [{ wch: 22 }, { wch: 34 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const fileName = sanitizeFileName(
      `Attendance_${sectionName}_${attendanceDate || sessionId}`,
    );

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleExportPdf = () => {
    if (records.length === 0) {
      return;
    }

    window.print();
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Attendance Record"
      eyebrow="ATTENDANCE HISTORY"
      description="Official completed class attendance record"
    >
      <section className="attendance-history-detail-page">
        {/* =================================================
            TOP ACTIONS
        ================================================== */}

        <div className="attendance-history-detail-nav">
          <button
            type="button"
            onClick={() => navigate("/adviser/attendance/history")}
          >
            ← Back to Attendance History
          </button>

          <div>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || records.length === 0}
            >
              PDF
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || records.length === 0}
            >
              XLS
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* =================================================
            OFFICIAL HEADER
        ================================================== */}

        <section className="attendance-history-detail-hero">
          <div className="attendance-history-detail-identity">
            <div className="attendance-history-detail-logos">
              <img src={depedLogo} alt="Department of Education" />

              <img
                src={seniorHighSchoolLogo}
                alt="Signal Village National High School"
              />
            </div>

            <div>
              <span>REPUBLIC OF THE PHILIPPINES</span>

              <h2>Signal Village National High School</h2>

              <p>Attendance Management System · Adviser Portal</p>
            </div>
          </div>

          <div className="attendance-history-detail-record-label">
            <span>OFFICIAL SCHOOL RECORD</span>

            <strong>COMPLETED</strong>
          </div>
        </section>

        {/* =================================================
            RECORD TITLE
        ================================================== */}

        <section className="attendance-history-detail-title">
          <div>
            <span>STUDENT ATTENDANCE REGISTER</span>

            <h1>Attendance Record Sheet</h1>

            <p>Historical attendance record for a completed class session.</p>
          </div>

          <div className="attendance-history-detail-session-id">
            <span>SESSION ID</span>

            <strong>{sessionId || "—"}</strong>
          </div>
        </section>

        {/* =================================================
            SESSION METADATA
        ================================================== */}

        <section className="attendance-history-detail-meta">
          <article>
            <span>SECTION</span>

            <strong>{sectionName}</strong>
          </article>

          <article>
            <span>ATTENDANCE DATE</span>

            <strong>{formatDate(attendanceDate)}</strong>
          </article>

          <article>
            <span>SESSION START</span>

            <strong>{formatTime(session?.startedAt)}</strong>
          </article>

          <article>
            <span>SESSION END</span>

            <strong>{formatTime(session?.endedAt)}</strong>
          </article>

          <article>
            <span>CLASS ADVISER</span>

            <strong>{adviserName}</strong>
          </article>
        </section>

        {/* =================================================
            SUMMARY
        ================================================== */}

        <section className="attendance-history-detail-summary">
          <article>
            <span>STUDENTS</span>

            <strong>{totalStudents}</strong>
          </article>

          <article className="is-success">
            <span>PRESENT</span>

            <strong>{presentCount}</strong>
          </article>

          <article className="is-late">
            <span>LATE</span>

            <strong>{lateCount}</strong>
          </article>

          <article className="is-danger">
            <span>ABSENT</span>

            <strong>{absentCount}</strong>
          </article>

          <article>
            <span>ATTENDANCE RATE</span>

            <strong>{attendanceRate}%</strong>
          </article>
        </section>

        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="attendance-history-detail-error" role="alert">
            <span>!</span>

            <p>{error}</p>
          </div>
        )}

        {/* =================================================
            OFFICIAL REGISTER
        ================================================== */}

        <section className="attendance-history-detail-register">
          <header>
            <div>
              <span>OFFICIAL CLASS REGISTER</span>

              <h3>Student Attendance</h3>

              <p>Recorded attendance status for this completed session.</p>
            </div>

            <div className="attendance-history-detail-filters">
              <label>
                <span aria-hidden="true">⌕</span>

                <input
                  type="search"
                  value={searchQuery}
                  placeholder="Search name or student number..."
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>

              <select
                value={statusFilter}
                aria-label="Filter attendance status"
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All Status</option>

                <option value="PRESENT">Present</option>

                <option value="LATE">Late</option>

                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </header>

          {loading ? (
            <div className="attendance-history-detail-loading">
              <span />

              <strong>Loading official record</strong>
            </div>
          ) : records.length === 0 ? (
            <div className="attendance-history-detail-empty">
              No attendance records were found for this session.
            </div>
          ) : (
            <div className="attendance-history-detail-table-shell">
              <table className="attendance-history-detail-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Number</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Recorded At</th>
                    <th>Method</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record, index) => {
                    const status = getRecordStatus(record);

                    const studentName = getRecordStudentName(record);

                    const studentNumber = getRecordStudentNumber(record);

                    return (
                      <tr
                        key={
                          getRecordStudentId(record) ||
                          `${studentNumber}-${index}`
                        }
                      >
                        <td>{String(index + 1).padStart(2, "0")}</td>

                        <td>
                          <span className="attendance-history-detail-number">
                            {studentNumber}
                          </span>
                        </td>

                        <td>
                          <div className="attendance-history-detail-student">
                            <span>{studentName.charAt(0).toUpperCase()}</span>

                            <strong>{studentName}</strong>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`attendance-history-detail-status is-${status.toLowerCase()}`}
                          >
                            <i />

                            {status}
                          </span>
                        </td>

                        <td>
                          {getRecordTime(record)
                            ? formatTime(getRecordTime(record))
                            : "—"}
                        </td>

                        <td>{getRecordMethod(record)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && records.length > 0 && (
            <footer>
              <span>
                Showing {filteredRecords.length} of {records.length} attendance
                records
              </span>
            </footer>
          )}
        </section>

        {/* =================================================
            SIGNATURES
        ================================================== */}

        <section className="attendance-history-detail-signatures">
          <div>
            <span />

            <strong>{adviserName}</strong>

            <small>Class Adviser</small>
          </div>

          <div>
            <span />

            <strong>____________________</strong>

            <small>School Official</small>
          </div>
        </section>
      </section>

      {/* =================================================
          PRINT-ONLY OFFICIAL SHEET
      ================================================== */}

      <section className="attendance-history-print-sheet">
        <header>
          <div>
            <img src={depedLogo} alt="" />

            <img src={seniorHighSchoolLogo} alt="" />
          </div>

          <section>
            <span>REPUBLIC OF THE PHILIPPINES</span>

            <strong>Signal Village National High School</strong>

            <small>Attendance Management System</small>
          </section>
        </header>

        <div className="attendance-history-print-title">
          <span>OFFICIAL SCHOOL RECORD</span>

          <h1>Student Attendance Register</h1>

          <p>
            {sectionName} · {formatDate(attendanceDate)}
          </p>
        </div>

        <div className="attendance-history-print-meta">
          <div>
            <span>Adviser</span>

            <strong>{adviserName}</strong>
          </div>

          <div>
            <span>Started</span>

            <strong>{formatTime(session?.startedAt)}</strong>
          </div>

          <div>
            <span>Ended</span>

            <strong>{formatTime(session?.endedAt)}</strong>
          </div>

          <div>
            <span>Attendance Rate</span>

            <strong>{attendanceRate}%</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student Number</th>
              <th>Student Name</th>
              <th>Status</th>
              <th>Recorded At</th>
              <th>Method</th>
            </tr>
          </thead>

          <tbody>
            {exportRows.map((row) => (
              <tr key={`${row.No}-${row["Student Number"]}`}>
                <td>{row.No}</td>

                <td>{row["Student Number"]}</td>

                <td>{row["Student Name"]}</td>

                <td>{row.Status}</td>

                <td>{row["Recorded At"]}</td>

                <td>{row.Method}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer>
          <div>
            <span />

            <strong>{adviserName}</strong>

            <small>Class Adviser</small>
          </div>

          <div>
            <span />

            <strong>____________________</strong>

            <small>School Official</small>
          </div>
        </footer>
      </section>
    </AdviserLayout>
  );
}

export default AttendanceHistoryDetail;
