import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";

import CouncilorLayout from "../../layouts/CouncilorLayout";

import councilorService from "../../services/councilorService";

import depedLogo from "../../assets/kagawaran-educ-logo.svg";
import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/councilor.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 25;

const EXPORT_PAGE_SIZE = 100;

const SEARCH_DELAY = 350;

const MAX_EXPORT_PAGES = 1000;

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
   DATE HELPERS
========================================================= */

function toDateInputValue(date) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return toDateInputValue(
    new Date(),
  );
}

function isValidReportDate(
  value,
  today,
) {
  if (!value) {
    return false;
  }

  const pattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (!pattern.test(value)) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return false;
  }

  return value <= today;
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatNumber(value) {
  const number =
    Number(value ?? 0);

  if (
    !Number.isFinite(number)
  ) {
    return "0";
  }

  return number.toLocaleString(
    "en-PH",
  );
}

function formatPercentage(value) {
  const number =
    Number(value ?? 0);

  if (
    !Number.isFinite(number)
  ) {
    return "0.0%";
  }

  return `${number.toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

function formatLongDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

function clampPercentage(value) {
  const number =
    Number(value ?? 0);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      number,
      0,
    ),
    100,
  );
}

function sanitizeFileName(value) {
  return String(
    value ||
      "attendance-report",
  )
    .trim()
    .replace(
      /[<>:"/\\|?*]/g,
      "-",
    )
    .replace(
      /\s+/g,
      "_",
    )
    .slice(0, 90);
}

/* =========================================================
   ATTENDANCE HEALTH
========================================================= */

function getAttendanceHealth(rate) {
  const value =
    Number(rate ?? 0);

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

    description:
      "Attendance is lower and should be reviewed more closely.",
  };
}

/* =========================================================
   PDF IMAGE HELPER
========================================================= */

function loadImageAsPngDataUrl(
  source,
) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        try {
          const naturalWidth =
            image.naturalWidth ||
            256;

          const naturalHeight =
            image.naturalHeight ||
            256;

          const maximumSize =
            256;

          const scale =
            Math.min(
              maximumSize /
                naturalWidth,

              maximumSize /
                naturalHeight,

              1,
            );

          const width =
            Math.max(
              Math.round(
                naturalWidth *
                  scale,
              ),
              1,
            );

          const height =
            Math.max(
              Math.round(
                naturalHeight *
                  scale,
              ),
              1,
            );

          const canvas =
            document.createElement(
              "canvas",
            );

          canvas.width =
            width;

          canvas.height =
            height;

          const context =
            canvas.getContext(
              "2d",
            );

          if (!context) {
            reject(
              new Error(
                "Unable to create image canvas.",
              ),
            );

            return;
          }

          context.clearRect(
            0,
            0,
            width,
            height,
          );

          context.drawImage(
            image,
            0,
            0,
            width,
            height,
          );

          resolve(
            canvas.toDataURL(
              "image/png",
            ),
          );
        } catch (
          imageError
        ) {
          reject(
            imageError,
          );
        }
      };

      image.onerror = () => {
        reject(
          new Error(
            "Unable to load PDF logo.",
          ),
        );
      };

      image.src =
        source;
    },
  );
}

/* =========================================================
   PDF HEADER
========================================================= */

function drawPdfHeader({
  document,
  depedImage,
  schoolImage,
}) {
  const pageWidth =
    document.internal.pageSize.getWidth();

  /* BACKGROUND */

  document.setFillColor(
    ...PDF_COLORS.white,
  );

  document.rect(
    0,
    0,
    pageWidth,
    23,
    "F",
  );

  /* LOGOS */

  if (depedImage) {
    document.addImage(
      depedImage,
      "PNG",
      10,
      7,
      11,
      11,
      undefined,
      "FAST",
    );
  }

  if (schoolImage) {
    document.addImage(
      schoolImage,
      "PNG",
      23,
      7,
      11,
      11,
      undefined,
      "FAST",
    );
  }

  /* REPUBLIC */

  document.setTextColor(
    ...PDF_COLORS.muted,
  );

  document.setFont(
    "helvetica",
    "normal",
  );

  document.setFontSize(
    6.2,
  );

  document.text(
    "REPUBLIC OF THE PHILIPPINES",
    pageWidth / 2,
    7.8,
    {
      align: "center",
    },
  );

  /* SCHOOL */

  document.setTextColor(
    ...PDF_COLORS.navyDark,
  );

  document.setFont(
    "helvetica",
    "bold",
  );

  document.setFontSize(
    11,
  );

  document.text(
    "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
    pageWidth / 2,
    12.5,
    {
      align: "center",
    },
  );

  document.setTextColor(
    ...PDF_COLORS.muted,
  );

  document.setFont(
    "helvetica",
    "normal",
  );

  document.setFontSize(
    6.5,
  );

  document.text(
    "Attendance Management System · Councilor Portal",
    pageWidth / 2,
    16.5,
    {
      align: "center",
    },
  );

  /* DOCUMENT TYPE */

  document.setTextColor(
    ...PDF_COLORS.red,
  );

  document.setFont(
    "helvetica",
    "bold",
  );

  document.setFontSize(
    6.3,
  );

  document.text(
    "OFFICIAL SCHOOL RECORD",
    pageWidth - 10,
    10,
    {
      align: "right",
    },
  );

  document.setTextColor(
    ...PDF_COLORS.navyDark,
  );

  document.setFontSize(
    7,
  );

  document.text(
    "DAILY ATTENDANCE RECORD",
    pageWidth - 10,
    14,
    {
      align: "right",
    },
  );

  /* BOTTOM ACCENT */

  document.setFillColor(
    ...PDF_COLORS.red,
  );

  document.rect(
    0,
    20.5,
    pageWidth * 0.32,
    1.5,
    "F",
  );

  document.setFillColor(
    ...PDF_COLORS.amber,
  );

  document.rect(
    pageWidth * 0.32,
    20.5,
    pageWidth * 0.04,
    1.5,
    "F",
  );

  document.setFillColor(
    ...PDF_COLORS.navy,
  );

  document.rect(
    pageWidth * 0.36,
    20.5,
    pageWidth * 0.64,
    1.5,
    "F",
  );
}

/* =========================================================
   PDF META
========================================================= */

function drawPdfMeta({
  document,
  section,
  selectedDate,
  search,
}) {
  const pageWidth =
    document.internal.pageSize.getWidth();

  const left = 10;
  const right = 10;

  const availableWidth =
    pageWidth -
    left -
    right;

  const columnWidth =
    availableWidth / 4;

  const items = [
    {
      label:
        "ACADEMIC SECTION",

      value:
        section.sectionName ||
        "—",
    },

    {
      label:
        "ADVISER",

      value:
        section.adviserName ||
        "Unassigned",
    },

    {
      label:
        "ATTENDANCE DATE",

      value:
        formatLongDate(
          selectedDate,
        ),
    },

    {
      label:
        "STUDENT SCOPE",

      value:
        search ||
        "All students",
    },
  ];

  items.forEach(
    (item, index) => {
      const x =
        left +
        columnWidth *
          index;

      document.setFillColor(
        ...PDF_COLORS.softBlue,
      );

      document.setDrawColor(
        ...PDF_COLORS.border,
      );

      document.setLineWidth(
        0.2,
      );

      document.rect(
        x,
        26,
        columnWidth,
        13,
        "FD",
      );

      document.setTextColor(
        ...PDF_COLORS.muted,
      );

      document.setFont(
        "helvetica",
        "bold",
      );

      document.setFontSize(
        5.4,
      );

      document.text(
        item.label,
        x + 3,
        30.4,
      );

      document.setTextColor(
        ...PDF_COLORS.text,
      );

      document.setFontSize(
        7.1,
      );

      const displayValue =
        document.splitTextToSize(
          String(
            item.value,
          ),
          columnWidth - 6,
        );

      document.text(
        displayValue.slice(
          0,
          2,
        ),
        x + 3,
        34.6,
      );
    },
  );
}

/* =========================================================
   PDF SUMMARY
========================================================= */

function drawPdfSummary({
  document,
  summary,
}) {
  const pageWidth =
    document.internal.pageSize.getWidth();

  const left = 10;
  const right = 10;

  const gap = 2;

  const items = [
    {
      label:
        "Students",

      value:
        formatNumber(
          summary.students,
        ),

      color:
        PDF_COLORS.navy,
    },

    {
      label:
        "Sessions",

      value:
        formatNumber(
          summary.sessions,
        ),

      color:
        PDF_COLORS.blue,
    },

    {
      label:
        "Present",

      value:
        formatPercentage(
          summary.presentRate,
        ),

      color:
        PDF_COLORS.green,
    },

    {
      label:
        "Late",

      value:
        formatPercentage(
          summary.lateRate,
        ),

      color:
        PDF_COLORS.amber,
    },

    {
      label:
        "Absent",

      value:
        formatPercentage(
          summary.absenceRate,
        ),

      color:
        PDF_COLORS.red,
    },

    {
      label:
        "Overall",

      value:
        formatPercentage(
          summary.attendanceRate,
        ),

      color:
        PDF_COLORS.navyDark,
    },
  ];

  const availableWidth =
    pageWidth -
    left -
    right -
    gap *
      (items.length - 1);

  const cardWidth =
    availableWidth /
    items.length;

  items.forEach(
    (item, index) => {
      const x =
        left +
        index *
          (cardWidth + gap);

      document.setFillColor(
        250,
        252,
        254,
      );

      document.setDrawColor(
        ...PDF_COLORS.border,
      );

      document.roundedRect(
        x,
        42,
        cardWidth,
        11,
        1.2,
        1.2,
        "FD",
      );

      document.setFillColor(
        ...item.color,
      );

      document.rect(
        x,
        42,
        1.4,
        11,
        "F",
      );

      document.setTextColor(
        ...PDF_COLORS.muted,
      );

      document.setFont(
        "helvetica",
        "bold",
      );

      document.setFontSize(
        5.2,
      );

      document.text(
        item.label.toUpperCase(),
        x + 4,
        45.6,
      );

      document.setTextColor(
        ...item.color,
      );

      document.setFontSize(
        8,
      );

      document.text(
        item.value,
        x + 4,
        50.2,
      );
    },
  );
}

/* =========================================================
   PDF FOOTER
========================================================= */

function drawPdfFooters({
  document,
  generatedAt,
}) {
  const totalPages =
    document.getNumberOfPages();

  const pageWidth =
    document.internal.pageSize.getWidth();

  const pageHeight =
    document.internal.pageSize.getHeight();

  for (
    let pageNumber = 1;
    pageNumber <= totalPages;
    pageNumber += 1
  ) {
    document.setPage(
      pageNumber,
    );

    document.setDrawColor(
      ...PDF_COLORS.border,
    );

    document.setLineWidth(
      0.2,
    );

    document.line(
      10,
      pageHeight - 9,
      pageWidth - 10,
      pageHeight - 9,
    );

    document.setFont(
      "helvetica",
      "normal",
    );

    document.setFontSize(
      5.7,
    );

    document.setTextColor(
      ...PDF_COLORS.muted,
    );

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
        align:
          "right",
      },
    );
  }
}

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceDetail() {
  const navigate =
    useNavigate();

  const {
    sectionId,
  } = useParams();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const today =
    useMemo(
      () => getToday(),
      [],
    );

  /* =======================================================
     INITIAL DATE
  ======================================================= */

  const initialDate =
    useMemo(() => {
      const queryDate =
        searchParams.get(
          "date",
        ) ||
        searchParams.get(
          "from",
        );

      if (
        isValidReportDate(
          queryDate,
          today,
        )
      ) {
        return queryDate;
      }

      return today;
    }, []);

  /* =======================================================
     REPORT STATE
  ======================================================= */

  const [
    report,
    setReport,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     SEARCH STATE
  ======================================================= */

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");

  /* =======================================================
     DAILY DATE STATE
  ======================================================= */

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    initialDate,
  );

  const [
    page,
    setPage,
  ] = useState(0);

  /* =======================================================
     EXPORT STATE
  ======================================================= */

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
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            searchInput.trim(),
          );

          setPage(0);
        },
        SEARCH_DELAY,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    searchInput,
  ]);

  /* =======================================================
     KEEP DATE IN URL
  ======================================================= */

  useEffect(() => {
    setSearchParams(
      {
        date:
          selectedDate,
      },
      {
        replace: true,
      },
    );
  }, [
    selectedDate,
    setSearchParams,
  ]);

  /* =======================================================
     LOAD DAILY REPORT
  ======================================================= */

  useEffect(() => {
    if (!sectionId) {
      return undefined;
    }

    const controller =
      new AbortController();

    const loadReport =
      async () => {
        setLoading(true);

        setError("");

        try {
          const data =
            await councilorService.getSectionAttendanceReport(
              sectionId,
              {
                /*
                 * Backend still receives from/to,
                 * but both represent one school day.
                 */

                from:
                  selectedDate,

                to:
                  selectedDate,

                search:
                  debouncedSearch,

                page,

                size:
                  PAGE_SIZE,

                signal:
                  controller.signal,
              },
            );

          setReport(data);
        } catch (
          requestError
        ) {
          if (
            requestError
              ?.code ===
              "ERR_CANCELED" ||
            requestError
              ?.name ===
              "CanceledError"
          ) {
            return;
          }

          setReport(null);

          setError(
            requestError
              ?.response
              ?.data
              ?.message ||
              "Unable to load the attendance record.",
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false,
            );
          }
        }
      };

    void loadReport();

    return () => {
      controller.abort();
    };
  }, [
    sectionId,
    selectedDate,
    debouncedSearch,
    page,
  ]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const section =
    report?.section ?? {
      sectionId,

      sectionName:
        "Section Attendance",

      adviserId: null,

      adviserName: null,
    };

  const summary =
    report?.summary ?? {
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

  const studentPage =
    report?.students ?? {
      content: [],

      page: 0,

      size:
        PAGE_SIZE,

      totalElements: 0,

      totalPages: 0,

      first: true,

      last: true,
    };

  const students =
    studentPage.content ??
    [];

  const startRecord =
    studentPage.totalElements >
    0
      ? studentPage.page *
          studentPage.size +
        1
      : 0;

  const endRecord =
    Math.min(
      (studentPage.page + 1) *
        studentPage.size,

      studentPage.totalElements,
    );

  const overallHealth =
    getAttendanceHealth(
      summary.attendanceRate,
    );

  const isToday =
    selectedDate ===
    today;

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    /*
     * Main Attendance page can still use its existing
     * date-range API/filter design.
     */

    navigate(
      `/councilor/attendance?from=${selectedDate}&to=${selectedDate}`,
    );
  };

  /* =======================================================
     DATE CONTROLS
  ======================================================= */

  const handleDateChange =
    (event) => {
      const nextDate =
        event.target.value;

      if (
        !isValidReportDate(
          nextDate,
          today,
        )
      ) {
        return;
      }

      setSelectedDate(
        nextDate,
      );

      setPage(0);

      setExportError("");
    };

  const handleToday =
    () => {
      setSelectedDate(
        today,
      );

      setPage(0);

      setExportError("");
    };

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearchChange =
    (event) => {
      setSearchInput(
        event.target.value,
      );

      setExportError("");
    };

  const clearSearch = () => {
    setSearchInput("");

    setDebouncedSearch("");

    setPage(0);

    setExportError("");
  };

  /* =======================================================
     PAGINATION
  ======================================================= */

  const goToPreviousPage =
    () => {
      if (
        studentPage.first
      ) {
        return;
      }

      setPage(
        (current) =>
          current - 1,
      );
    };

  const goToNextPage =
    () => {
      if (
        studentPage.last
      ) {
        return;
      }

      setPage(
        (current) =>
          current + 1,
      );
    };

  /* =======================================================
     EXPORT — FETCH ALL STUDENTS
  ======================================================= */

  const fetchAllStudentsForExport =
    async (
      exportSearch =
        searchInput.trim(),
    ) => {
      if (!sectionId) {
        return {
          report: null,

          students: [],
        };
      }

      let currentPage = 0;

      let allStudents = [];

      let latestReport =
        null;

      while (
        currentPage <
        MAX_EXPORT_PAGES
      ) {
        const data =
          await councilorService.getSectionAttendanceReport(
            sectionId,
            {
              from:
                selectedDate,

              to:
                selectedDate,

              search:
                exportSearch,

              page:
                currentPage,

              size:
                EXPORT_PAGE_SIZE,
            },
          );

        latestReport =
          data;

        const pageData =
          data?.students ??
          {};

        const pageStudents =
          Array.isArray(
            pageData.content,
          )
            ? pageData.content
            : [];

        allStudents = [
          ...allStudents,
          ...pageStudents,
        ];

        const totalPages =
          Number(
            pageData.totalPages ??
              1,
          );

        if (
          pageData.last ===
            true ||
          pageStudents.length ===
            0 ||
          currentPage >=
            totalPages - 1
        ) {
          break;
        }

        currentPage += 1;
      }

      return {
        report:
          latestReport,

        students:
          allStudents,
      };
    };

  /* =======================================================
     EXPORT FILE NAME
  ======================================================= */

  const buildExportFileName =
    (extension) => {
      const sectionName =
        sanitizeFileName(
          section.sectionName,
        );

      return `${sectionName}_Attendance_${selectedDate}.${extension}`;
    };

  /* =======================================================
     EXPORT PDF
  ======================================================= */

  const handleExportPdf =
    async () => {
      try {
        setExportError("");

        setExportingPdf(
          true,
        );

        const exportSearch =
          searchInput.trim();

        const exportData =
          await fetchAllStudentsForExport(
            exportSearch,
          );

        const exportSection =
          exportData.report
            ?.section ??
          section;

        const exportSummary =
          exportData.report
            ?.summary ??
          summary;

        /* ===============================================
           LOAD LOGOS
        =============================================== */

        const [
          depedImage,
          schoolImage,
        ] =
          await Promise.all([
            loadImageAsPngDataUrl(
              depedLogo,
            ).catch(
              () => null,
            ),

            loadImageAsPngDataUrl(
              seniorHighSchoolLogo,
            ).catch(
              () => null,
            ),
          ]);

        /* ===============================================
           CREATE PDF
        =============================================== */

        const document =
          new jsPDF({
            orientation:
              "landscape",

            unit:
              "mm",

            format:
              "a4",

            compress:
              true,
          });

        document.setProperties(
          {
            title:
              `${exportSection.sectionName || "Section"} Attendance ${selectedDate}`,

            subject:
              "Official Daily Section Attendance Record",

            author:
              "Signal Village National High School",

            creator:
              "SVNHS Attendance Management System",
          },
        );

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

          section:
            exportSection,

          selectedDate,

          search:
            exportSearch,
        });

        drawPdfSummary({
          document,

          summary:
            exportSummary,
        });

        /* ===============================================
           TABLE BODY
        =============================================== */

        const tableBody =
          exportData.students.map(
            (
              student,
              index,
            ) => {
              const health =
                getAttendanceHealth(
                  student.attendanceRate,
                );

              return [
                index + 1,

                student.studentNumber ||
                  "—",

                student.studentName ||
                  "—",

                formatNumber(
                  student.sessions,
                ),

                formatNumber(
                  student.present,
                ),

                formatNumber(
                  student.late,
                ),

                formatNumber(
                  student.absent,
                ),

                formatPercentage(
                  student.attendanceRate,
                ),

                health.label,
              ];
            },
          );

        /* ===============================================
           PDF TABLE
        =============================================== */

        if (
          tableBody.length >
          0
        ) {
          autoTable(
            document,
            {
              startY: 58,

              margin: {
                top: 27,

                right: 10,

                bottom: 15,

                left: 10,
              },

              head: [
                [
                  "No.",

                  "Student No.",

                  "Student Name",

                  "Sessions",

                  "Present",

                  "Late",

                  "Absent",

                  "Attendance Rate",

                  "Review",
                ],
              ],

              body:
                tableBody,

              theme:
                "grid",

              showHead:
                "everyPage",

              rowPageBreak:
                "avoid",

              styles: {
                font:
                  "helvetica",

                fontSize:
                  6.4,

                cellPadding:
                  2.2,

                overflow:
                  "linebreak",

                valign:
                  "middle",

                halign:
                  "center",

                textColor:
                  PDF_COLORS.text,

                lineColor:
                  PDF_COLORS.border,

                lineWidth:
                  0.12,
              },

              headStyles: {
                fillColor:
                  PDF_COLORS.navyDark,

                textColor:
                  PDF_COLORS.white,

                fontStyle:
                  "bold",

                fontSize:
                  6,

                minCellHeight:
                  8,

                halign:
                  "center",
              },

              alternateRowStyles: {
                fillColor: [
                  249,
                  251,
                  253,
                ],
              },

              columnStyles: {
                0: {
                  cellWidth: 9,
                },

                1: {
                  cellWidth: 26,
                },

                2: {
                  cellWidth: 67,

                  halign:
                    "left",
                },

                3: {
                  cellWidth: 19,
                },

                4: {
                  cellWidth: 18,
                },

                5: {
                  cellWidth: 18,
                },

                6: {
                  cellWidth: 18,
                },

                7: {
                  cellWidth: 28,
                },

                8: {
                  cellWidth: 27,
                },
              },

              didParseCell: (
                hookData,
              ) => {
                if (
                  hookData.section !==
                  "body"
                ) {
                  return;
                }

                /* STUDENT NAME */

                if (
                  hookData.column
                    .index ===
                  2
                ) {
                  hookData.cell.styles.fontStyle =
                    "bold";

                  hookData.cell.styles.textColor =
                    PDF_COLORS.navyDark;
                }

                /* PRESENT */

                if (
                  hookData.column
                    .index ===
                  4
                ) {
                  hookData.cell.styles.textColor =
                    PDF_COLORS.green;

                  hookData.cell.styles.fontStyle =
                    "bold";
                }

                /* LATE */

                if (
                  hookData.column
                    .index ===
                  5
                ) {
                  hookData.cell.styles.textColor =
                    PDF_COLORS.amber;

                  hookData.cell.styles.fontStyle =
                    "bold";
                }

                /* ABSENT */

                if (
                  hookData.column
                    .index ===
                  6
                ) {
                  hookData.cell.styles.textColor =
                    PDF_COLORS.red;

                  hookData.cell.styles.fontStyle =
                    "bold";
                }

                /* ATTENDANCE RATE */

                if (
                  hookData.column
                    .index ===
                  7
                ) {
                  hookData.cell.styles.fontStyle =
                    "bold";
                }

                /* REVIEW */

                if (
                  hookData.column
                    .index ===
                  8
                ) {
                  const label =
                    String(
                      hookData.cell
                        .raw ?? "",
                    );

                  hookData.cell.styles.fontStyle =
                    "bold";

                  if (
                    label ===
                    "Strong"
                  ) {
                    hookData.cell.styles.textColor =
                      PDF_COLORS.green;

                    hookData.cell.styles.fillColor =
                      PDF_COLORS.softGreen;
                  } else if (
                    label ===
                    "Monitor"
                  ) {
                    hookData.cell.styles.textColor =
                      PDF_COLORS.amber;

                    hookData.cell.styles.fillColor =
                      PDF_COLORS.softAmber;
                  } else {
                    hookData.cell.styles.textColor =
                      PDF_COLORS.red;

                    hookData.cell.styles.fillColor =
                      PDF_COLORS.softRed;
                  }
                }
              },

              didDrawPage: (
                hookData,
              ) => {
                if (
                  hookData.pageNumber >
                  1
                ) {
                  drawPdfHeader({
                    document,

                    depedImage,

                    schoolImage,
                  });
                }
              },
            },
          );
        } else {
          /* =============================================
             EMPTY PDF STATE
          ============================================== */

          document.setDrawColor(
            ...PDF_COLORS.border,
          );

          document.setFillColor(
            249,
            251,
            253,
          );

          document.roundedRect(
            10,
            59,

            document.internal.pageSize.getWidth() -
              20,

            24,

            1.5,
            1.5,

            "FD",
          );

          document.setTextColor(
            ...PDF_COLORS.navyDark,
          );

          document.setFont(
            "helvetica",
            "bold",
          );

          document.setFontSize(
            9,
          );

          document.text(
            "No matching student attendance records",
            document.internal.pageSize.getWidth() /
              2,
            68,
            {
              align:
                "center",
            },
          );

          document.setTextColor(
            ...PDF_COLORS.muted,
          );

          document.setFont(
            "helvetica",
            "normal",
          );

          document.setFontSize(
            7,
          );

          document.text(
            `No attendance records were found for ${formatLongDate(
              selectedDate,
            )}.`,
            document.internal.pageSize.getWidth() /
              2,
            74,
            {
              align:
                "center",
            },
          );
        }

        /* ===============================================
           FOOTERS
        =============================================== */

        const generatedAt =
          new Intl.DateTimeFormat(
            "en-PH",
            {
              dateStyle:
                "medium",

              timeStyle:
                "short",
            },
          ).format(
            new Date(),
          );

        drawPdfFooters({
          document,

          generatedAt,
        });

        /* ===============================================
           DOWNLOAD
        =============================================== */

        document.save(
          buildExportFileName(
            "pdf",
          ),
        );
      } catch (
        exportRequestError
      ) {
        console.error(
          "Unable to export PDF report:",
          exportRequestError,
        );

        setExportError(
          exportRequestError
            ?.response
            ?.data
            ?.message ||
            "Unable to export the PDF attendance record.",
        );
      } finally {
        setExportingPdf(
          false,
        );
      }
    };

  /* =======================================================
     EXPORT EXCEL
  ======================================================= */

  const handleExportExcel =
    async () => {
      try {
        setExportError("");

        setExportingExcel(
          true,
        );

        const exportSearch =
          searchInput.trim();

        const exportData =
          await fetchAllStudentsForExport(
            exportSearch,
          );

        const exportSection =
          exportData.report
            ?.section ??
          section;

        const exportSummary =
          exportData.report
            ?.summary ??
          summary;

        /* ===============================================
           RECORD ROWS
        =============================================== */

        const recordRows =
          exportData.students.map(
            (
              student,
              index,
            ) => {
              const health =
                getAttendanceHealth(
                  student.attendanceRate,
                );

              return [
                index + 1,

                student.studentNumber ||
                  "",

                student.studentName ||
                  "",

                Number(
                  student.sessions ??
                    0,
                ),

                Number(
                  student.present ??
                    0,
                ),

                Number(
                  student.late ??
                    0,
                ),

                Number(
                  student.absent ??
                    0,
                ),

                Number(
                  student.attendanceRate ??
                    0,
                ) / 100,

                health.label,
              ];
            },
          );

        /* ===============================================
           ATTENDANCE RECORD SHEET
        =============================================== */

        const recordSheetData =
          [
            [
              "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
            ],

            [
              "ATTENDANCE MANAGEMENT SYSTEM",
            ],

            [
              "OFFICIAL DAILY SECTION ATTENDANCE RECORD",
            ],

            [],

            [
              "Section",

              exportSection.sectionName ||
                "—",
            ],

            [
              "Adviser",

              exportSection.adviserName ||
                "Unassigned",
            ],

            [
              "Attendance Date",

              formatLongDate(
                selectedDate,
              ),
            ],

            [
              "Student Scope",

              exportSearch ||
                "All students",
            ],

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

        const recordWorksheet =
          XLSX.utils.aoa_to_sheet(
            recordSheetData,
          );

        recordWorksheet[
          "!merges"
        ] = [
          XLSX.utils.decode_range(
            "A1:I1",
          ),

          XLSX.utils.decode_range(
            "A2:I2",
          ),

          XLSX.utils.decode_range(
            "A3:I3",
          ),
        ];

        recordWorksheet[
          "!cols"
        ] = [
          {
            wch: 7,
          },

          {
            wch: 19,
          },

          {
            wch: 32,
          },

          {
            wch: 12,
          },

          {
            wch: 12,
          },

          {
            wch: 10,
          },

          {
            wch: 10,
          },

          {
            wch: 19,
          },

          {
            wch: 17,
          },
        ];

        recordWorksheet[
          "!autofilter"
        ] = {
          ref:
            recordRows.length >
            0
              ? `A10:I${
                  10 +
                  recordRows.length
                }`
              : "A10:I10",
        };

        /* PERCENTAGE FORMAT */

        for (
          let rowIndex = 10;
          rowIndex <
          10 +
            recordRows.length;
          rowIndex += 1
        ) {
          const cellAddress =
            XLSX.utils.encode_cell(
              {
                r:
                  rowIndex,

                c: 7,
              },
            );

          if (
            recordWorksheet[
              cellAddress
            ]
          ) {
            recordWorksheet[
              cellAddress
            ].z = "0.0%";
          }
        }

        /* ===============================================
           SUMMARY SHEET
        =============================================== */

        const summarySheetData =
          [
            [
              "SIGNAL VILLAGE NATIONAL HIGH SCHOOL",
            ],

            [
              "DAILY ATTENDANCE SUMMARY",
            ],

            [],

            [
              "Section",

              exportSection.sectionName ||
                "—",
            ],

            [
              "Adviser",

              exportSection.adviserName ||
                "Unassigned",
            ],

            [
              "Attendance Date",

              formatLongDate(
                selectedDate,
              ),
            ],

            [
              "Student Scope",

              exportSearch ||
                "All students",
            ],

            [],

            [
              "Metric",

              "Value",
            ],

            [
              "Students",

              Number(
                exportSummary.students ??
                  0,
              ),
            ],

            [
              "Sessions",

              Number(
                exportSummary.sessions ??
                  0,
              ),
            ],

            [
              "Attendance Records",

              Number(
                exportSummary.totalRecords ??
                  0,
              ),
            ],

            [
              "Present Records",

              Number(
                exportSummary.present ??
                  0,
              ),
            ],

            [
              "Late Records",

              Number(
                exportSummary.late ??
                  0,
              ),
            ],

            [
              "Absent Records",

              Number(
                exportSummary.absent ??
                  0,
              ),
            ],

            [
              "Present Rate",

              Number(
                exportSummary.presentRate ??
                  0,
              ) / 100,
            ],

            [
              "Late Rate",

              Number(
                exportSummary.lateRate ??
                  0,
              ) / 100,
            ],

            [
              "Absence Rate",

              Number(
                exportSummary.absenceRate ??
                  0,
              ) / 100,
            ],

            [
              "Overall Attendance",

              Number(
                exportSummary.attendanceRate ??
                  0,
              ) / 100,
            ],
          ];

        const summaryWorksheet =
          XLSX.utils.aoa_to_sheet(
            summarySheetData,
          );

        summaryWorksheet[
          "!merges"
        ] = [
          XLSX.utils.decode_range(
            "A1:B1",
          ),

          XLSX.utils.decode_range(
            "A2:B2",
          ),
        ];

        summaryWorksheet[
          "!cols"
        ] = [
          {
            wch: 25,
          },

          {
            wch: 34,
          },
        ];

        for (
          let rowIndex = 15;
          rowIndex <= 18;
          rowIndex += 1
        ) {
          const cellAddress =
            XLSX.utils.encode_cell(
              {
                r:
                  rowIndex,

                c: 1,
              },
            );

          if (
            summaryWorksheet[
              cellAddress
            ]
          ) {
            summaryWorksheet[
              cellAddress
            ].z = "0.0%";
          }
        }

        /* ===============================================
           WORKBOOK
        =============================================== */

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,

          recordWorksheet,

          "Attendance Records",
        );

        XLSX.utils.book_append_sheet(
          workbook,

          summaryWorksheet,

          "Summary",
        );

        XLSX.writeFile(
          workbook,

          buildExportFileName(
            "xlsx",
          ),

          {
            compression:
              true,
          },
        );
      } catch (
        exportRequestError
      ) {
        console.error(
          "Unable to export Excel report:",
          exportRequestError,
        );

        setExportError(
          exportRequestError
            ?.response
            ?.data
            ?.message ||
            "Unable to export the Excel attendance record.",
        );
      } finally {
        setExportingExcel(
          false,
        );
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <CouncilorLayout>
      <section className="attendance-detail-page">
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

            Back to Attendance Overview
          </button>

          <div className="attendance-record-actions">
            {/* PDF */}

            <button
              type="button"
              className="attendance-export-button attendance-export-pdf"
              onClick={
                handleExportPdf
              }
              disabled={
                loading ||
                exportingPdf ||
                exportingExcel
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
                    ? "Generating..."
                    : "Export PDF"}
                </strong>

                <small>
                  Daily attendance sheet
                </small>
              </span>
            </button>

            {/* EXCEL */}

            <button
              type="button"
              className="attendance-export-button attendance-export-excel"
              onClick={
                handleExportExcel
              }
              disabled={
                loading ||
                exportingPdf ||
                exportingExcel
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
                    ? "Generating..."
                    : "Export Excel"}
                </strong>

                <small>
                  Daily spreadsheet
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
            OFFICIAL HEADER
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
                Attendance Management System · Councilor Portal
              </small>
            </div>
          </div>

          <div className="attendance-record-document">
            <span>
              OFFICIAL SCHOOL RECORD
            </span>

            <strong>
              Daily Section Attendance Sheet
            </strong>

            <small>
              Review the attendance record of the selected section for one school day.
            </small>
          </div>
        </header>

        {/* =================================================
            SECTION IDENTITY
        ================================================== */}

        <section className="attendance-record-identity">
          <div className="attendance-record-section-block">
            <span>
              ACADEMIC SECTION
            </span>

            <h1>
              {
                section.sectionName
              }
            </h1>

            <div className="attendance-record-section-meta">
              <span>
                Adviser

                <strong>
                  {section.adviserName ||
                    "Unassigned"}
                </strong>
              </span>

              <span>
                Attendance Date

                <strong>
                  {formatLongDate(
                    selectedDate,
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
              {formatPercentage(
                summary.attendanceRate,
              )}
            </strong>

            <div>
              <b>
                {
                  overallHealth.label
                }
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
            SUMMARY
        ================================================== */}

        <section
          className="attendance-record-summary"
          aria-label="Daily section attendance summary"
        >
          {/* STUDENTS */}

          <article className="attendance-record-stat attendance-record-stat-neutral">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ♙
            </div>

            <div>
              <span>
                STUDENTS
              </span>

              <strong>
                {formatNumber(
                  summary.students,
                )}
              </strong>

              <small>
                Students in daily record
              </small>
            </div>
          </article>

          {/* PRESENT */}

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
                {formatPercentage(
                  summary.presentRate,
                )}
              </strong>

              <small>
                {formatNumber(
                  summary.present,
                )}{" "}
                records
              </small>
            </div>
          </article>

          {/* LATE */}

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
                {formatPercentage(
                  summary.lateRate,
                )}
              </strong>

              <small>
                {formatNumber(
                  summary.late,
                )}{" "}
                records
              </small>
            </div>
          </article>

          {/* ABSENT */}

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
                {formatPercentage(
                  summary.absenceRate,
                )}
              </strong>

              <small>
                {formatNumber(
                  summary.absent,
                )}{" "}
                records
              </small>
            </div>
          </article>

          {/* SESSION */}

          <article className="attendance-record-stat attendance-record-stat-sessions">
            <div
              className="attendance-record-stat-icon"
              aria-hidden="true"
            >
              ▦
            </div>

            <div>
              <span>
                SESSIONS
              </span>

              <strong>
                {formatNumber(
                  summary.sessions,
                )}
              </strong>

              <small>
                {formatNumber(
                  summary.totalRecords,
                )}{" "}
                total records
              </small>
            </div>
          </article>
        </section>

        {/* =================================================
            RECORD SHEET
        ================================================== */}

        <section className="attendance-record-sheet">
          {/* ===============================================
              SHEET HEADER
          ================================================ */}

          <header className="attendance-record-sheet-header">
            <div>
              <span className="attendance-record-kicker">
                STUDENT ATTENDANCE REGISTER
              </span>

              <h2>
                Daily Attendance Record
              </h2>

              <p>
                Select a school date to review the section attendance record.
                The current date is selected by default.
              </p>
            </div>

            <div className="attendance-record-sheet-meta">
              <div>
                <span>
                  Students
                </span>

                <strong>
                  {formatNumber(
                    studentPage.totalElements,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Sessions
                </span>

                <strong>
                  {formatNumber(
                    summary.sessions,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Date
                </span>

                <strong>
                  {formatDate(
                    selectedDate,
                  )}
                </strong>
              </div>
            </div>
          </header>

          {/* ===============================================
              FILTERS
          ================================================ */}

          <div className="attendance-record-filters attendance-record-filters-daily">
            {/* SEARCH */}

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
                    searchInput
                  }
                  onChange={
                    handleSearchChange
                  }
                  placeholder="Name or student number..."
                  aria-label="Search students"
                />
              </div>

              {searchInput && (
                <button
                  type="button"
                  className="attendance-record-search-clear"
                  onClick={
                    clearSearch
                  }
                  aria-label="Clear student search"
                >
                  ×
                </button>
              )}
            </label>

            {/* DATE */}

            <label className="attendance-record-filter attendance-record-date-filter">
              <span>
                ATTENDANCE DATE
              </span>

              <input
                type="date"
                value={
                  selectedDate
                }
                max={
                  today
                }
                onChange={
                  handleDateChange
                }
                aria-label="Attendance date"
                required
              />
            </label>

            {/* TODAY */}

            <button
              type="button"
              className={`attendance-record-today-button ${
                isToday
                  ? "active"
                  : ""
              }`}
              onClick={
                handleToday
              }
              disabled={
                isToday
              }
            >
              <span>
                TODAY
              </span>

              <strong>
                {formatDate(
                  today,
                )}
              </strong>

              <small>
                {isToday
                  ? "Currently selected"
                  : "Return to today's record"}
              </small>
            </button>

            {/* CURRENT SCOPE */}

            <div className="attendance-record-filter-context">
              <span>
                CURRENT RECORD
              </span>

              <strong>
                {formatLongDate(
                  selectedDate,
                )}
              </strong>

              <small>
                {searchInput.trim()
                  ? `Filtered by “${searchInput.trim()}”`
                  : "Showing all students"}
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
                Loading attendance records for{" "}
                {formatLongDate(
                  selectedDate,
                )}
                ...
              </p>
            </div>
          )}

          {/* ===============================================
              EMPTY
          ================================================ */}

          {!loading &&
            !error &&
            students.length ===
              0 && (
              <div className="attendance-record-empty">
                <div
                  aria-hidden="true"
                >
                  ♙
                </div>

                <strong>
                  No attendance record found
                </strong>

                <p>
                  No student attendance records were found for{" "}
                  {formatLongDate(
                    selectedDate,
                  )}
                  {searchInput.trim()
                    ? " with the current student search."
                    : "."}
                </p>
              </div>
            )}

          {/* ===============================================
              TABLE
          ================================================ */}

          {!loading &&
            !error &&
            students.length >
              0 && (
              <>
                <div className="attendance-record-table-wrap">
                  <table className="attendance-record-table">
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
                          SESSIONS
                        </th>

                        <th>
                          PRESENT
                        </th>

                        <th>
                          LATE
                        </th>

                        <th>
                          ABSENT
                        </th>

                        <th className="attendance-record-col-rate">
                          ATTENDANCE RATE
                        </th>

                        <th>
                          REVIEW
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {students.map(
                        (
                          student,
                          index,
                        ) => {
                          const studentHealth =
                            getAttendanceHealth(
                              student.attendanceRate,
                            );

                          const absoluteIndex =
                            studentPage.page *
                              studentPage.size +
                            index +
                            1;

                          return (
                            <tr
                              key={
                                student.studentId
                              }
                              className={`attendance-record-row attendance-record-row-${studentHealth.key}`}
                            >
                              {/* NO */}

                              <td className="attendance-record-row-number">
                                {
                                  absoluteIndex
                                }
                              </td>

                              {/* STUDENT NUMBER */}

                              <td className="attendance-record-student-number">
                                {student.studentNumber ||
                                  "—"}
                              </td>

                              {/* STUDENT */}

                              <td>
                                <div className="attendance-record-student">
                                  <div
                                    aria-hidden="true"
                                  >
                                    {student.studentName
                                      ?.charAt(
                                        0,
                                      )
                                      ?.toUpperCase() ||
                                      "S"}
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        student.studentName
                                      }
                                    </strong>

                                    <span>
                                      {student.studentNumber ||
                                        "No number"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* SESSIONS */}

                              <td className="attendance-record-count">
                                {formatNumber(
                                  student.sessions,
                                )}
                              </td>

                              {/* PRESENT */}

                              <td>
                                <span className="attendance-record-pill present">
                                  {formatNumber(
                                    student.present,
                                  )}
                                </span>
                              </td>

                              {/* LATE */}

                              <td>
                                <span className="attendance-record-pill late">
                                  {formatNumber(
                                    student.late,
                                  )}
                                </span>
                              </td>

                              {/* ABSENT */}

                              <td>
                                <span className="attendance-record-pill absent">
                                  {formatNumber(
                                    student.absent,
                                  )}
                                </span>
                              </td>

                              {/* RATE */}

                              <td>
                                <div className="attendance-record-rate">
                                  <div>
                                    <strong>
                                      {formatPercentage(
                                        student.attendanceRate,
                                      )}
                                    </strong>

                                    <span>
                                      {
                                        studentHealth.label
                                      }
                                    </span>
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

                              {/* REVIEW */}

                              <td>
                                <span
                                  className={`attendance-record-review attendance-record-review-${studentHealth.key}`}
                                >
                                  {
                                    studentHealth.label
                                  }
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                {/* =========================================
                    NOTE
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
                        Daily record:
                      </strong>{" "}
                      this sheet shows attendance for{" "}
                      <strong>
                        {formatLongDate(
                          selectedDate,
                        )}
                      </strong>
                      . “For Review” is a visual monitoring aid
                      and is not a disciplinary classification.
                    </p>
                  </div>

                  <span>
                    Record date:{" "}
                    {formatDate(
                      selectedDate,
                    )}
                  </span>
                </div>

                {/* =========================================
                    PAGINATION
                ========================================== */}

                <footer className="attendance-record-pagination">
                  <p>
                    Showing{" "}
                    <strong>
                      {
                        startRecord
                      }
                    </strong>

                    {" – "}

                    <strong>
                      {
                        endRecord
                      }
                    </strong>{" "}

                    of{" "}

                    <strong>
                      {formatNumber(
                        studentPage.totalElements,
                      )}
                    </strong>{" "}

                    students
                  </p>

                  <div>
                    <button
                      type="button"
                      disabled={
                        studentPage.first
                      }
                      onClick={
                        goToPreviousPage
                      }
                    >
                      ← Previous
                    </button>

                    <span>
                      Page{" "}

                      <strong>
                        {studentPage.totalPages >
                        0
                          ? studentPage.page +
                            1
                          : 0}
                      </strong>

                      {" of "}

                      <strong>
                        {
                          studentPage.totalPages
                        }
                      </strong>
                    </span>

                    <button
                      type="button"
                      disabled={
                        studentPage.last
                      }
                      onClick={
                        goToNextPage
                      }
                    >
                      Next →
                    </button>
                  </div>
                </footer>
              </>
            )}
        </section>
      </section>
    </CouncilorLayout>
  );
}

export default AttendanceDetail;