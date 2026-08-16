import { Navigate, Route, Routes } from "react-router";

import LoginPage from "../features/auth/pages/LoginPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default AppRoutes;
