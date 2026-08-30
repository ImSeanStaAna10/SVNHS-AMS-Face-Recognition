import { useEffect, useMemo, useRef, useState } from "react";

import { useLocation } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";

import adviserService from "../../services/adviserService";
import authService from "../../services/authService";

import "../../styles/adviser/studentManagement.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeArray = (data) => (Array.isArray(data) ? data : []);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  fallbackMessage;

const hasFaceRegistered = (student, locallyRegisteredIds) => {
  if (locallyRegisteredIds.has(student?.id)) {
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

  stream.getTracks().forEach((track) => {
    track.stop();
  });
};

const canvasToImageFile = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to capture the face image."));

          return;
        }

        resolve(
          new File([blob], `student-face-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.95,
    );
  });

const scopeStudentsToSection = (students, sectionId) => {
  if (!sectionId) {
    return students;
  }

  return students.filter(
    (student) => !student.sectionId || student.sectionId === sectionId,
  );
};

const normalizeStudentNumberInput = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);

const isValidStudentNumber = (value) => /^\d{12}$/.test(String(value ?? ""));

const isFaceConflictResult = (result) => result?.outcome === "FACE_CONFLICT";

const getFaceSimilarityPercentage = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  /*
   * Backend returns cosine distance.
   * Convert it only for user-facing presentation:
   * similarity = (1 - distance) * 100
   *
   * This is a similarity score, not a probability or identity confidence.
   */
  return Math.min(100, Math.max(0, (1 - numericValue) * 100));
};

const formatFaceSimilarity = (value) => {
  const percentage = getFaceSimilarityPercentage(value);

  if (percentage === null) {
    return "Unavailable";
  }

  return `${percentage.toFixed(1)}%`;
};

const formatFaceSimilarityDifference = (firstDistance, secondDistance) => {
  const first = getFaceSimilarityPercentage(firstDistance);
  const second = getFaceSimilarityPercentage(secondDistance);

  if (first === null || second === null) {
    return "Unavailable";
  }

  return `${Math.abs(first - second).toFixed(1)} pts`;
};

const getFaceConflictStatusLabel = (status) => {
  const normalizedStatus = String(status || "PENDING").toUpperCase();

  if (normalizedStatus === "VERIFIED_DIFFERENT_PEOPLE") {
    return "Verified different";
  }

  if (normalizedStatus === "CONFIRMED_SAME_PERSON") {
    return "Same person confirmed";
  }

  return "Review needed";
};

function FaceSimilarityMeter({
  distance,
  label = "Face similarity",
  compact = false,
}) {
  const percentage = getFaceSimilarityPercentage(distance);
  const displayValue = formatFaceSimilarity(distance);
  const meterValue = percentage ?? 0;

  return (
    <div
      className={`student-face-similarity-meter ${compact ? "is-compact" : ""}`}
    >
      <div className="student-face-similarity-meter-header">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </div>

      <div
        className="student-face-similarity-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage === null ? undefined : Math.round(percentage)}
      >
        <i style={{ width: `${meterValue}%` }} />
      </div>

      {!compact && (
        <small>
          Higher percentage means a closer facial embedding match. It is not an
          identity confidence probability.
        </small>
      )}
    </div>
  );
}

/* =========================================================
   FACE CONFLICT NOTICE
========================================================= */

function FaceConflictNotice({ conflict, compact = false }) {
  if (!conflict) {
    return null;
  }

  const confirmedSamePerson =
    conflict?.conflictStatus === "CONFIRMED_SAME_PERSON";

  const conflictStatus = getFaceConflictStatusLabel(conflict?.conflictStatus);

  return (
    <div
      className={`student-face-conflict-card student-face-conflict-card-v2 ${
        compact ? "is-compact" : ""
      } ${confirmedSamePerson ? "is-confirmed-same-person" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div className="student-face-conflict-hero">
        <div className="student-face-conflict-icon" aria-hidden="true">
          {confirmedSamePerson ? "×" : "!"}
        </div>

        <div className="student-face-conflict-heading">
          <span className="student-face-conflict-eyebrow">
            {confirmedSamePerson
              ? "IDENTITY REVIEW COMPLETE"
              : "IDENTITY REVIEW NEEDED"}
          </span>

          <strong>
            {confirmedSamePerson
              ? "Separate face enrollment is blocked"
              : "A very similar enrolled face was found"}
          </strong>

          <p>
            {confirmedSamePerson
              ? "The identity review confirmed that these records represent the same physical person. A separate face record will not be created."
              : "The current face was not saved. Review the possible match and complete a fresh second capture before making any identity decision."}
          </p>
        </div>

        <span
          className={`student-face-conflict-status ${
            confirmedSamePerson ? "is-blocked" : "is-review"
          }`}
        >
          {confirmedSamePerson ? "BLOCKED" : conflictStatus}
        </span>
      </div>

      <div className="student-face-conflict-match">
        <div className="student-face-conflict-match-person">
          <span
            className="student-face-conflict-match-avatar"
            aria-hidden="true"
          >
            {conflict.conflictingStudentName?.charAt(0)?.toUpperCase() || "S"}
          </span>

          <div>
            <span>SIMILAR ENROLLED FACE</span>
            <strong>
              {conflict.conflictingStudentName || "Existing student"}
            </strong>
            <small>
              {conflict.conflictingSectionName || "Section unavailable"}
              {conflict.conflictingDepartmentName
                ? ` • ${conflict.conflictingDepartmentName}`
                : ""}
            </small>
          </div>
        </div>

        <FaceSimilarityMeter
          distance={conflict.distance}
          label="Face similarity"
          compact={compact}
        />
      </div>

      <div className="student-face-conflict-safety-note">
        <span aria-hidden="true">i</span>

        <p>
          {confirmedSamePerson
            ? "This stored decision remains authoritative for this face-conflict pair."
            : "Similarity percentage is provided only to make the comparison easier to understand. It does not by itself prove that two records are the same person."}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   CAMERA STATUS
========================================================= */

function FaceCameraStatus({ cameraActive, capturedFacePreview, scanPhase }) {
  const statusClass = capturedFacePreview
    ? "is-captured"
    : scanPhase === "countdown" || scanPhase === "holding"
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
    <span className={`student-face-camera-status ${statusClass}`}>
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
  captureMode = "enrollment",
}) {
  const verificationMode = captureMode === "verification";

  const scannerActive = cameraActive && !capturedFacePreview;

  const scannerCopy = useMemo(() => {
    if (scanPhase === "capturing" || capturingFace) {
      return {
        eyebrow: verificationMode
          ? "CAPTURING VERIFICATION PHOTO"
          : "CAPTURING ENROLLMENT PHOTO",
        title: "Hold still",
        description: verificationMode
          ? "Creating the second face image used to verify the similarity conflict."
          : "Creating the face image used for attendance recognition.",
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
        description:
          "Keep your face centered while the scanner prepares the capture.",
      };
    }

    if (scanPhase === "positioning") {
      return {
        eyebrow: verificationMode
          ? "SECOND CAPTURE ACTIVE"
          : "AUTO CAPTURE ACTIVE",
        title: "Center your face",
        description:
          "Keep one face inside the guide and look directly at the camera.",
      };
    }

    if (scanPhase === "preparing" || (cameraActive && !cameraReady)) {
      return {
        eyebrow: "PREPARING CAMERA",
        title: verificationMode
          ? "Starting verification scanner"
          : "Starting enrollment scanner",
        description: "The camera will be ready in a moment.",
      };
    }

    if (cameraActive && cameraReady) {
      return {
        eyebrow: verificationMode
          ? "IDENTITY VERIFICATION READY"
          : "FACE ENROLLMENT READY",
        title: scanMessage || "Position one student in frame",
        description: "Auto capture is enabled. You can also use Capture Now.",
      };
    }

    return {
      eyebrow: verificationMode ? "IDENTITY VERIFICATION" : "FACE ENROLLMENT",
      title: "Camera unavailable",
      description: verificationMode
        ? "Enable the camera to capture the required second verification photo."
        : "Enable the camera to begin guided face enrollment.",
    };
  }, [
    cameraActive,
    cameraReady,
    capturingFace,
    scanMessage,
    scanPhase,
    verificationMode,
  ]);

  return (
    <div
      className={`student-face-camera-content ${
        verificationMode ? "is-verification-mode" : ""
      }`}
    >
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
              {verificationMode
                ? "VERIFICATION PHOTO READY"
                : "ENROLLMENT PHOTO READY"}
            </div>

            <div className="student-face-captured-summary">
              <span className="student-face-captured-check" aria-hidden="true">
                ✓
              </span>

              <div>
                <strong>
                  {verificationMode
                    ? "Second capture complete"
                    : "Capture complete"}
                </strong>
                <p>
                  {verificationMode
                    ? "Review this second photo, then submit it for identity verification."
                    : "Review the student's face photo. Retake it if needed, then save the enrollment."}
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

                <strong>
                  {verificationMode
                    ? "Start the identity verification scanner"
                    : "Start the face enrollment scanner"}
                </strong>

                <p>
                  {verificationMode
                    ? "Capture a fresh second image of the student so the backend can verify whether the original face conflict is reproduced."
                    : "Allow camera access to capture the student's registered face identity for attendance recognition."}
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
                  {verificationMode ? "SECOND CAPTURE" : "AUTO CAPTURE"}
                </div>

                {cameraReady && scanPhase !== "countdown" && (
                  <button
                    type="button"
                    className="student-face-manual-capture"
                    disabled={registeringFace || capturingFace || !cameraReady}
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
                    <span>
                      {verificationMode
                        ? "Preparing verification photo..."
                        : "Preparing enrollment photo..."}
                    </span>
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
            <strong>
              {verificationMode ? "Identity verification" : "Face registration"}
            </strong>
            <p>{faceError}</p>
          </div>
        </div>
      )}

      <div className="student-face-privacy-note">
        <span aria-hidden="true">▣</span>

        <p>
          <strong>
            {verificationMode
              ? "Second verification photo"
              : "Face enrollment photo"}
          </strong>
          {verificationMode
            ? " The image is submitted only to evaluate this existing face conflict."
            : " The captured image is submitted only when you complete enrollment."}
        </p>
      </div>

      <div className="student-face-capture-tips" aria-label="Face capture tips">
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
  const location = useLocation();

  const user = authService.getUser();

  /* =======================================================
     CAMERA REFS
  ======================================================= */

  const videoRef = useRef(null);

  const canvasRef = useRef(null);

  const streamRef = useRef(null);

  const previewUrlRef = useRef("");

  const cameraStartFrameRef = useRef(null);

  const autoCaptureTimeoutsRef = useRef([]);

  const autoCaptureSessionRef = useRef(0);

  const autoCaptureStartedRef = useRef(false);

  const flashTimeoutRef = useRef(null);

  const filterMenuRef = useRef(null);

  const enrollmentBodyRef = useRef(null);

  const preVerificationCaptureFileRef = useRef(null);

  /* =======================================================
     DATA STATE
  ======================================================= */

  const [section, setSection] = useState(null);

  const [students, setStudents] = useState([]);

  /* =======================================================
     PAGE STATE
  ======================================================= */

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [faceFilter, setFaceFilter] = useState("ALL");

  const [sortOrder, setSortOrder] = useState("DEFAULT");

  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [currentPage, setCurrentPage] = useState(1);

  const [successMessage, setSuccessMessage] = useState("");

  /* =======================================================
     ADD STUDENT STATE
  ======================================================= */

  const [showAddModal, setShowAddModal] = useState(false);

  const [studentNumber, setStudentNumber] = useState("");

  const [studentName, setStudentName] = useState("");

  const [creatingStudent, setCreatingStudent] = useState(false);

  const [createError, setCreateError] = useState("");

  const [createdStudentRecord, setCreatedStudentRecord] = useState(null);

  const [enrollmentStep, setEnrollmentStep] = useState(1);

  /* =======================================================
     EDIT STUDENT STATE
  ======================================================= */

  const [editingStudent, setEditingStudent] = useState(null);

  const [editStudentNumber, setEditStudentNumber] = useState("");

  const [editStudentName, setEditStudentName] = useState("");

  const [updatingStudent, setUpdatingStudent] = useState(false);

  const [editError, setEditError] = useState("");

  /* =======================================================
     EXISTING STUDENT FACE STATE
  ======================================================= */

  const [selectedStudent, setSelectedStudent] = useState(null);

  const [registeringFace, setRegisteringFace] = useState(false);

  /* =======================================================
     SHARED CAMERA STATE
  ======================================================= */

  const [cameraActive, setCameraActive] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);

  const [cameraError, setCameraError] = useState("");

  const [capturingFace, setCapturingFace] = useState(false);

  const [capturedFaceFile, setCapturedFaceFile] = useState(null);

  const [capturedFacePreview, setCapturedFacePreview] = useState("");

  const [faceError, setFaceError] = useState("");

  const [faceConflict, setFaceConflict] = useState(null);

  const [faceVerificationOpen, setFaceVerificationOpen] = useState(false);

  const [faceVerificationStage, setFaceVerificationStage] = useState("CAPTURE");

  const [faceVerificationResult, setFaceVerificationResult] = useState(null);

  const [faceResolutionResult, setFaceResolutionResult] = useState(null);

  const [verifyingFaceConflict, setVerifyingFaceConflict] = useState(false);

  const [resolvingFaceConflict, setResolvingFaceConflict] = useState(false);

  const [pendingResolutionDecision, setPendingResolutionDecision] =
    useState(null);

  const [scanPhase, setScanPhase] = useState("idle");

  const [scanMessage, setScanMessage] = useState("Camera is off");

  const [countdown, setCountdown] = useState(null);

  const [flashActive, setFlashActive] = useState(false);

  const [locallyRegisteredFaceIds, setLocallyRegisteredFaceIds] = useState(
    () => new Set(),
  );

  /* =======================================================
     LOAD PAGE DATA
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      try {
        setLoading(true);

        setError("");

        const [sectionData, studentData] = await Promise.all([
          adviserService.getSections(),
          adviserService.getStudents(),
        ]);

        if (!isMounted) {
          return;
        }

        const sections = normalizeArray(sectionData);

        const allStudents = normalizeArray(studentData);

        const assignedSection =
          sections.find((item) => item.active !== false) || sections[0] || null;

        setSection(assignedSection);

        setStudents(scopeStudentsToSection(allStudents, assignedSection?.id));
      } catch (requestError) {
        console.error("Unable to load students:", requestError);

        if (!isMounted) {
          return;
        }

        setError(
          getErrorMessage(requestError, "Unable to load student records."),
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
      if (cameraStartFrameRef.current) {
        window.cancelAnimationFrame(cameraStartFrameRef.current);
      }

      autoCaptureTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );

      autoCaptureTimeoutsRef.current = [];

      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      stopMediaStream(streamRef.current);

      streamRef.current = null;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);

        previewUrlRef.current = "";
      }
    };
  }, []);

  /* =======================================================
     BODY SCROLL LOCK
  ======================================================= */

  const modalOpen =
    showAddModal ||
    Boolean(selectedStudent) ||
    Boolean(editingStudent) ||
    faceVerificationOpen;

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  /* =======================================================
     FILTER DROPDOWN
  ======================================================= */

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
     DERIVED DATA
  ======================================================= */

  const adviserName = user?.name?.trim() || section?.adviserName || "Adviser";

  const sectionName = section?.name || "No assigned section";

  const faceRegisteredCount = useMemo(
    () =>
      students.filter((student) =>
        hasFaceRegistered(student, locallyRegisteredFaceIds),
      ).length,
    [students, locallyRegisteredFaceIds],
  );

  const facePendingCount = Math.max(students.length - faceRegisteredCount, 0);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let result = students.filter((student) => {
      const name = String(student?.name || "").toLowerCase();

      const number = String(student?.studentNumber || "").toLowerCase();

      const matchesSearch =
        !query || name.includes(query) || number.includes(query);

      const active = student?.active !== false;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && active) ||
        (statusFilter === "INACTIVE" && !active);

      const faceRegistered = hasFaceRegistered(
        student,
        locallyRegisteredFaceIds,
      );

      const matchesFace =
        faceFilter === "ALL" ||
        (faceFilter === "REGISTERED" && faceRegistered) ||
        (faceFilter === "PENDING" && !faceRegistered);

      return matchesSearch && matchesStatus && matchesFace;
    });

    if (sortOrder !== "DEFAULT") {
      result = [...result].sort((first, second) => {
        const firstName = String(first?.name || "");

        const secondName = String(second?.name || "");

        const firstNumber = String(first?.studentNumber || "");

        const secondNumber = String(second?.studentNumber || "");

        if (sortOrder === "NAME_ASC") {
          return firstName.localeCompare(secondName, undefined, {
            sensitivity: "base",
          });
        }

        if (sortOrder === "NAME_DESC") {
          return secondName.localeCompare(firstName, undefined, {
            sensitivity: "base",
          });
        }

        if (sortOrder === "NUMBER_ASC") {
          return firstNumber.localeCompare(secondNumber, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        if (sortOrder === "NUMBER_DESC") {
          return secondNumber.localeCompare(firstNumber, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return 0;
      });
    }

    return result;
  }, [
    students,
    searchQuery,
    statusFilter,
    faceFilter,
    sortOrder,
    locallyRegisteredFaceIds,
  ]);

  const activeFilterCount = [
    statusFilter !== "ALL",
    faceFilter !== "ALL",
    sortOrder !== "DEFAULT",
  ].filter(Boolean).length;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / rowsPerPage),
  );

  const pageStartIndex = (currentPage - 1) * rowsPerPage;

  const paginatedStudents = filteredStudents.slice(
    pageStartIndex,
    pageStartIndex + rowsPerPage,
  );

  const visibleStart = filteredStudents.length === 0 ? 0 : pageStartIndex + 1;

  const visibleEnd = Math.min(
    pageStartIndex + rowsPerPage,
    filteredStudents.length,
  );

  const paginationItems = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from(
        {
          length: totalPages,
        },
        (_, index) => index + 1,
      );
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "ellipsis-right", totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [
        1,
        "ellipsis-left",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "ellipsis-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  }, [currentPage, totalPages]);

  const resetRosterView = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setFaceFilter("ALL");
    setSortOrder("DEFAULT");
    setRowsPerPage(10);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, faceFilter, sortOrder, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* =======================================================
     ENROLLMENT STEP SCROLL RESET
     Each wizard step opens from the top instead of inheriting
     the previous step's internal scroll position.
  ======================================================= */

  useEffect(() => {
    if (!showAddModal || !enrollmentBodyRef.current) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      enrollmentBodyRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [enrollmentStep, showAddModal]);

  const faceRegistrationIntent = location.state?.action === "register-face";

  /* =======================================================
     REFRESH STUDENTS
  ======================================================= */

  const refreshStudents = async () => {
    const data = normalizeArray(await adviserService.getStudents());

    const scoped = scopeStudentsToSection(data, section?.id);

    setStudents(scoped);

    return scoped;
  };

  /* =======================================================
     CLEAR CAPTURE
  ======================================================= */

  const clearCapturedFace = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);

      previewUrlRef.current = "";
    }

    setCapturedFaceFile(null);

    setCapturedFacePreview("");
  };

  /* =======================================================
     AUTO CAPTURE TIMER HELPERS
  ======================================================= */

  const clearAutoCaptureTimers = () => {
    autoCaptureTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId),
    );

    autoCaptureTimeoutsRef.current = [];

    autoCaptureSessionRef.current += 1;

    setCountdown(null);
  };

  const scheduleAutoCaptureStep = (callback, delay, sessionId) => {
    const timeoutId = window.setTimeout(() => {
      if (autoCaptureSessionRef.current !== sessionId) {
        return;
      }

      callback();
    }, delay);

    autoCaptureTimeoutsRef.current.push(timeoutId);
  };

  /* =======================================================
     STOP CAMERA
  ======================================================= */

  const stopFaceCamera = () => {
    clearAutoCaptureTimers();

    stopMediaStream(streamRef.current);

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);

    setCameraReady(false);
  };

  /* =======================================================
     START CAMERA
  ======================================================= */

  const startFaceCamera = async () => {
    try {
      clearAutoCaptureTimers();

      autoCaptureStartedRef.current = false;

      setScanPhase("preparing");

      setScanMessage("Preparing camera...");

      setCameraError("");

      setFaceError("");

      setCameraReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not supported by this browser.");

        return;
      }

      stopFaceCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",

          width: {
            ideal: 1280,
          },

          height: {
            ideal: 720,
          },
        },

        audio: false,
      });

      const video = videoRef.current;

      if (!video) {
        stopMediaStream(stream);

        return;
      }

      streamRef.current = stream;

      video.srcObject = stream;

      setCameraActive(true);

      await video.play();
    } catch (requestError) {
      console.error("Unable to start camera:", requestError);

      stopFaceCamera();

      setScanPhase("error");

      setScanMessage("Camera unavailable");

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
  };

  /* =======================================================
     SCHEDULE CAMERA START
  ======================================================= */

  const scheduleCameraStart = () => {
    if (cameraStartFrameRef.current) {
      window.cancelAnimationFrame(cameraStartFrameRef.current);
    }

    cameraStartFrameRef.current = window.requestAnimationFrame(() => {
      cameraStartFrameRef.current = window.requestAnimationFrame(() => {
        cameraStartFrameRef.current = null;

        void startFaceCamera();
      });
    });
  };

  /* =======================================================
     RESET CAMERA
  ======================================================= */

  const resetCamera = () => {
    if (cameraStartFrameRef.current) {
      window.cancelAnimationFrame(cameraStartFrameRef.current);

      cameraStartFrameRef.current = null;
    }

    stopFaceCamera();

    clearCapturedFace();

    setCameraError("");

    setFaceError("");

    setFaceConflict(null);

    setFaceVerificationOpen(false);

    setFaceVerificationStage("CAPTURE");

    setFaceVerificationResult(null);

    setFaceResolutionResult(null);

    setVerifyingFaceConflict(false);

    setResolvingFaceConflict(false);

    setPendingResolutionDecision(null);

    preVerificationCaptureFileRef.current = null;

    setCapturingFace(false);

    autoCaptureStartedRef.current = false;

    setScanPhase("idle");

    setScanMessage("Camera is off");

    setCountdown(null);

    setFlashActive(false);
  };

  /* =======================================================
     CAPTURE FACE
  ======================================================= */

  const handleCaptureFace = async ({ automatic = false } = {}) => {
    if (capturingFace || registeringFace || creatingStudent) {
      return;
    }

    if (!automatic && (!cameraActive || !cameraReady)) {
      setFaceError("Camera is not ready yet.");

      return;
    }

    const video = videoRef.current;

    const canvas = canvasRef.current;

    if (
      !streamRef.current ||
      !video ||
      !canvas ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setFaceError("Unable to capture the camera image.");

      setScanPhase("error");

      setScanMessage("Capture failed");

      return;
    }

    try {
      clearAutoCaptureTimers();

      setCapturingFace(true);

      setScanPhase("capturing");

      setScanMessage(
        faceVerificationOpen
          ? "Capturing verification photo..."
          : "Capturing enrollment photo...",
      );

      setFaceError("");

      if (!faceVerificationOpen) {
        setFaceConflict(null);
      }

      canvas.width = video.videoWidth;

      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to prepare the face image.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      setFlashActive(true);

      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      flashTimeoutRef.current = window.setTimeout(() => {
        setFlashActive(false);

        flashTimeoutRef.current = null;
      }, 180);

      const imageFile = await canvasToImageFile(canvas);

      clearCapturedFace();

      const previewUrl = URL.createObjectURL(imageFile);

      previewUrlRef.current = previewUrl;

      setCapturedFaceFile(imageFile);

      setCapturedFacePreview(previewUrl);

      setScanPhase("captured");

      setScanMessage(
        faceVerificationOpen
          ? "Verification photo ready"
          : "Enrollment photo ready",
      );

      stopFaceCamera();
    } catch (captureError) {
      console.error("Unable to capture face:", captureError);

      setScanPhase("error");

      setScanMessage("Capture failed");

      setFaceError(
        captureError?.message || "Unable to capture the student's face.",
      );
    } finally {
      setCapturingFace(false);
    }
  };

  /* =======================================================
     AUTO CAPTURE SEQUENCE
  ======================================================= */

  const startAutoCaptureSequence = () => {
    if (
      autoCaptureStartedRef.current ||
      !streamRef.current ||
      previewUrlRef.current
    ) {
      return;
    }

    clearAutoCaptureTimers();

    autoCaptureStartedRef.current = true;

    const sessionId = autoCaptureSessionRef.current;

    setScanPhase("positioning");

    setScanMessage("Center your face inside the oval");

    scheduleAutoCaptureStep(
      () => {
        if (!streamRef.current) {
          return;
        }

        setScanPhase("holding");

        setScanMessage("Great. Look straight ahead and hold still");
      },
      1300,
      sessionId,
    );

    scheduleAutoCaptureStep(
      () => {
        setScanPhase("countdown");

        setScanMessage("Hold still");

        setCountdown(3);
      },
      2600,
      sessionId,
    );

    scheduleAutoCaptureStep(() => setCountdown(2), 3400, sessionId);

    scheduleAutoCaptureStep(() => setCountdown(1), 4200, sessionId);

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

  const handleCameraReady = () => {
    if (autoCaptureStartedRef.current || previewUrlRef.current) {
      return;
    }

    setCameraReady(true);

    setScanPhase("positioning");

    setScanMessage("Center your face inside the oval");

    startAutoCaptureSequence();
  };

  /* =======================================================
     RETAKE FACE
  ======================================================= */

  const handleRetakeFace = async () => {
    if (
      registeringFace ||
      creatingStudent ||
      verifyingFaceConflict ||
      resolvingFaceConflict
    ) {
      return;
    }

    clearCapturedFace();

    setFaceError("");

    if (!faceVerificationOpen) {
      setFaceConflict(null);
    }

    setCameraError("");

    autoCaptureStartedRef.current = false;

    setScanPhase("preparing");

    setScanMessage(
      faceVerificationOpen
        ? "Preparing verification camera..."
        : "Preparing camera...",
    );

    await startFaceCamera();
  };

  /* =======================================================
     ADD STUDENT MODAL / WIZARD
  ======================================================= */

  const resetAddStudentForm = () => {
    setStudentNumber("");

    setStudentName("");

    setCreateError("");

    setFaceConflict(null);

    setCreatedStudentRecord(null);

    setEnrollmentStep(1);
  };

  const openAddStudentModal = () => {
    resetCamera();

    resetAddStudentForm();

    setSelectedStudent(null);

    setEditingStudent(null);

    setSuccessMessage("");

    setShowAddModal(true);

    /*
     * Camera intentionally does NOT start here.
     * Step 1 is student details only so the enrollment
     * screen stays focused and camera permission is
     * requested only when the adviser reaches Step 2.
     */
  };

  const resetAddStudentModal = () => {
    resetCamera();

    setEnrollmentStep(1);

    setShowAddModal(false);

    resetAddStudentForm();
  };

  const closeAddModal = () => {
    if (creatingStudent) {
      return;
    }

    resetAddStudentModal();
  };

  const validateEnrollmentDetails = () => {
    const cleanStudentNumber = studentNumber.trim();

    const cleanName = studentName.trim();

    setCreateError("");

    if (!cleanStudentNumber || !cleanName) {
      setCreateError("Student number and student name are required.");

      return false;
    }

    if (!isValidStudentNumber(cleanStudentNumber)) {
      setCreateError("Student number must contain exactly 12 digits.");

      return false;
    }

    if (!section?.id) {
      setCreateError("No assigned section is available.");

      return false;
    }

    return true;
  };

  const goToEnrollmentDetails = () => {
    if (creatingStudent) {
      return;
    }

    stopFaceCamera();

    setFaceError("");

    setCameraError("");

    setEnrollmentStep(1);
  };

  const goToEnrollmentFace = () => {
    if (creatingStudent) {
      return;
    }

    if (!validateEnrollmentDetails()) {
      setEnrollmentStep(1);

      return;
    }

    setFaceError("");

    setCameraError("");

    setEnrollmentStep(2);

    if (!capturedFacePreview && !cameraActive) {
      scheduleCameraStart();
    }
  };

  const goToEnrollmentReview = () => {
    if (creatingStudent) {
      return;
    }

    if (!capturedFaceFile || !capturedFacePreview) {
      setFaceError("Please capture the student's face before continuing.");

      return;
    }

    stopFaceCamera();

    setCreateError("");

    setFaceError("");

    setEnrollmentStep(3);
  };

  const returnToEnrollmentFace = () => {
    if (creatingStudent) {
      return;
    }

    setCreateError("");

    setFaceError("");

    setEnrollmentStep(2);

    if (!capturedFacePreview && !cameraActive) {
      scheduleCameraStart();
    }
  };

  /* =======================================================
     CREATE STUDENT + REGISTER FACE
  ======================================================= */

  const handleCreateStudent = async (event) => {
    event.preventDefault();

    const cleanStudentNumber = studentNumber.trim();

    const cleanName = studentName.trim();

    if (!cleanStudentNumber || !cleanName) {
      setCreateError("Student number and student name are required.");

      return;
    }

    if (!isValidStudentNumber(cleanStudentNumber)) {
      setCreateError("Student number must contain exactly 12 digits.");

      return;
    }

    if (!section?.id) {
      setCreateError("No assigned section is available.");

      return;
    }

    if (!capturedFaceFile) {
      setFaceError("Please capture the student's face before saving.");

      return;
    }

    let operationStage = createdStudentRecord?.id ? "face" : "student";

    let studentRecord = createdStudentRecord;

    try {
      setCreatingStudent(true);

      setCreateError("");

      setFaceError("");

      setSuccessMessage("");

      if (!studentRecord?.id) {
        operationStage = "student";

        const createdStudent = await adviserService.createStudent({
          studentNumber: cleanStudentNumber,

          name: cleanName,

          sectionId: section.id,
        });

        if (createdStudent?.id) {
          studentRecord = createdStudent;

          setCreatedStudentRecord(createdStudent);

          setStudents((currentStudents) => {
            const alreadyExists = currentStudents.some(
              (student) => student.id === createdStudent.id,
            );

            if (alreadyExists) {
              return currentStudents;
            }

            return [...currentStudents, createdStudent];
          });
        } else {
          const refreshed = await refreshStudents();

          studentRecord = refreshed.find(
            (student) => String(student.studentNumber) === cleanStudentNumber,
          );

          if (!studentRecord?.id) {
            throw new Error(
              "Student was created, but the new student ID could not be resolved.",
            );
          }

          setCreatedStudentRecord(studentRecord);
        }
      }

      operationStage = "face";

      const faceRegistrationResult = await adviserService.registerStudentFace(
        studentRecord.id,
        capturedFaceFile,
      );

      if (isFaceConflictResult(faceRegistrationResult)) {
        setFaceConflict(faceRegistrationResult);

        setFaceVerificationStage("CAPTURE");

        setFaceVerificationResult(null);

        setFaceResolutionResult(null);

        setPendingResolutionDecision(null);

        setFaceError("");

        setEnrollmentStep(3);

        return;
      }

      setFaceConflict(null);

      setLocallyRegisteredFaceIds((currentIds) => {
        const updatedIds = new Set(currentIds);

        updatedIds.add(studentRecord.id);

        return updatedIds;
      });

      try {
        await refreshStudents();
      } catch (refreshError) {
        console.warn(
          "Unable to refresh students after enrollment:",
          refreshError,
        );
      }

      setSuccessMessage(
        `${cleanName} was added to ${sectionName} and the face photo was registered successfully.`,
      );

      resetAddStudentModal();
    } catch (requestError) {
      console.error("Student enrollment failed:", requestError);

      if (operationStage === "student") {
        if (requestError?.response?.status === 409) {
          setCreateError("That student number already exists.");

          return;
        }

        setCreateError(
          getErrorMessage(
            requestError,
            requestError?.message || "Unable to create the student.",
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
      setCreatingStudent(false);
    }
  };

  /* =======================================================
     EDIT STUDENT MODAL
  ======================================================= */

  const openEditStudent = (student) => {
    if (!student?.id || student.active === false) {
      return;
    }

    resetCamera();

    setShowAddModal(false);

    setSelectedStudent(null);

    setEditingStudent(student);

    setEditStudentNumber(student.studentNumber || "");

    setEditStudentName(student.name || "");

    setEditError("");

    setSuccessMessage("");
  };

  const resetEditStudent = () => {
    setEditingStudent(null);

    setEditStudentNumber("");

    setEditStudentName("");

    setEditError("");
  };

  const closeEditStudent = () => {
    if (updatingStudent) {
      return;
    }

    resetEditStudent();
  };

  /* =======================================================
     UPDATE STUDENT
  ======================================================= */

  const handleUpdateStudent = async (event) => {
    event.preventDefault();

    if (!editingStudent?.id) {
      setEditError("Student information is unavailable.");

      return;
    }

    const cleanStudentNumber = editStudentNumber.trim();

    const cleanName = editStudentName.trim();

    if (!cleanStudentNumber || !cleanName) {
      setEditError("Student number and student name are required.");

      return;
    }

    if (!isValidStudentNumber(cleanStudentNumber)) {
      setEditError("Student number must contain exactly 12 digits.");

      return;
    }

    try {
      setUpdatingStudent(true);

      setEditError("");

      setSuccessMessage("");

      const updatedStudent = await adviserService.updateStudent(
        editingStudent.id,
        {
          studentNumber: cleanStudentNumber,

          name: cleanName,
        },
      );

      if (updatedStudent?.id) {
        setStudents((currentStudents) =>
          currentStudents.map((student) =>
            student.id === updatedStudent.id
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
      } catch (refreshError) {
        console.warn("Unable to refresh students after update:", refreshError);
      }

      setSuccessMessage(
        `${cleanName}'s student information was updated successfully.`,
      );

      resetEditStudent();
    } catch (requestError) {
      console.error("Unable to update student:", requestError);

      if (requestError?.response?.status === 409) {
        setEditError("That student number already belongs to another student.");

        return;
      }

      setEditError(
        getErrorMessage(requestError, "Unable to update the student record."),
      );
    } finally {
      setUpdatingStudent(false);
    }
  };

  /* =======================================================
     EXISTING STUDENT FACE MODAL
  ======================================================= */

  const openFaceRegistration = (student) => {
    if (!student?.id || student.active === false) {
      return;
    }

    resetCamera();

    setShowAddModal(false);

    setEditingStudent(null);

    setSelectedStudent(student);

    setSuccessMessage("");

    scheduleCameraStart();
  };

  const resetFaceRegistration = () => {
    resetCamera();

    setSelectedStudent(null);
  };

  const closeFaceRegistration = () => {
    if (registeringFace) {
      return;
    }

    resetFaceRegistration();
  };

  /* =======================================================
     REGISTER / UPDATE EXISTING FACE
  ======================================================= */

  const handleRegisterFace = async (event) => {
    event.preventDefault();

    if (!selectedStudent?.id) {
      setFaceError("Student information is unavailable.");

      return;
    }

    if (!capturedFaceFile) {
      setFaceError("Please capture the student's face first.");

      return;
    }

    const studentId = selectedStudent.id;

    const registeredName = selectedStudent.name || "Student";

    try {
      setRegisteringFace(true);

      setFaceError("");

      const faceRegistrationResult = await adviserService.registerStudentFace(
        studentId,
        capturedFaceFile,
      );

      if (isFaceConflictResult(faceRegistrationResult)) {
        setFaceConflict(faceRegistrationResult);

        setFaceVerificationStage("CAPTURE");

        setFaceVerificationResult(null);

        setFaceResolutionResult(null);

        setPendingResolutionDecision(null);

        setFaceError("");

        return;
      }

      setFaceConflict(null);

      setLocallyRegisteredFaceIds((currentIds) => {
        const updatedIds = new Set(currentIds);

        updatedIds.add(studentId);

        return updatedIds;
      });

      try {
        await refreshStudents();
      } catch (refreshError) {
        console.warn(
          "Student refresh failed after face registration:",
          refreshError,
        );
      }

      setSuccessMessage(`Face registration completed for ${registeredName}.`);

      resetFaceRegistration();
    } catch (requestError) {
      console.error("Unable to register student face:", requestError);

      setFaceError(
        getErrorMessage(requestError, "Unable to register the student's face."),
      );
    } finally {
      setRegisteringFace(false);
    }
  };

  /* =======================================================
     FACE CONFLICT WORKFLOW
  ======================================================= */

  const getFaceConflictTarget = () => {
    const targetId =
      faceConflict?.studentId ||
      createdStudentRecord?.id ||
      selectedStudent?.id ||
      "";

    const targetName = showAddModal
      ? studentName.trim() || createdStudentRecord?.name || "Student"
      : selectedStudent?.name || createdStudentRecord?.name || "Student";

    return {
      id: targetId,
      name: targetName,
      context: showAddModal ? "ADD" : "EXISTING",
    };
  };

  const restorePreVerificationCapture = () => {
    const originalFile = preVerificationCaptureFileRef.current;

    clearCapturedFace();

    if (!originalFile) {
      return;
    }

    const previewUrl = URL.createObjectURL(originalFile);

    previewUrlRef.current = previewUrl;

    setCapturedFaceFile(originalFile);

    setCapturedFacePreview(previewUrl);

    setScanPhase("captured");

    setScanMessage("Enrollment photo ready");
  };

  const openFaceConflictVerification = () => {
    const target = getFaceConflictTarget();

    if (!target.id || !faceConflict?.conflictId) {
      setFaceError(
        "Face conflict information is incomplete. Please retry face registration.",
      );

      return;
    }

    if (faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON") {
      setFaceError(
        "This face conflict was already confirmed as the same physical person. Separate face enrollment remains blocked.",
      );

      return;
    }

    preVerificationCaptureFileRef.current = capturedFaceFile;

    stopFaceCamera();

    clearCapturedFace();

    setCameraError("");

    setFaceError("");

    setFaceVerificationResult(null);

    setFaceResolutionResult(null);

    setPendingResolutionDecision(null);

    setFaceVerificationStage("CAPTURE");

    setFaceVerificationOpen(true);

    setScanPhase("preparing");

    setScanMessage("Preparing verification camera...");

    autoCaptureStartedRef.current = false;

    scheduleCameraStart();
  };

  const closeFaceConflictVerification = () => {
    if (verifyingFaceConflict || resolvingFaceConflict) {
      return;
    }

    if (faceResolutionResult?.conflictStatus === "VERIFIED_DIFFERENT_PEOPLE") {
      returnToFreshEnrollmentCapture();

      return;
    }

    stopFaceCamera();

    restorePreVerificationCapture();

    preVerificationCaptureFileRef.current = null;

    setFaceVerificationOpen(false);

    setFaceVerificationStage("CAPTURE");

    setFaceVerificationResult(null);

    setFaceResolutionResult(null);

    setPendingResolutionDecision(null);

    setFaceError("");
  };

  const returnToFreshEnrollmentCapture = () => {
    if (verifyingFaceConflict || resolvingFaceConflict) {
      return;
    }

    stopFaceCamera();

    clearCapturedFace();

    preVerificationCaptureFileRef.current = null;

    setFaceVerificationOpen(false);

    setFaceVerificationStage("CAPTURE");

    setFaceVerificationResult(null);

    setFaceResolutionResult(null);

    setPendingResolutionDecision(null);

    setFaceConflict(null);

    setFaceError("");

    setCameraError("");

    autoCaptureStartedRef.current = false;

    if (showAddModal) {
      setEnrollmentStep(2);
    }

    setScanPhase("preparing");

    setScanMessage("Preparing camera...");

    scheduleCameraStart();
  };

  const finishFaceRegistrationSuccess = async ({
    studentId,
    studentName: completedName,
    verificationResolved = false,
  }) => {
    setLocallyRegisteredFaceIds((currentIds) => {
      const updatedIds = new Set(currentIds);

      updatedIds.add(studentId);

      return updatedIds;
    });

    try {
      await refreshStudents();
    } catch (refreshError) {
      console.warn(
        "Unable to refresh students after verified face registration:",
        refreshError,
      );
    }

    const completedFromAdd = showAddModal;

    const successCopy = completedFromAdd
      ? verificationResolved
        ? `${completedName} was added to ${sectionName}. Identity verification confirmed a separate person and the face was registered successfully.`
        : `${completedName} was added to ${sectionName} and the face photo was registered successfully.`
      : verificationResolved
        ? `Identity verification was completed and the face registration for ${completedName} was saved successfully.`
        : `Face registration completed for ${completedName}.`;

    setSuccessMessage(successCopy);

    setFaceVerificationOpen(false);

    preVerificationCaptureFileRef.current = null;

    if (completedFromAdd) {
      resetAddStudentModal();
    } else {
      resetFaceRegistration();
    }
  };

  const completeVerifiedDifferentEnrollment = async () => {
    const target = getFaceConflictTarget();

    if (!target.id) {
      setFaceVerificationStage("ENROLLMENT_FAILED");

      setFaceError(
        "Student information is unavailable. Close verification and retry face registration.",
      );

      return false;
    }

    if (!capturedFaceFile) {
      setFaceVerificationStage("ENROLLMENT_FAILED");

      setFaceError(
        "The verification photo is unavailable. Capture a fresh face image before completing enrollment.",
      );

      return false;
    }

    try {
      const registrationResult = await adviserService.registerStudentFace(
        target.id,
        capturedFaceFile,
      );

      if (isFaceConflictResult(registrationResult)) {
        setFaceConflict(registrationResult);

        if (registrationResult?.conflictStatus === "CONFIRMED_SAME_PERSON") {
          setFaceVerificationStage("SAME_PERSON");
        } else {
          setFaceVerificationStage("NEW_CONFLICT");
        }

        setFaceError("");

        return false;
      }

      setFaceConflict(null);

      await finishFaceRegistrationSuccess({
        studentId: target.id,

        studentName: target.name,

        verificationResolved: true,
      });

      return true;
    } catch (requestError) {
      console.error(
        "Unable to complete verified face enrollment:",
        requestError,
      );

      setFaceVerificationStage("ENROLLMENT_FAILED");

      setFaceError(
        getErrorMessage(
          requestError,
          "The identity decision was saved, but face enrollment could not be completed. You can retry without repeating the identity decision.",
        ),
      );

      return false;
    }
  };

  const handleVerifyFaceConflict = async () => {
    const target = getFaceConflictTarget();

    if (!target.id || !faceConflict?.conflictId) {
      setFaceError(
        "Face conflict information is incomplete. Please close verification and retry.",
      );

      return;
    }

    if (!capturedFaceFile) {
      setFaceError(
        "Capture a fresh second face photo before submitting verification.",
      );

      return;
    }

    try {
      setVerifyingFaceConflict(true);

      setFaceError("");

      const result = await adviserService.verifyStudentFaceConflictCapture(
        target.id,
        faceConflict.conflictId,
        capturedFaceFile,
      );

      setFaceVerificationResult(result);

      setPendingResolutionDecision(null);

      if (result?.outcome === "MANUAL_REVIEW_REQUIRED") {
        setFaceVerificationStage("MANUAL_REVIEW");

        return;
      }

      if (result?.outcome === "CONFLICT_NOT_REPRODUCED") {
        setFaceVerificationStage("NOT_REPRODUCED");

        return;
      }

      if (result?.outcome === "CONFIRMED_SAME_PERSON") {
        setFaceConflict((currentConflict) => ({
          ...currentConflict,
          conflictStatus: "CONFIRMED_SAME_PERSON",
        }));

        setFaceVerificationStage("SAME_PERSON");

        return;
      }

      if (result?.outcome === "VERIFIED_DIFFERENT_PEOPLE") {
        setFaceConflict((currentConflict) => ({
          ...currentConflict,
          conflictStatus: "VERIFIED_DIFFERENT_PEOPLE",
        }));

        setFaceVerificationStage("ENROLLING");

        await completeVerifiedDifferentEnrollment();

        return;
      }

      setFaceError(
        result?.message ||
          "Identity verification returned an unsupported result.",
      );
    } catch (requestError) {
      console.error("Unable to verify face conflict:", requestError);

      setFaceError(
        getErrorMessage(
          requestError,
          "Unable to complete the second face verification.",
        ),
      );
    } finally {
      setVerifyingFaceConflict(false);
    }
  };

  const requestFaceConflictDecision = (decision) => {
    if (faceVerificationStage !== "MANUAL_REVIEW") {
      return;
    }

    setFaceError("");

    setPendingResolutionDecision(decision);
  };

  const cancelFaceConflictDecision = () => {
    if (resolvingFaceConflict) {
      return;
    }

    setPendingResolutionDecision(null);

    setFaceError("");
  };

  const confirmFaceConflictDecision = async () => {
    const decision = pendingResolutionDecision;

    const target = getFaceConflictTarget();

    if (!decision || !target.id || !faceConflict?.conflictId) {
      setFaceError(
        "The identity decision could not be prepared. Please try again.",
      );

      return;
    }

    try {
      setResolvingFaceConflict(true);

      setFaceError("");

      const result = await adviserService.resolveStudentFaceConflict(
        target.id,
        faceConflict.conflictId,
        decision,
      );

      setFaceResolutionResult(result);

      setPendingResolutionDecision(null);

      setFaceConflict((currentConflict) => ({
        ...currentConflict,
        conflictStatus:
          result?.conflictStatus || currentConflict?.conflictStatus,
      }));

      if (result?.conflictStatus === "VERIFIED_DIFFERENT_PEOPLE") {
        setFaceVerificationStage("ENROLLING");

        await completeVerifiedDifferentEnrollment();

        return;
      }

      if (result?.conflictStatus === "CONFIRMED_SAME_PERSON") {
        setFaceVerificationStage("SAME_PERSON");

        return;
      }

      setFaceError(
        result?.message ||
          "The face conflict was resolved with an unsupported status.",
      );
    } catch (requestError) {
      console.error("Unable to resolve face conflict:", requestError);

      setFaceError(
        getErrorMessage(
          requestError,
          "Unable to save the manual identity decision.",
        ),
      );
    } finally {
      setResolvingFaceConflict(false);
    }
  };

  const retryVerifiedDifferentEnrollment = async () => {
    if (resolvingFaceConflict) {
      return;
    }

    try {
      setResolvingFaceConflict(true);

      setFaceError("");

      setFaceVerificationStage("ENROLLING");

      await completeVerifiedDifferentEnrollment();
    } finally {
      setResolvingFaceConflict(false);
    }
  };

  const restartVerificationForNewConflict = () => {
    if (verifyingFaceConflict || resolvingFaceConflict) {
      return;
    }

    clearCapturedFace();

    setFaceVerificationResult(null);

    setFaceResolutionResult(null);

    setPendingResolutionDecision(null);

    setFaceVerificationStage("CAPTURE");

    setFaceError("");

    setCameraError("");

    autoCaptureStartedRef.current = false;

    setScanPhase("preparing");

    setScanMessage("Preparing verification camera...");

    scheduleCameraStart();
  };

  const closeConfirmedSamePersonReview = async () => {
    if (resolvingFaceConflict) {
      return;
    }

    const target = getFaceConflictTarget();

    try {
      await refreshStudents();
    } catch (refreshError) {
      console.warn(
        "Unable to refresh students after same-person resolution:",
        refreshError,
      );
    }

    setSuccessMessage(
      `Identity review completed for ${target.name}. Separate face enrollment remains blocked because the records were confirmed as the same physical person.`,
    );

    setFaceVerificationOpen(false);

    preVerificationCaptureFileRef.current = null;

    if (showAddModal) {
      resetAddStudentModal();
    } else {
      resetFaceRegistration();
    }
  };

  const faceConflictTarget = getFaceConflictTarget();

  const faceConflictBusy =
    verifyingFaceConflict || resolvingFaceConflict || capturingFace;

  const faceConflictConfirmedSamePerson =
    faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON";

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
          <div className="adviser-alert adviser-alert-error" role="alert">
            <span className="adviser-alert-icon" aria-hidden="true">
              !
            </span>

            <div>
              <strong>Student records unavailable</strong>

              <p>{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="student-success-alert" role="status">
            <span aria-hidden="true">✓</span>

            <div>
              <strong>Operation successful</strong>

              <p>{successMessage}</p>
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setSuccessMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {faceRegistrationIntent && (
          <div className="student-face-intent">
            <span aria-hidden="true">◎</span>

            <div>
              <strong>Student Face Enrollment</strong>

              <p>
                New students can now be created together with their ID-style
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
            <span>ASSIGNED SECTION</span>

            <h2>{loading ? "Loading section..." : sectionName}</h2>

            <p>
              Adviser: <strong>{adviserName}</strong>
            </p>
          </div>

          <div className="student-section-stats">
            <div>
              <span>TOTAL STUDENTS</span>

              <strong>{loading ? "—" : students.length}</strong>
            </div>

            <div>
              <span>FACE PENDING</span>

              <strong>{loading ? "—" : facePendingCount}</strong>
            </div>

            <div>
              <span>FACE REGISTERED</span>

              <strong>{loading ? "—" : faceRegisteredCount}</strong>
            </div>
          </div>

          <span
            className={`student-section-badge ${
              section?.active === false ? "is-inactive" : ""
            }`}
          >
            <span aria-hidden="true" />

            {section?.active === false ? "INACTIVE" : "ACTIVE"}
          </span>
        </section>

        {/* =================================================
            STUDENT PANEL
        ================================================== */}

        <section className="student-panel">
          <header className="student-panel-header">
            <div>
              <span>CLASS ROSTER</span>

              <h2>Students</h2>

              <p>Manage student records and face identities.</p>
            </div>

            <button
              type="button"
              className="adviser-primary-button"
              disabled={loading || !section?.id}
              onClick={openAddStudentModal}
            >
              <span aria-hidden="true">+</span>
              Add Student
            </button>
          </header>

          {/* SEARCH + FILTERS */}

          <div className="student-toolbar">
            <label className="student-search">
              <span className="student-search-icon" aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                value={searchQuery}
                placeholder="Search by student name or student number..."
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </label>

            <div className="student-toolbar-actions">
              <span className="student-result-count">
                <strong>{filteredStudents.length}</strong> of{" "}
                <strong>{students.length}</strong> student
                {students.length === 1 ? "" : "s"}
              </span>

              <div className="student-filter-wrap" ref={filterMenuRef}>
                <button
                  type="button"
                  className={`student-filter-button ${
                    filterMenuOpen ? "is-open" : ""
                  }`}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterMenuOpen((current) => !current)}
                >
                  <span
                    className="student-filter-button-icon"
                    aria-hidden="true"
                  >
                    ≡
                  </span>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="student-filter-count">
                      {activeFilterCount}
                    </span>
                  )}
                  <span className="student-filter-chevron" aria-hidden="true">
                    {filterMenuOpen ? "⌃" : "⌄"}
                  </span>
                </button>

                {filterMenuOpen && (
                  <div
                    className="student-filter-menu"
                    role="dialog"
                    aria-label="Filter students"
                  >
                    <header className="student-filter-menu-header">
                      <div>
                        <strong>Filter students</strong>

                        <span>Refine the class roster</span>
                      </div>

                      <button
                        type="button"
                        aria-label="Close filters"
                        onClick={() => setFilterMenuOpen(false)}
                      >
                        ×
                      </button>
                    </header>

                    <div className="student-filter-menu-body">
                      <label className="student-filter-row">
                        <span className="student-filter-row-label">
                          <i className="is-status" aria-hidden="true" />
                          Status
                        </span>

                        <select
                          value={statusFilter}
                          onChange={(event) =>
                            setStatusFilter(event.target.value)
                          }
                        >
                          <option value="ALL">All statuses</option>

                          <option value="ACTIVE">Active only</option>

                          <option value="INACTIVE">Inactive only</option>
                        </select>
                      </label>

                      <label className="student-filter-row">
                        <span className="student-filter-row-label">
                          <i className="is-face" aria-hidden="true" />
                          Face
                        </span>

                        <select
                          value={faceFilter}
                          onChange={(event) =>
                            setFaceFilter(event.target.value)
                          }
                        >
                          <option value="ALL">All face records</option>

                          <option value="REGISTERED">Registered</option>

                          <option value="PENDING">Pending</option>
                        </select>
                      </label>

                      <label className="student-filter-row">
                        <span className="student-filter-row-label">
                          <i className="is-sort" aria-hidden="true" />
                          Sort by
                        </span>

                        <select
                          value={sortOrder}
                          onChange={(event) => setSortOrder(event.target.value)}
                        >
                          <option value="DEFAULT">Default</option>

                          <option value="NAME_ASC">Name A–Z</option>

                          <option value="NAME_DESC">Name Z–A</option>

                          <option value="NUMBER_ASC">
                            Student no. ascending
                          </option>

                          <option value="NUMBER_DESC">
                            Student no. descending
                          </option>
                        </select>
                      </label>

                      <label className="student-filter-row">
                        <span className="student-filter-row-label">
                          <i className="is-rows" aria-hidden="true" />
                          Rows
                        </span>

                        <select
                          value={rowsPerPage}
                          onChange={(event) =>
                            setRowsPerPage(Number(event.target.value))
                          }
                        >
                          <option value={5}>5 per page</option>

                          <option value={10}>10 per page</option>

                          <option value={20}>20 per page</option>

                          <option value={50}>50 per page</option>
                        </select>
                      </label>
                    </div>

                    <footer className="student-filter-menu-footer">
                      <button
                        type="button"
                        className="student-filter-reset"
                        disabled={
                          !searchQuery &&
                          activeFilterCount === 0 &&
                          rowsPerPage === 10
                        }
                        onClick={resetRosterView}
                      >
                        Reset
                      </button>

                      <button
                        type="button"
                        className="student-filter-done"
                        onClick={() => setFilterMenuOpen(false)}
                      >
                        Done
                      </button>
                    </footer>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="student-table-shell">
            {loading ? (
              <div className="student-loading-state">
                <span className="student-loading-spinner" />

                <strong>Loading students...</strong>

                <p>Retrieving your assigned section roster.</p>
              </div>
            ) : !section ? (
              <div className="student-empty-state">
                <span aria-hidden="true">◇</span>

                <h3>No assigned section</h3>

                <p>
                  A Councilor must assign a section to your Adviser account
                  before you can manage students.
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="student-empty-state">
                <span aria-hidden="true">♙</span>

                <h3>No students yet</h3>

                <p>
                  Add the first student to <strong>{sectionName}</strong>.
                </p>

                <button
                  type="button"
                  className="adviser-primary-button"
                  onClick={openAddStudentModal}
                >
                  + Add Student
                </button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="student-empty-state">
                <span aria-hidden="true">⌕</span>

                <h3>No matching students</h3>

                <p>
                  {searchQuery ? (
                    <>
                      No student matched your search for{" "}
                      <strong>“{searchQuery}”</strong>.
                    </>
                  ) : (
                    <>No students match the selected filters.</>
                  )}
                </p>

                <button
                  type="button"
                  className="adviser-secondary-button student-empty-reset"
                  onClick={resetRosterView}
                >
                  Reset view
                </button>
              </div>
            ) : (
              <table className="student-table">
                <thead>
                  <tr>
                    <th>#</th>

                    <th>Student Number</th>

                    <th>Student Name</th>

                    <th>Status</th>

                    <th>Face Registration</th>

                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedStudents.map((student, index) => {
                    const faceRegistered = hasFaceRegistered(
                      student,
                      locallyRegisteredFaceIds,
                    );

                    const active = student.active !== false;

                    return (
                      <tr key={student.id || student.studentNumber}>
                        <td className="student-table-index">
                          {String(pageStartIndex + index + 1).padStart(2, "0")}
                        </td>

                        <td>
                          <span className="student-number">
                            {student.studentNumber || "—"}
                          </span>
                        </td>

                        <td>
                          <div className="student-name-cell">
                            <span className="student-avatar">
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
                            className={`student-status-badge ${
                              active ? "is-active" : "is-inactive"
                            }`}
                          >
                            <span aria-hidden="true" />

                            {active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`student-face-badge ${
                              faceRegistered ? "is-registered" : ""
                            }`}
                          >
                            <span aria-hidden="true">
                              {faceRegistered ? "✓" : "◎"}
                            </span>

                            {faceRegistered ? "Registered" : "Not Registered"}
                          </span>
                        </td>

                        <td>
                          <div className="student-row-actions">
                            <button
                              type="button"
                              className="student-face-action is-edit"
                              disabled={!active}
                              onClick={() => openEditStudent(student)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={`student-face-action is-face ${
                                faceRegistered ? "is-registered" : ""
                              }`}
                              disabled={!active}
                              onClick={() => openFaceRegistration(student)}
                            >
                              {faceRegistered ? "Update Face" : "Register Face"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!loading &&
            section &&
            students.length > 0 &&
            filteredStudents.length > 0 && (
              <div className="student-pagination">
                <div className="student-pagination-summary">
                  Showing{" "}
                  <strong>
                    {visibleStart}–{visibleEnd}
                  </strong>{" "}
                  of <strong>{filteredStudents.length}</strong> student
                  {filteredStudents.length === 1 ? "" : "s"}
                </div>

                <nav
                  className="student-pagination-controls"
                  aria-label="Student list pagination"
                >
                  <button
                    type="button"
                    className="student-pagination-nav"
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                  >
                    ‹
                  </button>

                  <div className="student-pagination-pages">
                    {paginationItems.map((item, index) =>
                      typeof item === "string" ? (
                        <span
                          key={`${item}-${index}`}
                          className="student-pagination-ellipsis"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={`student-pagination-page ${
                            currentPage === item ? "is-active" : ""
                          }`}
                          aria-current={
                            currentPage === item ? "page" : undefined
                          }
                          onClick={() => setCurrentPage(item)}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    className="student-pagination-nav"
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                  >
                    ›
                  </button>
                </nav>
              </div>
            )}
        </section>
      </section>

      {/* ===================================================
          ADD STUDENT + FACE ENROLLMENT WIZARD
      ==================================================== */}

      {showAddModal && !faceVerificationOpen && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddModal();
            }
          }}
        >
          <form
            className={`adviser-modal student-enrollment-modal student-enrollment-step-${enrollmentStep}`}
            onSubmit={handleCreateStudent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-enrollment-title"
          >
            <header className="adviser-modal-header student-modal-header student-wizard-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  {enrollmentStep === 1
                    ? "+"
                    : enrollmentStep === 2
                      ? "◎"
                      : "✓"}
                </div>

                <div>
                  <span>STUDENT ENROLLMENT</span>

                  <h2 id="student-enrollment-title">
                    {enrollmentStep === 1
                      ? "Add student details"
                      : enrollmentStep === 2
                        ? "Capture face identity"
                        : "Review enrollment"}
                  </h2>

                  <p>
                    {enrollmentStep === 1
                      ? "Enter the student's official roster information before opening the camera."
                      : enrollmentStep === 2
                        ? "Use the guided scanner to capture one clear, front-facing enrollment photo."
                        : "Confirm the student details and captured face before saving the enrollment."}
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

            <nav
              className="student-wizard-progress"
              aria-label="Enrollment progress"
            >
              <div
                className={`student-wizard-progress-item ${
                  enrollmentStep === 1
                    ? "is-current"
                    : enrollmentStep > 1
                      ? "is-complete"
                      : ""
                }`}
              >
                <span>{enrollmentStep > 1 ? "✓" : "1"}</span>

                <div>
                  <strong>Student details</strong>
                  <small>Roster information</small>
                </div>
              </div>

              <i aria-hidden="true" />

              <div
                className={`student-wizard-progress-item ${
                  enrollmentStep === 2
                    ? "is-current"
                    : enrollmentStep > 2
                      ? "is-complete"
                      : ""
                }`}
              >
                <span>{enrollmentStep > 2 ? "✓" : "2"}</span>

                <div>
                  <strong>Face capture</strong>
                  <small>Guided scanner</small>
                </div>
              </div>

              <i aria-hidden="true" />

              <div
                className={`student-wizard-progress-item ${
                  enrollmentStep === 3 ? "is-current" : ""
                }`}
              >
                <span>3</span>

                <div>
                  <strong>Review & save</strong>
                  <small>Final confirmation</small>
                </div>
              </div>
            </nav>

            <div ref={enrollmentBodyRef} className="student-wizard-body">
              {enrollmentStep === 1 && (
                <section className="student-wizard-step student-wizard-details-step">
                  <div className="student-wizard-step-intro">
                    <span>STEP 1 OF 3</span>

                    <h3>Student information</h3>

                    <p>
                      Start with the student's roster details. The camera stays
                      off until you continue to Face Capture.
                    </p>
                  </div>

                  {createdStudentRecord && (
                    <div className="student-created-notice">
                      <span aria-hidden="true">✓</span>

                      <div>
                        <strong>Student record already created</strong>

                        <p>
                          The roster record was saved earlier. Student details
                          are locked while you finish face registration.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="student-wizard-form-card">
                    <div className="student-form student-enrollment-form">
                      <label className="student-form-field">
                        <span>Student Number</span>

                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          value={studentNumber}
                          disabled={
                            creatingStudent || Boolean(createdStudentRecord)
                          }
                          autoComplete="off"
                          placeholder="e.g. 123456789012"
                          aria-invalid={
                            studentNumber.length > 0 &&
                            !isValidStudentNumber(studentNumber)
                          }
                          onChange={(event) => {
                            setStudentNumber(
                              normalizeStudentNumberInput(event.target.value),
                            );

                            if (createError) {
                              setCreateError("");
                            }
                          }}
                        />

                        <small>
                          Enter the official 12-digit school student number.
                        </small>
                      </label>

                      <label className="student-form-field">
                        <span>Complete Name</span>

                        <input
                          type="text"
                          value={studentName}
                          disabled={
                            creatingStudent || Boolean(createdStudentRecord)
                          }
                          autoComplete="off"
                          placeholder="Enter complete student name"
                          onChange={(event) => {
                            setStudentName(event.target.value);

                            if (createError) {
                              setCreateError("");
                            }
                          }}
                        />

                        <small>
                          Enter the name exactly as it appears on the class
                          roster.
                        </small>
                      </label>

                      <div className="student-form-field">
                        <span>Assigned Section</span>

                        <div className="student-locked-field student-wizard-section-field">
                          <div>
                            <small>SECTION</small>
                            <strong>{sectionName}</strong>
                          </div>

                          <span className="student-locked-badge">ASSIGNED</span>
                        </div>

                        <small>
                          New students are enrolled only in your assigned
                          section.
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="student-wizard-info-note">
                    <span aria-hidden="true">i</span>

                    <div>
                      <strong>Camera permission comes next</strong>

                      <p>
                        Your browser will request camera access only after you
                        continue to Step 2.
                      </p>
                    </div>
                  </div>

                  {createError && (
                    <div
                      className="adviser-modal-error student-wizard-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>
                      <p>{createError}</p>
                    </div>
                  )}
                </section>
              )}

              {enrollmentStep === 2 && (
                <section className="student-wizard-step student-wizard-camera-step">
                  <div className="student-wizard-student-bar">
                    <span className="student-face-student-avatar">
                      {studentName?.charAt(0)?.toUpperCase() || "S"}
                    </span>

                    <div>
                      <span>ENROLLING STUDENT</span>

                      <strong>{studentName.trim() || "Student"}</strong>

                      <small>
                        {studentNumber.trim() || "No student number"}
                        {" • "}
                        {sectionName}
                      </small>
                    </div>

                    <FaceCameraStatus
                      cameraActive={cameraActive}
                      capturedFacePreview={capturedFacePreview}
                      scanPhase={scanPhase}
                    />
                  </div>

                  <div className="student-wizard-camera-layout">
                    <div
                      className={`student-wizard-camera-main ${
                        capturedFacePreview ? "has-captured-face" : ""
                      }`}
                    >
                      <FaceCapturePanel
                        subjectName={studentName.trim() || "student"}
                        videoRef={videoRef}
                        canvasRef={canvasRef}
                        cameraActive={cameraActive}
                        cameraReady={cameraReady}
                        cameraError={cameraError}
                        capturedFacePreview={capturedFacePreview}
                        faceError={faceError}
                        registeringFace={creatingStudent}
                        capturingFace={capturingFace}
                        scanPhase={scanPhase}
                        scanMessage={scanMessage}
                        countdown={countdown}
                        flashActive={flashActive}
                        onCameraReady={handleCameraReady}
                        onEnableCamera={() => void startFaceCamera()}
                        onManualCapture={() => void handleCaptureFace()}
                      />

                      {faceConflict && (
                        <FaceConflictNotice conflict={faceConflict} compact />
                      )}
                    </div>

                    <aside className="student-wizard-camera-guide">
                      <span>FACE CAPTURE</span>

                      <h3>
                        {capturedFacePreview
                          ? faceConflict
                            ? "Face verification is required"
                            : "Review the captured photo"
                          : "One clear face is enough"}
                      </h3>

                      <p>
                        {capturedFacePreview
                          ? faceConflict
                            ? "This photo matched another enrolled face unusually closely. Continue to review and use Verify Identity for a fresh second capture, or retake only if this photo is poor."
                            : "If the face is clear and properly framed, continue to the final review."
                          : "Keep the student centered, facing forward, and evenly lit."}
                      </p>

                      {!capturedFacePreview && (
                        <div className="student-wizard-guide-list">
                          <div>
                            <i aria-hidden="true">1</i>
                            <span>
                              <strong>Center the face</strong>
                              Keep the full face inside the guide.
                            </span>
                          </div>

                          <div>
                            <i aria-hidden="true">2</i>
                            <span>
                              <strong>Look straight</strong>
                              Avoid turning or tilting the head.
                            </span>
                          </div>

                          <div>
                            <i aria-hidden="true">3</i>
                            <span>
                              <strong>Use clear lighting</strong>
                              Avoid strong backlight and deep shadows.
                            </span>
                          </div>
                        </div>
                      )}

                      {capturedFacePreview && (
                        <div
                          className={`student-wizard-captured-review ${
                            faceConflict ? "is-conflict" : ""
                          }`}
                        >
                          <span aria-hidden="true">
                            {faceConflict ? "!" : "✓"}
                          </span>

                          <div>
                            <strong>
                              {faceConflict
                                ? "Identity verification available"
                                : "Capture looks ready"}
                            </strong>
                            <p>
                              {faceConflict
                                ? "The current photo triggered a highly similar face conflict and was not registered. Continue to Review Enrollment, then use Verify Identity to complete the protected verification flow."
                                : "Check the framing and clarity once. Use Retake Photo only if the image needs improvement."}
                            </p>
                          </div>
                        </div>
                      )}
                    </aside>
                  </div>
                </section>
              )}

              {enrollmentStep === 3 && (
                <section className="student-wizard-step student-wizard-review-step">
                  <div className="student-wizard-step-intro">
                    <span>STEP 3 OF 3</span>

                    <h3>Review before saving</h3>

                    <p>
                      Confirm the student record and enrollment photo. Nothing
                      is submitted until you press the final save button.
                    </p>
                  </div>

                  <div className="student-wizard-review-grid">
                    <article className="student-wizard-review-card">
                      <div className="student-wizard-review-card-header">
                        <span className="student-face-student-avatar student-wizard-review-avatar">
                          {studentName?.charAt(0)?.toUpperCase() || "S"}
                        </span>

                        <div>
                          <span>STUDENT RECORD</span>
                          <strong>{studentName || "Student"}</strong>
                          <small>{studentNumber || "No student number"}</small>
                        </div>
                      </div>

                      <dl className="student-wizard-review-details">
                        <div>
                          <dt>Student Number</dt>
                          <dd>{studentNumber || "—"}</dd>
                        </div>

                        <div>
                          <dt>Complete Name</dt>
                          <dd>{studentName || "—"}</dd>
                        </div>

                        <div>
                          <dt>Assigned Section</dt>
                          <dd>{sectionName}</dd>
                        </div>

                        <div>
                          <dt>Face Identity</dt>
                          <dd
                            className={
                              faceConflict ? "is-conflict" : "is-ready"
                            }
                          >
                            {faceConflict
                              ? "Verification required"
                              : "Ready to register"}
                          </dd>
                        </div>
                      </dl>
                    </article>

                    <article className="student-wizard-review-photo-card">
                      <div className="student-wizard-review-photo-header">
                        <div>
                          <span>FACE IDENTITY</span>
                          <strong>Enrollment photo</strong>
                        </div>

                        <span className="student-wizard-review-ready">
                          ✓ PHOTO READY
                        </span>
                      </div>

                      <div className="student-wizard-review-photo">
                        {capturedFacePreview ? (
                          <img
                            src={capturedFacePreview}
                            alt={`Enrollment preview of ${studentName || "student"}`}
                          />
                        ) : (
                          <div className="student-wizard-review-photo-missing">
                            <span aria-hidden="true">!</span>
                            <strong>No photo captured</strong>
                          </div>
                        )}

                        {capturedFacePreview && (
                          <div className="student-wizard-review-photo-overlay">
                            <span aria-hidden="true">✓</span>
                            Face capture complete
                          </div>
                        )}
                      </div>
                    </article>
                  </div>

                  {faceConflict ? (
                    <FaceConflictNotice conflict={faceConflict} />
                  ) : (
                    <div className="student-wizard-final-note">
                      <span aria-hidden="true">✓</span>

                      <div>
                        <strong>Ready to complete enrollment</strong>

                        <p>
                          Saving will create the student record and register
                          this face image for attendance recognition.
                        </p>
                      </div>
                    </div>
                  )}

                  {createError && (
                    <div
                      className="adviser-modal-error student-wizard-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>
                      <p>{createError}</p>
                    </div>
                  )}

                  {faceError && !faceConflict && (
                    <div
                      className="student-face-feedback is-error student-wizard-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>

                      <div>
                        <strong>Face registration</strong>
                        <p>{faceError}</p>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="adviser-modal-actions student-wizard-actions">
              <div className="student-wizard-footer-copy">
                <strong>
                  {enrollmentStep === 1
                    ? "Student details"
                    : enrollmentStep === 2
                      ? capturedFacePreview
                        ? "Face photo ready"
                        : "Face photo required"
                      : faceConflict
                        ? "Face verification required"
                        : createdStudentRecord
                          ? "Complete face registration"
                          : "Ready to save"}
                </strong>

                <span>
                  {enrollmentStep === 1
                    ? "Enter the required roster information to continue."
                    : enrollmentStep === 2
                      ? capturedFacePreview
                        ? "Review the photo or retake it before continuing."
                        : "Auto capture starts when the camera becomes ready."
                      : faceConflict
                        ? "The student record is safe, but this face was not registered. Choose Verify Identity to continue now, or retake the photo if the capture quality is poor."
                        : createdStudentRecord
                          ? "The student record already exists. Only face registration will be retried."
                          : "Confirm the information, then save the student and face identity."}
                </span>
              </div>

              <div className="student-wizard-action-group">
                {enrollmentStep === 1 && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={creatingStudent}
                      onClick={closeAddModal}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="adviser-primary-button student-wizard-next-button"
                      disabled={
                        creatingStudent ||
                        !isValidStudentNumber(studentNumber) ||
                        !studentName.trim() ||
                        !section?.id
                      }
                      onClick={goToEnrollmentFace}
                    >
                      Continue to Face Capture
                      <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}

                {enrollmentStep === 2 && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={creatingStudent || capturingFace}
                      onClick={goToEnrollmentDetails}
                    >
                      ← Back to Details
                    </button>

                    {capturedFacePreview ? (
                      <>
                        <button
                          type="button"
                          className="adviser-secondary-button"
                          disabled={creatingStudent || capturingFace}
                          onClick={() => void handleRetakeFace()}
                        >
                          Retake Photo
                        </button>

                        <button
                          type="button"
                          className="adviser-primary-button student-wizard-next-button"
                          disabled={
                            creatingStudent ||
                            capturingFace ||
                            !capturedFaceFile
                          }
                          onClick={goToEnrollmentReview}
                        >
                          Review Enrollment
                          <span aria-hidden="true">→</span>
                        </button>
                      </>
                    ) : !cameraActive ? (
                      <button
                        type="button"
                        className="adviser-primary-button student-enrollment-camera-cta"
                        disabled={creatingStudent || capturingFace}
                        onClick={() => void startFaceCamera()}
                      >
                        Enable Camera
                        <span aria-hidden="true">◎</span>
                      </button>
                    ) : !cameraReady ? (
                      <button
                        type="button"
                        className="adviser-primary-button student-enrollment-camera-cta"
                        disabled
                      >
                        <span
                          className="adviser-button-spinner"
                          aria-hidden="true"
                        />
                        Preparing Camera...
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="adviser-primary-button student-enrollment-camera-cta"
                        disabled={creatingStudent || capturingFace}
                        onClick={() => void handleCaptureFace()}
                      >
                        {capturingFace ? "Capturing..." : "Capture Now"}
                      </button>
                    )}
                  </>
                )}

                {enrollmentStep === 3 && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={creatingStudent}
                      onClick={returnToEnrollmentFace}
                    >
                      ← Back to Face
                    </button>

                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={creatingStudent}
                      onClick={() => {
                        setEnrollmentStep(2);

                        void handleRetakeFace();
                      }}
                    >
                      Retake Photo
                    </button>

                    {faceConflict ? (
                      <button
                        type="button"
                        className={`adviser-primary-button student-enrollment-submit ${
                          faceConflictConfirmedSamePerson
                            ? "student-conflict-blocked-button"
                            : "student-conflict-verify-button"
                        }`}
                        disabled={
                          creatingStudent ||
                          faceConflictBusy ||
                          faceConflictConfirmedSamePerson
                        }
                        onClick={openFaceConflictVerification}
                      >
                        {faceConflictConfirmedSamePerson
                          ? "Enrollment Blocked"
                          : "Verify Identity"}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="adviser-primary-button student-enrollment-submit"
                        disabled={
                          creatingStudent ||
                          !capturedFaceFile ||
                          !isValidStudentNumber(studentNumber) ||
                          !studentName.trim()
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
                            : "Saving Enrollment..."
                          : createdStudentRecord
                            ? "Complete Face Registration"
                            : "Save Student & Face"}
                      </button>
                    )}
                  </>
                )}
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
            if (event.target === event.currentTarget) {
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
                  <span>STUDENT RECORD</span>

                  <h2 id="edit-student-title">Edit student</h2>

                  <p>Update the student's roster information.</p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={closeEditStudent}
                disabled={updatingStudent}
                aria-label="Close edit student"
              >
                ×
              </button>
            </header>

            <div className="student-edit-body">
              <div className="student-edit-summary">
                <span className="student-face-student-avatar">
                  {editingStudent.name?.charAt(0)?.toUpperCase() || "S"}
                </span>

                <div>
                  <span>CURRENT RECORD</span>

                  <strong>{editingStudent.name || "Student"}</strong>

                  <small>
                    {editingStudent.studentNumber || "No student number"}
                    {" • "}
                    {sectionName}
                  </small>
                </div>
              </div>

              <div className="student-form student-edit-form">
                <label className="student-form-field">
                  <span>Student Number</span>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={12}
                    value={editStudentNumber}
                    disabled={updatingStudent}
                    autoFocus
                    placeholder="Enter 12-digit student number"
                    aria-invalid={
                      editStudentNumber.length > 0 &&
                      !isValidStudentNumber(editStudentNumber)
                    }
                    onChange={(event) => {
                      setEditStudentNumber(
                        normalizeStudentNumberInput(event.target.value),
                      );

                      if (editError) {
                        setEditError("");
                      }
                    }}
                  />

                  <small>
                    Must contain exactly 12 digits and remain unique across
                    student records.
                  </small>
                </label>

                <label className="student-form-field">
                  <span>Complete Name</span>

                  <input
                    type="text"
                    value={editStudentName}
                    disabled={updatingStudent}
                    placeholder="Enter complete student name"
                    onChange={(event) => setEditStudentName(event.target.value)}
                  />
                </label>

                <div className="student-form-field">
                  <span>Assigned Section</span>

                  <div className="student-locked-field">
                    <div>
                      <small>SECTION</small>

                      <strong>{sectionName}</strong>
                    </div>

                    <span className="student-locked-badge">LOCKED</span>
                  </div>

                  <small>
                    Section assignment cannot be changed from Student
                    Management.
                  </small>
                </div>

                {editError && (
                  <div className="adviser-modal-error" role="alert">
                    <span aria-hidden="true">!</span>

                    <p>{editError}</p>
                  </div>
                )}
              </div>
            </div>

            <footer className="adviser-modal-actions student-edit-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={updatingStudent}
                onClick={closeEditStudent}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="adviser-primary-button"
                disabled={
                  updatingStudent ||
                  !isValidStudentNumber(editStudentNumber) ||
                  !editStudentName.trim()
                }
              >
                {updatingStudent && (
                  <span className="adviser-button-spinner" aria-hidden="true" />
                )}

                {updatingStudent ? "Saving..." : "Save Changes"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* ===================================================
          EXISTING STUDENT FACE MODAL
      ==================================================== */}

      {selectedStudent && !faceVerificationOpen && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
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
                  <span>FACE IDENTITY</span>

                  <h2 id="student-face-title">
                    {hasFaceRegistered(
                      selectedStudent,
                      locallyRegisteredFaceIds,
                    )
                      ? "Update student face"
                      : "Register student face"}
                  </h2>

                  <p>
                    Capture one clear, front-facing image for attendance
                    recognition.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={closeFaceRegistration}
                disabled={registeringFace || capturingFace}
                aria-label="Close face registration"
              >
                ×
              </button>
            </header>

            <div className="student-face-student">
              <span className="student-face-student-avatar">
                {selectedStudent.name?.charAt(0)?.toUpperCase() || "S"}
              </span>

              <div>
                <span>STUDENT</span>

                <strong>{selectedStudent.name}</strong>

                <small>
                  {selectedStudent.studentNumber || "No student number"}
                  {" • "}
                  {sectionName}
                </small>
              </div>

              <FaceCameraStatus
                cameraActive={cameraActive}
                capturedFacePreview={capturedFacePreview}
                scanPhase={scanPhase}
              />
            </div>

            <div className="student-identity-camera">
              <FaceCapturePanel
                subjectName={selectedStudent.name || "student"}
                videoRef={videoRef}
                canvasRef={canvasRef}
                cameraActive={cameraActive}
                cameraReady={cameraReady}
                cameraError={cameraError}
                capturedFacePreview={capturedFacePreview}
                faceError={faceError}
                registeringFace={registeringFace}
                capturingFace={capturingFace}
                scanPhase={scanPhase}
                scanMessage={scanMessage}
                countdown={countdown}
                flashActive={flashActive}
                onCameraReady={handleCameraReady}
                onEnableCamera={() => void startFaceCamera()}
                onManualCapture={() => void handleCaptureFace()}
              />

              {faceConflict && (
                <FaceConflictNotice conflict={faceConflict} compact />
              )}
            </div>

            <footer className="adviser-modal-actions student-face-modal-actions">
              <div className="student-face-footer-copy">
                <strong>
                  {faceConflict
                    ? "Face verification required"
                    : capturedFacePreview
                      ? "Photo ready"
                      : "Position the student"}
                </strong>

                <span>
                  {faceConflict
                    ? "This face was not saved. Choose Verify Identity for the required second capture, or retake if the current image quality is poor."
                    : capturedFacePreview
                      ? "Review the image, then save the face identity."
                      : "Auto capture starts once the camera is ready."}
                </span>
              </div>

              <div className="student-face-action-group">
                <button
                  type="button"
                  className="adviser-secondary-button"
                  disabled={registeringFace || capturingFace}
                  onClick={closeFaceRegistration}
                >
                  Cancel
                </button>

                {capturedFacePreview ? (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={registeringFace}
                      onClick={() => void handleRetakeFace()}
                    >
                      Retake
                    </button>

                    {faceConflict ? (
                      <button
                        type="button"
                        className={`adviser-primary-button ${
                          faceConflictConfirmedSamePerson
                            ? "student-conflict-blocked-button"
                            : "student-conflict-verify-button"
                        }`}
                        disabled={
                          registeringFace ||
                          faceConflictBusy ||
                          faceConflictConfirmedSamePerson
                        }
                        onClick={openFaceConflictVerification}
                      >
                        {faceConflictConfirmedSamePerson
                          ? "Enrollment Blocked"
                          : "Verify Identity"}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="adviser-primary-button"
                        disabled={registeringFace || !capturedFaceFile}
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
                    )}
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
                    onClick={() => void handleCaptureFace()}
                  >
                    {capturingFace ? "Capturing..." : "Capture Now"}
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      )}

      {/* ===================================================
          FACE CONFLICT IDENTITY VERIFICATION
      ==================================================== */}

      {faceVerificationOpen && faceConflict && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop student-face-verification-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !faceConflictBusy) {
              closeFaceConflictVerification();
            }
          }}
        >
          <section
            className="adviser-modal student-face-verification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-face-verification-title"
          >
            <header className="adviser-modal-header student-modal-header student-face-verification-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon student-face-verification-icon"
                  aria-hidden="true"
                >
                  ◈
                </div>

                <div>
                  <span>IDENTITY SAFEGUARD</span>

                  <h2 id="student-face-verification-title">
                    Verify face identity
                  </h2>

                  <p>
                    Follow two short steps. Capture once more, then review the
                    identity only if the similarity is reproduced.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="student-modal-close"
                disabled={faceConflictBusy}
                aria-label="Close identity verification"
                onClick={closeFaceConflictVerification}
              >
                ×
              </button>
            </header>

            <div className="student-face-verification-progress">
              <div
                className={`student-face-verification-progress-item ${
                  faceVerificationStage === "CAPTURE"
                    ? "is-current"
                    : "is-complete"
                }`}
              >
                <span>{faceVerificationStage === "CAPTURE" ? "1" : "✓"}</span>

                <div>
                  <strong>Second capture</strong>
                  <small>Recheck the detected similarity</small>
                </div>
              </div>

              <i aria-hidden="true" />

              <div
                className={`student-face-verification-progress-item ${
                  faceVerificationStage === "MANUAL_REVIEW" ||
                  faceVerificationStage === "ENROLLING" ||
                  faceVerificationStage === "ENROLLMENT_FAILED" ||
                  faceVerificationStage === "NEW_CONFLICT" ||
                  faceVerificationStage === "SAME_PERSON"
                    ? "is-current"
                    : faceVerificationStage !== "CAPTURE"
                      ? "is-complete"
                      : ""
                }`}
              >
                <span>2</span>

                <div>
                  <strong>Identity decision</strong>
                  <small>Human review when still uncertain</small>
                </div>
              </div>
            </div>

            <div className="student-face-verification-body">
              <div
                className="student-face-verification-summary"
                aria-label="Face conflict summary"
              >
                <div className="student-face-verification-summary-person is-target">
                  <span
                    className="student-face-student-avatar"
                    aria-hidden="true"
                  >
                    {faceConflictTarget.name?.charAt(0)?.toUpperCase() || "S"}
                  </span>

                  <div>
                    <span>VERIFYING</span>
                    <strong>{faceConflictTarget.name}</strong>
                    <small>
                      {showAddModal
                        ? studentNumber || "Student record"
                        : selectedStudent?.studentNumber || "Student record"}
                    </small>
                  </div>
                </div>

                <div className="student-face-verification-summary-score">
                  <span>FACE SIMILARITY</span>
                  <strong>{formatFaceSimilarity(faceConflict.distance)}</strong>
                  <small>Possible match</small>
                </div>

                <div className="student-face-verification-summary-person is-match">
                  <span
                    className="student-face-student-avatar"
                    aria-hidden="true"
                  >
                    {faceConflict.conflictingStudentName
                      ?.charAt(0)
                      ?.toUpperCase() || "S"}
                  </span>

                  <div>
                    <span>SIMILAR FACE</span>
                    <strong>
                      {faceConflict.conflictingStudentName ||
                        "Existing student"}
                    </strong>
                    <small>
                      {faceConflict.conflictingSectionName ||
                        "Section unavailable"}
                    </small>
                  </div>
                </div>
              </div>

              {faceVerificationStage === "CAPTURE" && (
                <div className="student-face-verification-capture-layout is-calm-focus">
                  <div className="student-face-verification-camera">
                    <div className="student-face-verification-step-heading">
                      <span>STEP 1 OF 2</span>

                      <h3>Take one fresh photo</h3>

                      <p>
                        Keep the student centered and facing forward. The camera
                        turns off after the photo is captured.
                      </p>
                    </div>

                    <FaceCapturePanel
                      subjectName={faceConflictTarget.name}
                      videoRef={videoRef}
                      canvasRef={canvasRef}
                      cameraActive={cameraActive}
                      cameraReady={cameraReady}
                      cameraError={cameraError}
                      capturedFacePreview={capturedFacePreview}
                      faceError={faceError}
                      registeringFace={verifyingFaceConflict}
                      capturingFace={capturingFace}
                      scanPhase={scanPhase}
                      scanMessage={scanMessage}
                      countdown={countdown}
                      flashActive={flashActive}
                      onCameraReady={handleCameraReady}
                      onEnableCamera={() => void startFaceCamera()}
                      onManualCapture={() => void handleCaptureFace()}
                      captureMode="verification"
                    />
                  </div>

                  <aside className="student-face-verification-help-card">
                    <div
                      className="student-face-verification-help-icon"
                      aria-hidden="true"
                    >
                      i
                    </div>

                    <div className="student-face-verification-help-copy">
                      <span>WHY THIS STEP?</span>
                      <strong>Confirm the similarity once more</strong>
                      <p>
                        Similar faces can happen with twins, siblings, or
                        duplicate records. A second live photo checks whether
                        the same conflict appears again before any manual
                        decision is allowed.
                      </p>
                    </div>

                    <div className="student-face-verification-quick-facts">
                      <div>
                        <span>Initial similarity</span>
                        <strong>
                          {formatFaceSimilarity(faceConflict.distance)}
                        </strong>
                      </div>

                      <div>
                        <span>Face saved</span>
                        <strong>No</strong>
                      </div>
                    </div>
                  </aside>
                </div>
              )}

              {faceVerificationStage === "MANUAL_REVIEW" && (
                <div className="student-face-verification-review is-calm-focus">
                  <div className="student-face-verification-step-heading">
                    <span>STEP 2 OF 2</span>

                    <h3>Confirm who the student is</h3>

                    <p>
                      The second photo reproduced the similarity conflict. The
                      system will not choose automatically. Verify the student
                      in front of you, then select one identity decision.
                    </p>
                  </div>

                  <div className="student-face-verification-comparison-strip">
                    <div className="student-face-verification-comparison-value">
                      <span>FIRST PHOTO</span>
                      <strong>
                        {formatFaceSimilarity(faceConflict.distance)}
                      </strong>
                    </div>

                    <span
                      className="student-face-verification-comparison-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>

                    <div className="student-face-verification-comparison-value">
                      <span>SECOND PHOTO</span>
                      <strong>
                        {formatFaceSimilarity(faceVerificationResult?.distance)}
                      </strong>
                    </div>

                    <div className="student-face-verification-comparison-result">
                      <span aria-hidden="true">✓</span>

                      <div>
                        <strong>Manual review required</strong>
                        <small>
                          Difference:{" "}
                          {formatFaceSimilarityDifference(
                            faceConflict.distance,
                            faceVerificationResult?.distance,
                          )}
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="student-face-verification-safety-strip is-calm">
                    <span aria-hidden="true">▣</span>

                    <div>
                      <strong>Camera is off. No face has been saved.</strong>
                      <p>
                        Check the student physically present and the official
                        roster before choosing below.
                      </p>
                    </div>
                  </div>

                  {!pendingResolutionDecision ? (
                    <div className="student-face-verification-decision-zone">
                      <div className="student-face-verification-decision-zone-heading">
                        <span>CHOOSE ONE</span>
                        <strong>What did you verify?</strong>
                      </div>

                      <div className="student-face-verification-decisions is-calm">
                        <button
                          type="button"
                          className="student-face-verification-decision is-different"
                          disabled={faceConflictBusy}
                          onClick={() =>
                            requestFaceConflictDecision("DIFFERENT_PEOPLE")
                          }
                        >
                          <span className="student-face-verification-decision-icon">
                            ≠
                          </span>

                          <div>
                            <strong>Two different students</strong>
                            <small>Allow separate face enrollment</small>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="student-face-verification-decision is-same"
                          disabled={faceConflictBusy}
                          onClick={() =>
                            requestFaceConflictDecision("SAME_PERSON")
                          }
                        >
                          <span className="student-face-verification-decision-icon">
                            =
                          </span>

                          <div>
                            <strong>Same physical person</strong>
                            <small>Keep separate face enrollment blocked</small>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`student-face-verification-confirmation ${
                        pendingResolutionDecision === "SAME_PERSON"
                          ? "is-same"
                          : "is-different"
                      }`}
                      role="alert"
                    >
                      <span
                        className="student-face-verification-confirmation-icon"
                        aria-hidden="true"
                      >
                        {pendingResolutionDecision === "SAME_PERSON"
                          ? "="
                          : "≠"}
                      </span>

                      <div>
                        <span>FINAL CONFIRMATION</span>

                        <h4>
                          {pendingResolutionDecision === "SAME_PERSON"
                            ? "Confirm this is the same physical person?"
                            : "Confirm these are two different students?"}
                        </h4>

                        <p>
                          {pendingResolutionDecision === "SAME_PERSON"
                            ? "Separate face enrollment will remain blocked for this conflict pair."
                            : "Separate face enrollment will be allowed for this student after the decision is saved."}
                        </p>

                        <div className="student-face-verification-confirmation-actions">
                          <button
                            type="button"
                            className="adviser-secondary-button"
                            disabled={resolvingFaceConflict}
                            onClick={cancelFaceConflictDecision}
                          >
                            Go Back
                          </button>

                          <button
                            type="button"
                            className={`adviser-primary-button ${
                              pendingResolutionDecision === "SAME_PERSON"
                                ? "student-face-confirm-same"
                                : ""
                            }`}
                            disabled={resolvingFaceConflict}
                            onClick={() => void confirmFaceConflictDecision()}
                          >
                            {resolvingFaceConflict && (
                              <span
                                className="adviser-button-spinner"
                                aria-hidden="true"
                              />
                            )}

                            {resolvingFaceConflict
                              ? "Saving Decision..."
                              : pendingResolutionDecision === "SAME_PERSON"
                                ? "Confirm Same Person"
                                : "Confirm Different Students"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {faceError && (
                    <div
                      className="student-face-feedback is-error student-face-verification-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>

                      <div>
                        <strong>Identity decision</strong>
                        <p>{faceError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {faceVerificationStage === "NOT_REPRODUCED" && (
                <div className="student-face-verification-result is-neutral">
                  <span
                    className="student-face-verification-result-icon"
                    aria-hidden="true"
                  >
                    ↻
                  </span>

                  <div>
                    <span>SECOND CAPTURE COMPLETE</span>

                    <h3>The original conflict was not reproduced</h3>

                    <p>
                      The backend did not reproduce the same face conflict from
                      the second capture. No face was saved and no manual
                      decision was recorded. Return to normal face capture and
                      retry enrollment with a fresh photo.
                    </p>

                    <dl>
                      <div>
                        <dt>Original similarity</dt>
                        <dd>{formatFaceSimilarity(faceConflict.distance)}</dd>
                      </div>

                      <div>
                        <dt>Second similarity</dt>
                        <dd>
                          {formatFaceSimilarity(
                            faceVerificationResult?.distance,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {faceVerificationStage === "SAME_PERSON" && (
                <div className="student-face-verification-result is-blocked">
                  <span
                    className="student-face-verification-result-icon"
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <span>IDENTITY DECISION SAVED</span>

                    <h3>Separate face enrollment is blocked</h3>

                    <p>
                      These student records were confirmed as the same physical
                      person. The backend saved the decision and will continue
                      blocking a separate face registration for this conflict
                      pair.
                    </p>

                    <dl>
                      <div>
                        <dt>Status</dt>
                        <dd>Same person confirmed</dd>
                      </div>

                      <div>
                        <dt>Verified by</dt>
                        <dd>
                          {faceResolutionResult?.verifiedByName ||
                            "Authorized Adviser"}
                        </dd>
                      </div>

                      <div>
                        <dt>Face saved</dt>
                        <dd>No</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {faceVerificationStage === "ENROLLING" && (
                <div className="student-face-verification-result is-processing">
                  <span
                    className="student-face-verification-result-spinner"
                    aria-hidden="true"
                  />

                  <div>
                    <span>IDENTITY DECISION SAVED</span>

                    <h3>Completing separate face enrollment</h3>

                    <p>
                      The students were verified as different people. The system
                      is now saving this student's face record.
                    </p>
                  </div>
                </div>
              )}

              {faceVerificationStage === "ENROLLMENT_FAILED" && (
                <div className="student-face-verification-result is-warning">
                  <span
                    className="student-face-verification-result-icon"
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <span>DECISION SAVED — ENROLLMENT PENDING</span>

                    <h3>The identity review is safe, but face saving failed</h3>

                    <p>
                      The students are already verified as different people. You
                      do not need to repeat the manual decision. Retry the face
                      save using the current verification capture.
                    </p>

                    {faceError && (
                      <div className="student-face-verification-inline-error">
                        {faceError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {faceVerificationStage === "NEW_CONFLICT" && (
                <div className="student-face-verification-result is-warning">
                  <span
                    className="student-face-verification-result-icon"
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <span>ANOTHER SIMILAR FACE DETECTED</span>

                    <h3>A new face conflict needs verification</h3>

                    <p>
                      The previous pair was resolved as different people, but
                      the latest enrollment attempt returned another unresolved
                      similar-face conflict. Start a fresh second capture for
                      the new conflict before continuing.
                    </p>

                    <FaceConflictNotice conflict={faceConflict} compact />
                  </div>
                </div>
              )}
            </div>

            <footer className="adviser-modal-actions student-face-verification-actions">
              <div className="student-face-verification-footer-copy">
                <strong>
                  {faceVerificationStage === "CAPTURE"
                    ? capturedFacePreview
                      ? "Second photo ready"
                      : "Fresh capture required"
                    : faceVerificationStage === "MANUAL_REVIEW"
                      ? "Identity check required"
                      : faceVerificationStage === "NOT_REPRODUCED"
                        ? "Retry normal enrollment"
                        : faceVerificationStage === "SAME_PERSON"
                          ? "Separate enrollment blocked"
                          : faceVerificationStage === "ENROLLMENT_FAILED"
                            ? "Identity verified — face save pending"
                            : faceVerificationStage === "NEW_CONFLICT"
                              ? "New conflict requires verification"
                              : "Completing enrollment"}
                </strong>

                <span>
                  {faceVerificationStage === "CAPTURE"
                    ? "Use a new live image rather than reusing the original enrollment photo."
                    : faceVerificationStage === "MANUAL_REVIEW"
                      ? "Verify the student in front of you, then choose one clear decision."
                      : faceVerificationStage === "NOT_REPRODUCED"
                        ? "No identity decision was recorded from this second capture."
                        : faceVerificationStage === "SAME_PERSON"
                          ? "The backend will continue preventing a separate face record."
                          : faceVerificationStage === "ENROLLMENT_FAILED"
                            ? "The manual identity decision is already stored and does not need to be repeated."
                            : faceVerificationStage === "NEW_CONFLICT"
                              ? "A fresh second capture is required for the newly detected pair."
                              : "Please wait while the face record is saved."}
                </span>
              </div>

              <div className="student-face-verification-action-group">
                {faceVerificationStage === "CAPTURE" && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={faceConflictBusy}
                      onClick={closeFaceConflictVerification}
                    >
                      Back
                    </button>

                    {capturedFacePreview ? (
                      <>
                        <button
                          type="button"
                          className="adviser-secondary-button"
                          disabled={faceConflictBusy}
                          onClick={() => void handleRetakeFace()}
                        >
                          Retake Photo
                        </button>

                        <button
                          type="button"
                          className="adviser-primary-button student-conflict-verify-button"
                          disabled={faceConflictBusy || !capturedFaceFile}
                          onClick={() => void handleVerifyFaceConflict()}
                        >
                          {verifyingFaceConflict && (
                            <span
                              className="adviser-button-spinner"
                              aria-hidden="true"
                            />
                          )}

                          {verifyingFaceConflict
                            ? "Verifying..."
                            : "Verify Second Capture"}
                        </button>
                      </>
                    ) : !cameraActive ? (
                      <button
                        type="button"
                        className="adviser-primary-button"
                        disabled={faceConflictBusy}
                        onClick={() => void startFaceCamera()}
                      >
                        Enable Camera
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="adviser-primary-button"
                        disabled={faceConflictBusy || !cameraReady}
                        onClick={() => void handleCaptureFace()}
                      >
                        {capturingFace ? "Capturing..." : "Capture Now"}
                      </button>
                    )}
                  </>
                )}

                {faceVerificationStage === "MANUAL_REVIEW" &&
                  !pendingResolutionDecision && (
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={faceConflictBusy}
                      onClick={closeFaceConflictVerification}
                    >
                      Review Later
                    </button>
                  )}

                {faceVerificationStage === "NOT_REPRODUCED" && (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    disabled={faceConflictBusy}
                    onClick={returnToFreshEnrollmentCapture}
                  >
                    Return to Face Capture
                  </button>
                )}

                {faceVerificationStage === "SAME_PERSON" && (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    disabled={faceConflictBusy}
                    onClick={() => void closeConfirmedSamePersonReview()}
                  >
                    Done
                  </button>
                )}

                {faceVerificationStage === "ENROLLMENT_FAILED" && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={faceConflictBusy}
                      onClick={closeFaceConflictVerification}
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      className="adviser-primary-button"
                      disabled={faceConflictBusy || !capturedFaceFile}
                      onClick={() => void retryVerifiedDifferentEnrollment()}
                    >
                      {resolvingFaceConflict && (
                        <span
                          className="adviser-button-spinner"
                          aria-hidden="true"
                        />
                      )}

                      {resolvingFaceConflict
                        ? "Retrying..."
                        : "Retry Face Enrollment"}
                    </button>
                  </>
                )}

                {faceVerificationStage === "NEW_CONFLICT" && (
                  <button
                    type="button"
                    className="adviser-primary-button student-conflict-verify-button"
                    disabled={faceConflictBusy}
                    onClick={restartVerificationForNewConflict}
                  >
                    Verify New Conflict
                  </button>
                )}

                {faceVerificationStage === "ENROLLING" && (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    disabled
                  >
                    <span
                      className="adviser-button-spinner"
                      aria-hidden="true"
                    />
                    Saving Face...
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}
    </AdviserLayout>
  );
}

export default StudentManagement;
