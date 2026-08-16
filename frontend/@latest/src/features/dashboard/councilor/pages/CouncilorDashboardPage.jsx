import { useEffect, useState } from "react";

import CouncilorStatCard from "../components/CouncilorStatCard";

import { getCouncilorDashboardSummary } from "../services/councilorDashboardService";

const initialSummary = {
  totalAdvisers: 0,
  activeAdvisers: 0,
  totalSections: 0,
};

function CouncilorDashboardPage() {
  const [summary, setSummary] = useState(initialSummary);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError("");

        const dashboardSummary = await getCouncilorDashboardSummary();

        setSummary(dashboardSummary);
      } catch (error) {
        setError(error.message || "Failed to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <main className="container py-5">
      <div className="mb-4">
        <p className="text-secondary mb-1">Councilor</p>

        <h1 className="fw-bold">Dashboard</h1>

        <p className="text-secondary">Overview of advisers and sections.</p>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-md-6 col-xl-4">
            <CouncilorStatCard
              title="Total Advisers"
              value={summary.totalAdvisers}
              description="Registered adviser accounts"
            />
          </div>

          <div className="col-md-6 col-xl-4">
            <CouncilorStatCard
              title="Active Advisers"
              value={summary.activeAdvisers}
              description="Currently active advisers"
            />
          </div>

          <div className="col-md-6 col-xl-4">
            <CouncilorStatCard
              title="Sections"
              value={summary.totalSections}
              description="Registered school sections"
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default CouncilorDashboardPage;
