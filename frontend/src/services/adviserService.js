import api from "./api";

/* =========================================================
   SECTIONS
========================================================= */

/**
 * Returns the sections accessible to the logged-in adviser.
 */
const getSections = async () => {
  const response = await api.get("/sections");

  return response.data;
};

/* =========================================================
   STUDENTS
========================================================= */

/**
 * Returns students accessible to the logged-in adviser.
 */
const getStudents = async () => {
  const response = await api.get("/students");

  return response.data;
};

/**
 * Creates a student inside the Adviser's assigned section.
 */
const createStudent = async ({
  studentNumber,
  name,
  sectionId,
}) => {
  const response = await api.post("/students", {
    studentNumber,
    name,
    sectionId,
  });

  return response.data;
};

/**
 * Updates a student's basic information.
 *
 * Backend:
 *
 * PATCH /api/students/{studentId}
 */
const updateStudent = async (
  studentId,
  {
    studentNumber,
    name,
  },
) => {
  const response = await api.patch(
    `/students/${studentId}`,
    {
      studentNumber,
      name,
    },
  );

  return response.data;
};

/**
 * Deactivates a student.
 *
 * Backend:
 *
 * DELETE /api/students/{studentId}
 *
 * Backend performs a soft delete.
 */
const deleteStudent = async (
  studentId,
) => {
  await api.delete(
    `/students/${studentId}`,
  );
};

/* =========================================================
   STUDENT FACE REGISTRATION
========================================================= */

/**
 * Registers a face image for a student.
 *
 * Backend expects multipart/form-data
 * with a file field named "image".
 *
 * Do not manually set Content-Type.
 */
const registerStudentFace = async (
  studentId,
  imageFile,
) => {
  const formData = new FormData();

  formData.append(
    "image",
    imageFile,
  );

  const response = await api.post(
    `/students/${studentId}/face`,
    formData,
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE SESSION
========================================================= */

/**
 * Returns the active attendance session
 * for a section.
 *
 * A 404 means there is currently no
 * active session.
 */
const getActiveSession = async (
  sectionId,
) => {
  try {
    const response = await api.get(
      `/attendance-sessions/section/${sectionId}/active`,
    );

    return response.data;
  } catch (error) {
    if (
      error?.response?.status === 404
    ) {
      return null;
    }

    throw error;
  }
};

/* =========================================================
   START ATTENDANCE SESSION
========================================================= */

/**
 * Starts an attendance session.
 *
 * NEW API:
 *
 * POST /api/attendance-sessions
 *
 * {
 *   sectionId,
 *   lateAfterMinutes,
 *   scheduledEndTime
 * }
 *
 *
 * scheduledEndTime:
 *
 * "09:00" -> automatic ending
 * null    -> manual ending only
 *
 *
 * BACKWARD COMPATIBILITY:
 *
 * startAttendanceSession(sectionId)
 *
 * still uses the old query-param flow so the
 * current AdviserAttendance page will not break
 * while it is being migrated.
 */
const startAttendanceSession = async (
  configuration,
) => {
  /* =======================================================
     LEGACY CALL

     Example:

     startAttendanceSession(section.id)
  ======================================================= */

  if (
    typeof configuration === "string"
  ) {
    const response = await api.post(
      "/attendance-sessions",
      null,
      {
        params: {
          sectionId: configuration,
        },
      },
    );

    return response.data;
  }

  /* =======================================================
     NEW CONFIGURED SESSION
  ======================================================= */

  const {
    sectionId,
    lateAfterMinutes,
    scheduledEndTime = null,
  } = configuration || {};

  const response = await api.post(
    "/attendance-sessions",
    {
      sectionId,
      lateAfterMinutes,
      scheduledEndTime,
    },
  );

  return response.data;
};

/* =========================================================
   END ATTENDANCE SESSION
========================================================= */

/**
 * Manually ends an active attendance session.
 *
 * Automatic ending is handled by the backend
 * when scheduledEndAt has been configured.
 *
 * Backend:
 *
 * PATCH /api/attendance-sessions/{sessionId}/end
 */
const endAttendanceSession = async (
  sessionId,
) => {
  const response = await api.patch(
    `/attendance-sessions/${sessionId}/end`,
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE HISTORY
========================================================= */

/**
 * Returns completed attendance sessions
 * belonging to the logged-in adviser.
 *
 * Backend:
 *
 * GET /api/attendance-sessions/history
 */
const getAttendanceHistory = async ({
  fromDate,
  toDate,
  page = 0,
  size = 10,
} = {}) => {
  const response = await api.get(
    "/attendance-sessions/history",
    {
      params: {
        fromDate,
        toDate,
        page,
        size,
      },
    },
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE RECORDS
========================================================= */

/**
 * Returns all attendance records
 * for a session.
 *
 * Possible statuses:
 *
 * PRESENT
 * LATE
 * ABSENT
 */
const getSessionRecords = async (
  sessionId,
) => {
  const response = await api.get(
    `/attendance-records/session/${sessionId}`,
  );

  const data = response.data;

  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.records,
    )
  ) {
    return data.records;
  }

  return [];
};

/* =========================================================
   MANUAL ATTENDANCE
========================================================= */

/**
 * Records manual attendance.
 *
 * IMPORTANT:
 *
 * The backend now determines the status:
 *
 * PRESENT -> before late cutoff
 * LATE    -> at/after late cutoff
 *
 * The frontend does NOT choose the status.
 */
const markManualAttendance = async ({
  sessionId,
  studentId,
}) => {
  const response = await api.post(
    "/attendance-records",
    null,
    {
      params: {
        sessionId,
        studentId,
      },
    },
  );

  return response.data;
};

/* =========================================================
   FACE RECOGNITION ATTENDANCE
========================================================= */

/**
 * Performs face recognition attendance.
 *
 * The backend automatically determines:
 *
 * PRESENT
 * or
 * LATE
 */
const markFaceAttendance = async ({
  sessionId,
  imageFile,
}) => {
  const formData = new FormData();

  formData.append(
    "sessionId",
    sessionId,
  );

  formData.append(
    "image",
    imageFile,
  );

  const response = await api.post(
    "/attendance-records/face",
    formData,
  );

  return response.data;
};

/* =========================================================
   REMOVE ATTENDANCE RECORD
========================================================= */

/**
 * Removes a student's attendance record
 * from a specific active session.
 */
const removeAttendance = async ({
  sessionId,
  studentId,
}) => {
  const response = await api.delete(
    "/attendance-records",
    {
      params: {
        sessionId,
        studentId,
      },
    },
  );

  return response.data;
};

/* =========================================================
   ACCOUNT SECURITY
========================================================= */

/**
 * Changes the password of the currently
 * authenticated user.
 */
const changePassword = async ({
  currentPassword,
  newPassword,
}) => {
  const response = await api.patch(
    "/users/me/password",
    {
      currentPassword,
      newPassword,
    },
  );

  return response.data;
};

/* =========================================================
   EXPORT
========================================================= */

const adviserService = {
  /* SECTIONS */

  getSections,

  /* STUDENTS */

  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  registerStudentFace,

  /* ATTENDANCE SESSION */

  getActiveSession,
  startAttendanceSession,
  endAttendanceSession,

  /* ATTENDANCE HISTORY */

  getAttendanceHistory,

  /* ATTENDANCE RECORDS */

  getSessionRecords,
  markManualAttendance,
  markFaceAttendance,
  removeAttendance,

  /* ACCOUNT SECURITY */

  changePassword,
};

export default adviserService;