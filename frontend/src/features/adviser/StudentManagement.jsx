import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import "../../styles/adviser/studentManagement.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) =>
  Array.isArray(data) ? data : [];

const getErrorMessage = (
  error,
  fallbackMessage,
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const hasFaceRegistered = (
  student,
  locallyRegisteredIds,
) => {
  if (
    locallyRegisteredIds.has(
      student?.id,
    )
  ) {
    return true;
  }

  return (
    student?.faceRegistered === true ||
    student?.hasFace === true ||
    student?.faceEnrolled === true
  );
};

const stopMediaStream = (stream) => {
  if (!stream) {
    return;
  }

  stream
    .getTracks()
    .forEach((track) => {
      track.stop();
    });
};

const canvasToImageFile = (
  canvas,
) =>
  new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Unable to capture the face image.",
              ),
            );

            return;
          }

          resolve(
            new File(
              [blob],
              `student-face-${Date.now()}.jpg`,
              {
                type: "image/jpeg",
              },
            ),
          );
        },
        "image/jpeg",
        0.95,
      );
    },
  );

const scopeStudentsToSection = (
  students,
  sectionId,
) => {
  if (!sectionId) {
    return students;
  }

  return students.filter(
    (student) =>
      !student.sectionId ||
      student.sectionId ===
        sectionId,
  );
};

/* =========================================================
   CAMERA STATUS
========================================================= */

function FaceCameraStatus({
  cameraActive,
  capturedFacePreview,
  scanPhase,
}) {
  const statusClass = capturedFacePreview
    ? "is-captured"
    : scanPhase === "countdown" ||
        scanPhase === "holding"
      ? "is-scanning"
      : cameraActive
        ? "is-live"
        : "";

  const statusText = capturedFacePreview
    ? "PHOTO READY"
    : scanPhase === "countdown"
      ? "AUTO CAPTURE"
      : scanPhase === "holding"
        ? "HOLD STILL"
        : cameraActive
          ? "SCANNING"
          : "CAMERA OFF";

  return (
    <span
      className={`student-face-camera-status ${statusClass}`}
    >
      <span aria-hidden="true" />
      {statusText}
    </span>
  );
}

/* =========================================================
   REUSABLE BIOMETRIC FACE CAMERA
========================================================= */

