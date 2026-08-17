import api from "./api";

/* =========================================================
   ADVISERS
========================================================= */

const getAdvisers = async () => {
  const response = await api.get("/users");

  return response.data;
};

const createAdviser = async ({ name, email, password }) => {
  const response = await api.post("/users/advisers", {
    name,
    email,
    password,
  });

  return response.data;
};

/* =========================================================
   SECTIONS
========================================================= */

const getSections = async () => {
  const response = await api.get("/sections");

  return response.data;
};

const createSection = async ({ name, adviserId }) => {
  const response = await api.post("/sections", {
    name,
    adviserId,
  });

  return response.data;
};

/* =========================================================
   ATTENDANCE REPORTS
========================================================= */

/**
 * Get the Councilor school attendance report.
 *
 * Supports:
 * - Date range
 * - Section filter
 * - Adviser filter
 * - Search
 * - Server-side pagination
 * - Request cancellation
 */
const getAttendanceReport = async ({
  from,
  to,
  sectionId = "",
  adviserId = "",
  search = "",
  page = 0,
  size = 9,
  signal,
} = {}) => {
  const response = await api.get("/attendance-reports/sections", {
    params: {
      from: from || undefined,
      to: to || undefined,

      sectionId: sectionId || undefined,

      adviserId: adviserId || undefined,

      search: search || undefined,

      page,
      size,
    },

    signal,
  });

  return response.data;
};

/* =========================================================
   SERVICE EXPORT
========================================================= */

const councilorService = {
  /* Advisers */
  getAdvisers,
  createAdviser,

  /* Sections */
  getSections,
  createSection,

  /* Attendance */
  getAttendanceReport,
};

export default councilorService;
