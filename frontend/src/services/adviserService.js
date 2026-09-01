import api from "./api";

/* =========================================================
   LIVENESS FRAME HELPERS
========================================================= */

const normalizeLivenessFrames = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate == null) {
      continue;
    }

    if (Array.isArray(candidate)) {
      return candidate;
    }

    try {
      return Array.from(candidate);
    } catch {
      // Try the next compatible property name.
    }
  }

  return [];
};

const appendLivenessFrames = (
  formData,
  fieldName,
  frames,
  filenamePrefix,
) => {
  const normalizedFrames = normalizeLivenessFrames(frames).filter(Boolean);

  if (normalizedFrames.length === 0) {
    throw new Error(
      `Cannot submit liveness verification because "${fieldName}" contains no captured images.`,
    );
  }

  normalizedFrames.forEach((frame, index) => {
    if (!(frame instanceof Blob)) {
      throw new Error(
        `Invalid ${fieldName} frame at index ${index}. Expected an image File or Blob.`,
      );
    }

    const paddedIndex = String(index + 1).padStart(2, "0");

    const isFile =
      typeof File !== "undefined" &&
      frame instanceof File &&
      Boolean(frame.name);

    const filename = isFile
      ? frame.name
      : `${filenamePrefix}_${paddedIndex}.jpg`;

    formData.append(fieldName, frame, filename);
  });

  return normalizedFrames.length;
};

const buildLivenessFormData = ({
  baselineFrames,
  challengeFrames,
  baselineImages,
  challengeImages,
}) => {
  /*
   * Compatibility:
   *
   * Current StudentManagement uses:
   *   baselineImages
   *   challengeImages
   *
   * Other/newer code may use:
   *   baselineFrames
   *   challengeFrames
   *
   * We support BOTH.
   */

  const resolvedBaselineFrames = normalizeLivenessFrames(
    baselineFrames,
    baselineImages,
  );

  const resolvedChallengeFrames = normalizeLivenessFrames(
    challengeFrames,
    challengeImages,
  );

  const formData = new FormData();

  const baselineCount = appendLivenessFrames(
    formData,
    "baseline_images",
    resolvedBaselineFrames,
    "baseline",
  );

  const challengeCount = appendLivenessFrames(
    formData,
    "challenge_images",
    resolvedChallengeFrames,
    "challenge",
  );

  if (import.meta.env?.DEV) {
    console.debug("[LIVENESS] Multipart payload prepared", {
      baselineCount,
      challengeCount,

      baselineFormDataCount:
        formData.getAll("baseline_images").length,

      challengeFormDataCount:
        formData.getAll("challenge_images").length,
    });
  }

  return formData;
};

/* =========================================================
   SECTIONS
========================================================= */

const getSections = async () => {
  const response = await api.get("/sections");

  return response.data;
};

/* =========================================================
   STUDENTS
========================================================= */

const getStudents = async () => {
  const response = await api.get("/students");

  return response.data;
};

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

const deleteStudent = async (studentId) => {
  await api.delete(
    `/students/${studentId}`,
  );
};

/* =========================================================
   STUDENT VERIFICATION SETTINGS
========================================================= */

const getStudentVerificationSettings = async (
  studentId,
) => {
  const response = await api.get(
    `/students/${studentId}/verification-settings`,
  );

  return response.data;
};

const updateStudentVerificationSettings = async (
  studentId,
  settings,
) => {
  const response = await api.patch(
    `/students/${studentId}/verification-settings`,
    settings,
  );

  return response.data;
};

/* =========================================================
   SECURE ENROLLMENT LIVENESS
========================================================= */

const createEnrollmentLivenessChallenge = async (
  studentId,
) => {
  const response = await api.post(
    `/students/${studentId}/liveness-challenges/enrollment`,
  );

  return response.data;
};

/**
 * Supports BOTH:
 *
 * baselineImages / challengeImages
 *
 * and
 *
 * baselineFrames / challengeFrames
 *
 * This prevents frontend version mismatches.
 */
