
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";
import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import seniorHighSchoolLogo from "../../assets/shs-logo.svg";

import "../../styles/adviser/attendanceSession.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PH_TIME_ZONE = "Asia/Manila";

const AUTO_ALIGN_DELAY = 1400;
const AUTO_COUNTDOWN_STEP = 700;
const RESULT_HOLD_SUCCESS = 3600;
const RESULT_HOLD_ERROR = 2200;

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) => (Array.isArray(data) ? data : []);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  fallbackMessage;

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

const getRecordStatus = (record) => {
  const status = String(record?.status || "").trim().toUpperCase();

  /*
   * Legacy attendance records created before explicit
   * status support are treated as PRESENT.
   */
  return status || "PRESENT";
};

const isPresentRecord = (record) =>
  getRecordStatus(record) === "PRESENT";

const isLateRecord = (record) =>
  getRecordStatus(record) === "LATE";

const isAttendedRecord = (record) => {
  const status = getRecordStatus(record);

  return status === "PRESENT" || status === "LATE";
};

const getAttendanceStatusLabel = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PRESENT") {
    return "Present";
  }

  if (normalizedStatus === "LATE") {
    return "Late";
  }

  if (normalizedStatus === "ABSENT") {
    return "Absent";
  }

  return "Pending";
};

const getAttendanceStatusClass = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PRESENT") {
    return "is-present";
  }

  if (normalizedStatus === "LATE") {
    return "is-late";
  }

  if (normalizedStatus === "ABSENT") {
    return "is-absent";
  }

  return "is-pending";
};

const toSchoolDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const raw = value.trim();

    /*
     * Backend LocalDateTime values do not contain a timezone.
     * Interpret those values explicitly as Philippine time.
     */
    if (
      /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(
        raw,
      )
    ) {
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

  const minute = twoDigits(minuteValue);

  const seconds = includeSeconds ? `:${twoDigits(secondValue || 0)}` : "";

  return `${normalizedHour}:${minute}${seconds} ${period}`;
};

