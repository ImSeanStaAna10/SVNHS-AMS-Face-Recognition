import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";
import speechService from "../../services/speechService";

import {
  useActiveAttendanceSession,
  useAttendanceSessionRecords,
} from "../../hooks/queries/useAttendanceQueries";
import {
  useAdviserSections,
  useAdviserStudents,
} from "../../hooks/queries/useStudentsQueries";

import queryKeys from "../../lib/query/queryKeys";
import faceReadiness from "../../utils/FaceReadiness";
import {
  captureFrameBurst,
  waitForVideoReady,
} from "../../utils/livenessCapture";

import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/adviser/attendanceSession.css";
import "../../styles/adviser/attendanceSessionVoice.css";

const PH_TIME_ZONE = "Asia/Manila";

/*
 * Auto Capture UX timing.
 *
 * The student gets a short positioning period first, then a REAL
 * five-second countdown: 5 → 4 → 3 → 2 → 1 → capture.
 */
const AUTO_ALIGN_DELAY = 500;
const AUTO_COUNTDOWN_SECONDS = 5;
const AUTO_COUNTDOWN_STEP = 1000;

/*
 * Results stay visible long enough to be readable without making
 * Auto Capture feel slow. The camera stream itself stays alive.
 */
const RESULT_HOLD_SUCCESS = 2800;

/*
 * Failed recognition information stays visible for 10 seconds,
 * then the scanner becomes ready again. The camera is NOT
 * automatically started if it is currently off.
 */
const RESULT_HOLD_ERROR = 10000;

/*
 * Ambiguous / conflict information stays visible for 10 seconds.
 * If the adviser does not act, the conflict card clears and the
 * camera remains off until the adviser explicitly enables it again.
 */
const RESULT_HOLD_CONFLICT = 10000;

/*
 * Duplicate attendance information also stays visible long enough
 * for the student name and previous attendance details to be read.
 */
const RESULT_HOLD_ALREADY_RECORDED = 10000;

/*
 * Current attendance backend still accepts one image at:
 * POST /api/attendance-records/face
 *
 * We reuse livenessCapture.js only as a fast 3-frame stability burst,
 * then submit the final frame to the EXISTING endpoint. This improves
 * blur resistance without inventing an attendance-liveness backend API.
 */
const ATTENDANCE_CAPTURE_FRAME_COUNT = 3;
const ATTENDANCE_CAPTURE_INTERVAL_MS = 90;

/*
 * Lightweight face-presence monitor for Auto Capture.
 *
 * IMPORTANT:
 * This is NOT a strict camera-readiness gate.
 * We only use MediaPipe to answer one question:
 *
 *   "Is exactly one face visible?"
 *
 * Centering, lighting, stability, frontal score, and readiness
 * percentage do NOT block Auto Capture on this page.
 */
const FACE_MONITOR_INTERVAL_MS = 220;

const normalizeArray = (data) => (Array.isArray(data) ? data : []);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  fallbackMessage;

const getCameraAccessErrorMessage = (error) => {
  const name = String(error?.name || "").trim();

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was blocked. Allow camera permission for this site, then try again.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No usable camera was detected. Connect or enable a camera, then try again.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera could not be opened. It may already be in use by another application or browser tab.";
  }

  if (
    name === "OverconstrainedError" ||
    name === "ConstraintNotSatisfiedError"
  ) {
    return "The camera could not use the requested video settings. Try another camera or reload the page.";
  }

  if (name === "SecurityError") {
    return "Camera access is blocked by the browser's security settings.";
  }

  if (name === "AbortError") {
    return "Camera startup was interrupted. Please try again.";
  }

  return getErrorMessage(
    error,
    "Unable to start the camera. Check the camera connection and try again.",
  );
};

const getRecognitionErrorPresentation = (error) => {
  const status = error?.response?.status;
  const serverMessage = getErrorMessage(error, "").trim();
  const normalizedMessage = serverMessage.toLowerCase();

  if (!error?.response) {
    return {
      title: "Connection Problem",
      message:
        "The attendance service could not be reached. Check the connection and try again. Your attendance session is still open.",
      type: "error",
      voice: "Connection problem. Please try again.",
    };
  }

  if (
    normalizedMessage.includes("multiple face") ||
    normalizedMessage.includes("more than one face")
  ) {
    return {
      title: "Multiple Faces Detected",
      message: "Keep only one student inside the camera frame, then try again.",
      type: "error",
      voice: "Multiple faces detected. Keep only one student in the camera.",
    };
  }

  if (
    normalizedMessage.includes("no face") ||
    normalizedMessage.includes("face not detected")
  ) {
    return {
      title: "No Face Detected",
      message:
        "Move closer and keep the student's full face clearly inside the guide.",
      type: "error",
      voice: "No face detected. Move closer and try again.",
    };
  }

  if (normalizedMessage.includes("blur")) {
    return {
      title: "Image Too Blurry",
      message:
        "Hold still for a moment and keep the student's face centered before capture.",
      type: "error",
      voice: "The image is blurry. Hold still and try again.",
    };
  }

  if (
    normalizedMessage.includes("lighting") ||
    normalizedMessage.includes("too dark") ||
    normalizedMessage.includes("low light")
  ) {
    return {
      title: "Improve Lighting",
      message:
        "Make sure the student's face is evenly lit and clearly visible to the camera.",
      type: "error",
      voice: "Please improve the lighting and try again.",
    };
  }

  if (status === 409) {
    return {
      title: "Already Recorded",
      message:
        "This student already has an attendance record for this session.",
      type: "warning",
      voice: "Attendance already recorded.",
    };
  }

  if (status === 403) {
    return {
      title: "Wrong Section",
      message: "The recognized student does not belong to this section.",
      type: "error",
      voice: "This student belongs to another section.",
    };
  }

  if (
    status === 422 ||
    (status === 401 && normalizedMessage.includes("face not recognized"))
  ) {
    return {
      title: "Face Not Recognized",
      message:
        "No registered student matched the captured face. Reposition the student and try again.",
      type: "error",
      voice: "Face not recognized. Please try again.",
    };
  }

  if (status === 429) {
    return {
      title: "Scanner Busy",
      message:
        "Too many recognition requests were received. Wait a moment and try again.",
      type: "warning",
      voice: "Scanner busy. Please wait and try again.",
    };
  }

  if ([500, 502, 503, 504].includes(status)) {
    return {
      title: "Recognition Service Unavailable",
      message:
        "The recognition service is temporarily unavailable. The camera remains ready, so you can try again without leaving the session.",
      type: "error",
      voice:
        "Recognition service is temporarily unavailable. Please try again.",
    };
  }

  if (status === 400) {
    return {
      title: "Unable to Read Face",
      message:
        serverMessage ||
        "The captured image could not be processed. Reposition the student and try again.",
      type: "error",
      voice: "Unable to read the face. Please try again.",
    };
  }

  return {
    title: "Recognition Failed",
    message:
      serverMessage ||
      "Unable to process the face attendance request. You can retry without leaving this session.",
    type: "error",
    voice: "Face recognition failed. Please try again.",
  };
};

/*
 * Resolve the recognized student's identity behind an
 * "already recorded" response.
 *
 * Best case:
 * The backend returns studentId / studentName / studentNumber
 * in the 409 response payload.
 *
 * Safe fallbacks:
 * - nested student / attendanceRecord fields;
 * - exact student number contained in the backend message;
 * - exact roster name contained in the backend message.
 *
 * IMPORTANT:
 * The frontend never guesses an identity from unrelated records.
 */
const resolveAlreadyRecordedIdentity = ({
  responseData,
  responseMessage,
  records,
  students,
}) => {
  const directStudentId =
    responseData?.studentId ||
    responseData?.student?.id ||
    responseData?.attendanceRecord?.studentId ||
    responseData?.attendanceRecord?.student?.id ||
    responseData?.topCandidate?.studentId ||
    "";

  const directStudentName =
    responseData?.studentName ||
    responseData?.student?.name ||
    responseData?.attendanceRecord?.studentName ||
    responseData?.attendanceRecord?.student?.name ||
    responseData?.topCandidate?.studentName ||
    "";

  const directStudentNumber =
    responseData?.studentNumber ||
    responseData?.student?.studentNumber ||
    responseData?.attendanceRecord?.studentNumber ||
    responseData?.attendanceRecord?.student?.studentNumber ||
    responseData?.topCandidate?.studentNumber ||
    "";

  let student =
    students.find(
      (item) => directStudentId && String(item?.id) === String(directStudentId),
    ) ||
    students.find(
      (item) =>
        directStudentNumber &&
        String(item?.studentNumber || "") === String(directStudentNumber),
    ) ||
    students.find(
      (item) =>
        directStudentName &&
        String(item?.name || "")
          .trim()
          .toLowerCase() === String(directStudentName).trim().toLowerCase(),
    ) ||
    null;

  if (!student && responseMessage) {
    const lowerMessage = String(responseMessage).toLowerCase();

    student =
      students.find((item) => {
        const studentNumber = String(item?.studentNumber || "").trim();

        return (
          studentNumber && lowerMessage.includes(studentNumber.toLowerCase())
        );
      }) ||
      students.find((item) => {
        const name = String(item?.name || "")
          .trim()
          .toLowerCase();

        return name.length >= 3 && lowerMessage.includes(name);
      }) ||
      null;
  }

  const studentId = directStudentId || student?.id || "";

  const record =
    records.find(
      (item) =>
        studentId && String(getRecordStudentId(item)) === String(studentId),
    ) ||
    records.find(
      (item) =>
        directStudentNumber &&
        String(getRecordStudentNumber(item)) === String(directStudentNumber),
    ) ||
    records.find(
      (item) =>
        directStudentName &&
        String(getRecordStudentName(item)).trim().toLowerCase() ===
          String(directStudentName).trim().toLowerCase(),
    ) ||
    null;

  return {
    student,
    record,
    studentId: studentId || getRecordStudentId(record),

    studentName:
      directStudentName || student?.name || getRecordStudentName(record) || "",

    studentNumber:
      directStudentNumber ||
      student?.studentNumber ||
      getRecordStudentNumber(record) ||
      "",
  };
};

const getFaceSimilarityPercent = (distance) => {
  const value = Number(distance);
  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, (1 - value) * 100))
    : null;
};

const formatFaceSimilarityPercent = (distance) => {
  const value = getFaceSimilarityPercent(distance);
  return value === null ? "—" : `${value.toFixed(1)}%`;
};

const formatSimilarityDifference = (distanceGap) => {
  const value = Number(distanceGap);
  return Number.isFinite(value)
    ? `${Math.abs(value * 100).toFixed(1)} pts`
    : "—";
};

const getSessionId = (session) => session?.sessionId || session?.id || "";
const getRecordStudentId = (record) =>
  record?.studentId || record?.student?.id || "";
