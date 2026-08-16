import { Navigate, Route, Routes } from "react-router";

import { ROLES } from "../constants/roles";

import LoginPage from "../features/auth/pages/LoginPage";

import ProtectedRoute from "../features/auth/components/ProtectedRoute";

import CouncilorDashboardPage from "../features/dashboard/councilor/pages/CouncilorDashboardPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/councilor/dashboard"
        element={
          <ProtectedRoute allowedRoles={[ROLES.COUNCILOR]}>
            <CouncilorDashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
