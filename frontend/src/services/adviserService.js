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
const createStudent = async ({ studentNumber, name, sectionId }) => {
  const response = await api.post("/students", {
    studentNumber,
    name,
    sectionId,
  });

  return response.data;
};

/* =========================================================
   STUDENT FACE REGISTRATION
========================================================= */

/**
 * Registers a face image for a student.
 *
 * Backend expects multipart/form-data
 * with a file field named "image".
 */
const registerStudentFace = async (studentId, imageFile) => {
  const formData = new FormData();

  formData.append("image", imageFile);

  const response = await api.post(`/students/${studentId}/face`, formData);

  return response.data;
};

/* =========================================================
   ATTENDANCE SESSION
========================================================= */

/**
 * Returns the active attendance session for a section.
 *
 * A 404 means there is currently no active session.
 */
const getActiveSession = async (sectionId) => {
  try {
    const response = await api.get(
      `/attendance-sessions/section/${sectionId}/active`,
    );

    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }

    throw error;
  }
};

/* =========================================================
   START ATTENDANCE SESSION
========================================================= */

/**
 * Starts an attendance session for a section.
 */
const startAttendanceSession = async (sectionId) => {
  const response = await api.post("/attendance-sessions", null, {
    params: {
      sectionId,
    },
  });

  return response.data;
};

/* =========================================================
   END ATTENDANCE SESSION
========================================================= */

/**
 * Ends an active attendance session.
 */
const endAttendanceSession = async (sessionId) => {
  const response = await api.patch(`/attendance-sessions/${sessionId}/end`);

  return response.data;
};

/* =========================================================
   ATTENDANCE RECORDS
========================================================= */

/**
 * Returns all attendance records for a session.
 *
 * Supports either:
 *
 * [
 *   {...}
 * ]
 *
 * or:
 *
 * {
 *   records: [...]
 * }
 */
const getSessionRecords = async (sessionId) => {
  const response = await api.get(`/attendance-records/session/${sessionId}`);

  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  return [];
};

/* =========================================================
   MANUAL ATTENDANCE
========================================================= */

/**
 * Marks a student PRESENT manually.
 *
 * Backend:
 *
 * POST /api/attendance-records
 * ?sessionId={sessionId}
 * &studentId={studentId}
 */
const markManualAttendance = async ({ sessionId, studentId }) => {
  const response = await api.post("/attendance-records", null, {
    params: {
      sessionId,
      studentId,
    },
  });

  return response.data;
};

/* =========================================================
   FACE RECOGNITION ATTENDANCE
========================================================= */

/**
 * Performs face recognition attendance.
 *
 * Backend expects multipart/form-data:
 *
 * sessionId = attendance session id
 * image     = face image
 */
const markFaceAttendance = async ({ sessionId, imageFile }) => {
  const formData = new FormData();

  formData.append("sessionId", sessionId);

  formData.append("image", imageFile);

  const response = await api.post("/attendance-records/face", formData);

  return response.data;
};

/* =========================================================
   REMOVE ATTENDANCE RECORD
========================================================= */

/**
 * Removes a student's attendance record
 * from a specific session.
 *
 * Backend:
 *
 * DELETE /api/attendance-records
 * ?sessionId={sessionId}
 * &studentId={studentId}
 */
const removeAttendance = async ({ sessionId, studentId }) => {
  const response = await api.delete("/attendance-records", {
    params: {
      sessionId,
      studentId,
    },
  });

  return response.data;
};

/* =========================================================
   EXPORT
========================================================= */

const adviserService = {
  /* SECTION */
  getSections,

  /* STUDENTS */
  getStudents,
  createStudent,
  registerStudentFace,

  /* SESSION */
  getActiveSession,
  startAttendanceSession,
  endAttendanceSession,

  /* ATTENDANCE */
  getSessionRecords,
  markManualAttendance,
  markFaceAttendance,
  removeAttendance,
};

export default adviserService;
