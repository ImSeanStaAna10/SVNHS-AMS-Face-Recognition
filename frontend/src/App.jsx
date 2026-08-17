import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./features/auth/Login";

import Advisers from "./features/councilor/AdviserManagement";
import CouncilorDashboard from "./features/councilor/CouncilorDashboard";
import SectionManagement from "./features/councilor/SectionManagement";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================================================
            AUTHENTICATION
        ================================================= */}

        <Route path="/login" element={<Login />} />

        {/* ================================================
            COUNCILOR
        ================================================= */}

        <Route path="/councilor/dashboard" element={<CouncilorDashboard />} />

        <Route path="/councilor/advisers" element={<Advisers />} />

        <Route path="/councilor/sections" element={<SectionManagement />} />

        {/* ================================================
            DEFAULT
        ================================================= */}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
