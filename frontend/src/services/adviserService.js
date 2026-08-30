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
 * Registers or updates a face image for a student.
 *
 * Backend expects multipart/form-data
 * with a file field named "image".
 *
 * Do not manually set Content-Type.
 *
 * POSSIBLE SUCCESSFUL BUSINESS OUTCOMES:
 *
 * ENROLLED
 * -> HTTP 200
 * -> face was saved successfully
 *
 * FACE_CONFLICT
 * -> HTTP 409
 * -> a highly similar enrolled face was detected
 * -> face was NOT saved
 *
 * FACE_CONFLICT is intentionally returned to the UI
 * instead of being treated as a generic Axios failure.
 *
 * Other 4xx/5xx errors are still thrown normally.
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

  try {
    const response = await api.post(
      `/students/${studentId}/face`,
      formData,
    );

    return response.data;
  } catch (error) {
    const status =
      error?.response?.status;

    const data =
      error?.response?.data;

    /* =======================================================
       EXPECTED FACE-CONFLICT OUTCOME

       Backend intentionally returns HTTP 409 when another
       globally enrolled face is unusually similar.

       This is NOT converted into a normal JavaScript error
       because the enrollment UI needs the conflict details.
    ======================================================= */

    if (
      status === 409 &&
      data?.outcome === "FACE_CONFLICT"
    ) {
      return data;
    }

    /* =======================================================
       REAL API ERROR

       Examples:
       - 400 invalid image
       - 401 unauthenticated
       - 403 wrong Adviser
       - 404 student missing
       - 500 backend error
    ======================================================= */

    throw error;
  }
};

/* =========================================================
   STUDENT FACE CONFLICT VERIFICATION
========================================================= */

/**
 * Performs the required second face capture for a
 * persisted face conflict.
 *
 * Backend:
 *
 * POST
 * /api/students/{studentId}/face-conflicts/{conflictId}/verify-capture
 *
 * multipart/form-data:
 * image = File
 *
 * Possible outcomes:
 *
 * MANUAL_REVIEW_REQUIRED
 * -> the same conflict was reproduced
 * -> a human decision is now required
 *
 * CONFLICT_NOT_REPRODUCED
 * -> the second capture did not reproduce the original conflict
 * -> retry normal face enrollment with a fresh capture
 *
 * VERIFIED_DIFFERENT_PEOPLE
 * CONFIRMED_SAME_PERSON
 * -> the conflict had already been resolved previously
 *
 * Do not manually set Content-Type. Axios/browser will add
 * the multipart boundary.
 */
const verifyStudentFaceConflictCapture = async (
  studentId,
  conflictId,
  imageFile,
) => {
  const formData = new FormData();

  formData.append(
    "image",
    imageFile,
  );

  const response = await api.post(
    `/students/${studentId}/face-conflicts/${conflictId}/verify-capture`,
    formData,
  );

  return response.data;
};

/* =========================================================
   STUDENT FACE CONFLICT RESOLUTION
========================================================= */

/**
 * Performs the final human identity decision after
 * second-capture verification.
 *
 * decision:
 *
 * DIFFERENT_PEOPLE
 * SAME_PERSON
 *
 * Backend:
 *
 * POST
 * /api/students/{studentId}/face-conflicts/{conflictId}/resolve
 */
const resolveStudentFaceConflict = async (
  studentId,
  conflictId,
  decision,
) => {
  const response = await api.post(
    `/students/${studentId}/face-conflicts/${conflictId}/resolve`,
    {
      decision,
    },
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
  verifyStudentFaceConflictCapture,
  resolveStudentFaceConflict,

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