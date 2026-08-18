import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./features/auth/Login";

/* =========================================================
   ADVISER
========================================================= */

import AdviserAttendance from "./features/adviser/AdviserAttendance";
import AdviserDashboard from "./features/adviser/AdviserDashboard";
import AttendanceHistory from "./features/adviser/AttendanceHistory";
import AttendanceHistoryDetail from "./features/adviser/AttendanceHistoryDetail";
import AttendanceSession from "./features/adviser/AttendanceSession";
import StudentManagement from "./features/adviser/StudentManagement";

/* =========================================================
   COUNCILOR
========================================================= */

import Advisers from "./features/councilor/AdviserManagement";
import AttendanceDetails from "./features/councilor/AttendanceDetail";
import AttendanceManagement from "./features/councilor/AttendanceManagement";
import CouncilorDashboard from "./features/councilor/CouncilorDashboard";
import SectionManagement from "./features/councilor/SectionManagement";

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =================================================
            AUTH
        ================================================= */}

        <Route path="/login" element={<Login />} />

        {/* =================================================
            COUNCILOR
        ================================================= */}

        <Route path="/councilor/dashboard" element={<CouncilorDashboard />} />

        <Route path="/councilor/advisers" element={<Advisers />} />

        <Route path="/councilor/sections" element={<SectionManagement />} />

        <Route
          path="/councilor/attendance"
          element={<AttendanceManagement />}
        />

        <Route
          path="/councilor/attendance/:sectionId"
          element={<AttendanceDetails />}
        />

        {/* =================================================
            ADVISER
        ================================================= */}

        <Route path="/adviser/dashboard" element={<AdviserDashboard />} />

        <Route path="/adviser/students" element={<StudentManagement />} />

        {/* =================================================
            ATTENDANCE LANDING PAGE
        ================================================= */}

        <Route path="/adviser/attendance" element={<AdviserAttendance />} />

        {/* =================================================
            ATTENDANCE HISTORY
        ================================================= */}

        <Route
          path="/adviser/attendance/history"
          element={<AttendanceHistory />}
        />

        <Route
          path="/adviser/attendance/history/:sessionId"
          element={<AttendanceHistoryDetail />}
        />

        {/* =================================================
            ACTIVE ATTENDANCE SESSION
        ================================================= */}

        <Route
          path="/adviser/attendance/:sessionId"
          element={<AttendanceSession />}
        />

        {/* =================================================
            FALLBACK
        ================================================= */}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
