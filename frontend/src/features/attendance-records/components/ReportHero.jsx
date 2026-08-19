import { useState } from "react";

function ReportHero({
  role,
  totalReports = 0,
  onDownloadAll,
  downloading = false,
}) {
  const [format, setFormat] = useState("BOTH");

  const isCouncilor =
    role === "COUNCILOR";

  const handleDownload = () => {
    onDownloadAll?.(format);
  };

  return (
    <section className="attendance-records-hero">
      <div className="attendance-records-hero-glow" />

      <div className="attendance-records-hero-content">
        <div className="attendance-records-hero-copy">
          <span className="attendance-records-eyebrow">
            OFFICIAL ATTENDANCE ARCHIVE
          </span>

          <h1>
            Attendance Records
          </h1>

          <p>
            Review, preview, and download automatically generated
            weekly and monthly attendance reports.
          </p>

          <div className="attendance-records-hero-meta">
            <span>
              {totalReports} archived{" "}
              {totalReports === 1
                ? "report"
                : "reports"}
            </span>

            <span className="attendance-records-meta-dot" />

            <span>
              {isCouncilor
                ? "All authorized sections"
                : "Assigned section"}
            </span>
          </div>
        </div>

        <div className="attendance-records-download-panel">
          <label
            htmlFor="attendance-report-download-format"
            className="attendance-records-download-label"
          >
            Download archive
          </label>

          <div className="attendance-records-download-controls">
            <select
              id="attendance-report-download-format"
              value={format}
              onChange={(event) =>
                setFormat(event.target.value)
              }
              disabled={downloading}
            >
              <option value="BOTH">
                PDF + Excel
              </option>

              <option value="PDF">
                PDF only
              </option>

              <option value="EXCEL">
                Excel only
              </option>
            </select>

            <button
              type="button"
              className="attendance-records-download-button"
              onClick={handleDownload}
              disabled={
                downloading ||
                totalReports === 0
              }
            >
              {downloading
                ? "Preparing..."
                : "Download All"}
            </button>
          </div>

          <small>
            Downloads use your currently applied filters.
          </small>
        </div>
      </div>
    </section>
  );
}

export default ReportHero;