const verifyEnrollmentLiveness = async ({
  studentId,
  challengeId,

  baselineFrames,
  challengeFrames,

  baselineImages,
  challengeImages,
}) => {
  if (!studentId) {
    throw new Error(
      "Student ID is required for liveness verification.",
    );
  }

  if (!challengeId) {
    throw new Error(
      "Challenge ID is required for liveness verification.",
    );
  }

  const formData = buildLivenessFormData({
    baselineFrames,
    challengeFrames,

    baselineImages,
    challengeImages,
  });

  /*
   * DO NOT manually set:
   *
   * Content-Type: multipart/form-data
   *
   * Browser/Axios must create the multipart boundary.
   */
  const response = await api.post(
    `/students/${studentId}/liveness-challenges/${challengeId}/verify`,
    formData,
  );

  return response.data;
};

/* =========================================================
   SECURE FACE-CONFLICT LIVENESS
========================================================= */

const createFaceConflictLivenessChallenge = async (
  studentId,
  conflictId,
) => {
  const response = await api.post(
    `/students/${studentId}/liveness-challenges/face-conflicts/${conflictId}`,
  );

  return response.data;
};

const verifyFaceConflictLiveness = async ({
  studentId,
  conflictId,
  challengeId,

  baselineFrames,
  challengeFrames,

  baselineImages,
  challengeImages,
}) => {
  if (!studentId) {
    throw new Error(
      "Student ID is required for face-conflict verification.",
    );
  }

  if (!conflictId) {
    throw new Error(
      "Conflict ID is required for face-conflict verification.",
    );
  }

  if (!challengeId) {
    throw new Error(
      "Challenge ID is required for face-conflict verification.",
    );
  }

  const formData = buildLivenessFormData({
    baselineFrames,
    challengeFrames,

    baselineImages,
    challengeImages,
  });

  const response = await api.post(
    `/students/${studentId}/liveness-challenges/face-conflicts/${conflictId}/${challengeId}/verify`,
    formData,
  );

  return response.data;
};

/* =========================================================
   LEGACY STUDENT FACE REGISTRATION
========================================================= */

/**
 * Retained for compatibility with other frontend pages.
 *
 * New StudentManagement liveness enrollment should normally
 * use createEnrollmentLivenessChallenge +
 * verifyEnrollmentLiveness.
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

    if (
      status === 409 &&
      data?.outcome === "FACE_CONFLICT"
    ) {
      return data;
    }

    throw error;
  }
};

/* =========================================================
   LEGACY FACE-CONFLICT CAPTURE
========================================================= */

const verifyStudentFaceConflictCapture = async (
  studentId,
  conflictId,
  imageFile,
) => {
  const formData =
    new FormData();

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

const startAttendanceSession = async (
  configuration,
) => {
  /*
   * Legacy usage:
   *
   * startAttendanceSession(sectionId)
   */
  if (
    typeof configuration === "string"
  ) {
    const response = await api.post(
      "/attendance-sessions",
      null,
      {
        params: {
          sectionId:
            configuration,
        },
      },
    );

    return response.data;
  }

  /*
   * New configured session:
   *
   * {
   *   sectionId,
   *   lateAfterMinutes,
   *   scheduledEndTime
   * }
   */

  const {
    sectionId,
    lateAfterMinutes,
    scheduledEndTime = null,
  } =
    configuration || {};

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

const getSessionRecords = async (
  sessionId,
) => {
  const response = await api.get(
    `/attendance-records/session/${sessionId}`,
  );

  const data =
    response.data;

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

const markFaceAttendance = async ({
  sessionId,
  imageFile,
}) => {
  const formData =
    new FormData();

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

  /* VERIFICATION SETTINGS */

  getStudentVerificationSettings,
  updateStudentVerificationSettings,

  /* SECURE FACE ENROLLMENT */

  createEnrollmentLivenessChallenge,
  verifyEnrollmentLiveness,

  /* SECURE FACE-CONFLICT VERIFICATION */

  createFaceConflictLivenessChallenge,
  verifyFaceConflictLiveness,

  /* LEGACY FACE PATHS */

  registerStudentFace,
  verifyStudentFaceConflictCapture,

  /* FACE-CONFLICT RESOLUTION */

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