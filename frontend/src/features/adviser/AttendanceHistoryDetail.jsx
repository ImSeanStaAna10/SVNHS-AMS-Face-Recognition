import { useEffect, useMemo, useState } from "react";

import { useLocation, useNavigate, useParams } from "react-router-dom";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";

import AdviserLayout from "../../layouts/AdviserLayout";

import authService from "../../services/authService";

import { useHistoricalAttendanceSessionRecords } from "../../hooks/queries/useAttendanceQueries";

import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/adviser/attendanceHistoryDetail.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PH_TIME_ZONE = "Asia/Manila";

const PDF_COLORS = {
  navy: [11, 46, 103],
  navyDark: [6, 26, 63],
  blue: [36, 95, 158],

  red: [181, 34, 50],
  amber: [194, 146, 31],
  green: [36, 122, 80],

  text: [25, 40, 64],
  muted: [100, 116, 139],
  border: [205, 214, 226],

  softBlue: [240, 246, 252],
  softGreen: [238, 248, 243],
  softAmber: [255, 248, 232],
  softRed: [255, 241, 243],

  white: [255, 255, 255],
};

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

const getRecordStatus = (record) =>
  String(record?.status || "PRESENT")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const parsed = Number(value);

  return Number.isNaN(parsed) ? 0 : parsed;
};

/* =========================================================
   DATE / TIME HELPERS
========================================================= */

const twoDigits = (value) => String(value).padStart(2, "0");

const hasExplicitTimezone = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const raw = value.trim();

  if (raw.endsWith("Z")) {
    return true;
  }

  const suffix = raw.length > 10 ? raw.slice(10) : "";

  return suffix.includes("+") || suffix.includes("-");
};

const toTwelveHourTime = (
  hourValue,
  minuteValue,
  secondValue,
  includeSeconds = false,
) => {
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) {
    return "—";
  }

  const period = hour >= 12 ? "PM" : "AM";

  const normalizedHour = hour % 12 || 12;

  const minute = twoDigits(minuteValue || 0);

  const seconds = includeSeconds ? `:${twoDigits(secondValue || 0)}` : "";

  return `${normalizedHour}:${minute}${seconds} ${period}`;
};