function FaceCapturePanel({
  subjectName,
  videoRef,
  canvasRef,
  cameraActive,
  cameraReady,
  cameraError,
  capturedFacePreview,
  faceError,
  registeringFace,
  capturingFace,
  scanPhase,
  scanMessage,
  countdown,
  flashActive,
  onCameraReady,
  onEnableCamera,
  onManualCapture,
}) {
  const scannerActive = cameraActive && !capturedFacePreview;

  const scannerCopy = useMemo(() => {
    if (scanPhase === "capturing" || capturingFace) {
      return {
        eyebrow: "CAPTURING ENROLLMENT PHOTO",
        title: "Hold still",
        description: "Creating the face image used for attendance recognition.",
      };
    }

    if (scanPhase === "countdown") {
      return {
        eyebrow: "FACE POSITION ACCEPTED",
        title: "Hold still",
        description: "Automatic capture is starting.",
      };
    }

    if (scanPhase === "holding") {
      return {
        eyebrow: "POSITION ACCEPTED",
        title: "Look straight at the camera",
        description: "Keep your face centered while the scanner prepares the capture.",
      };
    }

    if (scanPhase === "positioning") {
      return {
        eyebrow: "AUTO CAPTURE ACTIVE",
        title: "Center your face",
        description: "Keep one face inside the guide and look directly at the camera.",
      };
    }

    if (scanPhase === "preparing" || (cameraActive && !cameraReady)) {
      return {
        eyebrow: "PREPARING CAMERA",
        title: "Starting enrollment scanner",
        description: "The camera will be ready in a moment.",
      };
    }

    if (cameraActive && cameraReady) {
      return {
        eyebrow: "FACE ENROLLMENT READY",
        title: scanMessage || "Position one student in frame",
        description: "Auto capture is enabled. You can also use Capture Now.",
      };
    }

    return {
      eyebrow: "FACE ENROLLMENT",
      title: "Camera unavailable",
      description: "Enable the camera to begin guided face enrollment.",
    };
  }, [cameraActive, cameraReady, capturingFace, scanMessage, scanPhase]);

  return (
    <div className="student-face-camera-content">
      <div
        className={`student-face-camera-shell is-${scanPhase} scanner-${scanPhase}`}
      >
        {capturedFacePreview ? (
          <>
            <img
              src={capturedFacePreview}
              alt={`Captured face of ${subjectName}`}
              className="student-face-captured-image"
            />

            <div className="student-face-captured-shade" />

            <div className="student-face-captured-label">
              <span aria-hidden="true">✓</span>
              ENROLLMENT PHOTO READY
            </div>

            <div className="student-face-captured-summary">
              <span
                className="student-face-captured-check"
                aria-hidden="true"
              >
                ✓
              </span>

              <div>
                <strong>Capture complete</strong>
                <p>
                  Review the student's face photo. Retake it if needed, then
                  save the enrollment.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraActive ? "is-active" : ""}
              onCanPlay={onCameraReady}
            />

            {!cameraActive && (
              <div className="student-face-camera-placeholder">
                <div
                  className="student-face-placeholder-icon"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <span className="student-face-placeholder-kicker">
                  CAMERA OFF
                </span>

                <strong>Start the face enrollment scanner</strong>

                <p>
                  Allow camera access to capture the student's registered face
                  identity for attendance recognition.
                </p>

                <button
                  type="button"
                  className="adviser-primary-button"
                  disabled={registeringFace}
                  onClick={onEnableCamera}
                >
                  Enable Camera
                </button>
              </div>
            )}

            {scannerActive && (
              <>
                <div className="student-face-camera-shade" aria-hidden="true" />

                <div
                  className={`student-face-target scanner-${scanPhase}`}
                  aria-hidden="true"
                >
                  <div className="student-face-target-oval" />

                  {cameraReady && <div className="student-face-target-line" />}

                  <span className="corner corner-one" />
                  <span className="corner corner-two" />
                  <span className="corner corner-three" />
                  <span className="corner corner-four" />
                </div>

                <div className="student-face-live-badge">
                  <span />
                  LIVE
                </div>

                <div className="student-face-auto-badge">
                  <span aria-hidden="true">◎</span>
                  AUTO CAPTURE
                </div>

                {cameraReady && scanPhase !== "countdown" && (
                  <button
                    type="button"
                    className="student-face-manual-capture"
                    disabled={
                      registeringFace || capturingFace || !cameraReady
                    }
                    onClick={onManualCapture}
                  >
                    Capture Now
                  </button>
                )}

                <div className="student-face-scanner-message">
                  <span>{scannerCopy.eyebrow}</span>
                  <strong>{scannerCopy.title}</strong>
                  <small>{scannerCopy.description}</small>
                </div>

                {countdown !== null && (
                  <div className="student-face-countdown" aria-live="polite">
                    <small>HOLD STILL</small>
                    <span>{countdown}</span>
                  </div>
                )}

                {(capturingFace || scanPhase === "capturing") && (
                  <div className="student-face-processing-overlay">
                    <div className="student-face-processing-spinner" />
                    <strong>Capturing face</strong>
                    <span>Preparing enrollment photo...</span>
                  </div>
                )}
              </>
            )}

            <div
              className={`student-face-camera-flash ${
                flashActive ? "is-active" : ""
              }`}
              aria-hidden="true"
            />
          </>
        )}
      </div>

      <canvas ref={canvasRef} hidden />

      {!capturedFacePreview && cameraActive && !cameraReady && (
        <div className="student-face-camera-loading">
          <span className="student-face-loading-dot" />
          Preparing secure camera preview...
        </div>
      )}

      {cameraError && (
        <div className="student-face-feedback is-error" role="alert">
          <span aria-hidden="true">!</span>

          <div>
            <strong>Camera unavailable</strong>
            <p>{cameraError}</p>
          </div>
        </div>
      )}

      {faceError && (
        <div className="student-face-feedback is-error" role="alert">
          <span aria-hidden="true">!</span>

          <div>
            <strong>Face registration</strong>
            <p>{faceError}</p>
          </div>
        </div>
      )}

      <div className="student-face-privacy-note">
        <span aria-hidden="true">▣</span>

        <p>
          <strong>Face enrollment photo</strong>
          The captured image is submitted only when you complete enrollment.
        </p>
      </div>

      <div
        className="student-face-capture-tips"
        aria-label="Face capture tips"
      >
        <span>
          <i aria-hidden="true">1</i>
          Face centered
        </span>

        <span>
          <i aria-hidden="true">2</i>
          Look straight
        </span>

        <span>
          <i aria-hidden="true">3</i>
          Good lighting
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function StudentManagement() {
  const location =
    useLocation();

  const user =
    authService.getUser();

  /* =======================================================
     CAMERA REFS
  ======================================================= */

  const videoRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const previewUrlRef =
    useRef("");

  const cameraStartFrameRef =
    useRef(null);

  const autoCaptureTimeoutsRef =
    useRef([]);

  const autoCaptureSessionRef =
    useRef(0);

  const autoCaptureStartedRef =
    useRef(false);

  const flashTimeoutRef =
    useRef(null);

  /* =======================================================
     DATA STATE
  ======================================================= */

  const [
    section,
    setSection,
  ] = useState(null);

  const [
    students,
    setStudents,
  ] = useState([]);

  /* =======================================================
     PAGE STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* =======================================================
     ADD STUDENT STATE
  ======================================================= */

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    studentNumber,
    setStudentNumber,
  ] = useState("");

  const [
    studentName,
    setStudentName,
  ] = useState("");

  const [
    creatingStudent,
    setCreatingStudent,
  ] = useState(false);

  const [
    createError,
    setCreateError,
  ] = useState("");

  const [
    createdStudentRecord,
    setCreatedStudentRecord,
  ] = useState(null);

  /* =======================================================
     EDIT STUDENT STATE
  ======================================================= */

  const [
    editingStudent,
    setEditingStudent,
  ] = useState(null);

  const [
    editStudentNumber,
    setEditStudentNumber,
  ] = useState("");

  const [
    editStudentName,
    setEditStudentName,
  ] = useState("");

  const [
    updatingStudent,
    setUpdatingStudent,
  ] = useState(false);

  const [
    editError,
    setEditError,
  ] = useState("");

  /* =======================================================
     EXISTING STUDENT FACE STATE
  ======================================================= */

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState(null);

  const [
    registeringFace,
    setRegisteringFace,
  ] = useState(false);

  /* =======================================================
     SHARED CAMERA STATE
  ======================================================= */

  const [
    cameraActive,
    setCameraActive,
  ] = useState(false);

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);

  const [
    cameraError,
    setCameraError,
  ] = useState("");

  const [
    capturingFace,
    setCapturingFace,
  ] = useState(false);

  const [
    capturedFaceFile,
    setCapturedFaceFile,
  ] = useState(null);

  const [
    capturedFacePreview,
    setCapturedFacePreview,
  ] = useState("");

  const [
    faceError,
    setFaceError,
  ] = useState("");

  const [
    scanPhase,
    setScanPhase,
  ] = useState("idle");

  const [
    scanMessage,
    setScanMessage,
  ] = useState(
    "Camera is off",
  );

  const [
    countdown,
    setCountdown,
  ] = useState(null);

  const [
    flashActive,
    setFlashActive,
  ] = useState(false);

  const [
    locallyRegisteredFaceIds,
    setLocallyRegisteredFaceIds,
  ] = useState(
    () => new Set(),
  );

  /* =======================================================
     LOAD PAGE DATA
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadPageData =
      async () => {
        try {
          setLoading(true);

          setError("");

          const [
            sectionData,
            studentData,
          ] =
            await Promise.all([
              adviserService.getSections(),
              adviserService.getStudents(),
            ]);

          if (!isMounted) {
            return;
          }

          const sections =
            normalizeArray(
              sectionData,
            );

          const allStudents =
            normalizeArray(
              studentData,
            );

          const assignedSection =
            sections.find(
              (item) =>
                item.active !==
                false,
            ) ||
            sections[0] ||
            null;

          setSection(
            assignedSection,
          );

          setStudents(
            scopeStudentsToSection(
              allStudents,
              assignedSection?.id,
            ),
          );
        } catch (
          requestError
        ) {
          console.error(
            "Unable to load students:",
            requestError,
          );

          if (!isMounted) {
            return;
          }

          setError(
            getErrorMessage(
              requestError,
              "Unable to load student records.",
            ),
          );
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =======================================================
     CAMERA CLEANUP ON UNMOUNT
  ======================================================= */

  useEffect(() => {
    return () => {
      if (
        cameraStartFrameRef.current
      ) {
        window.cancelAnimationFrame(
          cameraStartFrameRef.current,
        );
      }

      autoCaptureTimeoutsRef.current.forEach(
        (timeoutId) =>
          window.clearTimeout(
            timeoutId,
          ),
      );

      autoCaptureTimeoutsRef.current =
        [];

      if (
        flashTimeoutRef.current
      ) {
        window.clearTimeout(
          flashTimeoutRef.current,
        );
      }

      stopMediaStream(
        streamRef.current,
      );

      streamRef.current =
        null;

      if (
        previewUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        );

        previewUrlRef.current =
          "";
      }
    };
  }, []);

  /* =======================================================
     BODY SCROLL LOCK
  ======================================================= */

  const modalOpen =
    showAddModal ||
    Boolean(
      selectedStudent,
    ) ||
    Boolean(
      editingStudent,
    );

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [modalOpen]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const adviserName =
    user?.name?.trim() ||
    section?.adviserName ||
    "Adviser";

  const sectionName =
    section?.name ||
    "No assigned section";

  const faceRegisteredCount =
    useMemo(
      () =>
        students.filter(
          (student) =>
            hasFaceRegistered(
              student,
              locallyRegisteredFaceIds,
            ),
        ).length,
      [
        students,
        locallyRegisteredFaceIds,
      ],
    );

  const facePendingCount =
    Math.max(
      students.length -
        faceRegisteredCount,
      0,
    );

  const filteredStudents =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      if (!query) {
        return students;
      }

      return students.filter(
        (student) => {
          const name =
            String(
              student?.name ||
                "",
            ).toLowerCase();

          const number =
            String(
              student?.studentNumber ||
                "",
            ).toLowerCase();

          return (
            name.includes(
              query,
            ) ||
            number.includes(
              query,
            )
          );
        },
      );
    }, [
      students,
      searchQuery,
    ]);

  const faceRegistrationIntent =
    location.state?.action ===
    "register-face";

  /* =======================================================
     REFRESH STUDENTS
  ======================================================= */

  const refreshStudents =
    async () => {
      const data =
        normalizeArray(
          await adviserService.getStudents(),
        );

      const scoped =
        scopeStudentsToSection(
          data,
          section?.id,
        );

      setStudents(scoped);

      return scoped;
    };

  /* =======================================================
     CLEAR CAPTURE
  ======================================================= */

  const clearCapturedFace =
    () => {
      if (
        previewUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        );

        previewUrlRef.current =
          "";
      }

      setCapturedFaceFile(
        null,
      );

      setCapturedFacePreview(
        "",
      );
    };

  /* =======================================================
     AUTO CAPTURE TIMER HELPERS
  ======================================================= */

  const clearAutoCaptureTimers =
    () => {
      autoCaptureTimeoutsRef.current.forEach(
        (timeoutId) =>
          window.clearTimeout(
            timeoutId,
          ),
      );

      autoCaptureTimeoutsRef.current =
        [];

      autoCaptureSessionRef.current +=
        1;

      setCountdown(null);
    };

  const scheduleAutoCaptureStep =
    (
      callback,
      delay,
      sessionId,
    ) => {
      const timeoutId =
        window.setTimeout(
          () => {
            if (
              autoCaptureSessionRef.current !==
              sessionId
            ) {
              return;
            }

            callback();
          },
          delay,
        );

      autoCaptureTimeoutsRef.current.push(
        timeoutId,
      );
    };

  /* =======================================================
     STOP CAMERA
  ======================================================= */

  const stopFaceCamera =
    () => {
      clearAutoCaptureTimers();

      stopMediaStream(
        streamRef.current,
      );

      streamRef.current =
        null;

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }

      setCameraActive(
        false,
      );

      setCameraReady(
        false,
      );
    };

  /* =======================================================
     START CAMERA
  ======================================================= */

  const startFaceCamera =
    async () => {
      try {
        clearAutoCaptureTimers();

        autoCaptureStartedRef.current =
          false;

        setScanPhase(
          "preparing",
        );

        setScanMessage(
          "Preparing camera...",
        );

        setCameraError("");

        setFaceError("");

        setCameraReady(
          false,
        );

        if (
          !navigator
            .mediaDevices
            ?.getUserMedia
        ) {
          setCameraError(
            "Camera access is not supported by this browser.",
          );

          return;
        }

        stopFaceCamera();

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode:
                  "user",

                width: {
                  ideal: 1280,
                },

                height: {
                  ideal: 720,
                },
              },

              audio: false,
            },
          );

        const video =
          videoRef.current;

        if (!video) {
          stopMediaStream(
            stream,
          );

          return;
        }

        streamRef.current =
          stream;

        video.srcObject =
          stream;

        setCameraActive(
          true,
        );

        await video.play();
      } catch (
        requestError
      ) {
        console.error(
          "Unable to start camera:",
          requestError,
        );

        stopFaceCamera();

        setScanPhase(
          "error",
        );

        setScanMessage(
          "Camera unavailable",
        );

        if (
          requestError?.name ===
          "NotAllowedError"
        ) {
          setCameraError(
            "Camera permission was denied. Please allow camera access in your browser.",
          );

          return;
        }

        if (
          requestError?.name ===
          "NotFoundError"
        ) {
          setCameraError(
            "No camera was detected on this device.",
          );

          return;
        }

        if (
          requestError?.name ===
          "NotReadableError"
        ) {
          setCameraError(
            "The camera is currently being used by another application.",
          );

          return;
        }

        setCameraError(
          "Unable to access the camera.",
        );
      }
    };

  /* =======================================================
     SCHEDULE CAMERA START
  ======================================================= */

  const scheduleCameraStart =
    () => {
      if (
        cameraStartFrameRef.current
      ) {
        window.cancelAnimationFrame(
          cameraStartFrameRef.current,
        );
      }

      cameraStartFrameRef.current =
        window.requestAnimationFrame(
          () => {
            cameraStartFrameRef.current =
              window.requestAnimationFrame(
                () => {
                  cameraStartFrameRef.current =
                    null;

                  void startFaceCamera();
                },
              );
          },
        );
    };

  /* =======================================================
     RESET CAMERA
  ======================================================= */

  const resetCamera =
    () => {
      if (
        cameraStartFrameRef.current
      ) {
        window.cancelAnimationFrame(
          cameraStartFrameRef.current,
        );

        cameraStartFrameRef.current =
          null;
      }

      stopFaceCamera();

      clearCapturedFace();

      setCameraError("");

      setFaceError("");

      setCapturingFace(
        false,
      );

      autoCaptureStartedRef.current =
        false;

      setScanPhase("idle");

      setScanMessage(
        "Camera is off",
      );

      setCountdown(null);

      setFlashActive(
        false,
      );
    };

  /* =======================================================
     CAPTURE FACE
  ======================================================= */

  const handleCaptureFace =
    async ({
      automatic = false,
    } = {}) => {
      if (
        capturingFace ||
        registeringFace ||
        creatingStudent
      ) {
        return;
      }

      if (
        !automatic &&
        (!cameraActive ||
          !cameraReady)
      ) {
        setFaceError(
          "Camera is not ready yet.",
        );

        return;
      }

      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      if (
        !streamRef.current ||
        !video ||
        !canvas ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        setFaceError(
          "Unable to capture the camera image.",
        );

        setScanPhase(
          "error",
        );

        setScanMessage(
          "Capture failed",
        );

        return;
      }

      try {
        clearAutoCaptureTimers();

        setCapturingFace(
          true,
        );

        setScanPhase(
          "capturing",
        );

        setScanMessage(
          "Capturing enrollment photo...",
        );

        setFaceError("");

        canvas.width =
          video.videoWidth;

        canvas.height =
          video.videoHeight;

        const context =
          canvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "Unable to prepare the face image.",
          );
        }

        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        setFlashActive(
          true,
        );

        if (
          flashTimeoutRef.current
        ) {
          window.clearTimeout(
            flashTimeoutRef.current,
          );
        }

        flashTimeoutRef.current =
          window.setTimeout(
            () => {
              setFlashActive(
                false,
              );

              flashTimeoutRef.current =
                null;
            },
            180,
          );

        const imageFile =
          await canvasToImageFile(
            canvas,
          );

        clearCapturedFace();

        const previewUrl =
          URL.createObjectURL(
            imageFile,
          );

        previewUrlRef.current =
          previewUrl;

        setCapturedFaceFile(
          imageFile,
        );

        setCapturedFacePreview(
          previewUrl,
        );

        setScanPhase(
          "captured",
        );

        setScanMessage(
          "Enrollment photo ready",
        );

        stopFaceCamera();
      } catch (
        captureError
      ) {
        console.error(
          "Unable to capture face:",
          captureError,
        );

        setScanPhase(
          "error",
        );

        setScanMessage(
          "Capture failed",
        );

        setFaceError(
          captureError?.message ||
            "Unable to capture the student's face.",
        );
      } finally {
        setCapturingFace(
          false,
        );
      }
    };

  /* =======================================================
     AUTO CAPTURE SEQUENCE
  ======================================================= */

  const startAutoCaptureSequence =
    () => {
      if (
        autoCaptureStartedRef.current ||
        !streamRef.current ||
        previewUrlRef.current
      ) {
        return;
      }

      clearAutoCaptureTimers();

      autoCaptureStartedRef.current =
        true;

      const sessionId =
        autoCaptureSessionRef.current;

      setScanPhase(
        "positioning",
      );

      setScanMessage(
        "Center your face inside the oval",
      );

      scheduleAutoCaptureStep(
        () => {
          if (
            !streamRef.current
          ) {
            return;
          }

          setScanPhase(
            "holding",
          );

          setScanMessage(
            "Great. Look straight ahead and hold still",
          );
        },
        1300,
        sessionId,
      );

      scheduleAutoCaptureStep(
        () => {
          setScanPhase(
            "countdown",
          );

          setScanMessage(
            "Hold still",
          );

          setCountdown(3);
        },
        2600,
        sessionId,
      );

      scheduleAutoCaptureStep(
        () =>
          setCountdown(2),
        3400,
        sessionId,
      );

      scheduleAutoCaptureStep(
        () =>
          setCountdown(1),
        4200,
        sessionId,
      );

      scheduleAutoCaptureStep(
        () => {
          setCountdown(null);

          void handleCaptureFace({
            automatic: true,
          });
        },
        5000,
        sessionId,
      );
    };

  const handleCameraReady =
    () => {
      if (
        autoCaptureStartedRef.current ||
        previewUrlRef.current
      ) {
        return;
      }

      setCameraReady(
        true,
      );

      setScanPhase(
        "positioning",
      );

      setScanMessage(
        "Center your face inside the oval",
      );

      startAutoCaptureSequence();
    };

  /* =======================================================
     RETAKE FACE
  ======================================================= */

  const handleRetakeFace =
    async () => {
      if (
        registeringFace ||
        creatingStudent
      ) {
        return;
      }

      clearCapturedFace();

      setFaceError("");

      setCameraError("");

      autoCaptureStartedRef.current =
        false;

      setScanPhase(
        "preparing",
      );

      setScanMessage(
        "Preparing camera...",
      );

      await startFaceCamera();
    };

  /* =======================================================
     ADD STUDENT MODAL
  ======================================================= */

  const resetAddStudentForm =
    () => {
      setStudentNumber("");

      setStudentName("");

      setCreateError("");

      setCreatedStudentRecord(
        null,
      );
    };

  const openAddStudentModal =
    () => {
      resetCamera();

      resetAddStudentForm();

      setSelectedStudent(
        null,
      );

      setEditingStudent(
        null,
      );

      setSuccessMessage("");

      setShowAddModal(
        true,
      );

      scheduleCameraStart();
    };

  const resetAddStudentModal =
    () => {
      resetCamera();

      setShowAddModal(
        false,
      );

      resetAddStudentForm();
    };

  const closeAddModal =
    () => {
      if (
        creatingStudent
      ) {
        return;
      }

      resetAddStudentModal();
    };

  /* =======================================================
     CREATE STUDENT + REGISTER FACE
  ======================================================= */

  const handleCreateStudent =
    async (event) => {
      event.preventDefault();

      const cleanStudentNumber =
        studentNumber.trim();

      const cleanName =
        studentName.trim();

      if (
        !cleanStudentNumber ||
        !cleanName
      ) {
        setCreateError(
          "Student number and student name are required.",
        );

        return;
      }

      if (!section?.id) {
        setCreateError(
          "No assigned section is available.",
        );

        return;
      }

      if (
        !capturedFaceFile
      ) {
        setFaceError(
          "Please capture the student's face before saving.",
        );

        return;
      }

      let operationStage =
        createdStudentRecord?.id
          ? "face"
          : "student";

      let studentRecord =
        createdStudentRecord;

      try {
        setCreatingStudent(
          true,
        );

        setCreateError("");

        setFaceError("");

        setSuccessMessage("");

        if (
          !studentRecord?.id
        ) {
          operationStage =
            "student";

          const createdStudent =
            await adviserService.createStudent(
              {
                studentNumber:
                  cleanStudentNumber,

                name:
                  cleanName,

                sectionId:
                  section.id,
              },
            );

          if (
            createdStudent?.id
          ) {
            studentRecord =
              createdStudent;

            setCreatedStudentRecord(
              createdStudent,
            );

            setStudents(
              (
                currentStudents,
              ) => {
                const alreadyExists =
                  currentStudents.some(
                    (
                      student,
                    ) =>
                      student.id ===
                      createdStudent.id,
                  );

                if (
                  alreadyExists
                ) {
                  return currentStudents;
                }

                return [
                  ...currentStudents,
                  createdStudent,
                ];
              },
            );
          } else {
            const refreshed =
              await refreshStudents();

            studentRecord =
              refreshed.find(
                (student) =>
                  String(
                    student.studentNumber,
                  ) ===
                  cleanStudentNumber,
              );

            if (
              !studentRecord?.id
            ) {
              throw new Error(
                "Student was created, but the new student ID could not be resolved.",
              );
            }

            setCreatedStudentRecord(
              studentRecord,
            );
          }
        }

        operationStage =
          "face";

        await adviserService.registerStudentFace(
          studentRecord.id,
          capturedFaceFile,
        );

        setLocallyRegisteredFaceIds(
          (currentIds) => {
            const updatedIds =
              new Set(
                currentIds,
              );

            updatedIds.add(
              studentRecord.id,
            );

            return updatedIds;
          },
        );

        try {
          await refreshStudents();
        } catch (
          refreshError
        ) {
          console.warn(
            "Unable to refresh students after enrollment:",
            refreshError,
          );
        }

        setSuccessMessage(
          `${cleanName} was added to ${sectionName} and the face photo was registered successfully.`,
        );

        resetAddStudentModal();
      } catch (
        requestError
      ) {
        console.error(
          "Student enrollment failed:",
          requestError,
        );

        if (
          operationStage ===
          "student"
        ) {
          if (
            requestError
              ?.response
              ?.status === 409
          ) {
            setCreateError(
              "That student number already exists.",
            );

            return;
          }

          setCreateError(
            getErrorMessage(
              requestError,
              requestError?.message ||
                "Unable to create the student.",
            ),
          );

          return;
        }

        setFaceError(
          getErrorMessage(
            requestError,
            "The student record was created, but face registration failed. You can retake the photo and try again without creating the student again.",
          ),
        );
      } finally {
        setCreatingStudent(
          false,
        );
      }
    };

  /* =======================================================
     EDIT STUDENT MODAL
  ======================================================= */

  const openEditStudent =
    (student) => {
      if (
        !student?.id ||
        student.active ===
          false
      ) {
        return;
      }

      resetCamera();

      setShowAddModal(
        false,
      );

      setSelectedStudent(
        null,
      );

      setEditingStudent(
        student,
      );

      setEditStudentNumber(
        student.studentNumber ||
          "",
      );

      setEditStudentName(
        student.name ||
          "",
      );

      setEditError("");

      setSuccessMessage("");
    };

  const resetEditStudent =
    () => {
      setEditingStudent(
        null,
      );

      setEditStudentNumber(
        "",
      );

      setEditStudentName(
        "",
      );

      setEditError("");
    };

  const closeEditStudent =
    () => {
      if (
        updatingStudent
      ) {
        return;
      }

      resetEditStudent();
    };

  /* =======================================================
     UPDATE STUDENT
  ======================================================= */

  const handleUpdateStudent =
    async (event) => {
      event.preventDefault();

      if (
        !editingStudent?.id
      ) {
        setEditError(
          "Student information is unavailable.",
        );

        return;
      }

      const cleanStudentNumber =
        editStudentNumber.trim();

      const cleanName =
        editStudentName.trim();

      if (
        !cleanStudentNumber ||
        !cleanName
      ) {
        setEditError(
          "Student number and student name are required.",
        );

        return;
      }

      try {
        setUpdatingStudent(
          true,
        );

        setEditError("");

        setSuccessMessage("");

        const updatedStudent =
          await adviserService.updateStudent(
            editingStudent.id,
            {
              studentNumber:
                cleanStudentNumber,

              name:
                cleanName,
            },
          );

        if (
          updatedStudent?.id
        ) {
          setStudents(
            (
              currentStudents,
            ) =>
              currentStudents.map(
                (student) =>
                  student.id ===
                  updatedStudent.id
                    ? {
                        ...student,
                        ...updatedStudent,
                      }
                    : student,
              ),
          );
        }

        try {
          await refreshStudents();
        } catch (
          refreshError
        ) {
          console.warn(
            "Unable to refresh students after update:",
            refreshError,
          );
        }

        setSuccessMessage(
          `${cleanName}'s student information was updated successfully.`,
        );

        resetEditStudent();
      } catch (
        requestError
      ) {
        console.error(
          "Unable to update student:",
          requestError,
        );

        if (
          requestError
            ?.response
            ?.status === 409
        ) {
          setEditError(
            "That student number already belongs to another student.",
          );

          return;
        }

        setEditError(
          getErrorMessage(
            requestError,
            "Unable to update the student record.",
          ),
        );
      } finally {
        setUpdatingStudent(
          false,
        );
      }
    };

  /* =======================================================
     EXISTING STUDENT FACE MODAL
  ======================================================= */

  const openFaceRegistration =
    (student) => {
      if (
        !student?.id ||
        student.active ===
          false
      ) {
        return;
      }

      resetCamera();

      setShowAddModal(
        false,
      );

      setEditingStudent(
        null,
      );

      setSelectedStudent(
        student,
      );

      setSuccessMessage("");

      scheduleCameraStart();
    };

  const resetFaceRegistration =
    () => {
      resetCamera();

      setSelectedStudent(
        null,
      );
    };

  const closeFaceRegistration =
    () => {
      if (
        registeringFace
      ) {
        return;
      }

      resetFaceRegistration();
    };

  /* =======================================================
     REGISTER / UPDATE EXISTING FACE
  ======================================================= */

  const handleRegisterFace =
    async (event) => {
      event.preventDefault();

      if (
        !selectedStudent?.id
      ) {
        setFaceError(
          "Student information is unavailable.",
        );

        return;
      }

      if (
        !capturedFaceFile
      ) {
        setFaceError(
          "Please capture the student's face first.",
        );

        return;
      }

      const studentId =
        selectedStudent.id;

      const registeredName =
        selectedStudent.name ||
        "Student";

      try {
        setRegisteringFace(
          true,
        );

        setFaceError("");

        await adviserService.registerStudentFace(
          studentId,
          capturedFaceFile,
        );

        setLocallyRegisteredFaceIds(
          (currentIds) => {
            const updatedIds =
              new Set(
                currentIds,
              );

            updatedIds.add(
              studentId,
            );

            return updatedIds;
          },
        );

        try {
          await refreshStudents();
        } catch (
          refreshError
        ) {
          console.warn(
            "Student refresh failed after face registration:",
            refreshError,
          );
        }

        setSuccessMessage(
          `Face registration completed for ${registeredName}.`,
        );

        resetFaceRegistration();
      } catch (
        requestError
      ) {
        console.error(
          "Unable to register student face:",
          requestError,
        );

        setFaceError(
          getErrorMessage(
            requestError,
            "Unable to register the student's face.",
          ),
        );
      } finally {
        setRegisteringFace(
          false,
        );
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Students"
      eyebrow="ADVISER PORTAL"
      description="Manage students within your assigned section"
    >
      <section className="student-management">
        {/* =================================================
            FEEDBACK
        ================================================== */}

        {error && (
          <div
            className="adviser-alert adviser-alert-error"
            role="alert"
          >
            <span
              className="adviser-alert-icon"
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <strong>
                Student records
                unavailable
              </strong>

              <p>
                {error}
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            className="student-success-alert"
            role="status"
          >
            <span
              aria-hidden="true"
            >
              ✓
            </span>

            <div>
              <strong>
                Operation successful
              </strong>

              <p>
                {
                  successMessage
                }
              </p>
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() =>
                setSuccessMessage(
                  "",
                )
              }
            >
              ×
            </button>
          </div>
        )}

        {faceRegistrationIntent && (
          <div className="student-face-intent">
            <span
              aria-hidden="true"
            >
              ◎
            </span>

            <div>
              <strong>
                Student Face
                Enrollment
              </strong>

              <p>
                New students can now
                be created together
                with their ID-style
                face photo.
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            SECTION OVERVIEW
        ================================================== */}

        <section className="student-section-overview">
          <div className="student-section-heading">
            <span>
              ASSIGNED SECTION
            </span>

            <h2>
              {loading
                ? "Loading section..."
                : sectionName}
            </h2>

            <p>
              Adviser:{" "}
              <strong>
                {adviserName}
              </strong>
            </p>
          </div>

          <div className="student-section-stats">
            <div>
              <span>
                TOTAL STUDENTS
              </span>

              <strong>
                {loading
                  ? "—"
                  : students.length}
              </strong>
            </div>

            <div>
              <span>
                FACE PENDING
              </span>

              <strong>
                {loading
                  ? "—"
                  : facePendingCount}
              </strong>
            </div>

            <div>
              <span>
                FACE REGISTERED
              </span>

              <strong>
                {loading
                  ? "—"
                  : faceRegisteredCount}
              </strong>
            </div>
          </div>

          <span
            className={`student-section-badge ${
              section?.active ===
              false
                ? "is-inactive"
                : ""
            }`}
          >
            <span
              aria-hidden="true"
            />

            {section?.active ===
            false
              ? "INACTIVE"
              : "ACTIVE"}
          </span>
        </section>

        {/* =================================================
            STUDENT PANEL
        ================================================== */}

        <section className="student-panel">
          <header className="student-panel-header">
            <div>
              <span>
                CLASS ROSTER
              </span>

              <h2>
                Students
              </h2>

              <p>
                Manage student
                records and face
                identities.
              </p>
            </div>

            <button
              type="button"
              className="adviser-primary-button"
              disabled={
                loading ||
                !section?.id
              }
              onClick={
                openAddStudentModal
              }
            >
              <span
                aria-hidden="true"
              >
                +
              </span>

              Add Student
            </button>
          </header>

          {/* SEARCH */}

          <div className="student-toolbar">
            <label className="student-search">
              <span
                className="student-search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  searchQuery
                }
                placeholder="Search by student name or student number..."
                onChange={(
                  event,
                ) =>
                  setSearchQuery(
                    event.target
                      .value,
                  )
                }
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() =>
                    setSearchQuery(
                      "",
                    )
                  }
                >
                  ×
                </button>
              )}
            </label>

            <span className="student-result-count">
              {
                filteredStudents.length
              }{" "}
              student
              {filteredStudents.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>

          {/* TABLE */}

          <div className="student-table-shell">
            {loading ? (
              <div className="student-loading-state">
                <span className="student-loading-spinner" />

                <strong>
                  Loading students...
                </strong>

                <p>
                  Retrieving your
                  assigned section
                  roster.
                </p>
              </div>
            ) : !section ? (
              <div className="student-empty-state">
                <span
                  aria-hidden="true"
                >
                  ◇
                </span>

                <h3>
                  No assigned section
                </h3>

                <p>
                  A Councilor must
                  assign a section to
                  your Adviser account
                  before you can manage
                  students.
                </p>
              </div>
            ) : students.length ===
              0 ? (
              <div className="student-empty-state">
                <span
                  aria-hidden="true"
                >
                  ♙
                </span>

                <h3>
                  No students yet
                </h3>

                <p>
                  Add the first
                  student to{" "}
                  <strong>
                    {sectionName}
                  </strong>
                  .
                </p>

                <button
                  type="button"
                  className="adviser-primary-button"
                  onClick={
                    openAddStudentModal
                  }
                >
                  + Add Student
                </button>
              </div>
            ) : filteredStudents.length ===
              0 ? (
              <div className="student-empty-state">
                <span
                  aria-hidden="true"
                >
                  ⌕
                </span>

                <h3>
                  No matching students
                </h3>

                <p>
                  No student matched
                  your search for{" "}
                  <strong>
                    “{searchQuery}”
                  </strong>
                  .
                </p>
              </div>
            ) : (
              <table className="student-table">
                <thead>
                  <tr>
                    <th>#</th>

                    <th>
                      Student Number
                    </th>

                    <th>
                      Student Name
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Face Registration
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (
                      student,
                      index,
                    ) => {
                      const faceRegistered =
                        hasFaceRegistered(
                          student,
                          locallyRegisteredFaceIds,
                        );

                      const active =
                        student.active !==
                        false;

                      return (
                        <tr
                          key={
                            student.id ||
                            student.studentNumber
                          }
                        >
                          <td className="student-table-index">
                            {String(
                              index +
                                1,
                            ).padStart(
                              2,
                              "0",
                            )}
                          </td>

                          <td>
                            <span className="student-number">
                              {student.studentNumber ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <div className="student-name-cell">
                              <span className="student-avatar">
                                {student.name
                                  ?.charAt(
                                    0,
                                  )
                                  ?.toUpperCase() ||
                                  "S"}
                              </span>

                              <div>
                                <strong>
                                  {student.name ||
                                    "Unnamed Student"}
                                </strong>

                                <small>
                                  {
                                    sectionName
                                  }
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`student-status-badge ${
                                active
                                  ? "is-active"
                                  : "is-inactive"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                              />

                              {active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`student-face-badge ${
                                faceRegistered
                                  ? "is-registered"
                                  : ""
                              }`}
                            >
                              <span
                                aria-hidden="true"
                              >
                                {faceRegistered
                                  ? "✓"
                                  : "◎"}
                              </span>

                              {faceRegistered
                                ? "Registered"
                                : "Not Registered"}
                            </span>
                          </td>

                          <td>
                            <div className="student-row-actions">
                              <button
                                type="button"
                                className="student-face-action is-edit"
                                disabled={
                                  !active
                                }
                                onClick={() =>
                                  openEditStudent(
                                    student,
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className={`student-face-action is-face ${
                                  faceRegistered
                                    ? "is-registered"
                                    : ""
                                }`}
                                disabled={
                                  !active
                                }
                                onClick={() =>
                                  openFaceRegistration(
                                    student,
                                  )
                                }
                              >
                                {faceRegistered
                                  ? "Update Face"
                                  : "Register Face"}
                              </button>

                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>

      {/* ===================================================
          ADD STUDENT + FACE ENROLLMENT MODAL
      ==================================================== */}

      {showAddModal && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddModal();
            }
          }}
        >
          <form
            className="adviser-modal student-enrollment-modal"
            onSubmit={handleCreateStudent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-enrollment-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  +
                </div>

                <div>
                  <span>
                    STUDENT ENROLLMENT
                  </span>

                  <h2 id="student-enrollment-title">
                    Add a student
                  </h2>

                  <p>
                    Create the student
                    record and capture
                    the face identity
                    used for attendance.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={closeAddModal}
                disabled={creatingStudent}
                aria-label="Close student enrollment"
              >
                ×
              </button>
            </header>

            <div
              className="student-enrollment-progress"
              aria-label="Enrollment progress"
            >
              <div
                className={
                  studentNumber.trim() &&
                  studentName.trim()
                    ? "is-complete"
                    : "is-current"
                }
              >
                <span>
                  {studentNumber.trim() &&
                  studentName.trim()
                    ? "✓"
                    : "1"}
                </span>

                <div>
                  <strong>
                    Student details
                  </strong>

                  <small>
                    Name and student
                    number
                  </small>
                </div>
              </div>

              <i aria-hidden="true" />

              <div
                className={
                  capturedFacePreview
                    ? "is-complete"
                    : studentNumber.trim() &&
                        studentName.trim()
                      ? "is-current"
                      : ""
                }
              >
                <span>
                  {capturedFacePreview
                    ? "✓"
                    : "2"}
                </span>

                <div>
                  <strong>
                    Face capture
                  </strong>

                  <small>
                    Guided biometric
                    photo
                  </small>
                </div>
              </div>

              <i aria-hidden="true" />

              <div
                className={
                  capturedFacePreview
                    ? "is-current"
                    : ""
                }
              >
                <span>
                  3
                </span>

                <div>
                  <strong>
                    Save enrollment
                  </strong>

                  <small>
                    Create and register
                  </small>
                </div>
              </div>
            </div>

            <div className="student-enrollment-body">
              <section className="student-enrollment-details">
                <div className="student-enrollment-section-heading">
                  <span>
                    01
                  </span>

                  <div>
                    <strong>
                      Student
                      information
                    </strong>

                    <p>
                      Enter the
                      student's official
                      roster details.
                    </p>
                  </div>
                </div>

                {createdStudentRecord && (
                  <div className="student-created-notice">
                    <span
                      aria-hidden="true"
                    >
                      ✓
                    </span>

                    <div>
                      <strong>
                        Student record
                        created
                      </strong>

                      <p>
                        The student
                        details are now
                        locked. Retake
                        the photo and
                        complete face
                        registration.
                      </p>
                    </div>
                  </div>
                )}

                <div className="student-form student-enrollment-form">
                  <label className="student-form-field">
                    <span>
                      Student Number
                    </span>

                    <input
                      type="text"
                      value={studentNumber}
                      disabled={
                        creatingStudent ||
                        Boolean(
                          createdStudentRecord,
                        )
                      }
                      autoFocus
                      placeholder="e.g. 2026-0001"
                      onChange={(event) =>
                        setStudentNumber(
                          event.target
                            .value,
                        )
                      }
                    />

                    <small>
                      Use the official
                      school student
                      number.
                    </small>
                  </label>

                  <label className="student-form-field">
                    <span>
                      Complete Name
                    </span>

                    <input
                      type="text"
                      value={studentName}
                      disabled={
                        creatingStudent ||
                        Boolean(
                          createdStudentRecord,
                        )
                      }
                      placeholder="Enter complete student name"
                      onChange={(event) =>
                        setStudentName(
                          event.target
                            .value,
                        )
                      }
                    />

                    <small>
                      Enter the name as
                      it appears on the
                      class roster.
                    </small>
                  </label>

                  <div className="student-form-field">
                    <span>
                      Assigned Section
                    </span>

                    <div className="student-locked-field">
                      <div>
                        <small>
                          SECTION
                        </small>

                        <strong>
                          {sectionName}
                        </strong>
                      </div>

                      <span className="student-locked-badge">
                        ASSIGNED
                      </span>
                    </div>

                    <small>
                      Enrollment is
                      restricted to
                      your assigned
                      section.
                    </small>
                  </div>

                  <div className="student-enrollment-checklist">
                    <span>
                      <i
                        className={
                          studentNumber.trim()
                            ? "is-complete"
                            : ""
                        }
                        aria-hidden="true"
                      >
                        {studentNumber.trim()
                          ? "✓"
                          : "1"}
                      </i>

                      Student number
                    </span>

                    <span>
                      <i
                        className={
                          studentName.trim()
                            ? "is-complete"
                            : ""
                        }
                        aria-hidden="true"
                      >
                        {studentName.trim()
                          ? "✓"
                          : "2"}
                      </i>

                      Complete name
                    </span>

                    <span>
                      <i
                        className={
                          capturedFacePreview
                            ? "is-complete"
                            : ""
                        }
                        aria-hidden="true"
                      >
                        {capturedFacePreview
                          ? "✓"
                          : "3"}
                      </i>

                      Face photo
                    </span>
                  </div>

                  {createError && (
                    <div
                      className="adviser-modal-error"
                      role="alert"
                    >
                      <span
                        aria-hidden="true"
                      >
                        !
                      </span>

                      <p>
                        {createError}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="student-enrollment-photo">
                <div className="student-enrollment-photo-header">
                  <div className="student-enrollment-section-heading">
                    <span>
                      02
                    </span>

                    <div>
                      <strong>
                        Face identity
                      </strong>

                      <p>
                        Keep one face
                        centered and
                        look straight
                        at the camera.
                      </p>
                    </div>
                  </div>

                  <FaceCameraStatus
                    cameraActive={cameraActive}
                    capturedFacePreview={
                      capturedFacePreview
                    }
                    scanPhase={scanPhase}
                  />
                </div>

                <FaceCapturePanel
                  subjectName={
                    studentName.trim() ||
                    "student"
                  }
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  cameraActive={
                    cameraActive
                  }
                  cameraReady={
                    cameraReady
                  }
                  cameraError={
                    cameraError
                  }
                  capturedFacePreview={
                    capturedFacePreview
                  }
                  faceError={faceError}
                  registeringFace={
                    creatingStudent
                  }
                  capturingFace={
                    capturingFace
                  }
                  scanPhase={scanPhase}
                  scanMessage={
                    scanMessage
                  }
                  countdown={countdown}
                  flashActive={
                    flashActive
                  }
                  onCameraReady={
                    handleCameraReady
                  }
                  onEnableCamera={() =>
                    void startFaceCamera()
                  }
                  onManualCapture={() =>
                    void handleCaptureFace()
                  }
                />
              </section>
            </div>

            <footer className="adviser-modal-actions student-enrollment-actions">
              <div className="student-enrollment-footer-copy">
                <strong>
                  {capturedFacePreview
                    ? "Ready to complete enrollment"
                    : "Face photo required"}
                </strong>

                <span>
                  {capturedFacePreview
                    ? "Review the captured photo before saving."
                    : "The final save button becomes available after a face is captured."}
                </span>
              </div>

              <div className="student-enrollment-action-group">
                <button
                  type="button"
                  className="adviser-secondary-button"
                  disabled={
                    creatingStudent
                  }
                  onClick={
                    closeAddModal
                  }
                >
                  Cancel
                </button>

                {capturedFacePreview ? (
                  <button
                    type="button"
                    className="adviser-secondary-button"
                    disabled={
                      creatingStudent
                    }
                    onClick={() =>
                      void handleRetakeFace()
                    }
                  >
                    Retake Photo
                  </button>
                ) : (
                  <button
                    type="button"
                    className="adviser-secondary-button"
                    disabled={
                      creatingStudent ||
                      capturingFace ||
                      !cameraActive ||
                      !cameraReady
                    }
                    onClick={() =>
                      void handleCaptureFace()
                    }
                  >
                    {capturingFace
                      ? "Capturing..."
                      : "Capture Now"}
                  </button>
                )}

                <button
                  type="submit"
                  className="adviser-primary-button student-enrollment-submit"
                  disabled={
                    creatingStudent ||
                    !capturedFaceFile
                  }
                >
                  {creatingStudent && (
                    <span
                      className="adviser-button-spinner"
                      aria-hidden="true"
                    />
                  )}

                  {creatingStudent
                    ? createdStudentRecord
                      ? "Registering Face..."
                      : "Creating Student..."
                    : createdStudentRecord
                      ? "Complete Face Registration"
                      : "Save Student & Face"}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {/* ===================================================
          EDIT STUDENT MODAL
      ==================================================== */}

      {editingStudent && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditStudent();
            }
          }}
        >
          <form
            className="adviser-modal student-edit-modal"
            onSubmit={handleUpdateStudent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-student-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  ✎
                </div>

                <div>
                  <span>
                    STUDENT RECORD
                  </span>

                  <h2 id="edit-student-title">
                    Edit student
                  </h2>

                  <p>
                    Update the
                    student's roster
                    information.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={
                  closeEditStudent
                }
                disabled={
                  updatingStudent
                }
                aria-label="Close edit student"
              >
                ×
              </button>
            </header>

            <div className="student-edit-body">
              <div className="student-edit-summary">
                <span className="student-face-student-avatar">
                  {editingStudent.name
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    "S"}
                </span>

                <div>
                  <span>
                    CURRENT RECORD
                  </span>

                  <strong>
                    {editingStudent.name ||
                      "Student"}
                  </strong>

                  <small>
                    {editingStudent.studentNumber ||
                      "No student number"}
                    {" • "}
                    {sectionName}
                  </small>
                </div>
              </div>

              <div className="student-form student-edit-form">
                <label className="student-form-field">
                  <span>
                    Student Number
                  </span>

                  <input
                    type="text"
                    value={
                      editStudentNumber
                    }
                    disabled={
                      updatingStudent
                    }
                    autoFocus
                    placeholder="Enter student number"
                    onChange={(event) =>
                      setEditStudentNumber(
                        event.target
                          .value,
                      )
                    }
                  />

                  <small>
                    Must remain unique
                    across student
                    records.
                  </small>
                </label>

                <label className="student-form-field">
                  <span>
                    Complete Name
                  </span>

                  <input
                    type="text"
                    value={
                      editStudentName
                    }
                    disabled={
                      updatingStudent
                    }
                    placeholder="Enter complete student name"
                    onChange={(event) =>
                      setEditStudentName(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <div className="student-form-field">
                  <span>
                    Assigned Section
                  </span>

                  <div className="student-locked-field">
                    <div>
                      <small>
                        SECTION
                      </small>

                      <strong>
                        {sectionName}
                      </strong>
                    </div>

                    <span className="student-locked-badge">
                      LOCKED
                    </span>
                  </div>

                  <small>
                    Section assignment
                    cannot be changed
                    from Student
                    Management.
                  </small>
                </div>

                {editError && (
                  <div
                    className="adviser-modal-error"
                    role="alert"
                  >
                    <span
                      aria-hidden="true"
                    >
                      !
                    </span>

                    <p>
                      {editError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <footer className="adviser-modal-actions student-edit-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={
                  updatingStudent
                }
                onClick={
                  closeEditStudent
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="adviser-primary-button"
                disabled={
                  updatingStudent ||
                  !editStudentNumber.trim() ||
                  !editStudentName.trim()
                }
              >
                {updatingStudent && (
                  <span
                    className="adviser-button-spinner"
                    aria-hidden="true"
                  />
                )}

                {updatingStudent
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* ===================================================
          EXISTING STUDENT FACE MODAL
      ==================================================== */}

      {selectedStudent && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeFaceRegistration();
            }
          }}
        >
          <form
            className="adviser-modal student-face-modal student-identity-modal"
            onSubmit={handleRegisterFace}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-face-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  ◎
                </div>

                <div>
                  <span>
                    FACE IDENTITY
                  </span>

                  <h2 id="student-face-title">
                    {hasFaceRegistered(
                      selectedStudent,
                      locallyRegisteredFaceIds,
                    )
                      ? "Update student face"
                      : "Register student face"}
                  </h2>

                  <p>
                    Capture one clear,
                    front-facing image
                    for attendance
                    recognition.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={
                  closeFaceRegistration
                }
                disabled={
                  registeringFace ||
                  capturingFace
                }
                aria-label="Close face registration"
              >
                ×
              </button>
            </header>

            <div className="student-face-student">
              <span className="student-face-student-avatar">
                {selectedStudent.name
                  ?.charAt(0)
                  ?.toUpperCase() ||
                  "S"}
              </span>

              <div>
                <span>
                  STUDENT
                </span>

                <strong>
                  {selectedStudent.name}
                </strong>

                <small>
                  {selectedStudent.studentNumber ||
                    "No student number"}
                  {" • "}
                  {sectionName}
                </small>
              </div>

              <FaceCameraStatus
                cameraActive={
                  cameraActive
                }
                capturedFacePreview={
                  capturedFacePreview
                }
                scanPhase={
                  scanPhase
                }
              />
            </div>

            <div className="student-identity-camera">
              <FaceCapturePanel
                subjectName={
                  selectedStudent.name ||
                  "student"
                }
                videoRef={videoRef}
                canvasRef={canvasRef}
                cameraActive={
                  cameraActive
                }
                cameraReady={
                  cameraReady
                }
                cameraError={
                  cameraError
                }
                capturedFacePreview={
                  capturedFacePreview
                }
                faceError={faceError}
                registeringFace={
                  registeringFace
                }
                capturingFace={
                  capturingFace
                }
                scanPhase={scanPhase}
                scanMessage={
                  scanMessage
                }
                countdown={countdown}
                flashActive={
                  flashActive
                }
                onCameraReady={
                  handleCameraReady
                }
                onEnableCamera={() =>
                  void startFaceCamera()
                }
                onManualCapture={() =>
                  void handleCaptureFace()
                }
              />
            </div>

            <footer className="adviser-modal-actions student-face-modal-actions">
              <div className="student-face-footer-copy">
                <strong>
                  {capturedFacePreview
                    ? "Photo ready"
                    : "Position the student"}
                </strong>

                <span>
                  {capturedFacePreview
                    ? "Review the image, then save the face identity."
                    : "Auto capture starts once the camera is ready."}
                </span>
              </div>

              <div className="student-face-action-group">
                <button
                  type="button"
                  className="adviser-secondary-button"
                  disabled={
                    registeringFace ||
                    capturingFace
                  }
                  onClick={
                    closeFaceRegistration
                  }
                >
                  Cancel
                </button>

                {capturedFacePreview ? (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={
                        registeringFace
                      }
                      onClick={() =>
                        void handleRetakeFace()
                      }
                    >
                      Retake
                    </button>

                    <button
                      type="submit"
                      className="adviser-primary-button"
                      disabled={
                        registeringFace ||
                        !capturedFaceFile
                      }
                    >
                      {registeringFace && (
                        <span
                          className="adviser-button-spinner"
                          aria-hidden="true"
                        />
                      )}

                      {registeringFace
                        ? "Saving Face..."
                        : hasFaceRegistered(
                              selectedStudent,
                              locallyRegisteredFaceIds,
                            )
                          ? "Update Face"
                          : "Register Face"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    disabled={
                      !cameraActive ||
                      !cameraReady ||
                      capturingFace ||
                      registeringFace
                    }
                    onClick={() =>
                      void handleCaptureFace()
                    }
                  >
                    {capturingFace
                      ? "Capturing..."
                      : "Capture Now"}
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      )}
    </AdviserLayout>
  );
}

export default StudentManagement;