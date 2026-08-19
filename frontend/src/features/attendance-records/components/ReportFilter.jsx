function ReportFilters({
  role,
  sections = [],
  filters,
  onChange,
  onApply,
  onReset,
  loading = false,
}) {
  const isCouncilor =
    role === "COUNCILOR";

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    onChange?.({
      ...filters,
      [name]: value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onApply?.();
  };

  return (
    <section className="attendance-records-filter-card">
      <div className="attendance-records-section-heading">
        <div>
          <span>
            REPORT FILTERS
          </span>

          <h2>
            Find archived reports
          </h2>
        </div>

        <p>
          Narrow the archive by report type, section, or
          reporting period.
        </p>
      </div>

      <form
        className="attendance-records-filter-grid"
        onSubmit={handleSubmit}
      >
        <div className="attendance-records-field">
          <label htmlFor="reportType">
            Report type
          </label>

          <select
            id="reportType"
            name="type"
            value={filters.type}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="">
              All report types
            </option>

            <option value="WEEKLY">
              Weekly
            </option>

            <option value="MONTHLY">
              Monthly
            </option>
          </select>
        </div>

        {isCouncilor && (
          <div className="attendance-records-field">
            <label htmlFor="reportSection">
              Section
            </label>

            <select
              id="reportSection"
              name="sectionId"
              value={filters.sectionId}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">
                All sections
              </option>

              {sections.map((section) => (
                <option
                  key={section.id}
                  value={section.id}
                >
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="attendance-records-field">
          <label htmlFor="reportFrom">
            From
          </label>

          <input
            id="reportFrom"
            type="date"
            name="from"
            value={filters.from}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="attendance-records-field">
          <label htmlFor="reportTo">
            To
          </label>

          <input
            id="reportTo"
            type="date"
            name="to"
            value={filters.to}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="attendance-records-filter-actions">
          <button
            type="button"
            className="attendance-records-button-secondary"
            onClick={onReset}
            disabled={loading}
          >
            Reset
          </button>

          <button
            type="submit"
            className="attendance-records-button-primary"
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "Apply Filters"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ReportFilters;