const formatSchoolTime = (value, includeSeconds = true) => {
  if (!value) {
    return "—";
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (
      raw.length >= 16 &&
      raw[4] === "-" &&
      raw[7] === "-" &&
      (raw[10] === "T" || raw[10] === " ")
    ) {
      const hour = raw.slice(11, 13);

      const minute = raw.slice(14, 16);

      const second = raw.length >= 19 ? raw.slice(17, 19) : "00";

      return toTwelveHourTime(hour, minute, second, includeSeconds);
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

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

const canvasToImageFile = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to capture camera image."));

          return;
        }

        resolve(
          new File([blob], `attendance-face-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.94,
    );
  });

/* =========================================================
   COMPONENT
========================================================= */

function AttendanceSession() {
  const { sessionId } = useParams();

  const navigate = useNavigate();

  const user = authService.getUser();

  /* =======================================================
     REFS
  ======================================================= */

  const videoRef = useRef(null);

  const canvasRef = useRef(null);

  const streamRef = useRef(null);

  const autoTimerRef = useRef(null);

  const resultTimerRef = useRef(null);

  const scanLockRef = useRef(false);

  const filterMenuRef = useRef(null);

  /* =======================================================
     DATA
  ======================================================= */

  const [section, setSection] = useState(null);

  const [students, setStudents] = useState([]);

  const [activeSession, setActiveSession] = useState(null);

  const [sessionRecords, setSessionRecords] = useState([]);

  /* =======================================================
     PAGE
  ======================================================= */

  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  const [liveClock, setLiveClock] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState("");

  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("ALL");

  const [attendanceMethodFilter, setAttendanceMethodFilter] = useState("ALL");

  const [attendanceSort, setAttendanceSort] = useState("DEFAULT");

  const [pageSize, setPageSize] = useState(10);

  const [currentPage, setCurrentPage] = useState(1);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  /* =======================================================
     CAMERA / AUTO SCAN
  ======================================================= */

  const [cameraActive, setCameraActive] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);

  const [cameraError, setCameraError] = useState("");

  const [autoScanEnabled, setAutoScanEnabled] = useState(true);

  const [scannerState, setScannerState] = useState("idle");

  const [countdown, setCountdown] = useState(null);

  const [recognizing, setRecognizing] = useState(false);

  const [recognitionResult, setRecognitionResult] = useState(null);

  /* =======================================================
     MANUAL ATTENDANCE
  ======================================================= */

  const [markingStudentId, setMarkingStudentId] = useState("");

  const [removingStudentId, setRemovingStudentId] = useState("");

  const [manualMessage, setManualMessage] = useState("");

  const [manualError, setManualError] = useState("");

  /* =======================================================
     SESSION END
  ======================================================= */

  const [showEndModal, setShowEndModal] = useState(false);

  const [endingSession, setEndingSession] = useState(false);

  const [endError, setEndError] = useState("");

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setPageError("");

        if (!sessionId) {
          throw new Error("Attendance session ID is missing.");
        }

        const [sectionData, studentData, recordData] = await Promise.all([
          adviserService.getSections(),
          adviserService.getStudents(),
          adviserService.getSessionRecords(sessionId),
        ]);

        if (!mounted) {
          return;
        }

        const sections = normalizeArray(sectionData);

        const allStudents = normalizeArray(studentData);

        const records = normalizeArray(recordData);

        const assignedSection =
          sections.find((item) => item.active !== false) || sections[0] || null;

        setSection(assignedSection);

        const scopedStudents = assignedSection?.id
          ? allStudents.filter((student) => {
              const studentSectionId = getStudentSectionId(student);

              return (
                !studentSectionId ||
                String(studentSectionId) === String(assignedSection.id)
              );
            })
          : allStudents;

        setStudents(scopedStudents);

        setSessionRecords(records);

        if (!assignedSection?.id) {
          setActiveSession(null);

          setPageError("No assigned section is available.");

          return;
        }

        const currentSession = await adviserService.getActiveSession(
          assignedSection.id,
        );

        if (!mounted) {
          return;
        }

        const currentSessionId = getSessionId(currentSession);

        if (!currentSession || String(currentSessionId) !== String(sessionId)) {
          setActiveSession(null);

          setPageError("This attendance session is no longer active.");

          return;
        }

        setActiveSession(currentSession);
      } catch (requestError) {
        console.error("Unable to load attendance session:", requestError);

        if (!mounted) {
          return;
        }

        setPageError(
          getErrorMessage(
            requestError,
            requestError?.message || "Unable to load attendance session.",
          ),
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  /* =======================================================
     LIVE CLOCK
  ======================================================= */

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveClock(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  /* =======================================================
     DERIVED
  ======================================================= */

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
      const studentId = getRecordStudentId(record);

      if (studentId) {
        ids.add(String(studentId));
      }
    });

    return ids;
  }, [attendedRecords]);

  const presentCount = presentRecords.length;

  const lateCount = lateRecords.length;

  const attendedCount =
    attendedStudentIds.size || attendedRecords.length;

  const remainingCount = Math.max(
    activeStudents.length - attendedCount,
    0,
  );

  const completionPercentage = activeStudents.length
    ? Math.min(
        100,
        Math.round(
          (attendedCount / activeStudents.length) * 100,
        ),
      )
    : 0;

  const sectionName = section?.name || "Assigned Section";

  const adviserName =
    user?.name?.trim() || section?.adviserName || "Class Adviser";

  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    "";

  const sessionLateAfterMinutes =
    activeSession?.lateAfterMinutes ?? null;

  const sessionLateCutoffAt =
    activeSession?.lateCutoffAt || "";

  const sessionScheduledEndAt =
    activeSession?.scheduledEndAt || "";

  const scheduledEndDate =
    toSchoolDate(sessionScheduledEndAt);

  const scheduledEndReached = Boolean(
    scheduledEndDate &&
      liveClock.getTime() >= scheduledEndDate.getTime(),
  );

  const sessionIsActive = Boolean(
    activeSession &&
      String(getSessionId(activeSession)) === String(sessionId) &&
      !scheduledEndReached,
  );

  const attendanceRows = useMemo(
    () =>
      activeStudents.map((student, originalIndex) => {
        const record = sessionRecords.find(
          (item) =>
            String(getRecordStudentId(item)) === String(student.id),
        );

        const status = record
          ? getRecordStatus(record)
          : "PENDING";

        const attended = record
          ? isAttendedRecord(record)
          : false;

        return {
          student,
          record,
          status,
          attended,
          originalIndex,
        };
      }),
    [activeStudents, sessionRecords],
  );

  const filteredStudentRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rows = attendanceRows.filter(
      ({ student, record, status }) => {
        const name = String(
          student?.name || "",
        ).toLowerCase();

        const number = String(
          student?.studentNumber || "",
        ).toLowerCase();

        const method = String(
          getRecordMethod(record) || "",
        ).toUpperCase();

        const matchesSearch =
          !query ||
          name.includes(query) ||
          number.includes(query);

        const matchesStatus =
          attendanceStatusFilter === "ALL" ||
          attendanceStatusFilter === status;

        const matchesMethod =
          attendanceMethodFilter === "ALL" ||
          (attendanceMethodFilter === "FACE" &&
            method.includes("FACE")) ||
          (attendanceMethodFilter === "MANUAL" &&
            method.includes("MANUAL"));

        return (
          matchesSearch &&
          matchesStatus &&
          matchesMethod
        );
      },
    );

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
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items = [1];

    if (currentPage > 4) {
      items.push("left-ellipsis");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (currentPage < totalPages - 3) {
      items.push("right-ellipsis");
    }

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
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target)
      ) {
        setFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterMenuOpen]);

  /* =======================================================
     TIMERS
  ======================================================= */

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

  /* =======================================================
     RECORD REFRESH
  ======================================================= */

  const refreshRecords = useCallback(async () => {
    if (!sessionId) {
      return [];
    }

    const data = await adviserService.getSessionRecords(sessionId);

    const records = normalizeArray(data);

    setSessionRecords(records);

    return records;
  }, [sessionId]);

  /* =======================================================
     CAMERA
  ======================================================= */

  const stopCamera = useCallback(() => {
    clearAutoTimer();

    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);

    setCameraReady(false);

    setCountdown(null);

    setScannerState("idle");
  }, [clearAutoTimer]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError("");
      setScannerState("starting");

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not supported by this browser.");

        setScannerState("idle");

        return;
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
        },
        audio: false,
      });

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());

        return;
      }

      streamRef.current = stream;

      video.srcObject = stream;

      setCameraActive(true);

      await video.play();
    } catch (requestError) {
      console.error("Unable to start camera:", requestError);

      stopCamera();

      if (requestError?.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access in your browser.",
        );

        return;
      }

      if (requestError?.name === "NotFoundError") {
        setCameraError("No camera was detected on this device.");

        return;
      }

      if (requestError?.name === "NotReadableError") {
        setCameraError(
          "The camera is currently being used by another application.",
        );

        return;
      }

      setCameraError("Unable to access the camera.");
    }
  }, [stopCamera]);

  /* =======================================================
     SCHEDULED SESSION END GUARD
  ======================================================= */

  useEffect(() => {
    if (!scheduledEndReached) {
      return;
    }

    clearAutoTimer();
    clearResultTimer();

    scanLockRef.current =
      false;

    setAutoScanEnabled(
      false,
    );

    setRecognitionResult(
      null,
    );

    stopCamera();

    setPageError(
      "This attendance session has reached its scheduled end time. Attendance recording is now closed.",
    );
  }, [
    scheduledEndReached,
    clearAutoTimer,
    clearResultTimer,
    stopCamera,
  ]);

  /* =======================================================
     AUTO OPEN CAMERA
  ======================================================= */

  useEffect(() => {
    if (loading || !sessionIsActive || cameraActive) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void startCamera();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [loading, sessionIsActive, cameraActive, startCamera]);

  /* =======================================================
     RECOGNITION
  ======================================================= */

  const captureAndRecognize = useCallback(
    async ({ manual = false } = {}) => {
      if (
        !sessionId ||
        !sessionIsActive ||
        recognizing ||
        scanLockRef.current
      ) {
        return;
      }

      if (!cameraActive || !cameraReady) {
        if (manual) {
          setCameraError("Camera is not ready yet.");
        }

        return;
      }

      const video = videoRef.current;

      const canvas = canvasRef.current;

      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        setCameraError("Unable to capture the current camera frame.");

        return;
      }

      scanLockRef.current = true;

      const previousAttendedIds = new Set(
        attendedStudentIds,
      );

      try {
        clearAutoTimer();
        clearResultTimer();

        setRecognizing(true);

        setCountdown(null);

        setScannerState("processing");

        setCameraError("");

        setRecognitionResult(null);

        canvas.width = video.videoWidth;

        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to prepare the camera image.");
        }

        /*
         * Preview is mirrored through CSS.
         * Submitted frame stays original
         * for consistent recognition.
         */
        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const imageFile =
          await canvasToImageFile(
            canvas,
          );

        const result =
          await adviserService.markFaceAttendance({
            sessionId,
            imageFile,
          });

        const refreshedRecords =
          await refreshRecords();

        let recognizedStudentId =
          result?.studentId ||
          result?.student?.id ||
          result?.attendanceRecord?.studentId ||
          result?.attendanceRecord?.student?.id ||
          "";

        let recognizedRecord =
          null;

        if (recognizedStudentId) {
          recognizedRecord =
            refreshedRecords.find(
              (record) =>
                String(
                  getRecordStudentId(
                    record,
                  ),
                ) ===
                String(
                  recognizedStudentId,
                ),
            );
        }

        if (!recognizedStudentId) {
          recognizedRecord =
            refreshedRecords.find(
              (record) => {
                const recordStudentId =
                  getRecordStudentId(
                    record,
                  );

                return (
                  recordStudentId &&
                  !previousAttendedIds.has(
                    String(
                      recordStudentId,
                    ),
                  ) &&
                  isAttendedRecord(
                    record,
                  )
                );
              },
            );

          recognizedStudentId =
            getRecordStudentId(
              recognizedRecord,
            );
        }

        const recognizedStudent =
          students.find(
            (student) =>
              String(student.id) ===
              String(
                recognizedStudentId,
              ),
          );

        const studentName =
          result?.studentName ||
          result?.student?.name ||
          getRecordStudentName(
            recognizedRecord,
          ) ||
          recognizedStudent?.name ||
          "Recognized Student";

        const studentNumber =
          result?.studentNumber ||
          result?.student
            ?.studentNumber ||
          getRecordStudentNumber(
            recognizedRecord,
          ) ||
          recognizedStudent
            ?.studentNumber ||
          "—";

        const recordedAt =
          getRecordTime(
            recognizedRecord,
          ) ||
          result?.recordedAt ||
          result?.attendanceRecord
            ?.recordedAt ||
          new Date();

        const responseStatus =
          String(
            result?.attendanceStatus ||
              result?.attendanceRecord
                ?.status ||
              "",
          )
            .trim()
            .toUpperCase();

        const attendanceStatus =
          recognizedRecord
            ? getRecordStatus(
                recognizedRecord,
              )
            : responseStatus ===
                  "LATE" ||
                responseStatus ===
                  "PRESENT"
              ? responseStatus
              : "PRESENT";

        setRecognitionResult({
          type: "success",
          status:
            attendanceStatus ===
            "LATE"
              ? "MARKED LATE"
              : "MARKED PRESENT",
          attendanceStatus,
          name: studentName,
          studentNumber,
          sectionName,
          recordedAt,
          method:
            "Face Recognition",
          message:
            result?.message ||
            (attendanceStatus ===
            "LATE"
              ? "Attendance recorded as late."
              : "Attendance recorded successfully."),
        });

        setScannerState(
          "success",
        );

        resultTimerRef.current =
          window.setTimeout(
            () => {
              setRecognitionResult(
                null,
              );

              setScannerState(
                "ready",
              );

              scanLockRef.current =
                false;
            },
            RESULT_HOLD_SUCCESS,
          );
      } catch (requestError) {
        console.error("Face attendance failed:", requestError);

        const status = requestError?.response?.status;

        const responseMessage =
          getErrorMessage(
            requestError,
            "",
          );

        const normalizedResponseMessage =
          responseMessage.toLowerCase();

        const sessionEndedConflict =
          status === 409 &&
          (normalizedResponseMessage.includes(
            "scheduled end",
          ) ||
            normalizedResponseMessage.includes(
              "session has reached",
            ) ||
            normalizedResponseMessage.includes(
              "session is no longer active",
            ));

        let title =
          "Face Not Recognized";

        let message =
          "No registered student matched the captured face.";

        let resultType =
          "error";

        if (sessionEndedConflict) {
          title = "Session Ended";

          message =
            "Attendance recording is already closed for this session.";

          setPageError(
            responseMessage ||
              message,
          );

          stopCamera();
        } else if (status === 409) {
          title =
            "Already Recorded";

          message =
            "This student already has an attendance record for this session.";

          resultType =
            "warning";
        } else if (status === 403) {
          title = "Wrong Section";

          message =
            "The recognized student does not belong to this section.";
        } else if (status !== 422) {
          title =
            "Recognition Failed";

          message =
            "Unable to process the face attendance request.";
        }

        setRecognitionResult({
          type: resultType,
          status:
            title.toUpperCase(),
          name: title,
          studentNumber: "—",
          sectionName,
          recordedAt: new Date(),
          method:
            "Face Recognition",
          message:
            responseMessage ||
            message,
        });

        setScannerState(resultType === "warning" ? "warning" : "error");

        resultTimerRef.current = window.setTimeout(() => {
          setRecognitionResult(null);

          setScannerState("ready");

          scanLockRef.current = false;
        }, RESULT_HOLD_ERROR);
      } finally {
        setRecognizing(false);

        if (!resultTimerRef.current) {
          scanLockRef.current = false;
        }
      }
    },
    [
      sessionId,
      sessionIsActive,
      recognizing,
      cameraActive,
      cameraReady,
      attendedStudentIds,
      clearAutoTimer,
      clearResultTimer,
      refreshRecords,
      students,
      sectionName,
      stopCamera,
      setCameraError,
    ],
  );

  /* =======================================================
     AUTO SCAN LOOP
  ======================================================= */

  useEffect(() => {
    clearAutoTimer();

    if (
      !autoScanEnabled ||
      !sessionIsActive ||
      !cameraActive ||
      !cameraReady ||
      recognizing ||
      recognitionResult ||
      scanLockRef.current
    ) {
      return undefined;
    }

    setScannerState("aligning");

    setCountdown(null);

    autoTimerRef.current = window.setTimeout(() => {
      setScannerState("countdown");

      setCountdown(3);

      const runStep = (nextValue) => {
        autoTimerRef.current = window.setTimeout(() => {
          if (nextValue > 0) {
            setCountdown(nextValue);

            runStep(nextValue - 1);

            return;
          }

          setCountdown(null);

          void captureAndRecognize();
        }, AUTO_COUNTDOWN_STEP);
      };

      runStep(2);
    }, AUTO_ALIGN_DELAY);

    return () => {
      clearAutoTimer();
    };
  }, [
    autoScanEnabled,
    sessionIsActive,
    cameraActive,
    cameraReady,
    recognizing,
    recognitionResult,
    captureAndRecognize,
    clearAutoTimer,
  ]);

  /* =======================================================
     CAMERA CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      clearAutoTimer();
      clearResultTimer();

      const stream = streamRef.current;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = null;
    };
  }, [clearAutoTimer, clearResultTimer]);

  /* =======================================================
     SCANNER COPY
  ======================================================= */

  const scannerCopy = useMemo(() => {
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

    if (scannerState === "warning") {
      return {
        eyebrow: "ALREADY RECORDED",
        title: "Attendance already exists",
        description: "The scanner will resume automatically.",
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
        eyebrow: "FACE POSITION ACCEPTED",
        title: "Hold still",
        description: "Automatic capture is starting.",
      };
    }

    if (scannerState === "aligning") {
      return {
        eyebrow: "AUTO SCAN ACTIVE",
        title: "Center your face",
        description: "Look directly at the camera and hold still.",
      };
    }

    if (cameraActive && cameraReady) {
      return {
        eyebrow: autoScanEnabled ? "AUTO SCAN ACTIVE" : "SCANNER READY",
        title: autoScanEnabled
          ? "Ready for the next student"
          : "Position one student in frame",
        description: autoScanEnabled
          ? "The camera will capture automatically."
          : "Use Scan Now when the student is ready.",
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
  }, [scannerState, cameraActive, cameraReady, autoScanEnabled]);

  /* =======================================================
     MANUAL ATTENDANCE
  ======================================================= */

  const handleMarkPresent = async (student) => {
    if (!sessionId || !student?.id || !sessionIsActive) {
      return;
    }

    try {
      setMarkingStudentId(student.id);

      setManualError("");

      setManualMessage("");

      await adviserService.markManualAttendance({
        sessionId,
        studentId: student.id,
      });

      const refreshedRecords =
        await refreshRecords();

      const savedRecord =
        refreshedRecords.find(
          (record) =>
            String(
              getRecordStudentId(
                record,
              ),
            ) ===
            String(student.id),
        );

      const savedStatus =
        savedRecord
          ? getRecordStatus(
              savedRecord,
            )
          : "PRESENT";

      setManualMessage(
        savedStatus === "LATE"
          ? `${student.name} was recorded as late.`
          : `${student.name} was marked present.`,
      );
    } catch (requestError) {
      console.error(
        "Manual attendance failed:",
        requestError,
      );

      setManualError(
        getErrorMessage(
          requestError,
          requestError?.response?.status ===
            409
            ? "The student already has an attendance record for this session."
            : "Unable to record the student's attendance.",
        ),
      );
    } finally {
      setMarkingStudentId("");
    }
  };

  const handleRemoveAttendance = async (student) => {
    if (!sessionId || !student?.id || !sessionIsActive) {
      return;
    }

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

  /* =======================================================
     END SESSION
  ======================================================= */

  const handleEndSession = async () => {
    if (!sessionId || endingSession) {
      return;
    }

    try {
      setEndingSession(true);

      setEndError("");

      await adviserService.endAttendanceSession(sessionId);

      stopCamera();

      setShowEndModal(false);

      navigate("/adviser/attendance", {
        replace: true,
      });
    } catch (requestError) {
      console.error("Unable to end attendance session:", requestError);

      setEndError(
        getErrorMessage(requestError, "Unable to end the attendance session."),
      );
    } finally {
      setEndingSession(false);
    }
  };

  /* =======================================================
     SCROLL LOCK MODAL
  ======================================================= */

  useEffect(() => {
    if (!showEndModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showEndModal]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="attendance-live-page">
      {/* =================================================
          TOP BAR
      ================================================== */}

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
            className={`attendance-live-session-pill ${
              scheduledEndReached
                ? "is-ended"
                : ""
            }`}
          >
            <i />
            {scheduledEndReached
              ? "SESSION ENDED"
              : "ACTIVE SESSION"}
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

      {/* =================================================
          ERROR
      ================================================== */}

      {pageError && (
        <div className="attendance-live-page-error">
          <strong>Attendance Session</strong>

          <span>{pageError}</span>
        </div>
      )}

      {/* =================================================
          CAMERA-FIRST LANDING
      ================================================== */}

      <section className="attendance-live-hero">
        {/* CAMERA */}

        <div className="attendance-live-camera-column">
          <div className="attendance-live-camera-header">
            <div>
              <span>FACE RECOGNITION ATTENDANCE</span>

              <h1>Live Attendance Scanner</h1>

              <p>
                Students only need to face the camera. Attendance is captured
                and recorded automatically.
              </p>
            </div>

            <div className="attendance-live-header-actions">
              <button
                type="button"
                className={`attendance-auto-toggle ${
                  autoScanEnabled ? "is-on" : ""
                }`}
                disabled={!sessionIsActive}
                onClick={() => {
                  clearAutoTimer();

                  setCountdown(null);

                  setAutoScanEnabled((current) => !current);
                }}
              >
                <span aria-hidden="true" />
                Auto Scan {autoScanEnabled ? "ON" : "OFF"}
              </button>

              <button
                type="button"
                className="attendance-scan-now-button"
                disabled={
                  !sessionIsActive ||
                  !cameraActive ||
                  !cameraReady ||
                  recognizing
                }
                onClick={() =>
                  void captureAndRecognize({
                    manual: true,
                  })
                }
              >
                Scan Now
              </button>
            </div>
          </div>

          <div
            className={`attendance-live-camera-shell scanner-${scannerState}`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraActive ? "is-active" : ""}
              onCanPlay={() => {
                setCameraReady(true);

                setScannerState("ready");
              }}
            />

            <canvas ref={canvasRef} hidden />

            {!cameraActive && (
              <div className="attendance-live-camera-placeholder">
                <div className="attendance-live-camera-placeholder-icon">◎</div>

                <span>CAMERA OFF</span>

                <h2>Start the face scanner</h2>

                <p>Allow camera access to begin automated attendance.</p>

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
                  LIVE
                </div>

                <div className="attendance-camera-stats">
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

                {recognizing && (
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
              Camera preview is mirrored for natural positioning. Recognition
              uses the original frame.
            </span>

            <button
              type="button"
              disabled={recognizing}
              onClick={cameraActive ? stopCamera : () => void startCamera()}
            >
              {cameraActive ? "Turn Camera Off" : "Turn Camera On"}
            </button>
          </div>
        </div>

        {/* RESULT PANEL */}

        <aside
          className={`attendance-live-result-panel ${
            recognitionResult ? `is-${recognitionResult.type}` : ""
          } ${
            recognitionResult?.attendanceStatus === "LATE"
              ? "is-late"
              : ""
          }`}
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

              <h2>Ready for attendance</h2>

              <p>
                The recognized student's information will appear here
                automatically.
              </p>

              <div className="attendance-result-empty-steps">
                <div>
                  <span>01</span>

                  <p>Student faces the camera</p>
                </div>

                <div>
                  <span>02</span>

                  <p>System recognizes identity</p>
                </div>

                <div>
                  <span>03</span>

                  <p>Attendance status is recorded</p>
                </div>
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
                    {recognitionResult.type === "success"
                      ? recognitionResult.attendanceStatus || "PRESENT"
                      : recognitionResult.type === "warning"
                        ? "ALREADY RECORDED"
                        : "NOT RECORDED"}
                  </strong>
                </div>
              </div>

              <p className="attendance-result-message">
                {recognitionResult.message}
              </p>

              <button
                type="button"
                onClick={() => {
                  clearResultTimer();

                  setRecognitionResult(null);

                  setScannerState("ready");

                  scanLockRef.current = false;
                }}
              >
                Next Student
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

      {/* =================================================
          LOWER CONTROL / REPORT SECTION
      ================================================== */}

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
                  className={`attendance-filter-trigger ${
                    filterMenuOpen ? "is-open" : ""
                  } ${filterMenuActiveCount ? "has-active" : ""}`}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterMenuOpen((current) => !current)}
                >
                  <span className="attendance-filter-trigger-icon" aria-hidden="true">
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
            <div className="attendance-active-filter-chips" aria-label="Active filters">
              {attendanceStatusFilter !== "ALL" && (
                <span className="is-status">
                  Status: {getAttendanceStatusLabel(
                    attendanceStatusFilter,
                  )}
                </span>
              )}

              {attendanceMethodFilter !== "ALL" && (
                <span className="is-method">
                  Method: {attendanceMethodFilter === "FACE" ? "Face" : "Manual"}
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
                    const marking =
                      markingStudentId === student.id;

                    const removing =
                      removingStudentId === student.id;

                    const methodLabel = record
                      ? getRecordMethod(record) || "Attendance"
                      : "—";

                    const methodUpper =
                      String(methodLabel).toUpperCase();

                    const methodClass = !record
                      ? "is-empty"
                      : methodUpper.includes("FACE")
                        ? "is-face"
                        : methodUpper.includes("MANUAL")
                          ? "is-manual"
                          : "is-generic";

                    const rowNumber =
                      (currentPage - 1) * pageSize + index + 1;

                    const statusClass =
                      getAttendanceStatusClass(status);

                    const statusLabel =
                      getAttendanceStatusLabel(status);

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
                              <strong>{student.name || "Unnamed Student"}</strong>

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
                              onClick={() =>
                                void handleMarkPresent(student)
                              }
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
                })
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
                        <button
                          type="button"
                          onClick={resetAttendanceView}
                        >
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
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
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

      {/* =================================================
          END MODAL
      ================================================== */}

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