const formatTime = (value, includeSeconds = false) => {
  if (!value) {
    return "—";
  }

  /*
   * Spring LocalDateTime has no timezone.
   * Treat it as already-local school time.
   */
  if (typeof value === "string" && !hasExplicitTimezone(value)) {
    const raw = value.trim();

    const localDateTime =
      raw.length >= 16 &&
      raw[4] === "-" &&
      raw[7] === "-" &&
      (raw[10] === "T" || raw[10] === " ");

    if (localDateTime) {
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

  if (
    typeof value === "string" &&
    value.length >= 10 &&
    value[4] === "-" &&
    value[7] === "-"
  ) {
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);

    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,

    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatGeneratedAt = () =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,

    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

/* =========================================================
   FILE NAME
========================================================= */

const sanitizeFileName = (value) => {
  const invalidCharacters = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];

  let result = String(value || "attendance-record").trim();

  invalidCharacters.forEach((character) => {
    result = result.split(character).join("-");
  });

  return result.split(" ").filter(Boolean).join("_").slice(0, 90);
};

/* =========================================================
   SESSION STORAGE
========================================================= */

const readStoredSession = (storageKey) => {
  try {
    const stored = window.sessionStorage.getItem(storageKey);

    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/* =========================================================
   ATTENDANCE HEALTH
========================================================= */

const getAttendanceHealth = (rate) => {
  const value = Number(rate ?? 0);

  if (value >= 90) {
    return {
      key: "strong",

      label: "Strong",

      description: "This completed session recorded a high attendance rate.",
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
   PDF IMAGE HELPER
========================================================= */

const loadImageAsPngDataUrl = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      try {
        const naturalWidth = image.naturalWidth || 256;

        const naturalHeight = image.naturalHeight || 256;

        const maximumSize = 256;

        const scale = Math.min(
          maximumSize / naturalWidth,

          maximumSize / naturalHeight,

          1,
        );

        const width = Math.max(Math.round(naturalWidth * scale), 1);

        const height = Math.max(Math.round(naturalHeight * scale), 1);

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Unable to create image canvas."));

          return;
        }

        context.clearRect(0, 0, width, height);

        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/png"));
      } catch (imageError) {
        reject(imageError);
      }
    };

    image.onerror = () => {
      reject(new Error("Unable to load PDF logo."));
    };

    image.src = source;
  });

/* =========================================================
   PDF HEADER
========================================================= */

const drawPdfHeader = ({ document, depedImage, schoolImage }) => {
  const pageWidth = document.internal.pageSize.getWidth();

  /* WHITE HEADER */

  document.setFillColor(...PDF_COLORS.white);

  document.rect(0, 0, pageWidth, 23, "F");

  /* LOGOS */

  if (depedImage) {
    document.addImage(depedImage, "PNG", 10, 7, 11, 11, undefined, "FAST");
  }

  if (schoolImage) {
    document.addImage(schoolImage, "PNG", 23, 7, 11, 11, undefined, "FAST");
  }

  /* REPUBLIC */

  document.setTextColor(...PDF_COLORS.muted);

  document.setFont("helvetica", "normal");

  document.setFontSize(6.2);

  document.text("REPUBLIC OF THE PHILIPPINES", pageWidth / 2, 7.8, {
    align: "center",
  });

  /* SCHOOL */

  document.setTextColor(...PDF_COLORS.navyDark);

  document.setFont("helvetica", "bold");

  document.setFontSize(11);

  document.text("SIGNAL VILLAGE NATIONAL HIGH SCHOOL", pageWidth / 2, 12.5, {
    align: "center",
  });

  document.setTextColor(...PDF_COLORS.muted);

  document.setFont("helvetica", "normal");

  document.setFontSize(6.5);

  document.text(
    "Attendance Management System · Adviser Portal",
    pageWidth / 2,
    16.5,
    {
      align: "center",
    },
  );

  /* DOCUMENT TYPE */

  document.setTextColor(...PDF_COLORS.red);

  document.setFont("helvetica", "bold");

  document.setFontSize(6.3);

  document.text("OFFICIAL SCHOOL RECORD", pageWidth - 10, 10, {
    align: "right",
  });

  document.setTextColor(...PDF_COLORS.navyDark);

  document.setFontSize(7);

  document.text("ATTENDANCE SESSION RECORD", pageWidth - 10, 14, {
    align: "right",
  });

  /* ACCENT */

  document.setFillColor(...PDF_COLORS.red);

  document.rect(0, 20.5, pageWidth * 0.32, 1.5, "F");

  document.setFillColor(...PDF_COLORS.amber);

  document.rect(pageWidth * 0.32, 20.5, pageWidth * 0.04, 1.5, "F");

  document.setFillColor(...PDF_COLORS.navy);

  document.rect(pageWidth * 0.36, 20.5, pageWidth * 0.64, 1.5, "F");
};

/* =========================================================
   PDF SESSION META
========================================================= */

const drawPdfMeta = ({
  document,
  sectionName,
  adviserName,
  attendanceDate,
  startedAt,
  endedAt,
}) => {
  const pageWidth = document.internal.pageSize.getWidth();

  const left = 10;
  const right = 10;

  const availableWidth = pageWidth - left - right;

  const width = availableWidth / 5;

  const items = [
    {
      label: "SECTION",

      value: sectionName || "—",
    },

    {
      label: "ADVISER",

      value: adviserName || "Class Adviser",
    },

    {
      label: "ATTENDANCE DATE",

      value: formatDate(attendanceDate),
    },

    {
      label: "SESSION STARTED",

      value: formatTime(startedAt),
    },

    {
      label: "SESSION ENDED",

      value: formatTime(endedAt),
    },
  ];

  items.forEach((item, index) => {
    const x = left + width * index;

    document.setFillColor(...PDF_COLORS.softBlue);

    document.setDrawColor(...PDF_COLORS.border);

    document.setLineWidth(0.2);

    document.rect(x, 26, width, 13, "FD");

    document.setTextColor(...PDF_COLORS.muted);

    document.setFont("helvetica", "bold");

    document.setFontSize(5.2);

    document.text(item.label, x + 3, 30.2);

    document.setTextColor(...PDF_COLORS.text);

    document.setFontSize(6.8);

    const text = document.splitTextToSize(String(item.value || "—"), width - 6);

    document.text(text.slice(0, 2), x + 3, 34.5);
  });
};

/* =========================================================
   PDF SUMMARY
========================================================= */

const drawPdfSummary = ({
  document,
  totalStudents,
  presentCount,
  lateCount,
  absentCount,
  attendanceRate,
}) => {
  const pageWidth = document.internal.pageSize.getWidth();

  const left = 10;
  const right = 10;

  const gap = 2;

  const items = [
    {
      label: "Students",

      value: String(totalStudents),

      color: PDF_COLORS.navy,
    },

    {
      label: "Present",

      value: String(presentCount),

      color: PDF_COLORS.green,
    },

    {
      label: "Late",

      value: String(lateCount),

      color: PDF_COLORS.amber,
    },

    {
      label: "Absent",

      value: String(absentCount),

      color: PDF_COLORS.red,
    },

    {
      label: "Attendance",

      value: `${Number(attendanceRate).toFixed(1)}%`,

      color: PDF_COLORS.navyDark,
    },
  ];

  const availableWidth = pageWidth - left - right - gap * (items.length - 1);

  const cardWidth = availableWidth / items.length;

  items.forEach((item, index) => {
    const x = left + index * (cardWidth + gap);

    document.setFillColor(250, 252, 254);

    document.setDrawColor(...PDF_COLORS.border);

    document.roundedRect(x, 42, cardWidth, 11, 1.2, 1.2, "FD");

    document.setFillColor(...item.color);

    document.rect(x, 42, 1.4, 11, "F");

    document.setTextColor(...PDF_COLORS.muted);

    document.setFont("helvetica", "bold");

    document.setFontSize(5.2);

    document.text(item.label.toUpperCase(), x + 4, 45.6);

    document.setTextColor(...item.color);

    document.setFontSize(8);

    document.text(item.value, x + 4, 50.2);
  });
};

/* =========================================================
   PDF SIGNATURES
========================================================= */

const drawPdfSignatures = ({
  document,
  adviserName,
  depedImage,
  schoolImage,
}) => {
  const pageWidth = document.internal.pageSize.getWidth();

  const pageHeight = document.internal.pageSize.getHeight();

  const finalTableY = document.lastAutoTable?.finalY ?? 60;

  let signatureY = finalTableY + 16;

  /*
   * If the table already consumes most
   * of the last page, put certification
   * on its own clean page.
   */
  if (signatureY > pageHeight - 35) {
    document.addPage();

    drawPdfHeader({
      document,
      depedImage,
      schoolImage,
    });

    signatureY = 42;
  }

  /* CERTIFICATION */

  document.setTextColor(...PDF_COLORS.muted);

  document.setFont("helvetica", "bold");

  document.setFontSize(5.6);

  document.text("CERTIFICATION", 10, signatureY);

  document.setTextColor(...PDF_COLORS.text);

  document.setFont("helvetica", "normal");

  document.setFontSize(6.3);

  document.text(
    "This document represents the official attendance entries recorded for the completed class session.",
    10,
    signatureY + 4.2,
  );

  const lineY = signatureY + 19;

  const leftCenter = pageWidth * 0.31;

  const rightCenter = pageWidth * 0.69;

  const signatureWidth = 62;

  /* ADVISER */

  document.setDrawColor(...PDF_COLORS.muted);

  document.setLineWidth(0.25);

  document.line(
    leftCenter - signatureWidth / 2,
    lineY,

    leftCenter + signatureWidth / 2,
    lineY,
  );

  document.setFont("helvetica", "bold");

  document.setFontSize(7);

  document.setTextColor(...PDF_COLORS.text);

  document.text(adviserName || "Class Adviser", leftCenter, lineY + 4.5, {
    align: "center",
  });

  document.setFont("helvetica", "normal");

  document.setFontSize(5.8);

  document.setTextColor(...PDF_COLORS.muted);

  document.text("Class Adviser", leftCenter, lineY + 8, {
    align: "center",
  });

  /* SCHOOL OFFICIAL */

  document.setDrawColor(...PDF_COLORS.muted);

  document.line(
    rightCenter - signatureWidth / 2,
    lineY,

    rightCenter + signatureWidth / 2,
    lineY,
  );

  document.setFont("helvetica", "bold");

  document.setFontSize(7);

  document.setTextColor(...PDF_COLORS.text);

  document.text("School Official", rightCenter, lineY + 4.5, {
    align: "center",
  });

  document.setFont("helvetica", "normal");

  document.setFontSize(5.8);

  document.setTextColor(...PDF_COLORS.muted);

  document.text("Authorized Signature", rightCenter, lineY + 8, {
    align: "center",
  });
};

/* =========================================================
   PDF FOOTERS
========================================================= */

const drawPdfFooters = ({ document, generatedAt }) => {
  const totalPages = document.getNumberOfPages();

  const pageWidth = document.internal.pageSize.getWidth();

  const pageHeight = document.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    document.setPage(pageNumber);

    document.setDrawColor(...PDF_COLORS.border);

    document.setLineWidth(0.2);

    document.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);

    document.setFont("helvetica", "normal");

    document.setFontSize(5.7);

    document.setTextColor(...PDF_COLORS.muted);

    document.text(
      `Generated by SVNHS Attendance Management System · ${generatedAt}`,
      10,
      pageHeight - 5.2,
    );

    document.text(
      `Page ${pageNumber} of ${totalPages}`,
      pageWidth - 10,
      pageHeight - 5.2,
      {
        align: "right",
      },
    );
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
     UI STATE
  ======================================================= */

  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [exportingPdf, setExportingPdf] = useState(false);

  const [exportingExcel, setExportingExcel] = useState(false);

  const [exportError, setExportError] = useState("");

  /* =======================================================
     SESSION METADATA
  ======================================================= */

  const storageKey = `attendance-history-session-${sessionId}`;

  const navigationSession = location.state?.session || null;

  const storedSession = useMemo(
    () => navigationSession || readStoredSession(storageKey),
    [navigationSession, storageKey],
  );

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
      // Storage is only a refresh convenience.
    }
  }, [navigationSession, storageKey]);

  /* =======================================================
     CACHED HISTORICAL SESSION RECORDS

     Completed session records intentionally use the
     historical query key / history cache policy instead of
     the live attendance-session records key.
  ======================================================= */

  const recordsQuery = useHistoricalAttendanceSessionRecords(sessionId);

  const records = normalizeArray(recordsQuery.data);

  /*
   * Cached historical records render immediately when the
   * same completed session is reopened while still fresh.
   */
  const loading = recordsQuery.isLoading;

  /*
   * A missing route parameter is handled locally.
   *
   * If cached records already exist and a background refresh
   * fails, keep the official record visible.
   */
  const error = !sessionId
    ? "Attendance session ID is missing."
    : recordsQuery.data == null && recordsQuery.error
      ? getErrorMessage(
          recordsQuery.error,
          "Unable to load the attendance record.",
        )
      : "";

  /* =======================================================
     FALLBACK SESSION METADATA
  ======================================================= */

  const derivedSession = useMemo(() => {
    if (storedSession || records.length === 0) {
      return null;
    }

    const firstRecord = records[0];

    const timedRecord = records.find((record) =>
      Boolean(getRecordTime(record)),
    );

    const recordedAt = timedRecord ? getRecordTime(timedRecord) : "";

    return {
      sessionId,

      sectionName: getRecordSectionName(firstRecord) || "Assigned Section",

      attendanceDate: recordedAt ? String(recordedAt).slice(0, 10) : "",

      studentCount: records.length,

      status: "ENDED",
    };
  }, [records, sessionId, storedSession]);

  const session = storedSession || derivedSession || null;

  /* =======================================================
     STATUS COUNTS
  ======================================================= */

  const statusCounts = useMemo(
    () =>
      records.reduce(
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
      ),
    [records],
  );

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
      ? Math.round((attendedCount / totalStudents) * 1000) / 10
      : 0;

  const presentRate =
    totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 1000) / 10
      : 0;

  const lateRate =
    totalStudents > 0 ? Math.round((lateCount / totalStudents) * 1000) / 10 : 0;

  const absenceRate =
    totalStudents > 0
      ? Math.round((absentCount / totalStudents) * 1000) / 10
      : 0;

  const sectionName = session?.sectionName || "Assigned Section";

  const attendanceDate = session?.attendanceDate || "";

  const adviserName =
    user?.name?.trim() || session?.adviserName || "Class Adviser";

  const overallHealth = getAttendanceHealth(attendanceRate);

  /* =======================================================
     FILTERED RECORDS
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
     COMPLETE EXPORT DATA
  ======================================================= */

  const exportRows = useMemo(
    () =>
      records.map((record, index) => ({
        No: index + 1,

        "Student Number": getRecordStudentNumber(record),

        "Student Name": getRecordStudentName(record),

        Status: getRecordStatus(record),

        "Recorded At": getRecordTime(record)
          ? formatTime(getRecordTime(record), true)
          : "",
      })),
    [records],
  );

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    navigate("/adviser/attendance/history");
  };

  /* =======================================================
     EXPORT PDF
  ======================================================= */

  const handleExportPdf = async () => {
    if (records.length === 0 || exportingPdf || exportingExcel) {
      return;
    }

    try {
      setExportError("");

      setExportingPdf(true);

      /* ===============================================
           LOAD LOGOS
        =============================================== */

      const [depedImage, schoolImage] = await Promise.all([
        loadImageAsPngDataUrl(depedLogo).catch(() => null),

        loadImageAsPngDataUrl(seniorHighSchoolLogo).catch(() => null),
      ]);

      /* ===============================================
           CREATE PDF
        =============================================== */

      const document = new jsPDF({
        orientation: "landscape",

        unit: "mm",

        format: "a4",

        compress: true,
      });

      document.setProperties({
        title: `${sectionName} Attendance ${attendanceDate || sessionId}`,

        subject: "Official Student Attendance Session Record",

        author: "Signal Village National High School",

        creator: "SVNHS Attendance Management System",
      });

      /* ===============================================
           FIRST PAGE HEADER
        =============================================== */

      drawPdfHeader({
        document,

        depedImage,

        schoolImage,
      });

      drawPdfMeta({
        document,

        sectionName,

        adviserName,

        attendanceDate,

        startedAt: session?.startedAt,

        endedAt: session?.endedAt,
      });

      drawPdfSummary({
        document,

        totalStudents,

        presentCount,

        lateCount,

        absentCount,

        attendanceRate,
      });

      /* ===============================================
           TABLE DATA
        =============================================== */

      const tableBody = records.map((record, index) => {
        const time = getRecordTime(record);

        return [
          index + 1,

          getRecordStudentNumber(record),

          getRecordStudentName(record),

          getRecordStatus(record),

          time ? formatTime(time, true) : "—",
        ];
      });

      /* ===============================================
           TABLE
        =============================================== */

      autoTable(document, {
        startY: 58,

        margin: {
          top: 27,

          right: 10,

          bottom: 15,

          left: 10,
        },

        head: [["No.", "Student No.", "Student Name", "Status", "Recorded At"]],

        body: tableBody,

        theme: "grid",

        showHead: "everyPage",

        rowPageBreak: "avoid",

        styles: {
          font: "helvetica",

          fontSize: 6.7,

          cellPadding: 2.4,

          overflow: "linebreak",

          valign: "middle",

          halign: "center",

          textColor: PDF_COLORS.text,

          lineColor: PDF_COLORS.border,

          lineWidth: 0.12,
        },

        headStyles: {
          fillColor: PDF_COLORS.navyDark,

          textColor: PDF_COLORS.white,

          fontStyle: "bold",

          fontSize: 6.2,

          minCellHeight: 8,

          halign: "center",
        },

        alternateRowStyles: {
          fillColor: [249, 251, 253],
        },

        columnStyles: {
          0: {
            cellWidth: 12,
          },

          1: {
            cellWidth: 42,
          },

          2: {
            cellWidth: 105,

            halign: "left",
          },

          3: {
            cellWidth: 45,
          },

          4: {
            cellWidth: 50,
          },
        },

        didParseCell: (hookData) => {
          if (hookData.section !== "body") {
            return;
          }

          /* STUDENT NAME */

          if (hookData.column.index === 2) {
            hookData.cell.styles.fontStyle = "bold";

            hookData.cell.styles.textColor = PDF_COLORS.navyDark;
          }

          /* STATUS */

          if (hookData.column.index === 3) {
            const status = String(hookData.cell.raw ?? "").toUpperCase();

            hookData.cell.styles.fontStyle = "bold";

            if (status === "PRESENT") {
              hookData.cell.styles.textColor = PDF_COLORS.green;

              hookData.cell.styles.fillColor = PDF_COLORS.softGreen;
            } else if (status === "LATE") {
              hookData.cell.styles.textColor = PDF_COLORS.amber;

              hookData.cell.styles.fillColor = PDF_COLORS.softAmber;
            } else if (status === "ABSENT") {
              hookData.cell.styles.textColor = PDF_COLORS.red;

              hookData.cell.styles.fillColor = PDF_COLORS.softRed;
            }
          }
        },

        didDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) {
            drawPdfHeader({
              document,

              depedImage,

              schoolImage,
            });
          }
        },
      });

      /* ===============================================
           CERTIFICATION / SIGNATURES
        =============================================== */

      drawPdfSignatures({
        document,

        adviserName,

        depedImage,

        schoolImage,
      });

      /* ===============================================
           FOOTERS / PAGE NUMBERS
        =============================================== */

      drawPdfFooters({
        document,

        generatedAt: formatGeneratedAt(),
      });

      /* ===============================================
           FILE NAME
        =============================================== */

      const fileName = sanitizeFileName(
        `${sectionName}_Attendance_${attendanceDate || sessionId}`,
      );

      /* ===============================================
           DIRECT PDF DOWNLOAD
        =============================================== */

      document.save(`${fileName}.pdf`);
    } catch (exportRequestError) {
      console.error(
        "Unable to export PDF attendance record:",
        exportRequestError,
      );

      setExportError(
        exportRequestError?.response?.data?.message ||
          "Unable to export the PDF attendance record.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  /* =======================================================
     EXPORT EXCEL
  ======================================================= */

  const handleExportExcel = () => {
    if (records.length === 0 || exportingPdf || exportingExcel) {
      return;
    }

    try {
      setExportError("");

      setExportingExcel(true);

      /* ===============================================
           RECORD ROWS
        =============================================== */

      const recordRows = exportRows.map((row) => [
        row.No,

        row["Student Number"],

        row["Student Name"],

        row.Status,

        row["Recorded At"],
      ]);

      /* ===============================================
           RECORD WORKSHEET
        =============================================== */

      const recordSheetData = [
        ["SIGNAL VILLAGE NATIONAL HIGH SCHOOL"],

        ["ATTENDANCE MANAGEMENT SYSTEM"],

        ["OFFICIAL STUDENT ATTENDANCE REGISTER"],

        [],

        ["Section", sectionName],

        ["Adviser", adviserName],

        ["Attendance Date", formatDate(attendanceDate)],

        ["Session Started", formatTime(session?.startedAt)],

        ["Session Ended", formatTime(session?.endedAt)],

        [],

        ["No.", "Student Number", "Student Name", "Status", "Recorded At"],

        ...recordRows,
      ];

      const recordWorksheet = XLSX.utils.aoa_to_sheet(recordSheetData);

      recordWorksheet["!merges"] = [
        XLSX.utils.decode_range("A1:E1"),

        XLSX.utils.decode_range("A2:E2"),

        XLSX.utils.decode_range("A3:E3"),
      ];

      recordWorksheet["!cols"] = [
        {
          wch: 7,
        },

        {
          wch: 19,
        },

        {
          wch: 34,
        },

        {
          wch: 15,
        },

        {
          wch: 20,
        },
      ];

      recordWorksheet["!autofilter"] = {
        ref:
          recordRows.length > 0 ? `A11:E${11 + recordRows.length}` : "A11:E11",
      };

      /* ===============================================
           SUMMARY WORKSHEET
        =============================================== */

      const summarySheetData = [
        ["SIGNAL VILLAGE NATIONAL HIGH SCHOOL"],

        ["ATTENDANCE SESSION SUMMARY"],

        [],

        ["Section", sectionName],

        ["Adviser", adviserName],

        ["Attendance Date", formatDate(attendanceDate)],

        ["Session Started", formatTime(session?.startedAt)],

        ["Session Ended", formatTime(session?.endedAt)],

        [],

        ["Metric", "Value"],

        ["Students", totalStudents],

        ["Present", presentCount],

        ["Late", lateCount],

        ["Absent", absentCount],

        ["Present Rate", presentRate / 100],

        ["Late Rate", lateRate / 100],

        ["Absence Rate", absenceRate / 100],

        ["Overall Attendance", attendanceRate / 100],
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summarySheetData);

      summaryWorksheet["!merges"] = [
        XLSX.utils.decode_range("A1:B1"),

        XLSX.utils.decode_range("A2:B2"),
      ];

      summaryWorksheet["!cols"] = [
        {
          wch: 25,
        },

        {
          wch: 32,
        },
      ];

      for (let rowIndex = 14; rowIndex <= 17; rowIndex += 1) {
        const address = XLSX.utils.encode_cell({
          r: rowIndex,

          c: 1,
        });

        if (summaryWorksheet[address]) {
          summaryWorksheet[address].z = "0.0%";
        }
      }

      /* ===============================================
           WORKBOOK
        =============================================== */

      const workbook = XLSX.utils.book_new();

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

      const fileName = sanitizeFileName(
        `${sectionName}_Attendance_${attendanceDate || sessionId}`,
      );

      XLSX.writeFile(
        workbook,

        `${fileName}.xlsx`,

        {
          compression: true,
        },
      );
    } catch (exportRequestError) {
      console.error(
        "Unable to export Excel attendance record:",
        exportRequestError,
      );

      setExportError("Unable to export the Excel attendance record.");
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
            TOOLBAR
        ================================================== */}

        <div className="attendance-record-toolbar">
          <button
            type="button"
            className="attendance-detail-back"
            onClick={handleBack}
          >
            <span aria-hidden="true">←</span>
            Back to Attendance History
          </button>

          <div className="attendance-record-actions">
            {/* PDF */}

            <button
              type="button"
              className="attendance-export-button attendance-export-pdf"
              disabled={
                loading ||
                records.length === 0 ||
                exportingPdf ||
                exportingExcel
              }
              onClick={() => void handleExportPdf()}
            >
              <span className="attendance-export-icon" aria-hidden="true">
                PDF
              </span>

              <span>
                <strong>{exportingPdf ? "Generating..." : "Export PDF"}</strong>

                <small>Direct PDF download</small>
              </span>
            </button>

            {/* EXCEL */}

            <button
              type="button"
              className="attendance-export-button attendance-export-excel"
              disabled={
                loading ||
                records.length === 0 ||
                exportingPdf ||
                exportingExcel
              }
              onClick={handleExportExcel}
            >
              <span className="attendance-export-icon" aria-hidden="true">
                XLS
              </span>

              <span>
                <strong>
                  {exportingExcel ? "Preparing..." : "Export Excel"}
                </strong>

                <small>Complete session record</small>
              </span>
            </button>
          </div>
        </div>

        {/* =================================================
            EXPORT ERROR
        ================================================== */}

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
        ================================================== */}

        <header className="attendance-record-header">
          <div className="attendance-record-brand">
            <div className="attendance-record-logos" aria-hidden="true">
              <img src={depedLogo} alt="" />

              <img src={seniorHighSchoolLogo} alt="" />
            </div>

            <div className="attendance-record-school">
              <span>REPUBLIC OF THE PHILIPPINES</span>

              <strong>Signal Village National High School</strong>

              <small>Attendance Management System · Adviser Portal</small>
            </div>
          </div>

          <div className="attendance-record-document">
            <span>OFFICIAL SCHOOL RECORD</span>

            <strong>Student Attendance Sheet</strong>

            <small>Completed attendance session record</small>
          </div>
        </header>

        {/* =================================================
            SECTION / SESSION IDENTITY
        ================================================== */}

        <section className="attendance-record-identity">
          <div className="attendance-record-section-block">
            <span>ACADEMIC SECTION</span>

            <h1>{sectionName}</h1>

            <div className="attendance-record-section-meta">
              <span>
                Adviser
                <strong>{adviserName}</strong>
              </span>

              <span>
                Attendance Date
                <strong>{formatDate(attendanceDate)}</strong>
              </span>

              <span>
                Session Time
                <strong>
                  {formatTime(session?.startedAt)} –{" "}
                  {formatTime(session?.endedAt)}
                </strong>
              </span>
            </div>
          </div>

          <div
            className={`attendance-record-health attendance-record-health-${overallHealth.key}`}
          >
            <span>ATTENDANCE HEALTH</span>

            <strong>{attendanceRate.toFixed(1)}%</strong>

            <div>
              <b>{overallHealth.label}</b>

              <small>{overallHealth.description}</small>
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
          {/* TOTAL */}

          <article className="attendance-record-stat attendance-record-stat-neutral">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ♙
            </div>

            <div>
              <span>ENROLLED / REPORTED</span>

              <strong>{totalStudents}</strong>

              <small>Students in session</small>
            </div>
          </article>

          {/* PRESENT */}

          <article className="attendance-record-stat attendance-record-stat-present">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ✓
            </div>

            <div>
              <span>PRESENT</span>

              <strong>{presentRate.toFixed(1)}%</strong>

              <small>{presentCount} records</small>
            </div>
          </article>

          {/* LATE */}

          <article className="attendance-record-stat attendance-record-stat-late">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ◷
            </div>

            <div>
              <span>LATE</span>

              <strong>{lateRate.toFixed(1)}%</strong>

              <small>{lateCount} records</small>
            </div>
          </article>

          {/* ABSENT */}

          <article className="attendance-record-stat attendance-record-stat-absent">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ×
            </div>

            <div>
              <span>ABSENT</span>

              <strong>{absenceRate.toFixed(1)}%</strong>

              <small>{absentCount} records</small>
            </div>
          </article>

          {/* SESSION */}

          <article className="attendance-record-stat attendance-record-stat-sessions">
            <div className="attendance-record-stat-icon" aria-hidden="true">
              ▦
            </div>

            <div>
              <span>SESSION</span>

              <strong>1</strong>

              <small>Completed record</small>
            </div>
          </article>
        </section>

        {/* =================================================
            PROFESSIONAL RECORD SHEET
        ================================================== */}

        <section className="attendance-record-sheet">
          {/* ===============================================
              HEADER
          ================================================ */}

          <header className="attendance-record-sheet-header">
            <div>
              <span className="attendance-record-kicker">
                STUDENT ATTENDANCE REGISTER
              </span>

              <h2>Attendance Record Sheet</h2>

              <p>
                Official student attendance entries recorded during this
                completed class session.
              </p>
            </div>

            <div className="attendance-record-sheet-meta">
              <div>
                <span>Students</span>

                <strong>{totalStudents}</strong>
              </div>

              <div>
                <span>Present</span>

                <strong>{presentCount}</strong>
              </div>

              <div>
                <span>Date</span>

                <strong>{formatDate(attendanceDate)}</strong>
              </div>
            </div>
          </header>

          {/* ===============================================
              FILTERS
          ================================================ */}

          <div className="attendance-record-filters adviser-attendance-record-filters">
            {/* SEARCH */}

            <label className="attendance-record-search">
              <span aria-hidden="true">⌕</span>

              <div>
                <span>SEARCH STUDENT</span>

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Name or student number..."
                  aria-label="Search students"
                />
              </div>
            </label>

            {/* STATUS */}

            <label className="attendance-record-filter adviser-attendance-status-filter">
              <span>ATTENDANCE STATUS</span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter attendance status"
              >
                <option value="ALL">All Status</option>

                <option value="PRESENT">Present</option>

                <option value="LATE">Late</option>

                <option value="ABSENT">Absent</option>
              </select>
            </label>

            {/* SCOPE */}

            <div className="attendance-record-filter-context">
              <span>SESSION SCOPE</span>

              <strong>
                {searchQuery.trim()
                  ? `Filtered: “${searchQuery.trim()}”`
                  : statusFilter === "ALL"
                    ? "All attendance records"
                    : statusFilter}
              </strong>

              <small>
                PDF and Excel exports always include the complete official
                session record.
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

          {!loading && !error && records.length === 0 && (
            <div className="attendance-record-empty">
              <div aria-hidden="true">♙</div>

              <strong>No attendance records found</strong>

              <p>
                This completed session does not contain any attendance records.
              </p>
            </div>
          )}

          {/* ===============================================
              TABLE
          ================================================ */}

          {!loading && !error && records.length > 0 && (
            <>
              <div className="attendance-record-table-wrap">
                <table className="attendance-record-table adviser-attendance-record-table">
                  <thead>
                    <tr>
                      <th className="attendance-record-col-no">NO.</th>

                      <th className="attendance-record-col-number">
                        STUDENT NO.
                      </th>

                      <th className="attendance-record-col-student">
                        STUDENT NAME
                      </th>

                      <th>STATUS</th>

                      <th>RECORDED AT</th>
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
                          className={`attendance-record-row adviser-attendance-record-row is-${status.toLowerCase()}`}
                        >
                          {/* NO */}

                          <td className="attendance-record-row-number">
                            {index + 1}
                          </td>

                          {/* STUDENT NUMBER */}

                          <td className="attendance-record-student-number">
                            {studentNumber}
                          </td>

                          {/* STUDENT */}

                          <td>
                            <div className="attendance-record-student">
                              <div aria-hidden="true">
                                {studentName.charAt(0).toUpperCase()}
                              </div>

                              <div>
                                <strong>{studentName}</strong>

                                <span>{studentNumber}</span>
                              </div>
                            </div>
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`attendance-session-status-pill is-${status.toLowerCase()}`}
                            >
                              <i />

                              {status}
                            </span>
                          </td>

                          {/* TIME */}

                          <td className="adviser-attendance-record-time">
                            {getRecordTime(record)
                              ? formatTime(getRecordTime(record), true)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* =========================================
                    NOTE
                ========================================== */}

              <div className="attendance-record-note">
                <div>
                  <span aria-hidden="true">i</span>

                  <p>
                    <strong>Reading the register:</strong> present and late
                    records include their recorded attendance time when
                    available. Absent students do not have a recorded check-in
                    time.
                  </p>
                </div>

                <span>Session ID: {sessionId}</span>
              </div>

              {/* =========================================
                    FOOTER
                ========================================== */}

              <footer className="attendance-record-pagination adviser-attendance-record-footer">
                <p>
                  Showing <strong>{filteredRecords.length}</strong> of{" "}
                  <strong>{records.length}</strong> attendance records
                </p>

                <div className="adviser-attendance-session-footer-meta">
                  <span>COMPLETED SESSION</span>

                  <strong>{formatDate(attendanceDate)}</strong>
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

            <strong>{adviserName}</strong>

            <small>Class Adviser</small>
          </div>

          <div>
            <span />

            <strong>______________________________</strong>

            <small>School Official</small>
          </div>
        </section>
      </section>
    </AdviserLayout>
  );
}

export default AttendanceHistoryDetail;
