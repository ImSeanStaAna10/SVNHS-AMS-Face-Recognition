import {
  useEffect,
  useState,
} from "react";

import attendanceReportService from "../../services/attendanceReportService";

import ReportFilters from "./components/ReportFilter";
import ReportHero from "./components/ReportHero";
import ReportPagination from "./components/ReportPagination";
import ReportSummary from "./components/ReportSummary";
import ReportTable from "./components/ReportTable";

import {
  resolveRequestError,
} from "./utils/reportFormatter";

import "./AttendanceRecords.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 12;

/* =========================================================
   DEFAULT FILTERS
========================================================= */

const DEFAULT_FILTERS = {
  type: "",
  sectionId: "",
  from: "",
  to: "",
};

/* =========================================================
   DEFAULT PAGE
========================================================= */

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

/* =========================================================
   ATTENDANCE RECORDS
========================================================= */

function AttendanceRecords({
  role,
  sections = [],
}) {
  const isCouncilor =
    role === "COUNCILOR";

  /* =========================================================
     FILTER STATE
  ========================================================= */

  const [
    filters,
    setFilters,
  ] = useState(
    DEFAULT_FILTERS
  );

  const [
    appliedFilters,
    setAppliedFilters,
  ] = useState(
    DEFAULT_FILTERS
  );

  /* =========================================================
     PAGINATION STATE
  ========================================================= */

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    reportPage,
    setReportPage,
  ] = useState(
    EMPTY_PAGE
  );

  /* =========================================================
     UI STATE
  ========================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionKey,
    setActionKey,
  ] = useState("");

  const [
    downloadingAll,
    setDownloadingAll,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* =========================================================
     RELOAD KEY

     Incrementing this forces the archive effect to
     retrieve fresh data without duplicating the
     loading function.
  ========================================================= */

  const [
    reloadKey,
    setReloadKey,
  ] = useState(0);

  /* =========================================================
     LOAD ARCHIVE

     Automatically runs when:
     - filters are applied
     - page changes
     - report is regenerated
     - role changes
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const fetchReports = async () => {
      try {
        const response =
          await attendanceReportService
            .getAttendanceReportArchive({
              type:
                appliedFilters.type,

              sectionId:
                isCouncilor
                  ? appliedFilters.sectionId
                  : undefined,

              from:
                appliedFilters.from,

              to:
                appliedFilters.to,

              page,

              size: PAGE_SIZE,
            });

        if (cancelled) {
          return;
        }

        setReportPage({
          ...EMPTY_PAGE,
          ...response,

          content:
            response?.content ||
            [],
        });
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        const message =
          await resolveRequestError(
            requestError,
            "Unable to load attendance reports."
          );

        if (cancelled) {
          return;
        }

        setError(
          message
        );

        setReportPage({
          ...EMPTY_PAGE,
          page,
        });
      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    };

    fetchReports();

    return () => {
      cancelled = true;
    };
  }, [
    appliedFilters.type,
    appliedFilters.sectionId,
    appliedFilters.from,
    appliedFilters.to,
    isCouncilor,
    page,
    reloadKey,
  ]);

  /* =========================================================
     AUTO CLEAR ALERTS
  ========================================================= */

  useEffect(() => {
    if (
      !success &&
      !error
    ) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          setSuccess("");
          setError("");
        },
        5000
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    success,
    error,
  ]);

  /* =========================================================
     CURRENT REPORTS
  ========================================================= */

  const reports =
    reportPage?.content ||
    [];

  /* =========================================================
     APPLY FILTERS
  ========================================================= */

  const handleApplyFilters = () => {
    setLoading(
      true
    );

    setError("");
    setSuccess("");

    setPage(0);

    setAppliedFilters({
      type:
        filters.type,

      sectionId:
        isCouncilor
          ? filters.sectionId
          : "",

      from:
        filters.from,

      to:
        filters.to,
    });
  };

  /* =========================================================
     RESET FILTERS
  ========================================================= */

  const handleResetFilters = () => {
    setLoading(
      true
    );

    setError("");
    setSuccess("");

    setFilters({
      ...DEFAULT_FILTERS,
    });

    setAppliedFilters({
      ...DEFAULT_FILTERS,
    });

    /*
     * If already on page zero with default filters,
     * changing the filters may not trigger the effect.
     * reloadKey guarantees a refresh.
     */
    if (
      page === 0 &&
      appliedFilters.type === "" &&
      appliedFilters.sectionId === "" &&
      appliedFilters.from === "" &&
      appliedFilters.to === ""
    ) {
      setReloadKey(
        (current) =>
          current + 1
      );
    }

    setPage(0);
  };

  /* =========================================================
     GENERIC REPORT ACTION
  ========================================================= */

  const runReportAction = async ({
    report,
    action,
    callback,
    successMessage,
  }) => {
    if (
      !report?.id
    ) {
      return;
    }

    if (
      actionKey
    ) {
      return;
    }

    setActionKey(
      `${report.id}:${action}`
    );

    setError("");
    setSuccess("");

    try {
      await callback();

      if (
        successMessage
      ) {
        setSuccess(
          successMessage
        );
      }
    } catch (requestError) {
      const message =
        await resolveRequestError(
          requestError,
          "Unable to complete the report action."
        );

      setError(
        message
      );
    } finally {
      setActionKey("");
    }
  };

  /* =========================================================
     VIEW PDF
  ========================================================= */

  const handleViewPdf = (
    report
  ) => {
    void runReportAction({
      report,

      action:
        "view",

      callback:
        () =>
          attendanceReportService
            .viewAttendanceReportPdf(
              report.id
            ),
    });
  };

  /* =========================================================
     DOWNLOAD PDF
  ========================================================= */

  const handleDownloadPdf = (
    report
  ) => {
    void runReportAction({
      report,

      action:
        "pdf",

      callback:
        () =>
          attendanceReportService
            .downloadAttendanceReportPdf({
              id:
                report.id,

              pdfFileName:
                report.pdfFileName,
            }),
    });
  };

  /* =========================================================
     DOWNLOAD EXCEL
  ========================================================= */

  const handleDownloadExcel = (
    report
  ) => {
    void runReportAction({
      report,

      action:
        "excel",

      callback:
        () =>
          attendanceReportService
            .downloadAttendanceReportExcel({
              id:
                report.id,

              excelFileName:
                report.excelFileName,
            }),
    });
  };

  /* =========================================================
     REGENERATE REPORT

     COUNCILOR ONLY

     Instead of calling the removed loadReports()
     function, we increment reloadKey.
  ========================================================= */

  const handleRegenerate = (
    report
  ) => {
    if (
      !isCouncilor
    ) {
      return;
    }

    void runReportAction({
      report,

      action:
        "regenerate",

      callback:
        async () => {
          await attendanceReportService
            .generateAttendanceReport({
              sectionId:
                report.sectionId,

              type:
                report.reportType,

              from:
                report.periodStart,

              to:
                report.periodEnd,
            });

          setLoading(
            true
          );

          setReloadKey(
            (current) =>
              current + 1
          );
        },

      successMessage:
        "Attendance report regenerated successfully.",
    });
  };

  /* =========================================================
     DOWNLOAD ALL

     Uses currently applied filters.
  ========================================================= */

  const handleDownloadAll =
    async (
      format
    ) => {
      if (
        downloadingAll
      ) {
        return;
      }

      setDownloadingAll(
        true
      );

      setError("");
      setSuccess("");

      try {
        await attendanceReportService
          .downloadAttendanceReportsZip({
            type:
              appliedFilters.type,

            sectionId:
              isCouncilor
                ? appliedFilters.sectionId
                : undefined,

            from:
              appliedFilters.from,

            to:
              appliedFilters.to,

            format,
          });

        setSuccess(
          "Attendance report archive downloaded successfully."
        );
      } catch (requestError) {
        const message =
          await resolveRequestError(
            requestError,
            "Unable to download attendance reports."
          );

        setError(
          message
        );
      } finally {
        setDownloadingAll(
          false
        );
      }
    };

  /* =========================================================
     PAGE CHANGE
  ========================================================= */

  const handlePageChange = (
    nextPage
  ) => {
    if (
      loading
    ) {
      return;
    }

    if (
      nextPage < 0
    ) {
      return;
    }

    if (
      nextPage >=
      reportPage.totalPages
    ) {
      return;
    }

    if (
      nextPage === page
    ) {
      return;
    }

    setLoading(
      true
    );

    setError("");
    setSuccess("");

    setPage(
      nextPage
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="attendance-records-page">
      {/* =====================================================
          HERO
      ===================================================== */}

      <ReportHero
        role={role}
        totalReports={
          reportPage.totalElements
        }
        onDownloadAll={
          handleDownloadAll
        }
        downloading={
          downloadingAll
        }
      />

      {/* =====================================================
          ALERT
      ===================================================== */}

      {(error || success) && (
        <div
          className={`attendance-records-alert ${
            error
              ? "attendance-records-alert-error"
              : "attendance-records-alert-success"
          }`}
          role="status"
          aria-live="polite"
        >
          {error || success}
        </div>
      )}

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <ReportFilters
        role={role}
        sections={
          sections
        }
        filters={
          filters
        }
        onChange={
          setFilters
        }
        onApply={
          handleApplyFilters
        }
        onReset={
          handleResetFilters
        }
        loading={
          loading
        }
      />

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <ReportSummary
        totalReports={
          reportPage.totalElements
        }
        reports={
          reports
        }
      />

      {/* =====================================================
          REPORT ARCHIVE
      ===================================================== */}

      <section className="attendance-records-list-card">
        <div className="attendance-records-section-heading attendance-records-table-heading">
          <div>
            <span>
              REPORT ARCHIVE
            </span>

            <h2>
              Generated attendance reports
            </h2>
          </div>

          <p>
            PDF and Excel files are securely stored and
            retrieved through the attendance report service.
          </p>
        </div>

        <ReportTable
          role={role}
          reports={
            reports
          }
          loading={
            loading
          }
          actionKey={
            actionKey
          }
          onViewPdf={
            handleViewPdf
          }
          onDownloadPdf={
            handleDownloadPdf
          }
          onDownloadExcel={
            handleDownloadExcel
          }
          onRegenerate={
            handleRegenerate
          }
        />

        <ReportPagination
          page={
            reportPage.page
          }
          size={
            reportPage.size
          }
          totalPages={
            reportPage.totalPages
          }
          totalElements={
            reportPage.totalElements
          }
          onPageChange={
            handlePageChange
          }
          loading={
            loading
          }
        />
      </section>
    </main>
  );
}

export default AttendanceRecords;