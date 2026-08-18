import {
  useEffect,
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

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
   DATA HELPERS
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

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

const getRecordStudentId = (record) =>
  record?.studentId ||
  record?.student?.id ||
  "";

const getRecordStudentName = (record) =>
  record?.studentName ||
  record?.student?.name ||
  "Unnamed Student";

const getRecordStudentNumber = (record) =>
  record?.studentNumber ||
  record?.student?.studentNumber ||
  "—";

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

const getRecordStatus = (record) =>
  String(
    record?.status ||
      "PRESENT",
  )
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? 0
    : parsed;
};

/* =========================================================
   DATE / TIME HELPERS
========================================================= */

const twoDigits = (value) =>
  String(value).padStart(2, "0");

const hasExplicitTimezone = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const raw =
    value.trim();

  if (raw.endsWith("Z")) {
    return true;
  }

  const suffix =
    raw.length > 10
      ? raw.slice(10)
      : "";

  return (
    suffix.includes("+") ||
    suffix.includes("-")
  );
};

const toTwelveHourTime = (
  hourValue,
  minuteValue,
  secondValue,
  includeSeconds = false,
) => {
  const hour =
    Number(hourValue);

  if (Number.isNaN(hour)) {
    return "—";
  }

  const period =
    hour >= 12
      ? "PM"
      : "AM";

  const normalizedHour =
    hour % 12 || 12;

  const minute =
    twoDigits(
      minuteValue || 0,
    );

  const seconds =
    includeSeconds
      ? `:${twoDigits(
          secondValue || 0,
        )}`
      : "";

  return `${normalizedHour}:${minute}${seconds} ${period}`;
};

const formatTime = (
  value,
  includeSeconds = false,
) => {
  if (!value) {
    return "—";
  }

  /*
   * Spring LocalDateTime has no timezone.
   * Treat it as already-local school time.
   */
  if (
    typeof value === "string" &&
    !hasExplicitTimezone(value)
  ) {
    const raw =
      value.trim();

    const localDateTime =
      raw.length >= 16 &&
      raw[4] === "-" &&
      raw[7] === "-" &&
      (raw[10] === "T" ||
        raw[10] === " ");

    if (localDateTime) {
      return toTwelveHourTime(
        raw.slice(11, 13),
        raw.slice(14, 16),
        raw.length >= 19
          ? raw.slice(17, 19)
          : "00",
        includeSeconds,
      );
    }
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: PH_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      second: includeSeconds
        ? "2-digit"
        : undefined,
      hour12: true,
    },
  ).format(date);
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  if (
    typeof value === "string" &&
    value.length >= 10 &&
    value[4] === "-" &&
    value[7] === "-"
  ) {
    const date =
      new Date(
        `${value.slice(
          0,
          10,
        )}T12:00:00`,
      );

    return new Intl.DateTimeFormat(
      "en-PH",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    ).format(date);
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: PH_TIME_ZONE,
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
};

const formatGeneratedAt = () =>
  new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: PH_TIME_ZONE,
      dateStyle: "long",
      timeStyle: "short",
    },
  ).format(new Date());

/* =========================================================
   FILE NAME
========================================================= */

const sanitizeFileName = (value) => {
  /*
   * Deliberately regex-free because the old
   * sanitizer caused escaping/parser issues.
   */
  const invalidCharacters = [
    "<",
    ">",
    ":",
    '"',
    "/",
    "\\",
    "|",
    "?",
    "*",
  ];

  let result =
    String(
      value ||
        "attendance-record",
    ).trim();

  invalidCharacters.forEach(
    (character) => {
      result = result
        .split(character)
        .join("-");
    },
  );

  return result
    .split(" ")
    .filter(Boolean)
    .join("_")
    .slice(0, 90);
};

/* =========================================================
   SESSION STORAGE
========================================================= */

const readStoredSession = (
  storageKey,
) => {
  try {
    const stored =
      window.sessionStorage.getItem(
        storageKey,
      );

    return stored
      ? JSON.parse(stored)
      : null;
  } catch {
    return null;
  }
};

/* =========================================================
   ATTENDANCE HEALTH
========================================================= */

