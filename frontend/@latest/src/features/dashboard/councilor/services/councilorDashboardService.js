import { apiClient } from "../../../../services/apiClient";

export async function getCouncilorDashboardSummary() {
  const users = await apiClient.get("/api/users");

  const advisers = users.filter((user) => user.role === "ADVISER");

  const activeAdvisers = advisers.filter((adviser) => adviser.active === true);

  return {
    totalAdvisers: advisers.length,
    activeAdvisers: activeAdvisers.length,
  };
}
