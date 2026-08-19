import api from "./api";

/* =========================================================
   ADVISERS
========================================================= */

/**
 * Gets all user accounts.
 *
 * AdviserManagement filters the result
 * to ROLE_ADVISER accounts.
 */
const getAdvisers = async () => {
  const response = await api.get(
    "/users",
  );

  return response.data;
};

/**
 * Creates a new adviser account.
 */
const createAdviser = async ({
  name,
  email,
  password,
}) => {
  const response = await api.post(
    "/users/advisers",
    {
      name,
      email,
      password,
    },
  );

  return response.data;
};

/**
 * Updates an existing adviser account.
 *
 * Editable:
 * - name
 * - email
 *
 * Password is managed separately
 * through resetAdviserPassword().
 */
const updateAdviser = async (
  adviserId,
  {
    name,
    email,
  },
) => {
  const response = await api.patch(
    `/users/advisers/${adviserId}`,
    {
      name,
      email,
    },
  );

  return response.data;
};

/**
 * Resets an adviser's password.
 */
const resetAdviserPassword = async (
  adviserId,
  {
    newPassword,
  },
) => {
  const response = await api.patch(
    `/users/advisers/${adviserId}/reset-password`,
    {
      newPassword,
    },
  );

  return response.data;
};

/* =========================================================
   SECTIONS
========================================================= */

/**
 * Gets all sections available
 * to the authenticated user.
 */
const getSections = async () => {
  const response = await api.get(
    "/sections",
  );

  return response.data;
};

/**
 * Creates a new section and assigns
 * an adviser to it.
 */
const createSection = async ({
  name,
  adviserId,
}) => {
  const response = await api.post(
    "/sections",
    {
      name,
      adviserId,
    },
  );

  return response.data;
};

/**
 * Updates an existing section.
 *
 * Section Management only allows
 * the section name to be changed.
 *
 * The existing adviserId is still
 * sent because the backend currently
 * requires it in UpdateSectionRequest.
 *
 * Adviser reassignment is not exposed
 * by the Section Management UI.
 */
const updateSection = async (
  sectionId,
  {
    name,
    adviserId,
  },
) => {
  const response = await api.patch(
    `/sections/${sectionId}`,
    {
      name,
      adviserId,
    },
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE — SECTION OVERVIEW
========================================================= */

/**
 * Gets paginated attendance summaries
 * grouped by section.
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
  const response = await api.get(
    "/attendance-reports/sections",
    {
      params: {
        from:
          from || undefined,

        to:
          to || undefined,

        sectionId:
          sectionId || undefined,

        adviserId:
          adviserId || undefined,

        search:
          search || undefined,

        page,
        size,
      },

      signal,
    },
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE — DETAILED SECTION REPORT
========================================================= */

/**
 * Gets the detailed student attendance
 * report for a specific section.
 */
const getSectionAttendanceReport = async (
  sectionId,
  {
    from,
    to,
    search = "",
    page = 0,
    size = 25,
    signal,
  } = {},
) => {
  const response = await api.get(
    `/attendance-reports/sections/${sectionId}/students`,
    {
      params: {
        from:
          from || undefined,

        to:
          to || undefined,

        search:
          search || undefined,

        page,
        size,
      },

      signal,
    },
  );

  return response.data;
};

/* =========================================================
   SERVICE EXPORT
========================================================= */

const councilorService = {
  /* Advisers */
  getAdvisers,
  createAdviser,
  updateAdviser,
  resetAdviserPassword,

  /* Sections */
  getSections,
  createSection,
  updateSection,

  /* Attendance */
  getAttendanceReport,
  getSectionAttendanceReport,
};

export default councilorService;