const getAttendanceHealth = (rate) => {
  const value =
    Number(rate ?? 0);

  if (value >= 90) {
    return {
      key: "strong",
      label: "Strong",
      description:
        "This completed session recorded a high attendance rate.",
    };
  }

  if (value >= 75) {
    return {
      key: "monitor",
      label: "Monitor",
      description:
        "Attendance is moderate and may benefit from routine monitoring.",
    };
  }

  return {
    key: "review",
    label: "For Review",
    description:
      "Attendance for this session is lower and may require follow-up.",
  };
};

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceHistoryDetail() {
  const { sessionId } =
    useParams();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const user =
    authService.getUser();

  /* =======================================================
     UI STATE
  ======================================================= */

  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    exportingPdf,
    setExportingPdf,
  ] = useState(false);

  const [
    exportingExcel,
    setExportingExcel,
  ] = useState(false);

  const [
    exportError,
    setExportError,
  ] = useState("");

  /* =======================================================
     SESSION METADATA
  ======================================================= */

  const storageKey =
    `attendance-history-session-${sessionId}`;

  const navigationSession =
    location.state?.session ||
    null;

  const storedSession =
    useMemo(
      () =>
        navigationSession ||
        readStoredSession(
          storageKey,
        ),
      [
        navigationSession,
        storageKey,
      ],
    );

  useEffect(() => {
    if (!navigationSession) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(
          navigationSession,
        ),
      );
    } catch {
      // Storage is only a refresh convenience.
    }
  }, [
    navigationSession,
    storageKey,
  ]);

  /* =======================================================
     LOAD SESSION RECORDS
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        if (!sessionId) {
          throw new Error(
            "Attendance session ID is missing.",
          );
        }

        const data =
          await adviserService.getSessionRecords(
            sessionId,
          );

        if (!mounted) {
          return;
        }

        setRecords(
          normalizeArray(data),
        );
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
            requestError?.message ||
              "Unable to load the attendance record.",
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
     FALLBACK SESSION METADATA
  ======================================================= */

  const derivedSession =
    useMemo(() => {
      if (
        storedSession ||
        records.length === 0
      ) {
        return null;
      }

      const firstRecord =
        records[0];

      const timedRecord =
        records.find(
          (record) =>
            Boolean(
              getRecordTime(
                record,
              ),
            ),
        );

      const recordedAt =
        timedRecord
          ? getRecordTime(
              timedRecord,
            )
          : "";

      return {
        sessionId,
        sectionName:
          getRecordSectionName(
            firstRecord,
          ) ||
          "Assigned Section",
        attendanceDate:
          recordedAt
            ? String(
                recordedAt,
              ).slice(
                0,
                10,
              )
            : "",
        studentCount:
          records.length,
        status: "ENDED",
      };
    }, [
      records,
      sessionId,
      storedSession,
    ]);

  const session =
    storedSession ||
    derivedSession ||
    null;

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const statusCounts =
    useMemo(
      () =>
        records.reduce(
          (
            totals,
            record,
          ) => {
            const status =
              getRecordStatus(
                record,
              );

            if (
              status === "PRESENT"
            ) {
              totals.present += 1;
            } else if (
              status === "LATE"
            ) {
              totals.late += 1;
            } else if (
              status === "ABSENT"
            ) {
              totals.absent += 1;
            }

            return totals;
          },
          {
            present: 0,
            late: 0,
            absent: 0,
          },
        ),
      [records],
    );

  const presentCount =
    statusCounts.present;

  const lateCount =
    statusCounts.late;

  const absentCount =
    statusCounts.absent;

  const totalStudents =
    session?.studentCount != null
      ? safeNumber(
          session.studentCount,
        )
      : records.length;

  const attendedCount =
    presentCount +
    lateCount;

  const attendanceRate =
    totalStudents > 0
      ? Math.round(
          (attendedCount /
            totalStudents) *
            1000,
        ) / 10
      : 0;

  const presentRate =
    totalStudents > 0
      ? Math.round(
          (presentCount /
            totalStudents) *
            1000,
        ) / 10
      : 0;

  const lateRate =
    totalStudents > 0
      ? Math.round(
          (lateCount /
            totalStudents) *
            1000,
        ) / 10
      : 0;

  const absenceRate =
    totalStudents > 0
      ? Math.round(
          (absentCount /
            totalStudents) *
            1000,
        ) / 10
      : 0;

  const sectionName =
    session?.sectionName ||
    "Assigned Section";

  const attendanceDate =
    session?.attendanceDate ||
    "";

  const adviserName =
    user?.name?.trim() ||
    session?.adviserName ||
    "Class Adviser";

  const overallHealth =
    getAttendanceHealth(
      attendanceRate,
    );

  /* =======================================================
     FILTERED RECORDS
  ======================================================= */

  const filteredRecords =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          const status =
            getRecordStatus(
              record,
            );

          if (
            statusFilter !==
              "ALL" &&
            status !==
              statusFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const name =
            getRecordStudentName(
              record,
            ).toLowerCase();

          const number =
            String(
              getRecordStudentNumber(
                record,
              ),
            ).toLowerCase();

          return (
            name.includes(query) ||
            number.includes(query)
          );
        },
      );
    }, [
      records,
      searchQuery,
      statusFilter,
    ]);

  /* =======================================================
     EXPORT DATA
  ======================================================= */

  const exportRows =
    useMemo(
      () =>
        records.map(
          (
            record,
            index,
          ) => ({
            No: index + 1,
            "Student Number":
              getRecordStudentNumber(
                record,
              ),
            "Student Name":
              getRecordStudentName(
                record,
              ),
            Status:
              getRecordStatus(
                record,
              ),
            "Recorded At":
              getRecordTime(
                record,
              )
                ? formatTime(
                    getRecordTime(
                      record,
                    ),
                    true,
                  )
                : "",
          }),
        ),
      [records],
    );

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    navigate(
      "/adviser/attendance/history",
    );
  };

  /* =======================================================
     PDF
  ======================================================= */

  const handleExportPdf =
    async () => {
      if (
        records.length === 0 ||
        exportingPdf ||
        exportingExcel
      ) {
        return;
      }

      try {
        setExportError("");
        setExportingPdf(true);

        await new Promise(
          (resolve) => {
            window.requestAnimationFrame(
              () => {
                window.requestAnimationFrame(
                  resolve,
                );
              },
            );
          },
        );

        window.print();
      } catch (
        exportRequestError
      ) {
        console.error(
          "Unable to prepare PDF export:",
          exportRequestError,
        );

        setExportError(
          "Unable to prepare the PDF attendance record.",
        );
      } finally {
        setExportingPdf(false);
      }
    };

  /* =======================================================
     EXCEL
  ======================================================= */

  const handleExportExcel =
    () => {
      if (
        records.length === 0 ||
        exportingPdf ||
        exportingExcel
      ) {
        return;
      }

      try {
        setExportError("");
        setExportingExcel(true);

        const recordRows =
          exportRows.map(
            (row) => [
              row.No,
              row["Student Number"],
              row["Student Name"],
              row.Status,
              row["Recorded At"],
            ],
          );

        const recordSheetData = [
          [
            "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
          ],
          [
            "ATTENDANCE MANAGEMENT SYSTEM",
          ],
          [
            "OFFICIAL STUDENT ATTENDANCE REGISTER",
          ],
          [],
          [
            "Section",
            sectionName,
          ],
          [
            "Adviser",
            adviserName,
          ],
          [
            "Attendance Date",
            formatDate(
              attendanceDate,
            ),
          ],
          [
            "Session Started",
            formatTime(
              session?.startedAt,
            ),
          ],
          [
            "Session Ended",
            formatTime(
              session?.endedAt,
            ),
          ],
          [],
          [
            "No.",
            "Student Number",
            "Student Name",
            "Status",
            "Recorded At",
          ],
          ...recordRows,
        ];

        const recordWorksheet =
          XLSX.utils.aoa_to_sheet(
            recordSheetData,
          );

        recordWorksheet["!merges"] = [
          XLSX.utils.decode_range(
            "A1:E1",
          ),
          XLSX.utils.decode_range(
            "A2:E2",
          ),
          XLSX.utils.decode_range(
            "A3:E3",
          ),
        ];

        recordWorksheet["!cols"] = [
          { wch: 7 },
          { wch: 19 },
          { wch: 34 },
          { wch: 15 },
          { wch: 20 },
        ];

        const summarySheetData = [
          [
            "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
          ],
          [
            "ATTENDANCE SESSION SUMMARY",
          ],
          [],
          [
            "Section",
            sectionName,
          ],
          [
            "Adviser",
            adviserName,
          ],
          [
            "Attendance Date",
            formatDate(
              attendanceDate,
            ),
          ],
          [
            "Session Started",
            formatTime(
              session?.startedAt,
            ),
          ],
          [
            "Session Ended",
            formatTime(
              session?.endedAt,
            ),
          ],
          [],
          [
            "Metric",
            "Value",
          ],
          [
            "Students",
            totalStudents,
          ],
          [
            "Present",
            presentCount,
          ],
          [
            "Late",
            lateCount,
          ],
          [
            "Absent",
            absentCount,
          ],
          [
            "Present Rate",
            presentRate / 100,
          ],
          [
            "Late Rate",
            lateRate / 100,
          ],
          [
            "Absence Rate",
            absenceRate / 100,
          ],
          [
            "Overall Attendance",
            attendanceRate / 100,
          ],
        ];

        const summaryWorksheet =
          XLSX.utils.aoa_to_sheet(
            summarySheetData,
          );

        summaryWorksheet["!merges"] = [
          XLSX.utils.decode_range(
            "A1:B1",
          ),
          XLSX.utils.decode_range(
            "A2:B2",
          ),
        ];

        summaryWorksheet["!cols"] = [
          { wch: 25 },
          { wch: 32 },
        ];

        for (
          let rowIndex = 14;
          rowIndex <= 17;
          rowIndex += 1
        ) {
          const address =
            XLSX.utils.encode_cell(
              {
                r: rowIndex,
                c: 1,
              },
            );

          if (
            summaryWorksheet[
              address
            ]
          ) {
            summaryWorksheet[
              address
            ].z = "0.0%";
          }
        }

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          recordWorksheet,
          "Attendance Record",
        );

        XLSX.utils.book_append_sheet(
          workbook,
          summaryWorksheet,
          "Summary",
        );

        const fileName =
          sanitizeFileName(
            `${sectionName}_Attendance_${attendanceDate || sessionId}`,
          );

        XLSX.writeFile(
          workbook,
          `${fileName}.xlsx`,
          {
            compression: true,
          },
        );
      } catch (
        exportRequestError
      ) {
        console.error(
          "Unable to export Excel attendance record:",
          exportRequestError,
        );

        setExportError(
          "Unable to export the Excel attendance record.",
        );
      } finally {
        setExportingExcel(false);
      }
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
      <section className="attendance-detail-page adviser-attendance-record-page">
        {/* =================================================
            PAGE TOOLBAR
        ================================================== */}

        <div className="attendance-record-toolbar">
          <button
            type="button"
            className="attendance-detail-back"
            onClick={
              handleBack
            }
          >
            <span
              aria-hidden="true"
            >
              ←
            </span>

            Back to Attendance History
          </button>

          <div className="attendance-record-actions">
            <button
              type="button"
              className="attendance-export-button attendance-export-pdf"
              disabled={
                loading ||
                records.length === 0 ||
                exportingPdf ||
                exportingExcel
              }
              onClick={() =>
                void handleExportPdf()
              }
            >
              <span
                className="attendance-export-icon"
                aria-hidden="true"
              >
                PDF
              </span>

              <span>
                <strong>
                  {exportingPdf
                    ? "Preparing..."
                    : "Export PDF"}
                </strong>

                <small>
                  Official printable sheet
                </small>
              </span>
            </button>

            <button
              type="button"
              className="attendance-export-button attendance-export-excel"
              disabled={
                loading ||
                records.length === 0 ||
                exportingPdf ||
                exportingExcel
              }
              onClick={
                handleExportExcel
              }
            >
              <span
                className="attendance-export-icon"
                aria-hidden="true"
              >
                XLS
              </span>

              <span>
                <strong>
                  {exportingExcel
                    ? "Preparing..."
                    : "Export Excel"}
                </strong>

                <small>
                  Complete session record
                </small>
              </span>
            </button>
          </div>
        </div>

        {/* =================================================
            EXPORT ERROR
        ================================================== */}

        {exportError && (
          <div
            className="attendance-export-error"
            role="alert"
          >
            <span
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Export could not be completed
              </strong>

              <p>
                {exportError}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            OFFICIAL REPORT HEADER
        ================================================== */}

        <header className="attendance-record-header">
          <div className="attendance-record-brand">
            <div
              className="attendance-record-logos"
              aria-hidden="true"
            >
              <img
                src={depedLogo}
                alt=""
              />

              <img
                src={
                  seniorHighSchoolLogo
                }
                alt=""
              />
            </div>

            <div className="attendance-record-school">
              <span>
                REPUBLIC OF THE PHILIPPINES
              </span>

              <strong>
                Signal Village National High School
              </strong>

              <small>
                Attendance Management System · Adviser Portal
              </small>
            </div>
          </div>

          <div className="attendance-record-document">
            <span>
              OFFICIAL SCHOOL RECORD
            </span>

            <strong>
              Student Attendance Sheet
            </strong>

            <small>
              Completed attendance session record
            </small>
          </div>
        </header>

        {/* =================================================
            SECTION / SESSION IDENTITY
        ================================================== */}

        <section className="attendance-record-identity">
          <div className="attendance-record-section-block">
            <span>
              ACADEMIC SECTION
            </span>

            <h1>
              {sectionName}
            </h1>

            <div className="attendance-record-section-meta">
              <span>
                Adviser
                <strong>
                  {adviserName}
                </strong>
              </span>

              <span>
                Attendance Date
                <strong>
                  {formatDate(
                    attendanceDate,
                  )}
                </strong>
              </span>

              <span>
                Session Time
                <strong>
                  {formatTime(
                    session?.startedAt,
                  )}{" "}
                  –{" "}
                  {formatTime(
                    session?.endedAt,
                  )}
                </strong>
              </span>
            </div>
          </div>

          <div
            className={`attendance-record-health attendance-record-health-${overallHealth.key}`}
          >
            <span>
              ATTENDANCE HEALTH
            </span>

            <strong>
              {attendanceRate.toFixed(
                1,
              )}
              %
            </strong>

            <div>
              <b>
                {overallHealth.label}
              </b>

              <small>
                {
                  overallHealth.description
                }
              </small>
            </div>
          </div>
        </section>

        {/* =================================================
            SESSION SUMMARY
        ================================================== */}

        <section
          className="attendance-record-summary"
          aria-label="Attendance session summary"
        >
          <article className="attendance-record-stat attendance-record-stat-neutral">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ♙
            </div>

            <div>
              <span>
                ENROLLED / REPORTED
              </span>

              <strong>
                {totalStudents}
              </strong>

              <small>
                Students in session
              </small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-present">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ✓
            </div>

            <div>
              <span>
                PRESENT
              </span>

              <strong>
                {presentRate.toFixed(
                  1,
                )}
                %
              </strong>

              <small>
                {presentCount} records
              </small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-late">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ◷
            </div>

            <div>
              <span>
                LATE
              </span>

              <strong>
                {lateRate.toFixed(
                  1,
                )}
                %
              </strong>

              <small>
                {lateCount} records
              </small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-absent">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ×
            </div>

            <div>
              <span>
                ABSENT
              </span>

              <strong>
                {absenceRate.toFixed(
                  1,
                )}
                %
              </strong>

              <small>
                {absentCount} records
              </small>
            </div>
          </article>

          <article className="attendance-record-stat attendance-record-stat-sessions">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ▦
            </div>

            <div>
              <span>
                SESSION
              </span>

              <strong>
                1
              </strong>

              <small>
                Completed record
              </small>
            </div>
          </article>
        </section>

        {/* =================================================
            PROFESSIONAL RECORD SHEET
        ================================================== */}

        <section className="attendance-record-sheet">
          <header className="attendance-record-sheet-header">
            <div>
              <span className="attendance-record-kicker">
                STUDENT ATTENDANCE REGISTER
              </span>

              <h2>
                Attendance Record Sheet
              </h2>

              <p>
                Official student attendance
                entries recorded during this
                completed class session.
              </p>
            </div>

            <div className="attendance-record-sheet-meta">
              <div>
                <span>
                  Students
                </span>

                <strong>
                  {totalStudents}
                </strong>
              </div>

              <div>
                <span>
                  Present
                </span>

                <strong>
                  {presentCount}
                </strong>
              </div>

              <div>
                <span>
                  Date
                </span>

                <strong>
                  {formatDate(
                    attendanceDate,
                  )}
                </strong>
              </div>
            </div>
          </header>

          {/* ===============================================
              FILTERS
          ================================================ */}

          <div className="attendance-record-filters adviser-attendance-record-filters">
            <label className="attendance-record-search">
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <div>
                <span>
                  SEARCH STUDENT
                </span>

                <input
                  type="search"
                  value={
                    searchQuery
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Name or student number..."
                  aria-label="Search students"
                />
              </div>
            </label>

            <label className="attendance-record-filter adviser-attendance-status-filter">
              <span>
                ATTENDANCE STATUS
              </span>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event,
                ) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter attendance status"
              >
                <option value="ALL">
                  All Status
                </option>

                <option value="PRESENT">
                  Present
                </option>

                <option value="LATE">
                  Late
                </option>

                <option value="ABSENT">
                  Absent
                </option>
              </select>
            </label>

            <div className="attendance-record-filter-context">
              <span>
                SESSION SCOPE
              </span>

              <strong>
                {searchQuery.trim()
                  ? `Filtered: “${searchQuery.trim()}”`
                  : statusFilter ===
                      "ALL"
                    ? "All attendance records"
                    : statusFilter}
              </strong>

              <small>
                Exports always include the
                complete official session
                record.
              </small>
            </div>
          </div>

          {/* ===============================================
              API ERROR
          ================================================ */}

          {error && (
            <div
              className="councilor-error attendance-record-api-error"
              role="alert"
            >
              <span
                aria-hidden="true"
              >
                !
              </span>

              <p>
                {error}
              </p>
            </div>
          )}

          {/* ===============================================
              LOADING
          ================================================ */}

          {loading && (
            <div className="attendance-record-loading">
              <span
                className="councilor-loading-spinner"
                aria-hidden="true"
              />

              <strong>
                Preparing attendance register
              </strong>

              <p>
                Loading student attendance
                records...
              </p>
            </div>
          )}

          {/* ===============================================
              EMPTY
          ================================================ */}

          {!loading &&
            !error &&
            records.length === 0 && (
              <div className="attendance-record-empty">
                <div
                  aria-hidden="true"
                >
                  ♙
                </div>

                <strong>
                  No attendance records found
                </strong>

                <p>
                  This completed session does
                  not contain any attendance
                  records.
                </p>
              </div>
            )}

          {/* ===============================================
              TABLE
          ================================================ */}

          {!loading &&
            !error &&
            records.length > 0 && (
              <>
                <div className="attendance-record-table-wrap">
                  <table className="attendance-record-table adviser-attendance-record-table">
                    <thead>
                      <tr>
                        <th className="attendance-record-col-no">
                          NO.
                        </th>

                        <th className="attendance-record-col-number">
                          STUDENT NO.
                        </th>

                        <th className="attendance-record-col-student">
                          STUDENT NAME
                        </th>

                        <th>
                          STATUS
                        </th>

                        <th>
                          RECORDED AT
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRecords.map(
                        (
                          record,
                          index,
                        ) => {
                          const status =
                            getRecordStatus(
                              record,
                            );

                          const studentName =
                            getRecordStudentName(
                              record,
                            );

                          const studentNumber =
                            getRecordStudentNumber(
                              record,
                            );

                          return (
                            <tr
                              key={
                                getRecordStudentId(
                                  record,
                                ) ||
                                `${studentNumber}-${index}`
                              }
                              className={`attendance-record-row adviser-attendance-record-row is-${status.toLowerCase()}`}
                            >
                              <td className="attendance-record-row-number">
                                {index +
                                  1}
                              </td>

                              <td className="attendance-record-student-number">
                                {
                                  studentNumber
                                }
                              </td>

                              <td>
                                <div className="attendance-record-student">
                                  <div
                                    aria-hidden="true"
                                  >
                                    {studentName
                                      .charAt(
                                        0,
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        studentName
                                      }
                                    </strong>

                                    <span>
                                      {
                                        studentNumber
                                      }
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={`attendance-session-status-pill is-${status.toLowerCase()}`}
                                >
                                  <i />

                                  {
                                    status
                                  }
                                </span>
                              </td>

                              <td className="adviser-attendance-record-time">
                                {getRecordTime(
                                  record,
                                )
                                  ? formatTime(
                                      getRecordTime(
                                        record,
                                      ),
                                      true,
                                    )
                                  : "—"}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                {/* =========================================
                    SHEET FOOTNOTE
                ========================================== */}

                <div className="attendance-record-note">
                  <div>
                    <span
                      aria-hidden="true"
                    >
                      i
                    </span>

                    <p>
                      <strong>
                        Reading the register:
                      </strong>{" "}
                      present and late records
                      include their recorded
                      attendance time when
                      available. Absent students
                      do not have a recorded
                      check-in time.
                    </p>
                  </div>

                  <span>
                    Session ID:{" "}
                    {sessionId}
                  </span>
                </div>

                <footer className="attendance-record-pagination adviser-attendance-record-footer">
                  <p>
                    Showing{" "}
                    <strong>
                      {
                        filteredRecords.length
                      }
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {records.length}
                    </strong>{" "}
                    attendance records
                  </p>

                  <div className="adviser-attendance-session-footer-meta">
                    <span>
                      COMPLETED SESSION
                    </span>

                    <strong>
                      {formatDate(
                        attendanceDate,
                      )}
                    </strong>
                  </div>
                </footer>
              </>
            )}
        </section>

        {/* =================================================
            SIGNATURES
        ================================================== */}

        <section className="adviser-attendance-record-signatures">
          <div>
            <span />

            <strong>
              {adviserName}
            </strong>

            <small>
              Class Adviser
            </small>
          </div>

          <div>
            <span />

            <strong>
              ______________________________
            </strong>

            <small>
              School Official
            </small>
          </div>
        </section>

        {/* =================================================
            PRINT-ONLY OFFICIAL FULL REPORT
        ================================================== */}

        <section
          className="attendance-print-sheet"
          aria-hidden="true"
        >
          <header className="attendance-print-header">
            <div className="attendance-print-logos">
              <img
                src={depedLogo}
                alt=""
              />

              <img
                src={
                  seniorHighSchoolLogo
                }
                alt=""
              />
            </div>

            <div>
              <span>
                Republic of the Philippines
              </span>

              <strong>
                Signal Village National High School
              </strong>

              <small>
                Attendance Management System
              </small>

              <h1>
                Official Student Attendance Record
              </h1>
            </div>
          </header>

          <section className="attendance-print-meta adviser-attendance-print-meta">
            <div>
              <span>
                Section
              </span>

              <strong>
                {sectionName}
              </strong>
            </div>

            <div>
              <span>
                Adviser
              </span>

              <strong>
                {adviserName}
              </strong>
            </div>

            <div>
              <span>
                Attendance Date
              </span>

              <strong>
                {formatDate(
                  attendanceDate,
                )}
              </strong>
            </div>

            <div>
              <span>
                Session Time
              </span>

              <strong>
                {formatTime(
                  session?.startedAt,
                )}{" "}
                –{" "}
                {formatTime(
                  session?.endedAt,
                )}
              </strong>
            </div>
          </section>

          <section className="attendance-print-summary adviser-attendance-print-summary">
            <div>
              <span>
                Students
              </span>

              <strong>
                {totalStudents}
              </strong>
            </div>

            <div>
              <span>
                Present
              </span>

              <strong>
                {presentCount}
              </strong>
            </div>

            <div>
              <span>
                Late
              </span>

              <strong>
                {lateCount}
              </strong>
            </div>

            <div>
              <span>
                Absent
              </span>

              <strong>
                {absentCount}
              </strong>
            </div>

            <div>
              <span>
                Attendance
              </span>

              <strong>
                {attendanceRate.toFixed(
                  1,
                )}
                %
              </strong>
            </div>
          </section>

          <table className="attendance-print-table">
            <thead>
              <tr>
                <th>
                  No.
                </th>

                <th>
                  Student No.
                </th>

                <th>
                  Student Name
                </th>

                <th>
                  Status
                </th>

                <th>
                  Recorded At
                </th>
              </tr>
            </thead>

            <tbody>
              {exportRows.map(
                (row) => (
                  <tr
                    key={`${row.No}-${row["Student Number"]}`}
                  >
                    <td>
                      {row.No}
                    </td>

                    <td>
                      {
                        row[
                          "Student Number"
                        ]
                      }
                    </td>

                    <td>
                      {
                        row[
                          "Student Name"
                        ]
                      }
                    </td>

                    <td>
                      {row.Status}
                    </td>

                    <td>
                      {
                        row[
                          "Recorded At"
                        ]
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <section className="adviser-attendance-print-signatures">
            <div>
              <span />

              <strong>
                {adviserName}
              </strong>

              <small>
                Class Adviser
              </small>
            </div>

            <div>
              <span />

              <strong>
                ______________________________
              </strong>

              <small>
                School Official
              </small>
            </div>
          </section>

          <footer className="attendance-print-footer">
            <span>
              Generated by SVNHS Attendance
              Management System ·{" "}
              {formatGeneratedAt()}
            </span>

            <span>
              Adviser Attendance History
            </span>
          </footer>
        </section>
      </section>
    </AdviserLayout>
  );
}

export default AttendanceHistoryDetail;
