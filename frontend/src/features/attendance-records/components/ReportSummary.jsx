import {
  formatPercentage,
} from "../utils/reportFormatter";

function ReportSummary({
  totalReports = 0,
  reports = [],
}) {
  const totals = reports.reduce(
    (summary, report) => {
      summary.present +=
        Number(report.presentCount) || 0;

      summary.late +=
        Number(report.lateCount) || 0;

      summary.absent +=
        Number(report.absentCount) || 0;

      summary.attendanceRate +=
        Number(report.attendanceRate) || 0;

      return summary;
    },
    {
      present: 0,
      late: 0,
      absent: 0,
      attendanceRate: 0,
    }
  );

  const averageRate =
    reports.length > 0
      ? totals.attendanceRate /
        reports.length
      : 0;

  const items = [
    {
      label: "Archived Reports",
      value: totalReports,
      hint: "Matching current filters",
      type: "default",
    },
    {
      label: "Average Attendance",
      value: formatPercentage(
        averageRate
      ),
      hint: "Reports shown on this page",
      type: "rate",
    },
    {
      label: "Present Records",
      value: totals.present,
      hint: "Current page totals",
      type: "present",
    },
    {
      label: "Late Records",
      value: totals.late,
      hint: "Current page totals",
      type: "late",
    },
    {
      label: "Absent Records",
      value: totals.absent,
      hint: "Current page totals",
      type: "absent",
    },
  ];

  return (
    <section className="attendance-records-summary-grid">
      {items.map((item) => (
        <article
          key={item.label}
          className={`attendance-records-summary-card attendance-records-summary-${item.type}`}
        >
          <span className="attendance-records-summary-label">
            {item.label}
          </span>

          <strong>
            {item.value}
          </strong>

          <small>
            {item.hint}
          </small>
        </article>
      ))}
    </section>
  );
}

export default ReportSummary;