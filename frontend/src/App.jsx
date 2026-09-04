import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./features/auth/login";

import authService from "./services/authService";

/* =========================================================
   PUBLIC
========================================================= */

import ParentAttendanceNotice from "./features/public/ParentAttendanceNotice";

/* =========================================================
   SUPERADMIN
========================================================= */

import CouncilorManagement from "./features/superadmin/CouncilorManagement";
import DepartmentManagement from "./features/superadmin/DepartmentManagement";
import SuperAdminDashboard from "./features/superadmin/SuperAdminDashboard";

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
import StudentTransfers from "./features/adviser/StudentTransfer";
import StudentsAtRisk from "./features/adviser/StudentAtRisk";

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
   ROLE HELPERS
========================================================= */

const getDashboardPath = (role) => {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin/dashboard";

    case "COUNCILOR":
      return "/councilor/dashboard";

    case "ADVISER":
      return "/adviser/dashboard";

    default:
      return "/login";
  }
};

/* =========================================================
   PROTECTED ROUTE
========================================================= */

function ProtectedRoute({ children, allowedRoles }) {
  const authenticated = authService.isAuthenticated();

  const user = authService.getUser();

  /* =======================================================
     NOT LOGGED IN
  ======================================================= */

  if (!authenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  /* =======================================================
     WRONG ROLE
  ======================================================= */

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  /* =======================================================
     AUTHORIZED
  ======================================================= */

  return children;
}

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =================================================
            PUBLIC PARENT ATTENDANCE NOTICE

            No Adviser/Councilor/SuperAdmin login required.

            Access is protected by the secure token
            contained in the email URL.
        ================================================= */}

        <Route
          path="/attendance-notice/:token"
          element={<ParentAttendanceNotice />}
        />

        {/* =================================================
            AUTH
        ================================================= */}

        <Route path="/login" element={<Login />} />

        {/* =================================================
            SUPERADMIN
        ================================================= */}

        <Route
          path="/superadmin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/superadmin/departments"
          element={
            <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
              <DepartmentManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/superadmin/councilors"
          element={
            <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
              <CouncilorManagement />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            COUNCILOR
        ================================================= */}

        <Route
          path="/councilor/dashboard"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <CouncilorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/councilor/advisers"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <Advisers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/councilor/sections"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <SectionManagement />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            COUNCILOR ATTENDANCE
        ================================================= */}

        <Route
          path="/councilor/attendance"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <AttendanceManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/councilor/attendance/:sectionId"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <AttendanceDetails />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            COUNCILOR ATTENDANCE RECORDS / ARCHIVE
        ================================================= */}

        <Route
          path="/councilor/attendance-records"
          element={
            <ProtectedRoute allowedRoles={["COUNCILOR"]}>
              <CouncilorAttendanceRecords />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER
        ================================================= */}

        <Route
          path="/adviser/dashboard"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserDashboard />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER STUDENT MANAGEMENT
        ================================================= */}

        <Route
          path="/adviser/students"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER STUDENT TRANSFERS

            Central transfer workspace:
            - Incoming requests
            - Outgoing requests
            - Transfer history
            - Approve
            - Reject
            - Cancel
        ================================================= */}

        <Route
          path="/adviser/transfers"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <StudentTransfers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adviser/students-at-risk"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <StudentsAtRisk />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE LANDING
        ================================================= */}

        <Route
          path="/adviser/attendance"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserAttendance />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE HISTORY
        ================================================= */}

        <Route
          path="/adviser/attendance/history"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AttendanceHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/adviser/attendance/history/:sessionId"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AttendanceHistoryDetail />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ADVISER ATTENDANCE RECORDS / ARCHIVE
        ================================================= */}

        <Route
          path="/adviser/attendance-records"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserAttendanceRecords />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ACTIVE ATTENDANCE SESSION

            Keep dynamic session route after static
            attendance routes so the static routes remain
            clear and easy to maintain.
        ================================================= */}

        <Route
          path="/adviser/attendance/:sessionId"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AttendanceSession />
            </ProtectedRoute>
          }
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
