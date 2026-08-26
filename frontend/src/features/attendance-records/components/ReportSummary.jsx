import { formatPercentage } from "../utils/reportFormatter";

function ReportSummary({ totalReports = 0, reports = [] }) {
  const totals = reports.reduce(
    (summary, report) => {
      const present = Number(report?.presentCount) || 0;

      const late = Number(report?.lateCount) || 0;

      const absent = Number(report?.absentCount) || 0;

      summary.present += present;

      summary.late += late;

      summary.absent += absent;

      return summary;
    },
    {
      present: 0,
      late: 0,
      absent: 0,
    },
  );

  /* =======================================================
     ATTENDANCE TOTALS

     PRESENT + LATE = attended
     PRESENT + LATE + ABSENT = total attendance records
  ======================================================= */

  const attendedCount = totals.present + totals.late;

  const totalAttendanceRecords = totals.present + totals.late + totals.absent;

  /* =======================================================
     COMBINED ATTENDANCE RATE

     This correctly weights WEEKLY / MONTHLY reports
     according to their actual attendance records.
  ======================================================= */

  const averageRate =
    totalAttendanceRecords > 0
      ? (attendedCount / totalAttendanceRecords) * 100
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

      value: formatPercentage(averageRate),

      hint: "Present + late on this page",

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
          <span className="attendance-records-summary-label">{item.label}</span>

          <strong>{item.value}</strong>

          <small>{item.hint}</small>
        </article>
      ))}
    </section>
  );
}

export default ReportSummary;
