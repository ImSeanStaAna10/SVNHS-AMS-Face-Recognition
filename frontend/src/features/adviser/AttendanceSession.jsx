import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import depedLogo from "../../assets/kagawaran-educ-logo.svg";
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

const isPresentRecord = (record) => {
  const status = String(record?.status || "").toUpperCase();

  return !status || status === "PRESENT";
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

const formatShortDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(value);

const sanitizeFileName = (value) => {
  const text = String(value || "attendance-session").trim();

  const invalidCharacters = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];

  let result = text;

  invalidCharacters.forEach((character) => {
    result = result.split(character).join("-");
  });

  return result.split(" ").filter(Boolean).join("_").slice(0, 90);
};

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

  const presentStudentIds = useMemo(() => {
    const ids = new Set();

    presentRecords.forEach((record) => {
      const studentId = getRecordStudentId(record);

      if (studentId) {
        ids.add(String(studentId));
      }
    });

    return ids;
  }, [presentRecords]);

  const presentCount = presentStudentIds.size || presentRecords.length;

  const remainingCount = Math.max(activeStudents.length - presentCount, 0);

  const completionPercentage = activeStudents.length
    ? Math.min(100, Math.round((presentCount / activeStudents.length) * 100))
    : 0;

  const sectionName = section?.name || "Assigned Section";

  const adviserName =
    user?.name?.trim() || section?.adviserName || "Class Adviser";

  const sessionStartedAt =
    activeSession?.startedAt ||
    activeSession?.startTime ||
    activeSession?.createdAt ||
    "";

  const sessionIsActive = Boolean(
    activeSession && String(getSessionId(activeSession)) === String(sessionId),
  );

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return activeStudents;
    }

    return activeStudents.filter((student) => {
      const name = String(student?.name || "").toLowerCase();

      const number = String(student?.studentNumber || "").toLowerCase();

      return name.includes(query) || number.includes(query);
    });
  }, [activeStudents, searchQuery]);

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

      const previousPresentIds = new Set(presentStudentIds);

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
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageFile = await canvasToImageFile(canvas);

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
              !previousPresentIds.has(String(recordStudentId)) &&
              isPresentRecord(record)
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

        setRecognitionResult({
          type: "success",
          status: "MARKED PRESENT",
          name: studentName,
          studentNumber,
          sectionName,
          recordedAt,
          method: "Face Recognition",
          message: result?.message || "Attendance recorded successfully.",
        });

        setScannerState("success");

        resultTimerRef.current = window.setTimeout(() => {
          setRecognitionResult(null);

          setScannerState("ready");

          scanLockRef.current = false;
        }, RESULT_HOLD_SUCCESS);
      } catch (requestError) {
        console.error("Face attendance failed:", requestError);

        const status = requestError?.response?.status;

        let title = "Face Not Recognized";

        let message = "No registered student matched the captured face.";

        let resultType = "error";

        if (status === 409) {
          title = "Already Present";

          message =
            "This student has already been marked present for this session.";

          resultType = "warning";
        } else if (status === 403) {
          title = "Wrong Section";

          message = "The recognized student does not belong to this section.";
        } else if (status !== 422) {
          title = "Recognition Failed";

          message = "Unable to process the face attendance request.";
        }

        setRecognitionResult({
          type: resultType,
          status: title.toUpperCase(),
          name: title,
          studentNumber: "—",
          sectionName,
          recordedAt: new Date(),
          method: "Face Recognition",
          message: getErrorMessage(requestError, message),
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
      presentStudentIds,
      clearAutoTimer,
      clearResultTimer,
      refreshRecords,
      students,
      sectionName,
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
        title: "Student marked present",
        description: "Preparing scanner for the next student.",
      };
    }

    if (scannerState === "warning") {
      return {
        eyebrow: "ALREADY RECORDED",
        title: "Student is already present",
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

      await refreshRecords();

      setManualMessage(`${student.name} was marked present.`);
    } catch (requestError) {
      console.error("Manual attendance failed:", requestError);

      setManualError(
        getErrorMessage(
          requestError,
          requestError?.response?.status === 409
            ? "The student has already been marked present."
            : "Unable to mark the student present.",
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
     EXPORT
  ======================================================= */

  const getAttendanceRows = () =>
    activeStudents.map((student, index) => {
      const record = presentRecords.find(
        (item) => String(getRecordStudentId(item)) === String(student.id),
      );

      return {
        No: index + 1,
        "Student Number": student.studentNumber || "",
        "Student Name": student.name || "",
        Status: record ? "PRESENT" : "PENDING",
        "Recorded At": record ? formatSchoolTime(getRecordTime(record)) : "",
        Method: getRecordMethod(record) || (record ? "Attendance" : ""),
      };
    });

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    const rows = getAttendanceRows();

    const attendanceSheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance Sheet");

    const summaryRows = [
      {
        Field: "Section",
        Value: sectionName,
      },
      {
        Field: "Adviser",
        Value: adviserName,
      },
      {
        Field: "Date",
        Value: formatShortDate(),
      },
      {
        Field: "Session Started",
        Value: formatSchoolTime(sessionStartedAt),
      },
      {
        Field: "Total Students",
        Value: activeStudents.length,
      },
      {
        Field: "Present",
        Value: presentCount,
      },
      {
        Field: "Pending",
        Value: remainingCount,
      },
      {
        Field: "Completion",
        Value: `${completionPercentage}%`,
      },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const fileName = sanitizeFileName(
      `Attendance_${sectionName}_${formatShortDate()}`,
    );

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleExportPdf = () => {
    window.print();
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
          <span className="attendance-live-session-pill">
            <i />
            ACTIVE SESSION
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
                  <div>
                    <span>PRESENT</span>
                    <strong>{presentCount}</strong>
                  </div>

                  <div>
                    <span>REMAINING</span>
                    <strong>{remainingCount}</strong>
                  </div>

                  <div>
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

                  <p>Attendance is marked present</p>
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
                      ? "PRESENT"
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
            <span>OFFICIAL CLASS RECORD</span>

            <h2>Student Attendance Register</h2>

            <p>
              Review manual entries, current attendance status, and export the
              official session record.
            </p>
          </div>

          <div className="attendance-report-actions">
            <button type="button" onClick={handleExportPdf}>
              PDF
              <span>Export PDF</span>
            </button>

            <button type="button" onClick={handleExportExcel}>
              XLS
              <span>Export Excel</span>
            </button>
          </div>
        </header>

        <div className="attendance-report-summary">
          <div>
            <span>STUDENTS</span>

            <strong>{activeStudents.length}</strong>
          </div>

          <div>
            <span>PRESENT</span>

            <strong className="is-success">{presentCount}</strong>
          </div>

          <div>
            <span>REMAINING</span>

            <strong>{remainingCount}</strong>
          </div>

          <div>
            <span>COMPLETION</span>

            <strong>{completionPercentage}%</strong>
          </div>
        </div>

        <div className="attendance-report-toolbar">
          <label>
            <span>⌕</span>

            <input
              type="search"
              value={searchQuery}
              placeholder="Search student name or student number..."
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}>
                ×
              </button>
            )}
          </label>

          <span>
            {filteredStudents.length} student
            {filteredStudents.length === 1 ? "" : "s"}
          </span>
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

                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student, index) => {
                const present = presentStudentIds.has(String(student.id));

                const record = presentRecords.find(
                  (item) =>
                    String(getRecordStudentId(item)) === String(student.id),
                );

                const marking = markingStudentId === student.id;

                const removing = removingStudentId === student.id;

                return (
                  <tr
                    key={student.id || student.studentNumber}
                    className={present ? "is-present" : ""}
                  >
                    <td>{String(index + 1).padStart(2, "0")}</td>

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
                        className={`attendance-live-status ${
                          present ? "is-present" : "is-pending"
                        }`}
                      >
                        <i />

                        {present ? "Present" : "Pending"}
                      </span>
                    </td>

                    <td>
                      {record ? formatSchoolTime(getRecordTime(record)) : "—"}
                    </td>

                    <td>
                      {present ? (
                        <button
                          type="button"
                          className="attendance-live-remove"
                          disabled={!sessionIsActive || removing}
                          onClick={() => void handleRemoveAttendance(student)}
                        >
                          {removing ? "Removing..." : "Remove"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="attendance-live-mark"
                          disabled={!sessionIsActive || marking}
                          onClick={() => void handleMarkPresent(student)}
                        >
                          {marking ? "Marking..." : "Mark Present"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          PRINT SHEET
      ================================================== */}

      <section className="attendance-print-sheet">
        <header>
          <div className="attendance-print-logos">
            <img src={depedLogo} alt="Department of Education" />

            <img
              src={seniorHighSchoolLogo}
              alt="Signal Village National High School"
            />
          </div>

          <div>
            <span>REPUBLIC OF THE PHILIPPINES</span>

            <strong>Signal Village National High School</strong>

            <small>Attendance Management System</small>
          </div>
        </header>

        <div className="attendance-print-title">
          <span>OFFICIAL SCHOOL RECORD</span>

          <h1>Student Attendance Register</h1>

          <p>
            {sectionName} · {formatSchoolDate()}
          </p>
        </div>

        <div className="attendance-print-meta">
          <div>
            <span>Adviser</span>
            <strong>{adviserName}</strong>
          </div>

          <div>
            <span>Started</span>
            <strong>{formatSchoolTime(sessionStartedAt)}</strong>
          </div>

          <div>
            <span>Present</span>
            <strong>{presentCount}</strong>
          </div>

          <div>
            <span>Pending</span>
            <strong>{remainingCount}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>

              <th>Student Number</th>

              <th>Student Name</th>

              <th>Status</th>

              <th>Recorded At</th>

              <th>Method</th>
            </tr>
          </thead>

          <tbody>
            {getAttendanceRows().map((row) => (
              <tr key={`${row.No}-${row["Student Number"]}`}>
                <td>{row.No}</td>

                <td>{row["Student Number"]}</td>

                <td>{row["Student Name"]}</td>

                <td>{row.Status}</td>

                <td>{row["Recorded At"]}</td>

                <td>{row.Method}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
