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
   ATTENDANCE
========================================================= */

const getAttendanceOverview = async () => {
  const response = await api.get("/attendance-overview");

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
  getAttendanceOverview,
};

export default councilorService;
