import {
  formatPercentage,
  formatReportPeriod,
  formatReportType,
  getAttendanceRateClass,
} from "../utils/reportFormatter";

function ReportTable({
  role,
  reports = [],
  loading = false,
  actionKey = "",
  onViewPdf,
  onDownloadPdf,
  onDownloadExcel,
  onRegenerate,
}) {
  const isCouncilor =
    role === "COUNCILOR";

  if (loading) {
    return (
      <div className="attendance-records-table-state">
        <div className="attendance-records-loader" />

        <strong>
          Loading attendance reports
        </strong>

        <span>
          Retrieving your archived records...
        </span>
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="attendance-records-table-state attendance-records-empty">
        <div className="attendance-records-empty-icon">
          AR
        </div>

        <strong>
          No attendance reports found
        </strong>

        <span>
          Try adjusting the report type, section, or date
          filters.
        </span>
      </div>
    );
  }

  const isBusy = (
    reportId,
    action
  ) => {
    return (
      actionKey ===
      `${reportId}:${action}`
    );
  };

  return (
    <div className="attendance-records-table-wrapper">
      <table className="attendance-records-table">
        <thead>
          <tr>
            <th>
              Reporting Period
            </th>

            <th>
              Type
            </th>

            <th>
              Section
            </th>

            <th>
              Adviser
            </th>

            <th className="attendance-records-number-column">
              Students
            </th>

            <th className="attendance-records-number-column">
              Sessions
            </th>

            <th>
              Attendance
            </th>

            <th>
              Breakdown
            </th>

            <th className="attendance-records-actions-column">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <div className="attendance-records-period">
                  <strong>
                    {formatReportPeriod(
                      report.periodStart,
                      report.periodEnd
                    )}
                  </strong>

                  <span>
                    Generated{" "}
                    {report.generatedAt
                      ? new Date(
                          report.generatedAt
                        ).toLocaleDateString(
                          "en-PH"
                        )
                      : "—"}
                  </span>
                </div>
              </td>

              <td>
                <span
                  className={`attendance-records-type-badge attendance-records-type-${String(
                    report.reportType
                  ).toLowerCase()}`}
                >
                  {formatReportType(
                    report.reportType
                  )}
                </span>
              </td>

              <td>
                <strong className="attendance-records-section-name">
                  {report.sectionName ||
                    "—"}
                </strong>
              </td>

              <td>
                <span className="attendance-records-adviser-name">
                  {report.adviserName ||
                    "—"}
                </span>
              </td>

              <td className="attendance-records-number-column">
                {report.studentCount ??
                  0}
              </td>

              <td className="attendance-records-number-column">
                {report.sessionCount ??
                  0}
              </td>

              <td>
                <span
                  className={`attendance-records-rate ${getAttendanceRateClass(
                    report.attendanceRate
                  )}`}
                >
                  {formatPercentage(
                    report.attendanceRate
                  )}
                </span>
              </td>

              <td>
                <div className="attendance-records-breakdown">
                  <span className="attendance-records-breakdown-present">
                    P {report.presentCount ?? 0}
                  </span>

                  <span className="attendance-records-breakdown-late">
                    L {report.lateCount ?? 0}
                  </span>

                  <span className="attendance-records-breakdown-absent">
                    A {report.absentCount ?? 0}
                  </span>
                </div>
              </td>

              <td>
                <div className="attendance-records-row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      onViewPdf?.(
                        report
                      )
                    }
                    disabled={
                      Boolean(actionKey)
                    }
                  >
                    {isBusy(
                      report.id,
                      "view"
                    )
                      ? "Opening..."
                      : "View PDF"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onDownloadPdf?.(
                        report
                      )
                    }
                    disabled={
                      Boolean(actionKey)
                    }
                  >
                    {isBusy(
                      report.id,
                      "pdf"
                    )
                      ? "Downloading..."
                      : "PDF"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onDownloadExcel?.(
                        report
                      )
                    }
                    disabled={
                      Boolean(actionKey)
                    }
                  >
                    {isBusy(
                      report.id,
                      "excel"
                    )
                      ? "Downloading..."
                      : "Excel"}
                  </button>

                  {isCouncilor && (
                    <button
                      type="button"
                      className="attendance-records-regenerate-button"
                      onClick={() =>
                        onRegenerate?.(
                          report
                        )
                      }
                      disabled={
                        Boolean(actionKey)
                      }
                    >
                      {isBusy(
                        report.id,
                        "regenerate"
                      )
                        ? "Updating..."
                        : "Regenerate"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportTable;