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
      /*
       * Try the next compatible property name.
       */
    }
  }

  return [];
};

const appendLivenessFrames = (formData, fieldName, frames, filenamePrefix) => {
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
   * Current StudentManagement may use:
   *
   * baselineImages
   * challengeImages
   *
   * Other/newer code may use:
   *
   * baselineFrames
   * challengeFrames
   *
   * Both are supported.
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

      baselineFormDataCount: formData.getAll("baseline_images").length,

      challengeFormDataCount: formData.getAll("challenge_images").length,
    });
  }

  return formData;
};

/* =========================================================
   GENERAL HELPERS
========================================================= */

const normalizeOptionalText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized ? normalized : null;
};

const requireId = (value, message) => {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
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

/* =========================================================
   CREATE STUDENT

   Supports Student + Parent / Guardian creation.
========================================================= */

const createStudent = async ({
  studentNumber,
  name,
  sectionId,
  guardian = null,
}) => {
  const response = await api.post("/students", {
    studentNumber,
    name,
    sectionId,
    guardian,
  });

  return response.data;
};

/* =========================================================
   UPDATE STUDENT

   Supports updating:
   - Student Number
   - Student Name
   - Parent / Guardian
========================================================= */

const updateStudent = async (
  studentId,
  { studentNumber, name, guardian = null },
) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to update a student.",
  );

  const response = await api.patch(`/students/${normalizedStudentId}`, {
    studentNumber,
    name,
    guardian,
  });

  return response.data;
};

/* =========================================================
   DEACTIVATE STUDENT
   SOFT DELETE
========================================================= */

const deleteStudent = async (studentId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to deactivate a student.",
  );

  await api.delete(`/students/${normalizedStudentId}`);
};

/* =========================================================
   REACTIVATE STUDENT
========================================================= */

const reactivateStudent = async (studentId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to reactivate a student.",
  );

  const response = await api.patch(
    `/students/${normalizedStudentId}/reactivate`,
  );

  return response.data;
};

/* =========================================================
   LEGACY DIRECT TRANSFER

   Retained only for compatibility.

   Normal StudentManagement transfer flow now uses:
   createStudentTransferRequest(...)
========================================================= */

const transferStudentSection = async (studentId, sectionId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to transfer a student.",
  );

  const normalizedSectionId = requireId(
    sectionId,
    "Destination section ID is required.",
  );

  const response = await api.patch(`/students/${normalizedStudentId}/section`, {
    sectionId: normalizedSectionId,
  });

  return response.data;
};

/* =========================================================
   STUDENT TRANSFER REQUESTS

   FLOW:

   Source Adviser
        ↓
   Creates transfer request
        ↓
      PENDING
        ↓
   Destination Adviser
        ↓
   APPROVE / REJECT

   Source Adviser may CANCEL while still PENDING.
========================================================= */

/* ---------------------------------------------------------
   ELIGIBLE DESTINATION SECTIONS
--------------------------------------------------------- */

const getEligibleStudentTransferSections = async (studentId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to load transfer destinations.",
  );

  const response = await api.get(
    `/student-transfer-requests/students/${normalizedStudentId}/eligible-sections`,
  );

  return Array.isArray(response.data) ? response.data : [];
};

/* ---------------------------------------------------------
   CREATE TRANSFER REQUEST
--------------------------------------------------------- */

const createStudentTransferRequest = async ({
  studentId,
  destinationSectionId,
  reason = null,
}) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to create a transfer request.",
  );

  const normalizedDestinationSectionId = requireId(
    destinationSectionId,
    "Destination section ID is required to create a transfer request.",
  );

  const response = await api.post(
    "/student-transfer-requests",
    {
      studentId: normalizedStudentId,

      destinationSectionId: normalizedDestinationSectionId,

      reason: normalizeOptionalText(reason),
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

/* ---------------------------------------------------------
   OUTGOING TRANSFER REQUESTS

   Requests created by the currently
   logged-in Adviser.
--------------------------------------------------------- */

const getOutgoingStudentTransferRequests = async () => {
  const response = await api.get("/student-transfer-requests/outgoing");

  return Array.isArray(response.data) ? response.data : [];
};

/* ---------------------------------------------------------
   INCOMING TRANSFER REQUESTS

   Requests where logged-in Adviser controls
   the destination section.
--------------------------------------------------------- */

const getIncomingStudentTransferRequests = async () => {
  const response = await api.get("/student-transfer-requests/incoming");

  return Array.isArray(response.data) ? response.data : [];
};

/* ---------------------------------------------------------
   INCOMING PENDING COUNT

   This is the transfer sidebar badge.

   NOTE:
   This is different from unread notification count.
--------------------------------------------------------- */

const getIncomingPendingTransferCount = async () => {
  const response = await api.get(
    "/student-transfer-requests/incoming/pending-count",
  );

  const data = response.data;

  /*
   * Supports:
   *
   * 3
   *
   * OR
   *
   * {
   *   count: 3
   * }
   *
   * OR
   *
   * {
   *   pendingCount: 3
   * }
   */

  if (typeof data === "number") {
    return Math.max(0, data);
  }

  if (typeof data?.count === "number") {
    return Math.max(0, data.count);
  }

  if (typeof data?.pendingCount === "number") {
    return Math.max(0, data.pendingCount);
  }

  const numeric = Number(data);

  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

/* ---------------------------------------------------------
   APPROVE TRANSFER REQUEST

   Destination Adviser only.

   IMPORTANT:
   Spring expects:

   @RequestBody ReviewStudentTransferRequest

   Therefore this request ALWAYS sends JSON:

   {
     "note": null
   }

   OR

   {
     "note": "Approved..."
   }

   Never send null as the request body because the
   Axios/browser configuration may serialize an empty
   PATCH request with an unsuitable Content-Type.
--------------------------------------------------------- */

const approveStudentTransferRequest = async (requestId, note = null) => {
  const normalizedRequestId = requireId(
    requestId,
    "Transfer request ID is required for approval.",
  );

  const normalizedNote = normalizeOptionalText(note);

  const response = await api.patch(
    `/student-transfer-requests/${normalizedRequestId}/approve`,

    {
      note: normalizedNote,
    },

    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

/* ---------------------------------------------------------
   REJECT TRANSFER REQUEST

   Destination Adviser only.

   Student remains in source section and becomes
   attendance-eligible again.

   IMPORTANT:
   Always send a JSON object, even when note is empty.
--------------------------------------------------------- */

const rejectStudentTransferRequest = async (requestId, note = null) => {
  const normalizedRequestId = requireId(
    requestId,
    "Transfer request ID is required for rejection.",
  );

  const normalizedNote = normalizeOptionalText(note);

  const response = await api.patch(
    `/student-transfer-requests/${normalizedRequestId}/reject`,

    {
      note: normalizedNote,
    },

    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

/* ---------------------------------------------------------
   CANCEL TRANSFER REQUEST

   Source Adviser only.

   Can only cancel while PENDING.

   Cancellation endpoint has no RequestBody, so there is
   no reason to send JSON here.
--------------------------------------------------------- */

const cancelStudentTransferRequest = async (requestId) => {
  const normalizedRequestId = requireId(
    requestId,
    "Transfer request ID is required for cancellation.",
  );

  const response = await api.patch(
    `/student-transfer-requests/${normalizedRequestId}/cancel`,
  );

  return response.data;
};

/* =========================================================
   STUDENT VERIFICATION SETTINGS
========================================================= */

const getStudentVerificationSettings = async (studentId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to load verification settings.",
  );

  const response = await api.get(
    `/students/${normalizedStudentId}/verification-settings`,
  );

  return response.data;
};

const updateStudentVerificationSettings = async (studentId, settings) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to update verification settings.",
  );

  const response = await api.patch(
    `/students/${normalizedStudentId}/verification-settings`,
    settings,
  );

  return response.data;
};

/* =========================================================
   SECURE PASSIVE ENROLLMENT

   Existing Spring liveness challenge URLs remain supported.

   Python treats both multipart groups as one ordered
   passive live-face sequence.
========================================================= */

const createEnrollmentLivenessChallenge = async (studentId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required to create an enrollment liveness challenge.",
  );

  const response = await api.post(
    `/students/${normalizedStudentId}/liveness-challenges/enrollment`,
  );

  return response.data;
};

/* =========================================================
   VERIFY ENROLLMENT LIVENESS
========================================================= */

const verifyEnrollmentLiveness = async ({
  studentId,
  challengeId,

  baselineFrames,
  challengeFrames,

  baselineImages,
  challengeImages,
}) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for liveness verification.",
  );

  const normalizedChallengeId = requireId(
    challengeId,
    "Challenge ID is required for liveness verification.",
  );

  const formData = buildLivenessFormData({
    baselineFrames,
    challengeFrames,

    baselineImages,
    challengeImages,
  });

  /*
   * IMPORTANT:
   *
   * Do NOT manually set:
   *
   * Content-Type: multipart/form-data
   *
   * Browser/Axios must generate the multipart boundary.
   */

  const response = await api.post(
    `/students/${normalizedStudentId}/liveness-challenges/${normalizedChallengeId}/verify`,
    formData,
  );

  return response.data;
};

/* =========================================================
   SECURE FACE-CONFLICT PASSIVE VERIFICATION
========================================================= */

const createFaceConflictLivenessChallenge = async (studentId, conflictId) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for face-conflict liveness verification.",
  );

  const normalizedConflictId = requireId(
    conflictId,
    "Conflict ID is required for face-conflict liveness verification.",
  );

  const response = await api.post(
    `/students/${normalizedStudentId}/liveness-challenges/face-conflicts/${normalizedConflictId}`,
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
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for face-conflict verification.",
  );

  const normalizedConflictId = requireId(
    conflictId,
    "Conflict ID is required for face-conflict verification.",
  );

  const normalizedChallengeId = requireId(
    challengeId,
    "Challenge ID is required for face-conflict verification.",
  );

  const formData = buildLivenessFormData({
    baselineFrames,
    challengeFrames,

    baselineImages,
    challengeImages,
  });

  const response = await api.post(
    `/students/${normalizedStudentId}/liveness-challenges/face-conflicts/${normalizedConflictId}/${normalizedChallengeId}/verify`,
    formData,
  );

  return response.data;
};

/* =========================================================
   LEGACY STUDENT FACE REGISTRATION

   Kept for compatibility.

   StudentManagement normally uses:

   createEnrollmentLivenessChallenge()
   +
   verifyEnrollmentLiveness()
========================================================= */

const registerStudentFace = async (studentId, imageFile) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for face registration.",
  );

  if (!(imageFile instanceof Blob)) {
    throw new Error("A valid face image File or Blob is required.");
  }

  const formData = new FormData();

  formData.append("image", imageFile);

  try {
    const response = await api.post(
      `/students/${normalizedStudentId}/face`,
      formData,
    );

    return response.data;
  } catch (error) {
    const status = error?.response?.status;

    const data = error?.response?.data;

    if (status === 409 && data?.outcome === "FACE_CONFLICT") {
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
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for face-conflict verification.",
  );

  const normalizedConflictId = requireId(
    conflictId,
    "Conflict ID is required for face-conflict verification.",
  );

  if (!(imageFile instanceof Blob)) {
    throw new Error("A valid face image File or Blob is required.");
  }

  const formData = new FormData();

  formData.append("image", imageFile);

  const response = await api.post(
    `/students/${normalizedStudentId}/face-conflicts/${normalizedConflictId}/verify-capture`,
    formData,
  );

  return response.data;
};

/* =========================================================
   STUDENT FACE CONFLICT RESOLUTION
========================================================= */

const resolveStudentFaceConflict = async (studentId, conflictId, decision) => {
  const normalizedStudentId = requireId(
    studentId,
    "Student ID is required for conflict resolution.",
  );

  const normalizedConflictId = requireId(
    conflictId,
    "Conflict ID is required for conflict resolution.",
  );

  const response = await api.post(
    `/students/${normalizedStudentId}/face-conflicts/${normalizedConflictId}/resolve`,
    {
      decision,
    },
  );

  return response.data;
};

/* =========================================================
   ATTENDANCE SESSION
========================================================= */

const getActiveSession = async (sectionId) => {
  const normalizedSectionId = requireId(
    sectionId,
    "Section ID is required to load the active attendance session.",
  );

  try {
    const response = await api.get(
      `/attendance-sessions/section/${normalizedSectionId}/active`,
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

const startAttendanceSession = async (configuration) => {
  /*
   * Legacy:
   *
   * startAttendanceSession(sectionId)
   */

  if (typeof configuration === "string") {
    const normalizedSectionId = requireId(
      configuration,
      "Section ID is required to start attendance.",
    );

    const response = await api.post("/attendance-sessions", null, {
      params: {
        sectionId: normalizedSectionId,
      },
    });

    return response.data;
  }

  /*
   * Configured usage:
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
  } = configuration || {};

  const normalizedSectionId = requireId(
    sectionId,
    "Section ID is required to start attendance.",
  );

  const response = await api.post("/attendance-sessions", {
    sectionId: normalizedSectionId,

    lateAfterMinutes,

    scheduledEndTime,
  });

  return response.data;
};

/* =========================================================
   END ATTENDANCE SESSION
========================================================= */

const endAttendanceSession = async (sessionId) => {
  const normalizedSessionId = requireId(
    sessionId,
    "Attendance session ID is required.",
  );

  const response = await api.patch(
    `/attendance-sessions/${normalizedSessionId}/end`,
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
  const response = await api.get("/attendance-sessions/history", {
    params: {
      fromDate,
      toDate,
      page,
      size,
    },
  });

  return response.data;
};

/* =========================================================
   ATTENDANCE RECORDS
========================================================= */

const getSessionRecords = async (sessionId) => {
  const normalizedSessionId = requireId(
    sessionId,
    "Attendance session ID is required.",
  );

  const response = await api.get(
    `/attendance-records/session/${normalizedSessionId}`,
  );

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

const markManualAttendance = async ({ sessionId, studentId }) => {
  const normalizedSessionId = requireId(
    sessionId,
    "Attendance session ID is required.",
  );

  const normalizedStudentId = requireId(studentId, "Student ID is required.");

  const response = await api.post("/attendance-records", null, {
    params: {
      sessionId: normalizedSessionId,

      studentId: normalizedStudentId,
    },
  });

  return response.data;
};

/* =========================================================
   FACE RECOGNITION ATTENDANCE
========================================================= */

const markFaceAttendance = async ({ sessionId, imageFile }) => {
  const normalizedSessionId = requireId(
    sessionId,
    "Attendance session ID is required.",
  );

  if (!(imageFile instanceof Blob)) {
    throw new Error("A valid face image File or Blob is required.");
  }

  const formData = new FormData();

  formData.append("sessionId", normalizedSessionId);

  formData.append("image", imageFile);

  const response = await api.post("/attendance-records/face", formData);

  return response.data;
};

/* =========================================================
   REMOVE ATTENDANCE RECORD
========================================================= */

const removeAttendance = async ({ sessionId, studentId }) => {
  const normalizedSessionId = requireId(
    sessionId,
    "Attendance session ID is required.",
  );

  const normalizedStudentId = requireId(studentId, "Student ID is required.");

  const response = await api.delete("/attendance-records", {
    params: {
      sessionId: normalizedSessionId,

      studentId: normalizedStudentId,
    },
  });

  return response.data;
};

/* =========================================================
   ATTENDANCE INTERVENTION / STUDENTS AT RISK
========================================================= */

/*
 * Returns the current attendance-risk read model
 * for students in the specified section.
 *
 * The backend determines:
 *
 * - finalized attendance totals
 * - absence count
 * - current risk level
 * - intervention information
 * - guardian availability
 *
 * We intentionally return response.data unchanged
 * so the frontend stays compatible with the exact
 * backend DTO shape.
 */

const getAttendanceRisksBySection = async (sectionId) => {
  const normalizedSectionId = requireId(
    sectionId,
    "Section ID is required to load attendance risks.",
  );

  const response = await api.get(
    `/attendance-risks/sections/${normalizedSectionId}`,
  );

  return response.data;
};

/* =========================================================
   PARENT NOTIFICATION PREVIEW
========================================================= */

/*
 * Loads the frozen-preview information before
 * an Adviser creates/sends a parent notification.
 *
 * This does NOT send an email.
 */

const getParentNotificationPreview = async (interventionId) => {
  const normalizedInterventionId = requireId(
    interventionId,
    "Attendance intervention ID is required to preview a parent notification.",
  );

  const response = await api.get(
    `/attendance-interventions/${normalizedInterventionId}/parent-notification-preview`,
  );

  return response.data;
};

/* =========================================================
   CREATE PARENT NOTIFICATION
========================================================= */

/*
 * Creates the frozen ParentNotification snapshot.
 *
 * This still does NOT send the email.
 *
 * Flow:
 *
 * Intervention
 *      ↓
 * Preview
 *      ↓
 * Create notification snapshot
 *      ↓
 * PENDING
 */

const createParentNotification = async (
  interventionId,
  { adviserNote = null } = {},
) => {
  const normalizedInterventionId = requireId(
    interventionId,
    "Attendance intervention ID is required to create a parent notification.",
  );

  const response = await api.post(
    `/attendance-interventions/${normalizedInterventionId}/parent-notifications`,
    {
      adviserNote: normalizeOptionalText(adviserNote),
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

/* =========================================================
   QUEUE / SEND PARENT NOTIFICATION
========================================================= */

/*
 * Queues an already-created ParentNotification.
 *
 * Important:
 *
 * The backend's outbox worker performs the actual
 * Gmail API send.
 *
 * This endpoint must therefore remain separate from
 * createParentNotification(...).
 *
 * Expected flow:
 *
 * PENDING
 *    ↓
 * queueParentNotification(...)
 *    ↓
 * QUEUED
 *    ↓
 * outbox worker
 *    ↓
 * SENT / FAILED
 */

const queueParentNotification = async (parentNotificationId) => {
  const normalizedNotificationId = requireId(
    parentNotificationId,
    "Parent notification ID is required to queue the notification.",
  );

  const response = await api.post(
    `/parent-notifications/${normalizedNotificationId}/send`,
  );

  return response.data;
};

/* =========================================================
   ACCOUNT SECURITY
========================================================= */

const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.patch("/users/me/password", {
    currentPassword,
    newPassword,
  });

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
  reactivateStudent,

  /*
   * Legacy direct-transfer API.
   * Kept for compatibility only.
   */
  transferStudentSection,

  /* STUDENT TRANSFER REQUESTS */

  getEligibleStudentTransferSections,
  createStudentTransferRequest,

  getOutgoingStudentTransferRequests,
  getIncomingStudentTransferRequests,
  getIncomingPendingTransferCount,

  approveStudentTransferRequest,
  rejectStudentTransferRequest,
  cancelStudentTransferRequest,

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

  /* ATTENDANCE INTERVENTION */

  getAttendanceRisksBySection,
  getParentNotificationPreview,
  createParentNotification,
  queueParentNotification,

  /* ACCOUNT SECURITY */

  changePassword,
};

export default adviserService;
