import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";

import CouncilorLayout from "../../layouts/CouncilorLayout";
import councilorService from "../../services/councilorService";

import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;
const SEARCH_DELAY = 350;

/* =========================================================
   DATE HELPERS
========================================================= */

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-PH");
}

function formatPercentage(value) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0.0%";
  }

  return `${number.toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatLongDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(from, to) {
  return from === to
    ? formatLongDate(from)
    : `${formatLongDate(from)} – ${formatLongDate(to)}`;
}

function clampPercentage(value) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 100);
}
function sanitizeFileName(value) {
  return String(value || "attendance-report")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 90);
}
/* =========================================================
   ATTENDANCE HEALTH
========================================================= */

function getAttendanceHealth(rate) {
  const value = Number(rate ?? 0);

  if (value >= 90) {
    return {
      key: "strong",
      label: "Strong",
      description:
        "Attendance is currently within the higher performance band.",
    };
  }

  if (value >= 75) {
    return {
      key: "monitor",
      label: "Monitor",
      description:
        "Attendance is moderate and may benefit from closer monitoring.",
    };
  }

  return {
    key: "review",
    label: "For Review",
    description: "Attendance is lower and should be reviewed more closely.",
  };
}

/* =========================================================
   ATTENDANCE DETAIL
========================================================= */

function AttendanceDetail() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const today = useMemo(() => getToday(), []);

  /* =======================================================
     INITIAL DATE RANGE FROM URL
  ======================================================= */

  const initialFrom = searchParams.get("from") || today;
  const initialTo = searchParams.get("to") || initialFrom;

  /* =======================================================
     STATE
  ======================================================= */

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [page, setPage] = useState(0);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState("");

  const [printStudents, setPrintStudents] = useState([]);
  const [printReport, setPrintReport] = useState(null);

  /* =========================================================
     DEBOUNCE STUDENT SEARCH
  ========================================================= */

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(0);
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  /* =========================================================
     KEEP REPORT DATES IN URL
  ========================================================= */

  useEffect(() => {
    setSearchParams(
      {
        from: fromDate,
        to: toDate,
      },
      {
        replace: true,
      },
    );
  }, [fromDate, toDate, setSearchParams]);

  /* =========================================================
     LOAD DETAILED REPORT
  ========================================================= */

  useEffect(() => {
    if (!sectionId) {
      return undefined;
    }

    const controller = new AbortController();

    const loadReport = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await councilorService.getSectionAttendanceReport(
          sectionId,
          {
            from: fromDate,
            to: toDate,
            search: debouncedSearch,
            page,
            size: PAGE_SIZE,
            signal: controller.signal,
          },
        );

        setReport(data);
      } catch (requestError) {
        if (
          requestError?.code === "ERR_CANCELED" ||
          requestError?.name === "CanceledError"
        ) {
          return;
        }

        setReport(null);

        setError(
          requestError?.response?.data?.message ||
            "Unable to load the detailed attendance report.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadReport();

    return () => {
      controller.abort();
    };
  }, [sectionId, fromDate, toDate, debouncedSearch, page]);

  /* =========================================================
     DERIVED DATA
  ========================================================= */

  const section = report?.section ?? {
    sectionId,
    sectionName: "Section Attendance",
    adviserId: null,
    adviserName: null,
  };

  const summary = report?.summary ?? {
    students: 0,
    sessions: 0,
    present: 0,
    late: 0,
    absent: 0,
    totalRecords: 0,
    presentRate: 0,
    lateRate: 0,
    attendanceRate: 0,
    absenceRate: 0,
  };

  const studentPage = report?.students ?? {
    content: [],
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  };

  const students = studentPage.content ?? [];

  const startRecord =
    studentPage.totalElements > 0 ? studentPage.page * studentPage.size + 1 : 0;

  const endRecord = Math.min(
    (studentPage.page + 1) * studentPage.size,
    studentPage.totalElements,
  );

  const overallHealth = getAttendanceHealth(summary.attendanceRate);

  const printSection = printReport?.section ?? section;
  const printSummary = printReport?.summary ?? summary;

  /* =========================================================
     BACK
  ========================================================= */

  const handleBack = () => {
    navigate(`/councilor/attendance?from=${fromDate}&to=${toDate}`);
  };

  /* =========================================================
     DATE FILTERS
  ========================================================= */

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
    setPage(0);
  };

  const handleToDateChange = (event) => {
    setToDate(event.target.value);
    setPage(0);
  };

  /* =========================================================
     PAGINATION
  ========================================================= */

  const goToPreviousPage = () => {
    if (!studentPage.first) {
      setPage((currentPage) => currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (!studentPage.last) {
      setPage((currentPage) => currentPage + 1);
    }
  };

  /* =========================================================
     EXPORT HELPERS
  ========================================================= */

  const fetchAllStudentsForExport = async () => {
    if (!sectionId) {
      return {
        report: null,
        students: [],
      };
    }

    let currentPage = 0;
    let allStudents = [];
    let latestReport = null;

    // Safety guard prevents a bad backend pagination response from looping forever.
    const MAX_EXPORT_PAGES = 1000;

    while (currentPage < MAX_EXPORT_PAGES) {
      const data = await councilorService.getSectionAttendanceReport(
        sectionId,
        {
          from: fromDate,
          to: toDate,
          search: debouncedSearch,
          page: currentPage,
          size: EXPORT_PAGE_SIZE,
        },
      );

      latestReport = data;

      const pageData = data?.students ?? {};
      const pageStudents = Array.isArray(pageData.content)
        ? pageData.content
        : [];

      allStudents = [...allStudents, ...pageStudents];

      if (
        pageData.last === true ||
        pageStudents.length === 0 ||
        currentPage >= Number(pageData.totalPages ?? 1) - 1
      ) {
        break;
      }

      currentPage += 1;
    }

    return {
      report: latestReport,
      students: allStudents,
    };
  };

  const buildExportFileName = (extension) => {
    const sectionName = sanitizeFileName(section.sectionName);
    const period = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;

    return `${sectionName}_Attendance_${period}.${extension}`;
  };

  /* =========================================================
     EXPORT PDF / PRINT
  ========================================================= */

  const handleExportPdf = async () => {
    try {
      setExportError("");
      setExportingPdf(true);

      const exportData = await fetchAllStudentsForExport();

      setPrintStudents(exportData.students);
      setPrintReport(exportData.report);

      // Give React two frames to render the print-only full record sheet.
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(resolve);
        });
      });

      window.print();
    } catch (exportRequestError) {
      console.error("Unable to prepare PDF export:", exportRequestError);

      setExportError(
        exportRequestError?.response?.data?.message ||
          "Unable to prepare the PDF report.",
      );
    } finally {
      setPrintStudents([]);
      setPrintReport(null);
      setExportingPdf(false);
    }
  };

  /* =========================================================
     EXPORT EXCEL
  ========================================================= */

  const handleExportExcel = async () => {
    try {
      setExportError("");
      setExportingExcel(true);

      const exportData = await fetchAllStudentsForExport();

      const exportSection = exportData.report?.section ?? section;
      const exportSummary = exportData.report?.summary ?? summary;

      const recordRows = exportData.students.map((student, index) => {
        const health = getAttendanceHealth(student.attendanceRate);

        return [
          index + 1,
          student.studentNumber || "",
          student.studentName || "",
          Number(student.sessions ?? 0),
          Number(student.present ?? 0),
          Number(student.late ?? 0),
          Number(student.absent ?? 0),
          Number(student.attendanceRate ?? 0) / 100,
          health.label,
        ];
      });

      const recordSheetData = [
        ["SIGNAL VILLAGE NATIONAL HIGH SCHOOL"],
        ["ATTENDANCE MANAGEMENT SYSTEM"],
        ["OFFICIAL SECTION ATTENDANCE RECORD"],
        [],
        ["Section", exportSection.sectionName || "—"],
        ["Adviser", exportSection.adviserName || "Unassigned"],
        ["Report Period", formatDateRange(fromDate, toDate)],
        ["Student Search", debouncedSearch || "All students"],
        [],
        [
          "No.",
          "Student Number",
          "Student Name",
          "Sessions",
          "Present",
          "Late",
          "Absent",
          "Attendance Rate",
          "Review Status",
        ],
        ...recordRows,
      ];

      const recordWorksheet = XLSX.utils.aoa_to_sheet(recordSheetData);

      recordWorksheet["!merges"] = [
        XLSX.utils.decode_range("A1:I1"),
        XLSX.utils.decode_range("A2:I2"),
        XLSX.utils.decode_range("A3:I3"),
      ];

      recordWorksheet["!cols"] = [
        { wch: 7 },
        { wch: 18 },
        { wch: 30 },
        { wch: 11 },
        { wch: 11 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 16 },
      ];

      for (
        let rowIndex = 10;
        rowIndex < 10 + recordRows.length;
        rowIndex += 1
      ) {
        const cellAddress = XLSX.utils.encode_cell({
          r: rowIndex,
          c: 7,
        });

        if (recordWorksheet[cellAddress]) {
          recordWorksheet[cellAddress].z = "0.0%";
        }
      }

      const summarySheetData = [
        ["SIGNAL VILLAGE NATIONAL HIGH SCHOOL"],
        ["SECTION ATTENDANCE SUMMARY"],
        [],
        ["Section", exportSection.sectionName || "—"],
        ["Adviser", exportSection.adviserName || "Unassigned"],
        ["Report Period", formatDateRange(fromDate, toDate)],
        ["Student Search", debouncedSearch || "All students"],
        [],
        ["Metric", "Value"],
        ["Students", Number(exportSummary.students ?? 0)],
        ["Sessions", Number(exportSummary.sessions ?? 0)],
        ["Attendance Records", Number(exportSummary.totalRecords ?? 0)],
        ["Present Records", Number(exportSummary.present ?? 0)],
        ["Late Records", Number(exportSummary.late ?? 0)],
        ["Absent Records", Number(exportSummary.absent ?? 0)],
        ["Present Rate", Number(exportSummary.presentRate ?? 0) / 100],
        ["Late Rate", Number(exportSummary.lateRate ?? 0) / 100],
        ["Absence Rate", Number(exportSummary.absenceRate ?? 0) / 100],
        ["Overall Attendance", Number(exportSummary.attendanceRate ?? 0) / 100],
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summarySheetData);

      summaryWorksheet["!merges"] = [
        XLSX.utils.decode_range("A1:B1"),
        XLSX.utils.decode_range("A2:B2"),
      ];

      summaryWorksheet["!cols"] = [{ wch: 24 }, { wch: 30 }];

      for (let rowIndex = 15; rowIndex <= 18; rowIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({
          r: rowIndex,
          c: 1,
        });

        if (summaryWorksheet[cellAddress]) {
          summaryWorksheet[cellAddress].z = "0.0%";
        }
      }

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        recordWorksheet,
        "Attendance Records",
      );

      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

      XLSX.writeFile(workbook, buildExportFileName("xlsx"), {
        compression: true,
      });
    } catch (exportRequestError) {
      console.error("Unable to export Excel report:", exportRequestError);

      setExportError(
        exportRequestError?.response?.data?.message ||
          "Unable to export the Excel report.",
      );
    } finally {
      setExportingExcel(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <CouncilorLayout>
      <section className="attendance-detail-page">
        {/* =================================================
            PAGE TOOLBAR
        ================================================= */}

        <div className="attendance-record-toolbar">
          <button
            type="button"
            className="attendance-detail-back"
            onClick={handleBack}
          >
            <span aria-hidden="true">←</span>
            Back to Attendance Overview
          </button>

          <div className="attendance-record-actions">
            <button
              type="button"
              className="attendance-export-button attendance-export-pdf"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf || exportingExcel}
            >
              <span className="attendance-export-icon" aria-hidden="true">
                PDF
              </span>

              <span>
                <strong>{exportingPdf ? "Preparing..." : "Export PDF"}</strong>

                <small>Official printable sheet</small>
              </span>
            </button>

            <button
              type="button"
              className="attendance-export-button attendance-export-excel"
              onClick={handleExportExcel}
              disabled={loading || exportingPdf || exportingExcel}
            >
              <span className="attendance-export-icon" aria-hidden="true">
                XLS
              </span>

              <span>
                <strong>
                  {exportingExcel ? "Preparing..." : "Export Excel"}
                </strong>

                <small>All matching students</small>
              </span>
            </button>
          </div>
        </div>

        {/* =================================================
            EXPORT ERROR
        ================================================= */}

        {exportError && (
          <div className="attendance-export-error" role="alert">
            <span aria-hidden="true">!</span>

            <div>
              <strong>Export could not be completed</strong>
              <p>{exportError}</p>
            </div>
          </div>
        )}

        {/* =================================================
            OFFICIAL REPORT HEADER
        ================================================= */}

        <header className="attendance-record-header">
          <div className="attendance-record-brand">
            <div className="attendance-record-logos" aria-hidden="true">
              <img src={depedLogo} alt="" />
              <img src={seniorHighSchoolLogo} alt="" />
            </div>

            <div className="attendance-record-school">
              <span>REPUBLIC OF THE PHILIPPINES</span>

              <strong>Signal Village National High School</strong>

              <small>Attendance Management System · Councilor Portal</small>
            </div>
          </div>

          <div className="attendance-record-document">
            <span>OFFICIAL SCHOOL RECORD</span>

            <strong>Section Attendance Sheet</strong>

            <small>
              Report generated from the Attendance Management System
            </small>
          </div>
        </header>

        {/* =================================================
            SECTION / REPORT IDENTITY
        ================================================= */}

        <section className="attendance-record-identity">
          <div className="attendance-record-section-block">
            <span>ACADEMIC SECTION</span>

            <h1>{section.sectionName}</h1>

            <div className="attendance-record-section-meta">
              <span>
                Adviser
                <strong>{section.adviserName || "Unassigned"}</strong>
              </span>

              <span>
                Report Period
                <strong>{formatDateRange(fromDate, toDate)}</strong>
              </span>
            </div>
          </div>

          <div
            className={`attendance-record-health attendance-record-health-${overallHealth.key}`}
          >
            <span>ATTENDANCE HEALTH</span>

            <strong>{formatPercentage(summary.attendanceRate)}</strong>

            <div>
              <b>{overallHealth.label}</b>
              <small>{overallHealth.description}</small>
            </div>
          </div>
        </section>

        {/* =================================================
            RECORD SUMMARY
        ================================================= */}

        <section
          className="attendance-record-summary"
          aria-label="Section attendance report summary"
        >
          <article className="attendance-record-stat attendance-record-stat-neutral">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ♙
            </div>

            <div>
              <span>ENROLLED / REPORTED</span>
              <strong>{formatNumber(summary.students)}</strong>
              <small>Students in report scope</small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-present">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ✓
            </div>

            <div>
              <span>PRESENT</span>
              <strong>{formatPercentage(summary.presentRate)}</strong>
              <small>{formatNumber(summary.present)} records</small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-late">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ◷
            </div>

            <div>
              <span>LATE</span>
              <strong>{formatPercentage(summary.lateRate)}</strong>
              <small>{formatNumber(summary.late)} records</small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-absent">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ×
            </div>

            <div>
              <span>ABSENT</span>
              <strong>{formatPercentage(summary.absenceRate)}</strong>
              <small>{formatNumber(summary.absent)} records</small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-sessions">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ▦
            </div>

            <div>
              <span>SESSIONS</span>
              <strong>{formatNumber(summary.sessions)}</strong>
              <small>{formatNumber(summary.totalRecords)} total records</small>
            </div>
          </article>
        </section>

        {/* =================================================
            PROFESSIONAL RECORD SHEET
        ================================================= */}

        <section className="attendance-record-sheet">
          {/* ===============================================
              SHEET HEADER
          ================================================ */}

          <header className="attendance-record-sheet-header">
            <div>
              <span className="attendance-record-kicker">
                STUDENT ATTENDANCE REGISTER
              </span>

              <h2>Attendance Record Sheet</h2>

              <p>
                Consolidated student attendance totals for the selected
                reporting period. Use the filters below to narrow the register.
              </p>
            </div>

            <div className="attendance-record-sheet-meta">
              <div>
                <span>Students</span>
                <strong>{formatNumber(studentPage.totalElements)}</strong>
              </div>

              <div>
                <span>Sessions</span>
                <strong>{formatNumber(summary.sessions)}</strong>
              </div>

              <div>
                <span>Period</span>
                <strong>
                  {fromDate === toDate
                    ? formatDate(fromDate)
                    : `${formatDate(fromDate)} – ${formatDate(toDate)}`}
                </strong>
              </div>
            </div>
          </header>

          {/* ===============================================
              FILTERS
          ================================================ */}

          <div className="attendance-record-filters">
            <label className="attendance-record-search">
              <span aria-hidden="true">⌕</span>

              <div>
                <span>SEARCH STUDENT</span>

                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name or student number..."
                  aria-label="Search students"
                />
              </div>
            </label>

            <label className="attendance-record-filter">
              <span>FROM DATE</span>

              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={handleFromDateChange}
              />
            </label>

            <label className="attendance-record-filter">
              <span>TO DATE</span>

              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={handleToDateChange}
              />
            </label>

            <div className="attendance-record-filter-context">
              <span>REPORT SCOPE</span>

              <strong>
                {debouncedSearch
                  ? `Filtered: “${debouncedSearch}”`
                  : "All students"}
              </strong>

              <small>Exports use this same date range and search scope.</small>
            </div>
          </div>

          {/* ===============================================
              REPORT ERROR
          ================================================ */}

          {error && (
            <div
              className="councilor-error attendance-record-api-error"
              role="alert"
            >
              <span aria-hidden="true">!</span>
              <p>{error}</p>
            </div>
          )}

          {/* ===============================================
              LOADING
          ================================================ */}

          {loading && (
            <div className="attendance-record-loading">
              <span className="councilor-loading-spinner" aria-hidden="true" />

              <strong>Preparing attendance register</strong>

              <p>Loading student attendance records...</p>
            </div>
          )}

          {/* ===============================================
              EMPTY
          ================================================ */}

          {!loading && !error && students.length === 0 && (
            <div className="attendance-record-empty">
              <div aria-hidden="true">♙</div>

              <strong>No student attendance found</strong>

              <p>
                No student attendance records match the selected report period
                or student search.
              </p>
            </div>
          )}

          {/* ===============================================
              TABLE
          ================================================ */}

          {!loading && !error && students.length > 0 && (
            <>
              <div className="attendance-record-table-wrap">
                <table className="attendance-record-table">
                  <thead>
                    <tr>
                      <th className="attendance-record-col-no">NO.</th>
                      <th className="attendance-record-col-number">
                        STUDENT NO.
                      </th>
                      <th className="attendance-record-col-student">
                        STUDENT NAME
                      </th>
                      <th>SESSIONS</th>
                      <th>PRESENT</th>
                      <th>LATE</th>
                      <th>ABSENT</th>
                      <th className="attendance-record-col-rate">
                        ATTENDANCE RATE
                      </th>
                      <th>REVIEW</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student, index) => {
                      const studentHealth = getAttendanceHealth(
                        student.attendanceRate,
                      );

                      const absoluteIndex =
                        studentPage.page * studentPage.size + index + 1;

                      return (
                        <tr
                          key={student.studentId}
                          className={`attendance-record-row attendance-record-row-${studentHealth.key}`}
                        >
                          <td className="attendance-record-row-number">
                            {absoluteIndex}
                          </td>

                          <td className="attendance-record-student-number">
                            {student.studentNumber || "—"}
                          </td>

                          <td>
                            <div className="attendance-record-student">
                              <div aria-hidden="true">
                                {student.studentName
                                  ?.charAt(0)
                                  ?.toUpperCase() || "S"}
                              </div>

                              <div>
                                <strong>{student.studentName}</strong>
                                <span>
                                  {student.studentNumber || "No number"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="attendance-record-count">
                            {formatNumber(student.sessions)}
                          </td>

                          <td>
                            <span className="attendance-record-pill present">
                              {formatNumber(student.present)}
                            </span>
                          </td>

                          <td>
                            <span className="attendance-record-pill late">
                              {formatNumber(student.late)}
                            </span>
                          </td>

                          <td>
                            <span className="attendance-record-pill absent">
                              {formatNumber(student.absent)}
                            </span>
                          </td>

                          <td>
                            <div className="attendance-record-rate">
                              <div>
                                <strong>
                                  {formatPercentage(student.attendanceRate)}
                                </strong>

                                <span>{studentHealth.label}</span>
                              </div>

                              <div
                                className="attendance-record-rate-bar"
                                aria-hidden="true"
                              >
                                <span
                                  style={{
                                    width: `${clampPercentage(
                                      student.attendanceRate,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`attendance-record-review attendance-record-review-${studentHealth.key}`}
                            >
                              {studentHealth.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* =========================================
                  SHEET FOOTNOTE
              ========================================== */}

              <div className="attendance-record-note">
                <div>
                  <span aria-hidden="true">i</span>

                  <p>
                    <strong>Reading the register:</strong> attendance rate
                    reflects the student's attendance across the selected
                    sessions. “For Review” is a visual monitoring aid and not a
                    disciplinary classification.
                  </p>
                </div>

                <span>Report scope: {formatDateRange(fromDate, toDate)}</span>
              </div>

              {/* =========================================
                  PAGINATION
              ========================================== */}

              <footer className="attendance-record-pagination">
                <p>
                  Showing <strong>{startRecord}</strong>
                  {" – "}
                  <strong>{endRecord}</strong> of{" "}
                  <strong>{formatNumber(studentPage.totalElements)}</strong>{" "}
                  students
                </p>

                <div>
                  <button
                    type="button"
                    disabled={studentPage.first}
                    onClick={goToPreviousPage}
                  >
                    ← Previous
                  </button>

                  <span>
                    Page{" "}
                    <strong>
                      {studentPage.totalPages > 0 ? studentPage.page + 1 : 0}
                    </strong>{" "}
                    of <strong>{studentPage.totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={studentPage.last}
                    onClick={goToNextPage}
                  >
                    Next →
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>

        {/* =================================================
            PRINT-ONLY OFFICIAL FULL REPORT
        ================================================= */}

        <section className="attendance-print-sheet" aria-hidden="true">
          <header className="attendance-print-header">
            <div className="attendance-print-logos">
              <img src={depedLogo} alt="" />
              <img src={seniorHighSchoolLogo} alt="" />
            </div>

            <div>
              <span>Republic of the Philippines</span>
              <strong>Signal Village National High School</strong>
              <small>Attendance Management System</small>
              <h1>Official Section Attendance Record</h1>
            </div>
          </header>

          <section className="attendance-print-meta">
            <div>
              <span>Section</span>
              <strong>{printSection.sectionName || "—"}</strong>
            </div>

            <div>
              <span>Adviser</span>
              <strong>{printSection.adviserName || "Unassigned"}</strong>
            </div>

            <div>
              <span>Report Period</span>
              <strong>{formatDateRange(fromDate, toDate)}</strong>
            </div>

            <div>
              <span>Student Scope</span>
              <strong>{debouncedSearch || "All students"}</strong>
            </div>
          </section>

          <section className="attendance-print-summary">
            <div>
              <span>Students</span>
              <strong>{formatNumber(printSummary.students)}</strong>
            </div>

            <div>
              <span>Sessions</span>
              <strong>{formatNumber(printSummary.sessions)}</strong>
            </div>

            <div>
              <span>Present</span>
              <strong>{formatPercentage(printSummary.presentRate)}</strong>
            </div>

            <div>
              <span>Late</span>
              <strong>{formatPercentage(printSummary.lateRate)}</strong>
            </div>

            <div>
              <span>Absent</span>
              <strong>{formatPercentage(printSummary.absenceRate)}</strong>
            </div>

            <div>
              <span>Overall</span>
              <strong>{formatPercentage(printSummary.attendanceRate)}</strong>
            </div>
          </section>

          <table className="attendance-print-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Student No.</th>
                <th>Student Name</th>
                <th>Sessions</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Rate</th>
                <th>Review</th>
              </tr>
            </thead>

            <tbody>
              {printStudents.map((student, index) => {
                const health = getAttendanceHealth(student.attendanceRate);

                return (
                  <tr key={`print-${student.studentId}`}>
                    <td>{index + 1}</td>
                    <td>{student.studentNumber || "—"}</td>
                    <td>{student.studentName}</td>
                    <td>{formatNumber(student.sessions)}</td>
                    <td>{formatNumber(student.present)}</td>
                    <td>{formatNumber(student.late)}</td>
                    <td>{formatNumber(student.absent)}</td>
                    <td>{formatPercentage(student.attendanceRate)}</td>
                    <td>{health.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <footer className="attendance-print-footer">
            <span>
              Generated by SVNHS Attendance Management System ·{" "}
              {new Intl.DateTimeFormat("en-PH", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date())}
            </span>

            <span>Councilor Attendance Overview</span>
          </footer>
        </section>
      </section>
    </CouncilorLayout>
  );
}

export default AttendanceDetail;
