import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./features/auth/login";

/* =========================================================
   ADVISER
========================================================= */

import AdviserAttendance from "./features/adviser/AdviserAttendance";
import AdviserAttendanceRecords from "./features/adviser/AdviserAttendanceRecords";
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
import CouncilorAttendanceRecords from "./features/councilor/CouncilorAttendanceRecords";
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

        <Route
          path="/login"
          element={
            <Login />
          }
        />

        {/* =================================================
            COUNCILOR
        ================================================= */}

        <Route
          path="/councilor/dashboard"
          element={
            <CouncilorDashboard />
          }
        />

        <Route
          path="/councilor/advisers"
          element={
            <Advisers />
          }
        />

        <Route
          path="/councilor/sections"
          element={
            <SectionManagement />
          }
        />

        {/* =================================================
            COUNCILOR ATTENDANCE
        ================================================= */}

        <Route
          path="/councilor/attendance"
          element={
            <AttendanceManagement />
          }
        />

        <Route
          path="/councilor/attendance/:sectionId"
          element={
            <AttendanceDetails />
          }
        />

        {/* =================================================
            COUNCILOR ATTENDANCE RECORDS / ARCHIVE
        ================================================= */}

        <Route
          path="/councilor/attendance-records"
          element={
            <CouncilorAttendanceRecords />
          }
        />

        {/* =================================================
            ADVISER
        ================================================= */}

        <Route
          path="/adviser/dashboard"
          element={
            <AdviserDashboard />
          }
        />

        <Route
          path="/adviser/students"
          element={
            <StudentManagement />
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE LANDING
        ================================================= */}

        <Route
          path="/adviser/attendance"
          element={
            <AdviserAttendance />
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE HISTORY
        ================================================= */}

        <Route
          path="/adviser/attendance/history"
          element={
            <AttendanceHistory />
          }
        />

        <Route
          path="/adviser/attendance/history/:sessionId"
          element={
            <AttendanceHistoryDetail />
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE RECORDS / ARCHIVE
        ================================================= */}

        <Route
          path="/adviser/attendance-records"
          element={
            <AdviserAttendanceRecords />
          }
        />

        {/* =================================================
            ACTIVE ATTENDANCE SESSION

            Keep dynamic session route after the static
            attendance routes for readability.
        ================================================= */}

        <Route
          path="/adviser/attendance/:sessionId"
          element={
            <AttendanceSession />
          }
        />

        {/* =================================================
            FALLBACK
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;