const getRecordStudentName = (record) =>
  record?.studentName || record?.student?.name || "";
const getRecordStudentNumber = (record) =>
  record?.studentNumber || record?.student?.studentNumber || "";
const getRecordTime = (record) =>
  record?.recordedAt || record?.createdAt || record?.timestamp || "";
const getRecordMethod = (record) =>
  record?.method || record?.attendanceMethod || record?.source || "";
const getRecordStatus = (record) =>
  String(record?.status || "")
    .trim()
    .toUpperCase() || "PRESENT";
const isPresentRecord = (record) => getRecordStatus(record) === "PRESENT";
const isLateRecord = (record) => getRecordStatus(record) === "LATE";
const isAttendedRecord = (record) =>
  ["PRESENT", "LATE"].includes(getRecordStatus(record));

const getAttendanceStatusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PRESENT") return "Present";
  if (value === "LATE") return "Late";
  if (value === "ABSENT") return "Absent";
  return "Pending";
};

const getAttendanceStatusClass = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PRESENT") return "is-present";
  if (value === "LATE") return "is-late";
  if (value === "ABSENT") return "is-absent";
  return "is-pending";
};

const toSchoolDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) {
      const parsed = new Date(`${raw.replace(" ", "T")}+08:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getStudentSectionId = (student) =>
  student?.sectionId || student?.section?.id || "";
const twoDigits = (value) => String(value).padStart(2, "0");

const toTwelveHourTime = (
  hourValue,
  minuteValue,
  secondValue,
  includeSeconds = true,
) => {
  const hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  const seconds = includeSeconds ? `:${twoDigits(secondValue || 0)}` : "";
  return `${normalizedHour}:${twoDigits(minuteValue)}${seconds} ${period}`;
};

const formatSchoolTime = (value, includeSeconds = true) => {
  if (!value) return "—";

  if (typeof value === "string") {
    const raw = value.trim();
    if (
      raw.length >= 16 &&
      raw[4] === "-" &&
      raw[7] === "-" &&
      (raw[10] === "T" || raw[10] === " ")
    ) {
      return toTwelveHourTime(
        raw.slice(11, 13),
        raw.slice(14, 16),
        raw.length >= 19 ? raw.slice(17, 19) : "00",
        includeSeconds,
      );
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(date);
};

const formatSchoolDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);

function AttendanceSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = authService.getUser();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoTimerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const captureRunRef = useRef(0);

  /*
   * Tracks whether the camera SHOULD be running.
   *
   * This keeps Auto Capture continuous while also respecting an
   * explicit Turn Camera Off action from the adviser.
   */
  const cameraRequestedRef = useRef(false);

  const filterMenuRef = useRef(null);
  const voiceCooldownRef = useRef({ key: "", time: 0 });
  const faceMonitorBusyRef = useRef(false);

  /*
   * Shared TanStack Query server state.
   *
   * Sections and students reuse the same adviser cache used by
   * Student Management and Dashboard. Active-session and session-record
   * queries deliberately keep the live cache policy.
   *
   * Face recognition responses themselves are NOT cached. Mutations
   * still go directly to the existing adviserService endpoints, then
   * refresh the shared live session-record query.
   */
  const sectionsQuery = useAdviserSections();
  const studentsQuery = useAdviserStudents();

  const section = useMemo(() => {
    const sections = normalizeArray(sectionsQuery.data);

    return (
      sections.find((item) => item?.active !== false) || sections[0] || null
    );
  }, [sectionsQuery.data]);

  const students = useMemo(() => {
    const allStudents = normalizeArray(studentsQuery.data);

    if (!section?.id) return allStudents;

    return allStudents.filter((student) => {
      const studentSectionId = getStudentSectionId(student);
      return (
        !studentSectionId || String(studentSectionId) === String(section.id)
      );
    });
  }, [studentsQuery.data, section?.id]);

  const activeSessionQuery = useActiveAttendanceSession(section?.id);
  const sessionRecordsQuery = useAttendanceSessionRecords(sessionId);

  const activeSession = activeSessionQuery.data || null;
  const sessionRecords = normalizeArray(sessionRecordsQuery.data);
  const refetchSessionRecords = sessionRecordsQuery.refetch;

  const [localPageError, setLocalPageError] = useState("");

  const loading =
    sectionsQuery.isLoading ||
    studentsQuery.isLoading ||
    sessionRecordsQuery.isLoading ||
    (Boolean(section?.id) && activeSessionQuery.isLoading);

  const queryError =
    (sectionsQuery.data == null && sectionsQuery.error) ||
    (studentsQuery.data == null && studentsQuery.error) ||
    (sessionRecordsQuery.data == null && sessionRecordsQuery.error) ||
    (section?.id &&
      activeSessionQuery.data === undefined &&
      activeSessionQuery.error) ||
    null;

  const sessionStateError = !sessionId
    ? "Attendance session ID is missing."
    : !loading && sectionsQuery.isSuccess && !section?.id
      ? "No assigned section is available."
      : !loading &&
          section?.id &&
          activeSessionQuery.isSuccess &&
          (!activeSession ||
            String(getSessionId(activeSession)) !== String(sessionId))
        ? "This attendance session is no longer active."
        : "";

  const pageError =
    localPageError ||
    sessionStateError ||
    (queryError
      ? getErrorMessage(queryError, "Unable to load attendance session.")
      : "");
  const [liveClock, setLiveClock] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("ALL");
  const [attendanceMethodFilter, setAttendanceMethodFilter] = useState("ALL");
  const [attendanceSort, setAttendanceSort] = useState("DEFAULT");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(() =>
    speechService.getEnabled(),
  );
  const voiceSupported = speechService.isSupported();

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scannerState, setScannerState] = useState("idle");
  const [countdown, setCountdown] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [cameraHoldReason, setCameraHoldReason] = useState("");
  const [captureProgress, setCaptureProgress] = useState(0);

  /*
   * Lightweight face-presence state for Auto Capture.
   *
   * faceCount === 1  -> countdown may start
   * faceCount === 0  -> wait silently
   * faceCount > 1    -> wait for only one student
   */
  const [faceDetectorStatus, setFaceDetectorStatus] = useState("idle");
  const [detectedFaceCount, setDetectedFaceCount] = useState(0);
  const [autoRequireNewFace, setAutoRequireNewFace] = useState(false);

  const faceDetectorReady = faceDetectorStatus === "ready";

  const [markingStudentId, setMarkingStudentId] = useState("");
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualError, setManualError] = useState("");
  const [ambiguousActionError, setAmbiguousActionError] = useState("");

  const [showEndModal, setShowEndModal] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState("");

  const speakGuidance = useCallback(
    (key, text, { cooldownMs = 2500, interrupt = true } = {}) => {
      if (!voiceEnabled || !voiceSupported) return false;

      const now = Date.now();
      if (
        voiceCooldownRef.current.key === key &&
        now - voiceCooldownRef.current.time < cooldownMs
      ) {
        return false;
      }

      voiceCooldownRef.current = { key, time: now };
      return speechService.speak(text, { interrupt });
    },
    [voiceEnabled, voiceSupported],
  );

  const toggleVoice = useCallback(() => {
    if (!voiceSupported) return;
    const next = !voiceEnabled;
    speechService.setEnabled(next);
    setVoiceEnabled(next);
    if (next)
      window.setTimeout(
        () => speechService.speak("Voice guidance enabled."),
        0,
      );
  }, [voiceEnabled, voiceSupported]);

  /*
   * Initial server loading is handled by the shared query hooks above.
   * No page-local duplicate sections / students / records request is needed.
   */

  useEffect(() => {
    const interval = window.setInterval(() => setLiveClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeStudents = useMemo(
    () => students.filter((student) => student.active !== false),
    [students],
  );
  const presentRecords = useMemo(
    () => sessionRecords.filter(isPresentRecord),
    [sessionRecords],
  );
  const lateRecords = useMemo(
    () => sessionRecords.filter(isLateRecord),
    [sessionRecords],
  );
  const attendedRecords = useMemo(
    () => sessionRecords.filter(isAttendedRecord),
    [sessionRecords],
  );

  const attendedStudentIds = useMemo(() => {
    const ids = new Set();
    attendedRecords.forEach((record) => {
      const id = getRecordStudentId(record);
      if (id) ids.add(String(id));
    });
    return ids;
  }, [attendedRecords]);

  const presentCount = presentRecords.length;
  const lateCount = lateRecords.length;
  const attendedCount = attendedStudentIds.size || attendedRecords.length;
  const remainingCount = Math.max(activeStudents.length - attendedCount, 0);
  const completionPercentage = activeStudents.length
    ? Math.min(100, Math.round((attendedCount / activeStudents.length) * 100))
    : 0;

  const sectionName = section?.name || "Assigned Section";
  const adviserName =
    user?.name?.trim() || section?.adviserName || "Class Adviser";
  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    "";
  const sessionLateAfterMinutes = activeSession?.lateAfterMinutes ?? null;
  const sessionLateCutoffAt = activeSession?.lateCutoffAt || "";
  const sessionScheduledEndAt = activeSession?.scheduledEndAt || "";
  const scheduledEndDate = toSchoolDate(sessionScheduledEndAt);
  const scheduledEndReached = Boolean(
    scheduledEndDate && liveClock.getTime() >= scheduledEndDate.getTime(),
  );
  const sessionIsActive = Boolean(
    activeSession &&
    String(getSessionId(activeSession)) === String(sessionId) &&
    !scheduledEndReached,
  );

  const cameraPausedForReview = cameraHoldReason === "AMBIGUOUS";
  const cameraPausedAfterReview = cameraHoldReason === "MANUAL_RESULT";
  const cameraIsHeld = cameraPausedForReview || cameraPausedAfterReview;

  const attendanceRows = useMemo(
    () =>
      activeStudents.map((student, originalIndex) => {
        const record = sessionRecords.find(
          (item) => String(getRecordStudentId(item)) === String(student.id),
        );
        const status = record ? getRecordStatus(record) : "PENDING";
        return {
          student,
          record,
          status,
          attended: record ? isAttendedRecord(record) : false,
          originalIndex,
        };
      }),
    [activeStudents, sessionRecords],
  );

  const filteredStudentRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = attendanceRows.filter(({ student, record, status }) => {
      const name = String(student?.name || "").toLowerCase();
      const number = String(student?.studentNumber || "").toLowerCase();
      const method = String(getRecordMethod(record) || "").toUpperCase();
      const matchesSearch =
        !query || name.includes(query) || number.includes(query);
      const matchesStatus =
        attendanceStatusFilter === "ALL" || attendanceStatusFilter === status;
      const matchesMethod =
        attendanceMethodFilter === "ALL" ||
        (attendanceMethodFilter === "FACE" && method.includes("FACE")) ||
        (attendanceMethodFilter === "MANUAL" && method.includes("MANUAL"));
      return matchesSearch && matchesStatus && matchesMethod;
    });

    return [...rows].sort((left, right) => {
      if (attendanceSort === "NAME_ASC") {
        return String(left.student?.name || "").localeCompare(
          String(right.student?.name || ""),
          "en",
          { sensitivity: "base" },
        );
      }
      if (attendanceSort === "NAME_DESC") {
        return String(right.student?.name || "").localeCompare(
          String(left.student?.name || ""),
          "en",
          { sensitivity: "base" },
        );
      }
      if (attendanceSort === "NUMBER_ASC") {
        return String(left.student?.studentNumber || "").localeCompare(
          String(right.student?.studentNumber || ""),
          "en",
          { numeric: true, sensitivity: "base" },
        );
      }
      if (attendanceSort === "RECENT") {
        const leftTime = left.record
          ? toSchoolDate(getRecordTime(left.record))
          : null;
        const rightTime = right.record
          ? toSchoolDate(getRecordTime(right.record))
          : null;
        const leftValue =
          leftTime && !Number.isNaN(leftTime.getTime())
            ? leftTime.getTime()
            : -Infinity;
        const rightValue =
          rightTime && !Number.isNaN(rightTime.getTime())
            ? rightTime.getTime()
            : -Infinity;
        return rightValue - leftValue;
      }
      return left.originalIndex - right.originalIndex;
    });
  }, [
    attendanceRows,
    searchQuery,
    attendanceStatusFilter,
    attendanceMethodFilter,
    attendanceSort,
  ]);

  const totalFilteredStudents = filteredStudentRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalFilteredStudents / Math.max(pageSize, 1)),
  );
  const paginatedStudentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStudentRows.slice(startIndex, startIndex + pageSize);
  }, [filteredStudentRows, currentPage, pageSize]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    const items = [1];
    if (currentPage > 4) items.push("left-ellipsis");
    for (
      let page = Math.max(2, currentPage - 1);
      page <= Math.min(totalPages - 1, currentPage + 1);
      page += 1
    ) {
      items.push(page);
    }
    if (currentPage < totalPages - 3) items.push("right-ellipsis");
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const visibleStart = totalFilteredStudents
    ? (currentPage - 1) * pageSize + 1
    : 0;
  const visibleEnd = Math.min(currentPage * pageSize, totalFilteredStudents);
  const filterMenuActiveCount = [
    attendanceStatusFilter !== "ALL",
    attendanceMethodFilter !== "ALL",
    attendanceSort !== "DEFAULT",
    pageSize !== 10,
  ].filter(Boolean).length;
  const filtersAreActive = Boolean(
    searchQuery.trim() || filterMenuActiveCount > 0,
  );

  const resetAttendanceView = useCallback(() => {
    setSearchQuery("");
    setAttendanceStatusFilter("ALL");
    setAttendanceMethodFilter("ALL");
    setAttendanceSort("DEFAULT");
    setPageSize(10);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    attendanceStatusFilter,
    attendanceMethodFilter,
    attendanceSort,
    pageSize,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target)
      ) {
        setFilterMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterMenuOpen]);

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const clearResultTimer = useCallback(() => {
    if (resultTimerRef.current) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  }, []);

  const refreshRecords = useCallback(async () => {
    if (!sessionId) return [];

    const refreshedResult = await refetchSessionRecords();

    if (refreshedResult.isError) {
      throw (
        refreshedResult.error ||
        new Error("Unable to refresh attendance records.")
      );
    }

    return normalizeArray(refreshedResult.data);
  }, [sessionId, refetchSessionRecords]);

  const releaseCamera = useCallback(() => {
    captureRunRef.current += 1;
    clearAutoTimer();

    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());

    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;

    setCameraActive(false);
    setCameraReady(false);
    setCountdown(null);
    setCaptureProgress(0);
    setScannerState("idle");

    setFaceDetectorStatus("idle");
    setDetectedFaceCount(0);
    setAutoRequireNewFace(false);
    faceReadiness.resetTracking();
  }, [clearAutoTimer]);

  const stopCamera = useCallback(() => {
    cameraRequestedRef.current = false;
    setAutoScanEnabled(false);
    releaseCamera();
  }, [releaseCamera]);

  const startCamera = useCallback(async () => {
    try {
      cameraRequestedRef.current = true;
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        cameraRequestedRef.current = false;
        setAutoScanEnabled(false);
        setCameraError("Camera access is not supported by this browser.");
        setScannerState("idle");
        return;
      }

      /*
       * Release a stale stream without changing the adviser's desired
       * camera state. This prevents duplicate tracks after retrying.
       */
      releaseCamera();
      setScannerState("starting");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!cameraRequestedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        cameraRequestedRef.current = false;
        setAutoScanEnabled(false);
        setCameraError(
          "Camera preview is unavailable. Reload the page and try again.",
        );
        setScannerState("idle");
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      setCameraActive(true);

      await video.play();
      await waitForVideoReady(video);

      if (!cameraRequestedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        video.srcObject = null;
        setCameraActive(false);
        setCameraReady(false);
        setScannerState("idle");
        return;
      }

      setCameraReady(true);
      setCameraError("");
      setScannerState("ready");

      /*
       * Prepare MediaPipe only as a lightweight face-presence detector.
       * AttendanceSession does NOT use its readiness score as a gate.
       */
      setDetectedFaceCount(0);
      setAutoRequireNewFace(false);
      faceReadiness.resetTracking();

      if (faceReadiness.isSupported()) {
        setFaceDetectorStatus("loading");

        void faceReadiness
          .ensureReady()
          .then(() => {
            if (cameraRequestedRef.current) {
              setFaceDetectorStatus("ready");
            }
          })
          .catch((detectorError) => {
            console.warn(
              "Automatic face presence detection is unavailable. Manual Scan Now remains available.",
              detectorError,
            );

            if (cameraRequestedRef.current) {
              setFaceDetectorStatus("unavailable");
            }
          });
      } else {
        setFaceDetectorStatus("unavailable");
      }
    } catch (requestError) {
      console.error("Unable to start camera:", requestError);

      cameraRequestedRef.current = false;
      setAutoScanEnabled(false);
      releaseCamera();
      setCameraError(getCameraAccessErrorMessage(requestError));
      setScannerState("idle");
    }
  }, [releaseCamera]);

  useEffect(() => {
    if (!scheduledEndReached) return;

    clearAutoTimer();
    clearResultTimer();
    scanLockRef.current = false;
    cameraRequestedRef.current = false;
    setAutoScanEnabled(false);
    setRecognitionResult(null);
    setCameraHoldReason("");
    releaseCamera();
    setLocalPageError(
      "This attendance session has reached its scheduled end time. Attendance recording is now closed.",
    );
    speakGuidance("session-ended", "Attendance session ended.", {
      cooldownMs: 10000,
    });
  }, [
    scheduledEndReached,
    clearAutoTimer,
    clearResultTimer,
    releaseCamera,
    speakGuidance,
  ]);

  /*
   * CAMERA START POLICY
   *
   * The camera does NOT start automatically when this page loads.
   *
   * Camera access begins only after an explicit adviser action:
   * - Enable Camera
   * - Turn Camera On
   * - enabling Auto Capture while the camera is currently off
   *
   * Retry / conflict timers only clear result information. They do not
   * silently reopen a camera that the adviser has not enabled.
   */

  /*
   * LIGHTWEIGHT FACE-PRESENCE MONITOR
   *
   * This intentionally ignores FaceReadiness.ready, lighting,
   * stability, frontal score, centering, and readiness percentage.
   *
   * Auto Capture only needs exactly ONE detected face.
   */
  useEffect(() => {
    if (
      !sessionIsActive ||
      !cameraActive ||
      !cameraReady ||
      cameraIsHeld ||
      recognizing ||
      recognitionResult ||
      faceDetectorStatus !== "ready"
    ) {
      return undefined;
    }

    let cancelled = false;

    const analyzeFacePresence = async () => {
      if (
        cancelled ||
        faceMonitorBusyRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        return;
      }

      faceMonitorBusyRef.current = true;

      try {
        const analysis = await faceReadiness.analyzeVideoFrame(
          videoRef.current,
        );

        if (cancelled) return;

        const nextFaceCount = Math.max(0, Number(analysis?.faceCount || 0));

        setDetectedFaceCount(nextFaceCount);

        /*
         * After a successful or already-recorded Auto Capture,
         * require the previous student to leave before rearming.
         * This prevents the same face from being scanned repeatedly.
         */
        if (autoRequireNewFace && nextFaceCount === 0) {
          setAutoRequireNewFace(false);
        }
      } catch (analysisError) {
        if (!cancelled) {
          console.warn(
            "Unable to analyze face presence in the current camera frame:",
            analysisError,
          );
        }
      } finally {
        faceMonitorBusyRef.current = false;
      }
    };

    void analyzeFacePresence();

    const interval = window.setInterval(
      () => void analyzeFacePresence(),
      FACE_MONITOR_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      faceMonitorBusyRef.current = false;
    };
  }, [
    sessionIsActive,
    cameraActive,
    cameraReady,
    cameraIsHeld,
    recognizing,
    recognitionResult,
    faceDetectorStatus,
    autoRequireNewFace,
  ]);

  const captureRecognitionImage = useCallback(async () => {
    const video = videoRef.current;
    if (!video) throw new Error("Camera preview is unavailable.");
    await waitForVideoReady(video);

    const runId = captureRunRef.current + 1;
    captureRunRef.current = runId;
    setScannerState("capturing");
    setCaptureProgress(0);

    const frames = await captureFrameBurst(video, {
      count: ATTENDANCE_CAPTURE_FRAME_COUNT,
      intervalMs: ATTENDANCE_CAPTURE_INTERVAL_MS,
      prefix: "attendance-face",
      isCancelled: () => captureRunRef.current !== runId,
      onProgress: (completed) => setCaptureProgress(completed),
    });

    if (captureRunRef.current !== runId)
      throw new Error("Attendance capture was cancelled.");
    if (!frames.length) throw new Error("No camera frame was captured.");
    return frames[frames.length - 1];
  }, []);

  const captureAndRecognize = useCallback(
    async ({ manual = false } = {}) => {
      if (!sessionId || !sessionIsActive || recognizing || scanLockRef.current)
        return;

      if (!cameraActive || !cameraReady) {
        if (manual) setCameraError("Camera is not ready yet.");
        return;
      }

      scanLockRef.current = true;
      const previousAttendedIds = new Set(attendedStudentIds);
      let keepScanLocked = false;

      try {
        clearAutoTimer();
        clearResultTimer();
        setRecognizing(true);
        setCountdown(null);
        setCameraError("");
        setRecognitionResult(null);
        setAmbiguousActionError("");

        if (manual) {
          speakGuidance(
            "manual-hold-still",
            "Hold still and look straight at the camera.",
            {
              cooldownMs: 1400,
            },
          );
        }

        const imageFile = await captureRecognitionImage();
        setScannerState("processing");

        const result = await adviserService.markFaceAttendance({
          sessionId,
          imageFile,
        });
        const refreshedRecords = await refreshRecords();

        let recognizedStudentId =
          result?.studentId ||
          result?.student?.id ||
          result?.attendanceRecord?.studentId ||
          result?.attendanceRecord?.student?.id ||
          "";

        let recognizedRecord = null;

        if (recognizedStudentId) {
          recognizedRecord = refreshedRecords.find(
            (record) =>
              String(getRecordStudentId(record)) ===
              String(recognizedStudentId),
          );
        }

        if (!recognizedStudentId) {
          recognizedRecord = refreshedRecords.find((record) => {
            const recordStudentId = getRecordStudentId(record);
            return (
              recordStudentId &&
              !previousAttendedIds.has(String(recordStudentId)) &&
              isAttendedRecord(record)
            );
          });
          recognizedStudentId = getRecordStudentId(recognizedRecord);
        }

        const recognizedStudent = students.find(
          (student) => String(student.id) === String(recognizedStudentId),
        );

        const studentName =
          result?.studentName ||
          result?.student?.name ||
          getRecordStudentName(recognizedRecord) ||
          recognizedStudent?.name ||
          "Recognized Student";

        const studentNumber =
          result?.studentNumber ||
          result?.student?.studentNumber ||
          getRecordStudentNumber(recognizedRecord) ||
          recognizedStudent?.studentNumber ||
          "—";

        const recordedAt =
          getRecordTime(recognizedRecord) ||
          result?.recordedAt ||
          result?.attendanceRecord?.recordedAt ||
          new Date();

        const responseStatus = String(
          result?.attendanceStatus || result?.attendanceRecord?.status || "",
        )
          .trim()
          .toUpperCase();

        const attendanceStatus = recognizedRecord
          ? getRecordStatus(recognizedRecord)
          : responseStatus === "LATE" || responseStatus === "PRESENT"
            ? responseStatus
            : "PRESENT";

        setRecognitionResult({
          type: "success",
          status:
            attendanceStatus === "LATE" ? "MARKED LATE" : "MARKED PRESENT",
          attendanceStatus,
          name: studentName,
          studentNumber,
          sectionName,
          recordedAt,
          method: "Face Recognition",
          message:
            result?.message ||
            (attendanceStatus === "LATE"
              ? "Attendance recorded as late."
              : "Attendance recorded successfully."),
        });

        setScannerState("success");

        if (voiceEnabled) {
          speechService.announceAttendanceResult({
            studentName,
            status: attendanceStatus,
          });
        }

        if (autoScanEnabled) {
          resultTimerRef.current = window.setTimeout(() => {
            setRecognitionResult(null);
            setAutoRequireNewFace(true);
            setScannerState("waiting-face");
            scanLockRef.current = false;
          }, RESULT_HOLD_SUCCESS);
        } else {
          keepScanLocked = true;
          scanLockRef.current = true;
        }
      } catch (requestError) {
        console.error("Face attendance failed:", requestError);

        const status = requestError?.response?.status;
        const responseData = requestError?.response?.data || {};
        const responseOutcome = String(responseData?.outcome || "")
          .trim()
          .toUpperCase();
        const responseMessage = getErrorMessage(requestError, "");
        const normalizedResponseMessage = responseMessage.toLowerCase();

        const ambiguousFaceMatch =
          status === 409 && responseOutcome === "AMBIGUOUS";
        const sessionEndedConflict =
          status === 409 &&
          (normalizedResponseMessage.includes("scheduled end") ||
            normalizedResponseMessage.includes("session has reached") ||
            normalizedResponseMessage.includes("session is no longer active"));

        /*
         * Preserve the existing backend contract:
         * after excluding AMBIGUOUS and a session-ended conflict,
         * a remaining 409 from face attendance represents an existing
         * attendance record.
         */
        const alreadyRecordedConflict =
          status === 409 && !ambiguousFaceMatch && !sessionEndedConflict;

        if (ambiguousFaceMatch) {
          const normalizeCandidate = (candidate) => {
            if (!candidate) return null;
            return {
              studentId: candidate?.studentId || "",
              studentNumber: candidate?.studentNumber || "—",
              studentName: candidate?.studentName || "Possible Student",
              distance: candidate?.distance,
              similarityPercent: getFaceSimilarityPercent(candidate?.distance),
              similarityLabel: formatFaceSimilarityPercent(candidate?.distance),
            };
          };

          setRecognitionResult({
            type: "warning",
            outcome: "AMBIGUOUS",
            status: "IDENTITY UNCERTAIN",
            name: "Manual verification required",
            studentNumber: "2 possible matches",
            sectionName,
            recordedAt: new Date(),
            method: "Face Recognition",
            message:
              "Two similar student identities were detected. No attendance was recorded. Verify the student before recording attendance manually.",
            topCandidate: normalizeCandidate(
              responseData?.topCandidate || null,
            ),
            secondCandidate: normalizeCandidate(
              responseData?.secondCandidate || null,
            ),
            similarityDifference: formatSimilarityDifference(
              responseData?.distanceGap,
            ),
          });

          /*
           * Conflict review still pauses and turns off the camera for
           * safety. The information remains visible for 10 seconds.
           *
           * Because automatic camera start is disabled, clearing this
           * result does NOT silently reopen the camera.
           */
          cameraRequestedRef.current = false;
          setAutoScanEnabled(false);
          setCameraHoldReason("AMBIGUOUS");
          releaseCamera();
          setScannerState("ambiguous");

          speakGuidance(
            "ambiguous-face",
            "Identity uncertain. Adviser verification is required.",
            { cooldownMs: 5000 },
          );

          keepScanLocked = true;
          scanLockRef.current = true;

          resultTimerRef.current = window.setTimeout(() => {
            setRecognitionResult(null);
            setAmbiguousActionError("");
            setCameraHoldReason("");
            setScannerState("idle");
            scanLockRef.current = false;
          }, RESULT_HOLD_CONFLICT);

          return;
        }

        /*
         * ALREADY RECORDED
         *
         * Show the recognized student's identity whenever the backend
         * provides enough information to resolve it safely.
         */
        if (alreadyRecordedConflict) {
          let latestRecords = sessionRecords;

          try {
            latestRecords = await refreshRecords();
          } catch (refreshError) {
            console.warn(
              "Unable to refresh attendance records after duplicate scan:",
              refreshError,
            );
          }

          const identity = resolveAlreadyRecordedIdentity({
            responseData,
            responseMessage,
            records: latestRecords,
            students,
          });

          const existingName = identity.studentName || "";

          const existingNumber = identity.studentNumber || "—";

          const existingRecord = identity.record || null;

          const existingStatus = existingRecord
            ? getRecordStatus(existingRecord)
            : String(
                responseData?.attendanceStatus ||
                  responseData?.status ||
                  responseData?.attendanceRecord?.status ||
                  "",
              )
                .trim()
                .toUpperCase();

          const safeAttendanceStatus =
            existingStatus === "LATE" || existingStatus === "PRESENT"
              ? existingStatus
              : "";

          const existingRecordedAt =
            (existingRecord && getRecordTime(existingRecord)) ||
            responseData?.recordedAt ||
            responseData?.attendanceRecord?.recordedAt ||
            new Date();

          setRecognitionResult({
            type: "warning",
            outcome: "ALREADY_RECORDED",
            retryable: true,
            status: "ALREADY RECORDED",
            attendanceStatus: safeAttendanceStatus,
            name: existingName || "Attendance Already Recorded",
            studentNumber: existingNumber,
            sectionName,
            recordedAt: existingRecordedAt,
            method: existingRecord
              ? getRecordMethod(existingRecord) || "Face Recognition"
              : "Face Recognition",
            message: existingName
              ? `${existingName} already has an attendance record for this session.`
              : "The recognized student already has an attendance record for this session.",
          });

          setScannerState("warning");

          speakGuidance(
            existingName
              ? `already-recorded-${identity.studentId || existingName}`
              : "already-recorded",
            existingName
              ? `${existingName}, attendance already recorded.`
              : "Attendance already recorded.",
            { cooldownMs: RESULT_HOLD_ALREADY_RECORDED },
          );

          /*
           * Clear the duplicate result after 10 seconds.
           * If the camera was already running, it remains available.
           * If it was off, this timer does not start it.
           */
          resultTimerRef.current = window.setTimeout(() => {
            setRecognitionResult(null);

            if (autoScanEnabled && cameraActive && cameraReady) {
              setAutoRequireNewFace(true);
              setScannerState("waiting-face");
            } else {
              setScannerState(cameraActive && cameraReady ? "ready" : "idle");
            }

            scanLockRef.current = false;
          }, RESULT_HOLD_ALREADY_RECORDED);

          return;
        }

        let title;
        let message;
        let resultType;
        let voiceMessage;
        let resultOutcome = "RETRYABLE_ERROR";

        if (sessionEndedConflict) {
          title = "Session Ended";
          message = "Attendance recording is already closed for this session.";
          resultType = "error";
          voiceMessage = "Attendance session ended.";
          resultOutcome = "SESSION_ENDED";

          setLocalPageError(responseMessage || message);
          cameraRequestedRef.current = false;
          setAutoScanEnabled(false);
          releaseCamera();
        } else {
          const presentation = getRecognitionErrorPresentation(requestError);
          title = presentation.title;
          message = presentation.message;
          resultType = presentation.type;
          voiceMessage = presentation.voice;
        }

        setRecognitionResult({
          type: resultType,
          outcome: resultOutcome,
          retryable: !sessionEndedConflict,
          status: title.toUpperCase(),
          name: title,
          studentNumber: "—",
          sectionName,
          recordedAt: new Date(),
          method: "Face Recognition",
          message,
        });

        setScannerState(resultType === "warning" ? "warning" : "error");
        speakGuidance(`recognition-${title}`, voiceMessage, {
          cooldownMs: resultType === "warning" ? 3500 : 2600,
        });

        if (!sessionEndedConflict) {
          /*
           * Retryable failures stay visible for exactly 10 seconds,
           * whether the adviser is using Manual Capture or Auto Capture.
           *
           * We do NOT call startCamera() here. If the camera is already
           * running, it stays available. If it is off, it remains off.
           */
          resultTimerRef.current = window.setTimeout(() => {
            setRecognitionResult(null);
            setScannerState(cameraActive && cameraReady ? "ready" : "idle");
            scanLockRef.current = false;
          }, RESULT_HOLD_ERROR);
        } else {
          keepScanLocked = true;
          scanLockRef.current = true;
        }
      } finally {
        setRecognizing(false);
        setCaptureProgress(0);
        if (!resultTimerRef.current && !keepScanLocked)
          scanLockRef.current = false;
      }
    },
    [
      sessionId,
      sessionIsActive,
      recognizing,
      cameraActive,
      cameraReady,
      sessionRecords,
      attendedStudentIds,
      clearAutoTimer,
      clearResultTimer,
      captureRecognitionImage,
      refreshRecords,
      students,
      sectionName,
      releaseCamera,
      autoScanEnabled,
      voiceEnabled,
      speakGuidance,
    ],
  );

  useEffect(() => {
    clearAutoTimer();

    if (
      !autoScanEnabled ||
      !sessionIsActive ||
      !cameraActive ||
      !cameraReady ||
      cameraIsHeld ||
      recognizing ||
      recognitionResult ||
      scanLockRef.current
    ) {
      return undefined;
    }

    /*
     * Auto Capture is FACE-PRESENCE GATED only.
     *
     * No strict guide:
     * - no readiness percentage requirement
     * - no centering requirement
     * - no lighting requirement
     * - no stability requirement
     * - no frontal-angle requirement
     *
     * Exactly one detected face is enough to begin the countdown.
     */
    if (faceDetectorStatus === "loading") {
      setScannerState("waiting-face");
      setCountdown(null);
      return undefined;
    }

    /*
     * If local face detection is unavailable, do not blindly run
     * automatic capture. Manual Scan Now remains available.
     */
    if (!faceDetectorReady) {
      setScannerState("ready");
      setCountdown(null);
      return undefined;
    }

    /*
     * After a completed scan, wait until the previous student leaves
     * the camera before accepting the next face.
     */
    if (autoRequireNewFace) {
      setScannerState("waiting-face");
      setCountdown(null);
      return undefined;
    }

    /*
     * Zero faces: wait silently.
     * Multiple faces: also wait.
     */
    if (detectedFaceCount !== 1) {
      setScannerState("waiting-face");
      setCountdown(null);
      return undefined;
    }

    cameraRequestedRef.current = true;

    /*
     * One face is visible. Give only a short debounce before starting
     * the real 5-second capture countdown.
     */
    setScannerState("face-detected");
    setCountdown(null);

    autoTimerRef.current = window.setTimeout(() => {
      /*
       * Re-check face presence before the countdown begins.
       * If the face left or a second face entered, do nothing.
       */
      if (!cameraRequestedRef.current || detectedFaceCount !== 1) {
        setCountdown(null);
        setScannerState("waiting-face");
        return;
      }

      setScannerState("countdown");
      setCountdown(AUTO_COUNTDOWN_SECONDS);

      speakGuidance(
        "auto-hold-still",
        "Hold still and look straight at the camera. Capturing in five seconds.",
        { cooldownMs: 6500 },
      );

      const runStep = (currentValue) => {
        autoTimerRef.current = window.setTimeout(() => {
          if (!cameraRequestedRef.current || detectedFaceCount !== 1) {
            setCountdown(null);
            setScannerState("waiting-face");
            return;
          }

          if (currentValue > 1) {
            const nextValue = currentValue - 1;
            setCountdown(nextValue);
            runStep(nextValue);
            return;
          }

          setCountdown(null);
          void captureAndRecognize();
        }, AUTO_COUNTDOWN_STEP);
      };

      runStep(AUTO_COUNTDOWN_SECONDS);
    }, AUTO_ALIGN_DELAY);

    return () => clearAutoTimer();
  }, [
    autoScanEnabled,
    sessionIsActive,
    cameraActive,
    cameraReady,
    cameraIsHeld,
    recognizing,
    recognitionResult,
    faceDetectorStatus,
    faceDetectorReady,
    detectedFaceCount,
    autoRequireNewFace,
    captureAndRecognize,
    clearAutoTimer,
    speakGuidance,
  ]);

  useEffect(() => {
    return () => {
      cameraRequestedRef.current = false;
      captureRunRef.current += 1;
      clearAutoTimer();
      clearResultTimer();
      speechService.stop();
      faceReadiness.resetTracking();
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [clearAutoTimer, clearResultTimer]);

  const scannerCopy = useMemo(() => {
    if (scannerState === "capturing") {
      return {
        eyebrow: "CAPTURING",
        title: "Hold still",
        description:
          captureProgress > 0
            ? `Capturing a clear recognition frame ${captureProgress} of ${ATTENDANCE_CAPTURE_FRAME_COUNT}.`
            : "Capturing a clear recognition frame.",
      };
    }
    if (scannerState === "processing") {
      return {
        eyebrow: "PROCESSING",
        title: "Recognizing student",
        description: "Please keep the student inside the camera frame.",
      };
    }
    if (scannerState === "success") {
      return {
        eyebrow: "ATTENDANCE RECORDED",
        title: "Student attendance recorded",
        description: "Preparing scanner for the next student.",
      };
    }
    if (scannerState === "ambiguous") {
      return {
        eyebrow: "IDENTITY UNCERTAIN",
        title: "Two possible matches detected",
        description: "No attendance was recorded. Verify the student manually.",
      };
    }
    if (scannerState === "warning") {
      return {
        eyebrow: "ALREADY RECORDED",
        title:
          recognitionResult?.outcome === "ALREADY_RECORDED"
            ? recognitionResult?.name || "Attendance already exists"
            : "Attendance already exists",
        description:
          recognitionResult?.outcome === "ALREADY_RECORDED"
            ? "The existing attendance information will remain visible for 10 seconds."
            : "The scanner will become ready again after 10 seconds.",
      };
    }
    if (scannerState === "error") {
      return {
        eyebrow: "SCAN UNSUCCESSFUL",
        title: "Please try again",
        description: "Reposition the student and keep only one face in frame.",
      };
    }
    if (scannerState === "countdown") {
      return {
        eyebrow: "AUTO CAPTURE READY",
        title: "Hold still",
        description:
          countdown !== null
            ? `Automatic capture in ${countdown} second${countdown === 1 ? "" : "s"}.`
            : "Automatic capture is starting.",
      };
    }
    if (scannerState === "waiting-face") {
      return {
        eyebrow: "AUTO CAPTURE ACTIVE",
        title: autoRequireNewFace
          ? "Ready for the next student"
          : detectedFaceCount > 1
            ? "One student at a time"
            : "Waiting for a student",
        description: autoRequireNewFace
          ? "The previous student must leave the frame before Auto Capture rearms."
          : detectedFaceCount > 1
            ? "Keep only one student inside the camera frame."
            : "The countdown starts automatically when one face is detected.",
      };
    }
    if (scannerState === "face-detected") {
      return {
        eyebrow: "FACE DETECTED",
        title: "Student detected",
        description: "Starting the automatic capture countdown.",
      };
    }
    if (scannerState === "aligning") {
      return {
        eyebrow: "AUTO CAPTURE ACTIVE",
        title: "Waiting for a student",
        description: "The countdown starts when one face is detected.",
      };
    }
    if (cameraActive && cameraReady) {
      return {
        eyebrow: autoScanEnabled ? "AUTO CAPTURE ACTIVE" : "MANUAL CAPTURE",
        title: autoScanEnabled
          ? "Ready for the next student"
          : "Position one student in frame",
        description: autoScanEnabled
          ? "Keep one student centered. The camera will capture automatically."
          : "Center one student, then press Scan Now when ready.",
      };
    }
    if (cameraActive) {
      return {
        eyebrow: "PREPARING CAMERA",
        title: "Starting scanner",
        description: "The camera will be ready in a moment.",
      };
    }
    return {
      eyebrow: "FACE ATTENDANCE",
      title: "Camera unavailable",
      description: "Enable the camera to start face attendance.",
    };
  }, [
    scannerState,
    cameraActive,
    cameraReady,
    autoScanEnabled,
    recognitionResult,
    autoRequireNewFace,
    detectedFaceCount,
    captureProgress,
    countdown,
  ]);

  const handleContinueScanner = useCallback(async () => {
    clearAutoTimer();
    clearResultTimer();
    setAmbiguousActionError("");
    setCameraError("");
    setRecognitionResult(null);
    setCountdown(null);
    setCaptureProgress(0);
    setAutoRequireNewFace(false);
    scanLockRef.current = false;

    /* The adviser explicitly chose to continue/retry. */
    cameraRequestedRef.current = true;

    const shouldRestartCamera = !cameraActive && sessionIsActive;
    setCameraHoldReason("");

    if (shouldRestartCamera) {
      setScannerState("starting");
      await startCamera();
      return;
    }

    setScannerState(cameraActive && cameraReady ? "ready" : "idle");
  }, [
    clearAutoTimer,
    clearResultTimer,
    cameraActive,
    cameraReady,
    sessionIsActive,
    startCamera,
  ]);

  const handleMarkPresent = async (student) => {
    if (!sessionId || !student?.id || !sessionIsActive) return;

    try {
      setMarkingStudentId(student.id);
      setManualError("");
      setManualMessage("");

      const result = await adviserService.markManualAttendance({
        sessionId,
        studentId: student.id,
      });

      const refreshedRecords = await refreshRecords();
      const savedRecord = refreshedRecords.find(
        (record) => String(getRecordStudentId(record)) === String(student.id),
      );
      const responseStatus = String(
        result?.attendanceStatus ||
          result?.status ||
          result?.attendanceRecord?.status ||
          "",
      )
        .trim()
        .toUpperCase();
      const savedStatus = savedRecord
        ? getRecordStatus(savedRecord)
        : responseStatus === "LATE" || responseStatus === "PRESENT"
          ? responseStatus
          : "PRESENT";

      setManualMessage(
        savedStatus === "LATE"
          ? `${student.name} was recorded as late.`
          : `${student.name} was marked present.`,
      );

      if (voiceEnabled) {
        speechService.announceAttendanceResult({
          studentName: student.name,
          status: savedStatus,
        });
      }
    } catch (requestError) {
      console.error("Manual attendance failed:", requestError);
      setManualError(
        getErrorMessage(
          requestError,
          requestError?.response?.status === 409
            ? "The student already has an attendance record for this session."
            : "Unable to record the student's attendance.",
        ),
      );
    } finally {
      setMarkingStudentId("");
    }
  };

  const handleAmbiguousMarkPresent = async (candidate) => {
    if (
      !sessionId ||
      !candidate?.studentId ||
      !sessionIsActive ||
      markingStudentId
    )
      return;

    try {
      clearResultTimer();
      scanLockRef.current = true;
      setMarkingStudentId(candidate.studentId);
      setAmbiguousActionError("");
      setManualError("");
      setManualMessage("");

      const result = await adviserService.markManualAttendance({
        sessionId,
        studentId: candidate.studentId,
      });
      const refreshedRecords = await refreshRecords();
      const savedRecord = refreshedRecords.find(
        (record) =>
          String(getRecordStudentId(record)) === String(candidate.studentId),
      );
      const responseStatus = String(
        result?.attendanceStatus ||
          result?.status ||
          result?.attendanceRecord?.status ||
          "",
      )
        .trim()
        .toUpperCase();
      const attendanceStatus = savedRecord
        ? getRecordStatus(savedRecord)
        : responseStatus === "LATE" || responseStatus === "PRESENT"
          ? responseStatus
          : "PRESENT";
      const recordedAt =
        getRecordTime(savedRecord) ||
        result?.recordedAt ||
        result?.attendanceRecord?.recordedAt ||
        new Date();

      setRecognitionResult({
        type: "success",
        outcome: "MANUAL_RECORDED",
        status: attendanceStatus === "LATE" ? "MARKED LATE" : "MARKED PRESENT",
        attendanceStatus,
        name: candidate.studentName || "Selected Student",
        studentNumber: candidate.studentNumber || "—",
        sectionName,
        recordedAt,
        method: "Manual Verification",
        message:
          attendanceStatus === "LATE"
            ? "Identity was manually confirmed and attendance was recorded as late based on the session cutoff."
            : "Identity was manually confirmed and attendance was recorded successfully.",
      });

      setCameraHoldReason("MANUAL_RESULT");
      setScannerState("success");
      setManualMessage(
        attendanceStatus === "LATE"
          ? `${candidate.studentName} was manually verified and recorded as late.`
          : `${candidate.studentName} was manually verified and marked present.`,
      );

      if (voiceEnabled) {
        speechService.announceAttendanceResult({
          studentName: candidate.studentName,
          status: attendanceStatus,
        });
      }

      clearResultTimer();
      scanLockRef.current = true;
    } catch (requestError) {
      console.error("Ambiguous manual attendance failed:", requestError);
      setAmbiguousActionError(
        getErrorMessage(
          requestError,
          requestError?.response?.status === 409
            ? "This student already has an attendance record for this session."
            : "Unable to record the selected student's attendance. Please try again.",
        ),
      );
      setScannerState("ambiguous");
      scanLockRef.current = true;
    } finally {
      setMarkingStudentId("");
    }
  };

  const handleRemoveAttendance = async (student) => {
    if (!sessionId || !student?.id || !sessionIsActive) return;
    try {
      setRemovingStudentId(student.id);
      setManualError("");
      setManualMessage("");
      await adviserService.removeAttendance({
        sessionId,
        studentId: student.id,
      });
      await refreshRecords();
      setManualMessage(`${student.name}'s attendance record was removed.`);
    } catch (requestError) {
      console.error("Unable to remove attendance:", requestError);
      setManualError(
        getErrorMessage(
          requestError,
          "Unable to remove the attendance record.",
        ),
      );
    } finally {
      setRemovingStudentId("");
    }
  };

  const handleEndSession = async () => {
    if (!sessionId || endingSession) return;
    try {
      setEndingSession(true);
      setEndError("");
      await adviserService.endAttendanceSession(sessionId);

      /*
       * Keep the shared cache synchronized with the successful mutation.
       * The active-session cache is cleared immediately, while completed
       * history is invalidated so its finalized PRESENT / LATE / ABSENT
       * totals are fetched when the adviser opens history next.
       */
      if (section?.id) {
        queryClient.setQueryData(
          queryKeys.adviser.activeSession(section.id),
          null,
        );
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.attendanceHistory.all(),
      });

      speechService.stop();
      cameraRequestedRef.current = false;
      stopCamera();
      setShowEndModal(false);
      navigate("/adviser/attendance", { replace: true });
    } catch (requestError) {
      console.error("Unable to end attendance session:", requestError);
      setEndError(
        getErrorMessage(requestError, "Unable to end the attendance session."),
      );
    } finally {
      setEndingSession(false);
    }
  };

  useEffect(() => {
    if (!showEndModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showEndModal]);

  return (
    <main className="attendance-live-page">
      <header className="attendance-live-topbar">
        <div className="attendance-live-brand">
          <img
            src={seniorHighSchoolLogo}
            alt="Signal Village National High School"
          />
          <div>
            <span>SVNHS ATTENDANCE</span>
            <strong>{sectionName}</strong>
          </div>
        </div>

        <div className="attendance-live-session-meta">
          <span
            className={`attendance-live-session-pill ${scheduledEndReached ? "is-ended" : ""}`}
          >
            <i />
            {scheduledEndReached ? "SESSION ENDED" : "ACTIVE SESSION"}
          </span>

          <div className="attendance-live-clock">
            <span>{formatSchoolDate(liveClock)}</span>
            <strong>{formatSchoolTime(liveClock)}</strong>
          </div>

          <button
            type="button"
            className="attendance-live-topbar-button"
            onClick={() => navigate("/adviser/attendance")}
          >
            Back
          </button>

          <button
            type="button"
            className="attendance-live-end-button"
            disabled={loading || !sessionIsActive}
            onClick={() => {
              setEndError("");
              setShowEndModal(true);
            }}
          >
            End Session
          </button>
        </div>
      </header>

      {pageError && (
        <div className="attendance-live-page-error">
          <strong>Attendance Session</strong>
          <span>{pageError}</span>
        </div>
      )}

      <section className="attendance-live-hero">
        <div className="attendance-live-camera-column">
          <div className="attendance-live-camera-header">
            <div>
              <span>FACE RECOGNITION ATTENDANCE</span>
              <h1>Attendance Scanner</h1>
              <p>
                Manual capture is the default for safer, more controlled
                attendance. Turn on Auto Capture only when you want continuous
                scanning.
              </p>
            </div>

            <div className="attendance-live-header-actions">
              <button
                type="button"
                className={`attendance-voice-toggle ${voiceEnabled && voiceSupported ? "is-on" : ""}`}
                aria-pressed={voiceEnabled && voiceSupported}
                disabled={!voiceSupported}
                title={
                  voiceSupported
                    ? "Toggle spoken attendance guidance"
                    : "Speech synthesis is unavailable in this browser"
                }
                onClick={toggleVoice}
              >
                <span
                  className="attendance-voice-toggle-icon"
                  aria-hidden="true"
                >
                  {voiceEnabled && voiceSupported ? "◖" : "×"}
                </span>
                {voiceSupported
                  ? `Voice ${voiceEnabled ? "ON" : "OFF"}`
                  : "Voice unavailable"}
              </button>

              <button
                type="button"
                aria-pressed={autoScanEnabled}
                className={`attendance-auto-toggle ${autoScanEnabled ? "is-on" : ""}`}
                disabled={
                  !sessionIsActive || cameraIsHeld || Boolean(recognitionResult)
                }
                onClick={() => {
                  clearAutoTimer();
                  clearResultTimer();
                  setCountdown(null);

                  const nextEnabled = !autoScanEnabled;
                  setAutoScanEnabled(nextEnabled);

                  if (nextEnabled) {
                    cameraRequestedRef.current = true;
                    setCameraError("");
                    setRecognitionResult(null);
                    setAutoRequireNewFace(false);
                    scanLockRef.current = false;

                    if (!cameraActive && sessionIsActive && !cameraIsHeld) {
                      void startCamera();
                    }
                  }
                }}
              >
                <span aria-hidden="true" />
                Auto Capture {autoScanEnabled ? "ON" : "OFF"}
              </button>

              <button
                type="button"
                className="attendance-scan-now-button"
                disabled={
                  !sessionIsActive ||
                  !cameraActive ||
                  !cameraReady ||
                  recognizing ||
                  Boolean(recognitionResult) ||
                  cameraIsHeld
                }
                onClick={() => void captureAndRecognize({ manual: true })}
              >
                {recognizing
                  ? scannerState === "capturing"
                    ? "Capturing..."
                    : "Processing..."
                  : "Scan Now"}
              </button>
            </div>
          </div>

          <div className="attendance-camera-workspace">
            <div
              className={`attendance-live-camera-shell scanner-${scannerState} ${
                cameraIsHeld ? "is-review-paused" : ""
              }`}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cameraActive ? "is-active" : ""}
                onCanPlay={() => {
                  setCameraReady(true);
                  if (scannerState === "starting" || scannerState === "idle") {
                    setScannerState("ready");
                  }
                }}
              />

              {!cameraActive && cameraPausedForReview && (
                <div className="attendance-live-camera-placeholder is-review-pause">
                  <div className="attendance-live-camera-placeholder-icon">
                    !
                  </div>
                  <span>CAMERA PAUSED FOR SAFETY</span>
                  <h2>Identity review required</h2>
                  <p>
                    The camera was turned off automatically because two student
                    identities matched. Verify the student in the panel before
                    continuing.
                  </p>
                  <div className="attendance-camera-pause-status">
                    <strong>No attendance recorded</strong>
                    <span>Choose a student or scan again.</span>
                  </div>
                </div>
              )}

              {!cameraActive && cameraPausedAfterReview && (
                <div className="attendance-live-camera-placeholder is-complete-pause">
                  <div className="attendance-live-camera-placeholder-icon">
                    ✓
                  </div>
                  <span>REVIEW COMPLETE</span>
                  <h2>Ready for the next student</h2>
                  <p>
                    The camera remains off after a manual identity decision so
                    the result can be reviewed without another capture starting.
                  </p>
                  <button
                    type="button"
                    disabled={!sessionIsActive}
                    onClick={() => void handleContinueScanner()}
                  >
                    Continue to Next Student
                  </button>
                </div>
              )}

              {!cameraActive && !cameraIsHeld && (
                <div className="attendance-live-camera-placeholder">
                  <div className="attendance-live-camera-placeholder-icon">
                    ◎
                  </div>
                  <span>CAMERA OFF</span>
                  <h2>Start the face scanner</h2>
                  <p>
                    Enable the camera, position one student inside the guide,
                    then use Scan Now. Auto Capture stays off unless you enable
                    it.
                  </p>
                  <button
                    type="button"
                    disabled={!sessionIsActive}
                    onClick={() => void startCamera()}
                  >
                    Enable Camera
                  </button>
                </div>
              )}

              {cameraActive && (
                <>
                  <div className="attendance-camera-shade" />

                  <div
                    className={`attendance-face-target scanner-${scannerState}`}
                    aria-hidden="true"
                  >
                    <div className="attendance-face-target-oval" />
                    <div className="attendance-face-target-line" />
                    <span className="corner corner-one" />
                    <span className="corner corner-two" />
                    <span className="corner corner-three" />
                    <span className="corner corner-four" />
                  </div>

                  <div className="attendance-live-badge">
                    <span />
                    LIVE CAMERA
                  </div>

                  <div
                    className={`attendance-capture-mode-badge ${
                      autoScanEnabled ? "is-auto" : "is-manual"
                    }`}
                  >
                    <span aria-hidden="true">
                      {autoScanEnabled ? "↻" : "●"}
                    </span>
                    {autoScanEnabled ? "AUTO CAPTURE" : "MANUAL CAPTURE"}
                  </div>

                  <div className="attendance-scanner-message">
                    <span>{scannerCopy.eyebrow}</span>
                    <strong>{scannerCopy.title}</strong>
                    <small>{scannerCopy.description}</small>
                  </div>

                  {countdown !== null && (
                    <div className="attendance-countdown">
                      <span>HOLD STILL</span>
                      <strong>{countdown}</strong>
                    </div>
                  )}

                  {recognizing && scannerState === "processing" && (
                    <div className="attendance-processing-overlay">
                      <div className="attendance-processing-spinner" />
                      <strong>Recognizing student</strong>
                      <span>Matching registered face identity...</span>
                    </div>
                  )}

                  {scannerState === "success" && (
                    <div className="attendance-camera-flash" />
                  )}
                </>
              )}
            </div>

            <div className="attendance-camera-session-strip">
              <div className="is-present">
                <span>PRESENT</span>
                <strong>{presentCount}</strong>
              </div>
              <div className="is-late">
                <span>LATE</span>
                <strong>{lateCount}</strong>
              </div>
              <div className="is-remaining">
                <span>REMAINING</span>
                <strong>{remainingCount}</strong>
              </div>
              <div className="is-completion">
                <span>COMPLETION</span>
                <strong>{completionPercentage}%</strong>
              </div>
            </div>
          </div>

          {cameraError && (
            <div className="attendance-live-camera-error" role="alert">
              <span>!</span>
              <p>{cameraError}</p>
              <button type="button" onClick={() => void startCamera()}>
                Retry Camera
              </button>
            </div>
          )}

          <div className="attendance-camera-footer">
            <span>
              {cameraIsHeld
                ? "Camera is paused while the current result needs adviser review."
                : autoScanEnabled
                  ? "Auto Capture is active. The countdown starts only when exactly one face is detected."
                  : "Manual Capture is active. The camera will not capture until you press Scan Now."}
            </span>

            {!cameraIsHeld && (
              <button
                type="button"
                disabled={recognizing}
                onClick={() => {
                  if (cameraActive) {
                    cameraRequestedRef.current = false;
                    setAutoScanEnabled(false);
                    clearAutoTimer();
                    clearResultTimer();
                    setRecognitionResult(null);
                    setCountdown(null);
                    releaseCamera();
                    return;
                  }

                  cameraRequestedRef.current = true;
                  void startCamera();
                }}
              >
                {cameraActive ? "Turn Camera Off" : "Turn Camera On"}
              </button>
            )}
          </div>
        </div>

        <aside
          className={`attendance-live-result-panel ${
            recognitionResult ? `is-${recognitionResult.type}` : ""
          } ${recognitionResult?.attendanceStatus === "LATE" ? "is-late" : ""}`}
        >
          <div className="attendance-result-panel-header">
            <span>LIVE STUDENT STATUS</span>
            <strong>
              {recognitionResult
                ? recognitionResult.status
                : "WAITING FOR STUDENT"}
            </strong>
          </div>

          {!recognitionResult ? (
            <div className="attendance-result-empty">
              <div className="attendance-result-empty-avatar">◎</div>
              <h2>Ready for the next student</h2>
              <p>
                Keep one student inside the frame. Manual Capture is the
                default. With Auto Capture enabled, the countdown starts only
                after one face is detected.
              </p>
              <div className="attendance-result-empty-steps">
                <div>
                  <span>01</span>
                  <p>Center one student inside the face guide</p>
                </div>
                <div>
                  <span>02</span>
                  <p>Press Scan Now, or enable Auto Capture</p>
                </div>
                <div>
                  <span>03</span>
                  <p>Review the result before continuing</p>
                </div>
              </div>
            </div>
          ) : recognitionResult.outcome === "AMBIGUOUS" ? (
            <div
              className="attendance-result-ambiguous"
              role="alert"
              aria-live="assertive"
            >
              <div className="attendance-ambiguous-heading">
                <div className="attendance-result-ambiguous-icon">!</div>
                <div>
                  <span className="attendance-result-kicker">
                    {recognitionResult.status}
                  </span>
                  <h2>Confirm who is in front of you</h2>
                  <p className="attendance-result-ambiguous-intro">
                    Two registered students matched. The camera is off and no
                    attendance was recorded until you make a decision.
                  </p>
                </div>
              </div>

              <div className="attendance-ambiguous-persistent-note">
                <span aria-hidden="true">●</span>
                Review mode — this information clears automatically after 10
                seconds.
              </div>

              <div className="attendance-ambiguous-candidates">
                {[
                  recognitionResult.topCandidate,
                  recognitionResult.secondCandidate,
                ]
                  .filter(Boolean)
                  .map((candidate, index) => {
                    const candidateAlreadyAttended = Boolean(
                      candidate.studentId &&
                      attendedStudentIds.has(String(candidate.studentId)),
                    );
                    const candidateMarking =
                      markingStudentId === candidate.studentId;

                    return (
                      <div
                        className={`attendance-ambiguous-candidate ${
                          index === 0 ? "is-closest" : ""
                        }`}
                        key={
                          candidate.studentId ||
                          `${candidate.studentName}-${index}`
                        }
                      >
                        <div className="attendance-ambiguous-candidate-topline">
                          <span>
                            {index === 0 ? "CLOSEST MATCH" : "SECOND MATCH"}
                          </span>
                          <strong>{candidate.similarityLabel}</strong>
                        </div>

                        <div className="attendance-ambiguous-candidate-main">
                          <div className="attendance-ambiguous-avatar">
                            {candidate.studentName?.charAt(0)?.toUpperCase() ||
                              "S"}
                          </div>
                          <div className="attendance-ambiguous-identity">
                            <h3>{candidate.studentName}</h3>
                            <p>Student No. {candidate.studentNumber}</p>
                          </div>
                        </div>

                        <div
                          className="attendance-ambiguous-similarity"
                          aria-label={`Face similarity ${candidate.similarityLabel}`}
                        >
                          <div>
                            <span>FACE SIMILARITY</span>
                            <strong>{candidate.similarityLabel}</strong>
                          </div>
                          <div className="attendance-ambiguous-meter">
                            <span
                              style={{
                                width: `${
                                  candidate.similarityPercent === null
                                    ? 0
                                    : candidate.similarityPercent
                                }%`,
                              }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="attendance-ambiguous-mark-button"
                          disabled={
                            !sessionIsActive ||
                            Boolean(markingStudentId) ||
                            candidateAlreadyAttended
                          }
                          onClick={() =>
                            void handleAmbiguousMarkPresent(candidate)
                          }
                        >
                          {candidateAlreadyAttended
                            ? "Already Recorded"
                            : candidateMarking
                              ? "Recording..."
                              : "Confirm & Record"}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <div className="attendance-ambiguous-difference">
                <div>
                  <span>SIMILARITY DIFFERENCE</span>
                  <strong>{recognitionResult.similarityDifference}</strong>
                </div>
                <p>
                  Smaller differences mean the two matches are harder to
                  distinguish. Similarity is a readability aid, not a
                  probability score.
                </p>
              </div>

              <div className="attendance-ambiguous-safe-note">
                <strong>Verify the student's name or school ID first.</strong>
                <span>
                  Confirm & Record uses manual attendance for the selected
                  student. The session's late rule still applies.
                </span>
              </div>

              {ambiguousActionError && (
                <div className="attendance-ambiguous-action-error" role="alert">
                  <strong>Attendance was not recorded.</strong>
                  <span>{ambiguousActionError}</span>
                </div>
              )}

              <div className="attendance-ambiguous-actions">
                <button
                  type="button"
                  className="is-secondary"
                  disabled={Boolean(markingStudentId)}
                  onClick={() => void handleContinueScanner()}
                >
                  Scan Again
                </button>
              </div>
            </div>
          ) : (
            <div className="attendance-result-student">
              <div className="attendance-result-icon">
                {recognitionResult.type === "success"
                  ? "✓"
                  : recognitionResult.type === "warning"
                    ? "!"
                    : "×"}
              </div>

              <span className="attendance-result-kicker">
                {recognitionResult.status}
              </span>
              <h2>{recognitionResult.name}</h2>
              <div className="attendance-result-number">
                {recognitionResult.studentNumber}
              </div>

              <div className="attendance-result-details">
                <div>
                  <span>SECTION</span>
                  <strong>{recognitionResult.sectionName}</strong>
                </div>
                <div>
                  <span>RECORDED</span>
                  <strong>
                    {formatSchoolTime(recognitionResult.recordedAt)}
                  </strong>
                </div>
                <div>
                  <span>METHOD</span>
                  <strong>{recognitionResult.method}</strong>
                </div>
                <div>
                  <span>STATUS</span>
                  <strong>
                    {recognitionResult.type === "success" ||
                    recognitionResult.outcome === "ALREADY_RECORDED"
                      ? recognitionResult.attendanceStatus || "RECORDED"
                      : "NOT RECORDED"}
                  </strong>
                </div>
              </div>

              <p className="attendance-result-message">
                {recognitionResult.message}
              </p>

              <button
                type="button"
                className={`attendance-result-action-button ${
                  recognitionResult.type === "success" ? "is-next" : "is-retry"
                }`}
                disabled={
                  !sessionIsActive &&
                  recognitionResult.outcome !== "SESSION_ENDED"
                }
                onClick={() => {
                  if (recognitionResult.outcome === "SESSION_ENDED") {
                    navigate("/adviser/attendance");
                    return;
                  }

                  void handleContinueScanner();
                }}
              >
                {recognitionResult.type === "success"
                  ? "Next Student"
                  : recognitionResult.outcome === "SESSION_ENDED"
                    ? "Back to Attendance"
                    : autoScanEnabled
                      ? "Try Again Now"
                      : "Try Again"}
              </button>
            </div>
          )}

          <div className="attendance-session-mini-summary">
            <div>
              <span>SESSION START</span>
              <strong>{formatSchoolTime(sessionStartedAt)}</strong>
            </div>
            <div>
              <span>LATE CUTOFF</span>
              <strong>
                {sessionLateCutoffAt
                  ? formatSchoolTime(sessionLateCutoffAt)
                  : sessionLateAfterMinutes
                    ? `${sessionLateAfterMinutes} min after start`
                    : "Not configured"}
              </strong>
            </div>
            <div>
              <span>SESSION END</span>
              <strong>
                {sessionScheduledEndAt
                  ? formatSchoolTime(sessionScheduledEndAt)
                  : "Manual"}
              </strong>
            </div>
            <div>
              <span>CLASS ADVISER</span>
              <strong>{adviserName}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="attendance-live-report-section">
        <header className="attendance-live-report-header">
          <div>
            <span>LIVE CLASS RECORD</span>
            <h2>Student Attendance Register</h2>
            <p>
              Review the current session, manage manual attendance, and quickly
              find students without leaving the live scanner.
            </p>
          </div>
        </header>

        <div className="attendance-report-summary">
          <div className="attendance-summary-card is-students">
            <span>STUDENTS</span>
            <strong>{activeStudents.length}</strong>
          </div>
          <div className="attendance-summary-card is-present">
            <span>PRESENT</span>
            <strong className="is-success">{presentCount}</strong>
          </div>
          <div className="attendance-summary-card is-late">
            <span>LATE</span>
            <strong>{lateCount}</strong>
          </div>
          <div className="attendance-summary-card is-remaining">
            <span>REMAINING</span>
            <strong>{remainingCount}</strong>
          </div>
          <div className="attendance-summary-card is-completion">
            <span>COMPLETION</span>
            <strong>{completionPercentage}%</strong>
          </div>
        </div>

        <div className="attendance-report-toolbar">
          <div className="attendance-report-search-block">
            <label
              className="attendance-report-search"
              htmlFor="attendance-search"
            >
              <span aria-hidden="true">⌕</span>
              <input
                id="attendance-search"
                type="search"
                value={searchQuery}
                placeholder="Search student name or student number..."
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear student search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </label>

            <div className="attendance-report-toolbar-right">
              <div className="attendance-report-result-copy">
                <strong>{totalFilteredStudents}</strong>
                <span>
                  result{totalFilteredStudents === 1 ? "" : "s"} found
                </span>
              </div>

              {filtersAreActive && (
                <button
                  type="button"
                  className="attendance-view-reset-button"
                  onClick={resetAttendanceView}
                >
                  Reset
                </button>
              )}

              <div className="attendance-filter-menu" ref={filterMenuRef}>
                <button
                  type="button"
                  className={`attendance-filter-trigger ${filterMenuOpen ? "is-open" : ""} ${
                    filterMenuActiveCount ? "has-active" : ""
                  }`}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterMenuOpen((current) => !current)}
                >
                  <span
                    className="attendance-filter-trigger-icon"
                    aria-hidden="true"
                  >
                    ☷
                  </span>
                  <span>Filters</span>
                  {filterMenuActiveCount > 0 && (
                    <strong>{filterMenuActiveCount}</strong>
                  )}
                  <i aria-hidden="true">▾</i>
                </button>

                {filterMenuOpen && (
                  <div
                    className="attendance-filter-popover"
                    role="dialog"
                    aria-label="Attendance filters and table view"
                  >
                    <div className="attendance-filter-popover-header">
                      <div>
                        <strong>Filters</strong>
                        <span>Refine the attendance list</span>
                      </div>
                      <button
                        type="button"
                        aria-label="Close filters"
                        onClick={() => setFilterMenuOpen(false)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="attendance-filter-popover-list">
                      <label className="attendance-filter-field is-status">
                        <span className="attendance-filter-field-label">
                          <i aria-hidden="true" />
                          Status
                        </span>
                        <select
                          value={attendanceStatusFilter}
                          onChange={(event) =>
                            setAttendanceStatusFilter(event.target.value)
                          }
                        >
                          <option value="ALL">All statuses</option>
                          <option value="PRESENT">Present only</option>
                          <option value="LATE">Late only</option>
                          <option value="PENDING">Pending only</option>
                        </select>
                      </label>

                      <label className="attendance-filter-field is-method">
                        <span className="attendance-filter-field-label">
                          <i aria-hidden="true" />
                          Method
                        </span>
                        <select
                          value={attendanceMethodFilter}
                          onChange={(event) =>
                            setAttendanceMethodFilter(event.target.value)
                          }
                        >
                          <option value="ALL">All methods</option>
                          <option value="FACE">Face recognition</option>
                          <option value="MANUAL">Manual entry</option>
                        </select>
                      </label>

                      <label className="attendance-filter-field is-sort">
                        <span className="attendance-filter-field-label">
                          <i aria-hidden="true" />
                          Sort by
                        </span>
                        <select
                          value={attendanceSort}
                          onChange={(event) =>
                            setAttendanceSort(event.target.value)
                          }
                        >
                          <option value="DEFAULT">Default roster order</option>
                          <option value="NAME_ASC">Name A–Z</option>
                          <option value="NAME_DESC">Name Z–A</option>
                          <option value="NUMBER_ASC">Student number</option>
                          <option value="RECENT">Most recently recorded</option>
                        </select>
                      </label>

                      <label className="attendance-filter-field is-rows">
                        <span className="attendance-filter-field-label">
                          <i aria-hidden="true" />
                          Rows
                        </span>
                        <select
                          value={pageSize}
                          onChange={(event) =>
                            setPageSize(Number(event.target.value))
                          }
                        >
                          <option value={10}>10 per page</option>
                          <option value={15}>15 per page</option>
                          <option value={25}>25 per page</option>
                          <option value={50}>50 per page</option>
                        </select>
                      </label>
                    </div>

                    <div className="attendance-filter-popover-footer">
                      <button
                        type="button"
                        className="is-reset"
                        disabled={!filtersAreActive}
                        onClick={resetAttendanceView}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="is-done"
                        onClick={() => setFilterMenuOpen(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {filterMenuActiveCount > 0 && (
            <div
              className="attendance-active-filter-chips"
              aria-label="Active filters"
            >
              {attendanceStatusFilter !== "ALL" && (
                <span className="is-status">
                  Status: {getAttendanceStatusLabel(attendanceStatusFilter)}
                </span>
              )}
              {attendanceMethodFilter !== "ALL" && (
                <span className="is-method">
                  Method:{" "}
                  {attendanceMethodFilter === "FACE" ? "Face" : "Manual"}
                </span>
              )}
              {attendanceSort !== "DEFAULT" && (
                <span className="is-sort">Custom sort</span>
              )}
              {pageSize !== 10 && (
                <span className="is-rows">{pageSize} rows</span>
              )}
            </div>
          )}
        </div>

        {manualMessage && (
          <div className="attendance-inline-feedback is-success">
            ✓ {manualMessage}
          </div>
        )}
        {manualError && (
          <div className="attendance-inline-feedback is-error">
            ! {manualError}
          </div>
        )}

        <div className="attendance-live-table-shell">
          <table className="attendance-live-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Number</th>
                <th>Student</th>
                <th>Status</th>
                <th>Recorded At</th>
                <th>Method</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudentRows.length ? (
                paginatedStudentRows.map(
                  ({ student, record, status, attended }, index) => {
                    const marking = markingStudentId === student.id;
                    const removing = removingStudentId === student.id;
                    const methodLabel = record
                      ? getRecordMethod(record) || "Attendance"
                      : "—";
                    const methodUpper = String(methodLabel).toUpperCase();
                    const methodClass = !record
                      ? "is-empty"
                      : methodUpper.includes("FACE")
                        ? "is-face"
                        : methodUpper.includes("MANUAL")
                          ? "is-manual"
                          : "is-generic";
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const statusClass = getAttendanceStatusClass(status);
                    const statusLabel = getAttendanceStatusLabel(status);

                    return (
                      <tr
                        key={student.id || student.studentNumber}
                        className={
                          status === "PRESENT"
                            ? "is-present"
                            : status === "LATE"
                              ? "is-late"
                              : status === "ABSENT"
                                ? "is-absent"
                                : ""
                        }
                      >
                        <td>{String(rowNumber).padStart(2, "0")}</td>
                        <td>
                          <span className="attendance-live-student-number">
                            {student.studentNumber || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="attendance-live-student">
                            <span>
                              {student.name?.charAt(0)?.toUpperCase() || "S"}
                            </span>
                            <div>
                              <strong>
                                {student.name || "Unnamed Student"}
                              </strong>
                              <small>{sectionName}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`attendance-live-status ${statusClass}`}
                          >
                            <i />
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {record
                            ? formatSchoolTime(getRecordTime(record))
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`attendance-live-method ${methodClass}`}
                          >
                            {methodLabel}
                          </span>
                        </td>
                        <td>
                          {attended ? (
                            <button
                              type="button"
                              className="attendance-live-remove"
                              disabled={!sessionIsActive || removing}
                              onClick={() =>
                                void handleRemoveAttendance(student)
                              }
                            >
                              {removing ? "Removing..." : "Remove"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="attendance-live-mark"
                              disabled={
                                !sessionIsActive ||
                                marking ||
                                status === "ABSENT"
                              }
                              onClick={() => void handleMarkPresent(student)}
                            >
                              {marking
                                ? "Recording..."
                                : status === "ABSENT"
                                  ? "Session Ended"
                                  : "Record Attendance"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="attendance-table-empty-state">
                      <span>⌕</span>
                      <strong>No students match these filters</strong>
                      <p>
                        Try changing the search term or clearing one of the
                        attendance filters.
                      </p>
                      {filtersAreActive && (
                        <button type="button" onClick={resetAttendanceView}>
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="attendance-pagination-bar">
          <div className="attendance-pagination-copy">
            <span>Showing</span>
            <strong>
              {visibleStart}–{visibleEnd}
            </strong>
            <span>of {totalFilteredStudents} students</span>
          </div>

          {totalFilteredStudents > 0 && (
            <div
              className="attendance-pagination-controls"
              aria-label="Pagination"
            >
              <button
                type="button"
                className="attendance-pagination-nav"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </button>

              <div className="attendance-pagination-pages">
                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <button
                      type="button"
                      key={item}
                      className={currentPage === item ? "is-active" : ""}
                      aria-current={currentPage === item ? "page" : undefined}
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} aria-hidden="true">
                      …
                    </span>
                  ),
                )}
              </div>

              <button
                type="button"
                className="attendance-pagination-nav"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                Next
              </button>
            </div>
          )}
        </footer>
      </section>

      {showEndModal && (
        <div
          className="attendance-live-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !endingSession) {
              setShowEndModal(false);
              setEndError("");
            }
          }}
        >
          <section
            className="attendance-live-end-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="attendance-live-end-modal-icon">!</div>
            <span>ATTENDANCE SESSION</span>
            <h2>End attendance session?</h2>
            <p>
              Face scanning and manual attendance will stop for this session.
            </p>

            <div className="attendance-live-end-summary">
              <div>
                <span>PRESENT</span>
                <strong>{presentCount}</strong>
              </div>
              <div>
                <span>LATE</span>
                <strong>{lateCount}</strong>
              </div>
              <div>
                <span>REMAINING</span>
                <strong>{remainingCount}</strong>
              </div>
            </div>

            {endError && (
              <div className="attendance-live-end-error">{endError}</div>
            )}

            <div className="attendance-live-end-actions">
              <button
                type="button"
                disabled={endingSession}
                onClick={() => {
                  setShowEndModal(false);
                  setEndError("");
                }}
              >
                Keep Session Active
              </button>
              <button
                type="button"
                className="is-danger"
                disabled={endingSession}
                onClick={() => void handleEndSession()}
              >
                {endingSession ? "Ending..." : "End Session"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default AttendanceSession;
