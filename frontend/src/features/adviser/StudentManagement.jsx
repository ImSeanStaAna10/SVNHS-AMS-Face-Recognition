import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";
import adviserService from "../../services/adviserService";
import authService from "../../services/authService";
import speechService from "../../services/speechService";
import faceReadiness from "../../utils/FaceReadiness";
import {
  captureFrameBurst,
  sleep,
  waitForVideoReady,
} from "../../utils/livenessCapture";

import "../../styles/adviser/studentManagement.css";
import "../../styles/adviser/studentManagementAttendanceScan.css";
import "../../styles/adviser/studentManagementAutoGuided.css";
import "../../styles/adviser/studentManagementLiveness.css";
import "../../styles/adviser/studentManagementProductionReview.css";
import "../../styles/adviser/studentManagementSimpleScan.css";

const BASELINE_COUNT = 8;
const BASELINE_INTERVAL = 220;
const TURN_CHALLENGE_FRAMES = 12;
const BLINK_CHALLENGE_FRAMES = 14;
const CHALLENGE_INTERVAL = 220;
const AUTO_FACE_CHECKS = 2;
const FACE_MONITOR_INTERVAL_MS = 180;

const normalizeArray = (value) => (Array.isArray(value) ? value : []);
const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  fallback;
const normalizeStudentNumberInput = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);
const isValidStudentNumber = (value) => /^\d{12}$/.test(String(value ?? ""));
const stopMediaStream = (stream) =>
  stream?.getTracks?.().forEach((track) => track.stop());
const scopeStudentsToSection = (students, sectionId) =>
  !sectionId
    ? students
    : students.filter(
        (student) => !student?.sectionId || student.sectionId === sectionId,
      );
const hasFaceRegistered = (student, localIds) =>
  localIds.has(student?.id) ||
  student?.faceRegistered === true ||
  student?.hasFace === true ||
  student?.faceEnrolled === true;

const clampPercent = (value) =>
  Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

const DEFAULT_FACE_GUIDANCE = {
  available: false,
  faceCount: 0,
  readiness: 0,
  position: 0,
  lighting: 0,
  stability: 0,
  frontal: 0,
  guidanceKey: "INITIALIZING",
  guidance: "Preparing automatic face guidance…",
  ready: false,
  eyesOpen: false,
  blinkScore: 0,
  noseRatio: 0.5,
  yawDegrees: null,
};

const getChallengeProgressCopy = (challengeType, progress, guidanceKey) => {
  const type = String(challengeType || "").toUpperCase();
  const score = clampPercent(progress);

  if (guidanceKey === "MULTIPLE_FACES") {
    return "Only one person should be visible.";
  }
  if (guidanceKey === "NO_FACE") {
    return "Keep your face inside the guide.";
  }
  if (guidanceKey === "WRONG_DIRECTION") {
    return "Turn the other way.";
  }
  if (guidanceKey === "HOLD_CHALLENGE") {
    return "Perfect. Hold that position.";
  }
  if (guidanceKey === "BLINK_COMPLETE") {
    return "Blink detected. Great.";
  }
  if (type === "BLINK") {
    if (score >= 65) return "Open your eyes again.";
    if (score >= 25) return "Blink once naturally.";
    return "Keep your eyes open until the prompt.";
  }
  return score >= 75
    ? "Almost there. Keep turning."
    : "Move slowly in the arrow direction.";
};

const challengeUi = (challengeType) => {
  switch (String(challengeType || "").toUpperCase()) {
    case "BLINK":
      return {
        icon: "◉",
        title: "Blink once now",
        text: "Keep facing the camera and make one natural blink.",
      };
    case "TURN_LEFT":
      return {
        icon: "←",
        title: "Turn your head left",
        text: "Slowly turn left while keeping your whole face visible.",
      };
    case "TURN_RIGHT":
      return {
        icon: "→",
        title: "Turn your head right",
        text: "Slowly turn right while keeping your whole face visible.",
      };
    default:
      return {
        icon: "◎",
        title: "Follow the live prompt",
        text: "Keep your face visible and follow the instruction.",
      };
  }
};

const humanizeReason = (reason) => {
  const key = String(reason || "")
    .trim()
    .toUpperCase();
  const messages = {
    NO_FACE: "No clear face was detected. Center one student and try again.",
    MULTIPLE_FACES:
      "More than one face was detected. Keep only the student being enrolled in view.",
    PASSIVE_LIVENESS_FAILED:
      "A live face could not be confirmed. Improve lighting and try again.",
    BLINK_NOT_DETECTED:
      "The blink was not detected clearly. Blink once only after the prompt.",
    TURN_NOT_DETECTED:
      "The head turn was not detected clearly. Turn slowly only after the prompt.",
    WRONG_TURN_DIRECTION:
      "The head moved in the opposite direction. Follow the arrow and retry.",
    CONTINUITY_FAILED:
      "The face changed during verification. The same student must stay in frame.",
    CHALLENGE_FAILED:
      "The guided live movement was not completed clearly enough. Please try again.",
    CHALLENGE_EXPIRED: "The secure live check expired. Start a fresh scan.",
    LIVENESS_CHALLENGE_EXPIRED:
      "The secure live check expired. Start a fresh scan.",
  };
  if (messages[key]) return messages[key];
  if (!key)
    return "Live face verification could not be completed. Please try again.";
  return key
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getFaceFlowError = (
  error,
  fallback = "Unable to complete secure face verification.",
) => {
  const status = error?.response?.status;
  const raw = getErrorMessage(error, "");
  const normalized = String(raw || "").toLowerCase();

  if (
    !error?.response &&
    (error?.code === "ERR_NETWORK" || normalized.includes("network"))
  ) {
    return "The face scan could not reach the server. Check the connection and try again.";
  }

  if (status === 413) {
    return "The capture was too large to send. Retake the scan and try again.";
  }

  if (status === 401) {
    return "Your sign-in session is no longer authorized for this verification. Sign in again before retrying.";
  }

  if (status === 403) {
    return "This account is not allowed to complete this face verification.";
  }

  if (
    status === 409 &&
    (normalized.includes("expired") ||
      normalized.includes("challenge") ||
      normalized.includes("already"))
  ) {
    return "This scan expired. Retake it to continue.";
  }

  if (status === 422) {
    return (
      raw ||
      "The captured frames could not be verified. Keep one clear face in frame and retake the secure scan."
    );
  }

  if ([500, 502, 503, 504].includes(status)) {
    return "Face verification is temporarily unavailable. Nothing was saved. Please try again.";
  }

  return raw || fallback;
};

const normalizeConflict = (result) => ({
  conflictId: result?.conflictId || result?.faceConflictId || "",
  studentId: result?.studentId || "",
  conflictStatus: result?.conflictStatus || "PENDING",
  conflictingStudentId: result?.conflictingStudentId || "",
  conflictingStudentName:
    result?.conflictingStudentName || "Similar enrolled student",
  conflictingSectionName: result?.conflictingSectionName || "",
  conflictingDepartmentName: result?.conflictingDepartmentName || "",
  distance: result?.distance,
});

const conflictVerificationOutcome = (result) =>
  result?.faceConflictVerificationOutcome ||
  result?.outcome ||
  result?.verificationOutcome ||
  "";

function VoiceToggle({ enabled, onChange }) {
  const supported = speechService.isSupported();
  return (
    <button
      type="button"
      className={`student-voice-toggle ${enabled ? "is-on" : ""}`}
      aria-pressed={enabled}
      disabled={!supported}
      title={
        supported
          ? enabled
            ? "Turn voice guidance off"
            : "Turn voice guidance on"
          : "Voice guidance unsupported"
      }
      onClick={() => onChange(!enabled)}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
      <span>{enabled ? "Voice on" : "Voice off"}</span>
    </button>
  );
}

function FaceConflictCard({ conflict }) {
  if (!conflict) return null;
  const blocked = conflict.conflictStatus === "CONFIRMED_SAME_PERSON";
  return (
    <div
      className={`student-liveness-conflict-card ${blocked ? "is-blocked" : ""}`}
      role="alert"
    >
      <div className="student-liveness-conflict-head">
        <span aria-hidden="true">{blocked ? "×" : "!"}</span>
        <div>
          <small>
            {blocked ? "SEPARATE ENROLLMENT BLOCKED" : "SIMILAR FACE FOUND"}
          </small>
          <strong>
            {blocked
              ? "Same physical person confirmed"
              : "Identity verification is required"}
          </strong>
          <p>
            {blocked
              ? "This identity decision is already saved for this pair."
              : "No face was saved. Run one more live scan before reviewing the match."}
          </p>
        </div>
      </div>
      <div className="student-liveness-match-row">
        <span className="student-liveness-match-avatar">
          {conflict.conflictingStudentName?.charAt(0)?.toUpperCase() || "S"}
        </span>
        <div>
          <small>POSSIBLE MATCH</small>
          <strong>
            {conflict.conflictingStudentName || "Existing student"}
          </strong>
          <span>
            {conflict.conflictingSectionName || "Section unavailable"}
            {conflict.conflictingDepartmentName
              ? ` • ${conflict.conflictingDepartmentName}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function FriendlyErrorCard({ error, onRetry, compact = false }) {
  if (!error) return null;

  const title = error?.title || "Something needs your attention";
  const message = error?.message || String(error || "Unable to continue.");
  const tips = Array.isArray(error?.tips) ? error.tips : [];

  return (
    <section
      className={`student-production-error ${compact ? "is-compact" : ""}`}
      role="alert"
    >
      <div className="student-production-error-icon" aria-hidden="true">
        !
      </div>
      <div className="student-production-error-copy">
        <small>WE COULDN'T COMPLETE THIS STEP</small>
        <strong>{title}</strong>
        <p>{message}</p>
        {tips.length > 0 && (
          <ul>
            {tips.slice(0, 3).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          className="adviser-secondary-button"
          onClick={onRetry}
        >
          Try Again
        </button>
      )}
    </section>
  );
}

function LiveScanner({
  studentName,
  videoRef,
  cameraActive,
  cameraReady,
  cameraError,
  scan,
  voiceEnabled,
  onVoiceChange,
  disabled,
  onEnableCamera,
  onStartScan,
  onRetry,
  reviewData = null,
  faceGuidance = DEFAULT_FACE_GUIDANCE,
  detectorStatus = "idle",
  autoStartEnabled = false,
  onAutoStartChange,
}) {
  const challenge = challengeUi(scan.challengeType);

  const baseline = scan.phase === "baseline";
  const requestingChallenge = scan.phase === "requesting-challenge";
  const challengeActive = scan.phase === "challenge";
  const reviewing = scan.phase === "review";
  const verifying = scan.phase === "verifying";
  const failed = scan.phase === "failed";

  const canScanNow =
    cameraActive &&
    cameraReady &&
    !disabled &&
    !scan.busy &&
    !reviewing &&
    !verifying;

  const scannerCopy = (() => {
    if (verifying) {
      return {
        eyebrow: "VERIFYING",
        title: "Checking face scan",
        description: "Please keep this enrollment window open.",
      };
    }

    if (baseline) {
      return {
        eyebrow: "CAPTURING",
        title: "Hold still",
        description: "Keep looking straight at the camera.",
      };
    }

    if (requestingChallenge) {
      return {
        eyebrow: "LIVE CHECK",
        title: "Stay centered",
        description: "Getting the next instruction.",
      };
    }

    if (challengeActive) {
      return {
        eyebrow: "FOLLOW THE INSTRUCTION",
        title: challenge.title,
        description: challenge.text,
      };
    }

    if (failed) {
      return {
        eyebrow: "SCAN UNSUCCESSFUL",
        title: "Please try again",
        description:
          "Keep one student in frame and follow the live instruction.",
      };
    }

    if (!cameraActive) {
      return {
        eyebrow: "FACE ENROLLMENT",
        title: "Camera is off",
        description: "Enable the camera to start the face scan.",
      };
    }

    if (!cameraReady) {
      return {
        eyebrow: "PREPARING CAMERA",
        title: "Starting scanner",
        description: "The camera will be ready in a moment.",
      };
    }

    if (autoStartEnabled) {
      if (detectorStatus === "ready" && faceGuidance.faceCount > 1) {
        return {
          eyebrow: "AUTO CAPTURE ACTIVE",
          title: "One student at a time",
          description: "Keep only one face inside the camera.",
        };
      }

      if (detectorStatus === "ready" && faceGuidance.faceCount === 1) {
        return {
          eyebrow: "AUTO CAPTURE ACTIVE",
          title: "Face detected",
          description: "The secure scan will start automatically.",
        };
      }

      return {
        eyebrow: "AUTO CAPTURE ACTIVE",
        title: "Center one student",
        description: "Auto Capture starts when one face is detected.",
      };
    }

    return {
      eyebrow: "MANUAL CAPTURE",
      title: "Position one student in frame",
      description: "Press Scan Now whenever you're ready.",
    };
  })();

  const friendlyCameraError = cameraError
    ? {
        title: "Camera isn't ready",
        message: cameraError,
        tips: [
          "Allow camera permission for this site.",
          "Close another app if it is already using the camera.",
        ],
      }
    : null;

  const friendlyScanError = scan.error
    ? {
        title: "Face scan needs another try",
        message: scan.error,
        tips: [
          "Keep the same student inside the frame.",
          "Follow the blink or head-turn instruction when it appears.",
        ],
      }
    : null;

  return (
    <section
      className={`student-enroll-scanner ${reviewing ? "is-reviewing" : ""}`}
    >
      <header className="student-enroll-scanner-header">
        <div className="student-enroll-scanner-heading">
          <span>FACE ENROLLMENT</span>
          <h3>Face Scanner</h3>
          <p>
            Use Scan Now for manual capture, or turn on Auto Capture when you
            want the scan to begin automatically after one face is detected.
          </p>
        </div>

        <div className="student-enroll-scanner-actions">
          <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />

          <button
            type="button"
            className={`student-enroll-auto-toggle ${autoStartEnabled ? "is-on" : ""}`}
            aria-pressed={autoStartEnabled}
            disabled={
              disabled ||
              reviewing ||
              verifying ||
              detectorStatus === "unavailable"
            }
            onClick={() => onAutoStartChange?.(!autoStartEnabled)}
          >
            <span aria-hidden="true" />
            Auto Capture {autoStartEnabled ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            className="student-enroll-scan-now"
            disabled={!canScanNow}
            onClick={onStartScan}
          >
            {scan.busy
              ? challengeActive
                ? "Scanning..."
                : verifying
                  ? "Verifying..."
                  : "Capturing..."
              : "Scan Now"}
          </button>
        </div>
      </header>

      <div className="student-enroll-scanner-workspace">
        <div className="student-enroll-camera-column">
          <div
            className={`student-enroll-camera-shell phase-${scan.phase} ${
              cameraReady ? "is-ready" : ""
            }`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraActive ? "is-active" : ""}
            />

            {!cameraActive && !reviewing && (
              <div className="student-enroll-camera-placeholder">
                <div
                  className="student-enroll-placeholder-icon"
                  aria-hidden="true"
                >
                  ◎
                </div>
                <span>CAMERA OFF</span>
                <h4>Start the face scanner</h4>
                <p>
                  Enable the camera, keep one student inside the guide, then
                  press Scan Now or turn on Auto Capture.
                </p>
                <button
                  type="button"
                  disabled={disabled || scan.busy}
                  onClick={onEnableCamera}
                >
                  Enable Camera
                </button>
              </div>
            )}

            {reviewing && (
              <div className="student-enroll-camera-placeholder is-complete">
                <div
                  className="student-enroll-placeholder-icon"
                  aria-hidden="true"
                >
                  ✓
                </div>
                <span>CAPTURE COMPLETE</span>
                <h4>Ready for review</h4>
                <p>
                  The camera is paused while you decide whether to retake or
                  continue.
                </p>
              </div>
            )}

            {cameraActive && !reviewing && (
              <>
                <div className="student-enroll-camera-shade" />

                <div
                  className={`student-enroll-face-target phase-${scan.phase}`}
                  aria-hidden="true"
                >
                  <div className="student-enroll-face-target-oval" />
                  <div className="student-enroll-face-target-line" />
                  <span className="corner corner-one" />
                  <span className="corner corner-two" />
                  <span className="corner corner-three" />
                  <span className="corner corner-four" />
                </div>

                <div className="student-enroll-live-badge">
                  <span />
                  LIVE CAMERA
                </div>

                <div
                  className={`student-enroll-mode-badge ${
                    autoStartEnabled ? "is-auto" : "is-manual"
                  }`}
                >
                  <span aria-hidden="true">{autoStartEnabled ? "↻" : "●"}</span>
                  {autoStartEnabled ? "AUTO CAPTURE" : "MANUAL CAPTURE"}
                </div>

                {challengeActive && (
                  <div
                    className="student-enroll-challenge-prompt"
                    aria-live="assertive"
                  >
                    <span
                      className="student-enroll-challenge-icon"
                      aria-hidden="true"
                    >
                      {challenge.icon}
                    </span>
                    <strong>{challenge.title}</strong>
                    <small>{challenge.text}</small>
                  </div>
                )}

                {verifying && (
                  <div className="student-enroll-processing">
                    <span className="student-live-processing-spinner" />
                    <strong>Verifying face scan</strong>
                    <small>Please keep this window open.</small>
                  </div>
                )}

                <div
                  className="student-enroll-scanner-message"
                  aria-live="polite"
                >
                  <span>{scannerCopy.eyebrow}</span>
                  <strong>{scannerCopy.title}</strong>
                  <small>{scannerCopy.description}</small>
                </div>
              </>
            )}
          </div>

          <div className="student-enroll-camera-footer">
            <span>
              {reviewing
                ? "Review the capture before anything is saved."
                : autoStartEnabled
                  ? "Auto Capture is active. You can still press Scan Now at any time."
                  : "Manual Capture is active. Nothing starts until you press Scan Now."}
            </span>

            {!reviewing && (
              <button
                type="button"
                disabled={disabled || scan.busy}
                onClick={cameraActive ? onRetry : onEnableCamera}
              >
                {cameraActive ? "Restart Camera" : "Turn Camera On"}
              </button>
            )}
          </div>

          <FriendlyErrorCard
            error={friendlyCameraError}
            onRetry={onEnableCamera}
            compact
          />
          <FriendlyErrorCard
            error={friendlyScanError}
            onRetry={onRetry}
            compact
          />
        </div>

        <aside
          className={`student-enroll-review-panel ${reviewing ? "is-ready" : ""}`}
        >
          <div className="student-enroll-review-header">
            <span>ENROLLMENT STATUS</span>
            <strong>
              {reviewing ? "READY TO VERIFY" : "WAITING FOR SCAN"}
            </strong>
          </div>

          {reviewing && reviewData ? (
            <div className="student-enroll-review-content">
              <div className="student-enroll-review-icon" aria-hidden="true">
                ✓
              </div>
              <span>SCAN COMPLETE</span>
              <h3>{studentName || "Student"}</h3>
              <p>
                The guided face capture is complete. Nothing has been saved yet.
              </p>

              <div className="student-enroll-review-note">
                <strong>Review before saving</strong>
                <span>
                  Retake creates a fresh scan. Verify &amp; Save sends this
                  capture through the existing backend liveness verification.
                </span>
              </div>

              <div className="student-enroll-review-actions">
                <button
                  type="button"
                  className="is-secondary"
                  disabled={disabled || scan.busy}
                  onClick={onRetry}
                >
                  Retake
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={disabled || scan.busy}
                  onClick={onStartScan}
                >
                  Verify &amp; Save
                </button>
              </div>
            </div>
          ) : (
            <div className="student-enroll-review-empty">
              <div
                className="student-enroll-review-empty-icon"
                aria-hidden="true"
              >
                ◎
              </div>
              <h3>Ready for face enrollment</h3>
              <p>
                Keep one student inside the camera. Manual Capture is the
                default, and Auto Capture can be enabled anytime.
              </p>

              <div className="student-enroll-review-steps">
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
                  <p>Follow the blink or head-turn instruction</p>
                </div>
                <div>
                  <span>04</span>
                  <p>Review before Verify &amp; Save</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function StudentManagement() {
  const location = useLocation();
  const user = authService.getUser();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRunRef = useRef(0);
  const cameraStartFrameRef = useRef(null);
  const filterMenuRef = useRef(null);
  const faceGuidanceRef = useRef(DEFAULT_FACE_GUIDANCE);
  const faceMonitorTimerRef = useRef(null);
  const autoReadyChecksRef = useRef(0);
  const autoStartLockRef = useRef(false);
  const lastSpokenGuidanceRef = useRef({ key: "", at: 0 });

  const [section, setSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [faceFilter, setFaceFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DEFAULT");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdStudentRecord, setCreatedStudentRecord] = useState(null);
  const [enrollmentStep, setEnrollmentStep] = useState(1);
  const [addEnrollmentResult, setAddEnrollmentResult] = useState(null);

  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentNumber, setEditStudentNumber] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [editError, setEditError] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [registeringFace, setRegisteringFace] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(() =>
    speechService.getEnabled(),
  );
  const [locallyRegisteredFaceIds, setLocallyRegisteredFaceIds] = useState(
    () => new Set(),
  );
  const [scan, setScan] = useState({
    busy: false,
    phase: "idle",
    challengeType: null,
    progress: 0,
    challengeProgress: 0,
    challengeGuidanceKey: "",
    error: "",
  });
  const [pendingLiveness, setPendingLiveness] = useState(null);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [detectorStatus, setDetectorStatus] = useState("idle");
  const [faceGuidanceState, setFaceGuidanceState] = useState(
    DEFAULT_FACE_GUIDANCE,
  );

  const [faceConflict, setFaceConflict] = useState(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictContext, setConflictContext] = useState(null);
  const [conflictStage, setConflictStage] = useState("READY");
  const [conflictVerificationResult, setConflictVerificationResult] =
    useState(null);
  const [pendingDecision, setPendingDecision] = useState("");
  const [conflictBusy, setConflictBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [sectionData, studentData] = await Promise.all([
          adviserService.getSections(),
          adviserService.getStudents(),
        ]);
        if (!mounted) return;
        const sections = normalizeArray(sectionData);
        const assigned =
          sections.find((item) => item?.active !== false) ||
          sections[0] ||
          null;
        setSection(assigned);
        setStudents(
          scopeStudentsToSection(normalizeArray(studentData), assigned?.id),
        );
      } catch (requestError) {
        if (mounted)
          setError(
            getErrorMessage(requestError, "Unable to load student records."),
          );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      scanRunRef.current += 1;
      if (cameraStartFrameRef.current)
        window.cancelAnimationFrame(cameraStartFrameRef.current);
      stopMediaStream(streamRef.current);
      speechService.stop();
      if (faceMonitorTimerRef.current)
        window.clearTimeout(faceMonitorTimerRef.current);
      faceReadiness.destroy();
    },
    [],
  );

  const modalOpen =
    showAddModal ||
    Boolean(editingStudent) ||
    Boolean(selectedStudent) ||
    conflictOpen;
  useEffect(() => {
    if (!modalOpen) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const outside = (event) =>
      filterMenuRef.current &&
      !filterMenuRef.current.contains(event.target) &&
      setFilterMenuOpen(false);
    const esc = (event) => event.key === "Escape" && setFilterMenuOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [filterMenuOpen]);

  const adviserName = user?.name?.trim() || section?.adviserName || "Adviser";
  const sectionName = section?.name || "No assigned section";
  const faceRegisteredCount = useMemo(
    () =>
      students.filter((s) => hasFaceRegistered(s, locallyRegisteredFaceIds))
        .length,
    [students, locallyRegisteredFaceIds],
  );
  const facePendingCount = Math.max(0, students.length - faceRegisteredCount);
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = students.filter((student) => {
      const active = student?.active !== false;
      const faceRegistered = hasFaceRegistered(
        student,
        locallyRegisteredFaceIds,
      );
      const matchSearch =
        !query ||
        String(student?.name || "")
          .toLowerCase()
          .includes(query) ||
        String(student?.studentNumber || "")
          .toLowerCase()
          .includes(query);
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && active) ||
        (statusFilter === "INACTIVE" && !active);
      const matchFace =
        faceFilter === "ALL" ||
        (faceFilter === "REGISTERED" && faceRegistered) ||
        (faceFilter === "PENDING" && !faceRegistered);
      return matchSearch && matchStatus && matchFace;
    });
    if (sortOrder !== "DEFAULT")
      result = [...result].sort((a, b) => {
        const an = String(a?.name || ""),
          bn = String(b?.name || "");
        const ai = String(a?.studentNumber || ""),
          bi = String(b?.studentNumber || "");
        if (sortOrder === "NAME_ASC")
          return an.localeCompare(bn, undefined, { sensitivity: "base" });
        if (sortOrder === "NAME_DESC")
          return bn.localeCompare(an, undefined, { sensitivity: "base" });
        if (sortOrder === "NUMBER_ASC")
          return ai.localeCompare(bi, undefined, { numeric: true });
        if (sortOrder === "NUMBER_DESC")
          return bi.localeCompare(ai, undefined, { numeric: true });
        return 0;
      });
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
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * rowsPerPage;
  const paginatedStudents = filteredStudents.slice(
    pageStartIndex,
    pageStartIndex + rowsPerPage,
  );
  const visibleStart = filteredStudents.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(
    pageStartIndex + rowsPerPage,
    filteredStudents.length,
  );
  const paginationItems = useMemo(() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, "r", totalPages];
    if (safePage >= totalPages - 2)
      return [
        1,
        "l",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [1, "l", safePage - 1, safePage, safePage + 1, "r", totalPages];
  }, [safePage, totalPages]);

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, statusFilter, faceFilter, sortOrder, rowsPerPage],
  );
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const resetRosterView = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setFaceFilter("ALL");
    setSortOrder("DEFAULT");
    setRowsPerPage(10);
    setCurrentPage(1);
  };
  const refreshStudents = async () => {
    const data = scopeStudentsToSection(
      normalizeArray(await adviserService.getStudents()),
      section?.id,
    );
    setStudents(data);
    return data;
  };
  const handleVoiceChange = (enabled) => {
    speechService.setEnabled(enabled);
    setVoiceEnabled(enabled);
    if (enabled) speechService.speak("Voice guidance enabled.");
  };
  const resetScan = () => {
    scanRunRef.current += 1;
    faceReadiness.resetTracking();
    autoReadyChecksRef.current = 0;
    autoStartLockRef.current = false;
    setPendingLiveness(null);
    setScan({
      busy: false,
      phase: "idle",
      challengeType: null,
      progress: 0,
      challengeProgress: 0,
      challengeGuidanceKey: "",
      error: "",
    });
  };
  const stopCamera = ({ cancelScan = true } = {}) => {
    if (cancelScan) scanRunRef.current += 1;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    faceReadiness.resetTracking();
    autoReadyChecksRef.current = 0;
    setCameraActive(false);
    setCameraReady(false);
  };
  const startCamera = async () => {
    try {
      setCameraError("");
      setScan((current) => ({ ...current, error: "" }));
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access is not supported by this browser.");
      stopCamera({ cancelScan: false });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) {
        stopMediaStream(stream);
        throw new Error("Camera preview is not ready yet.");
      }
      streamRef.current = stream;
      video.srcObject = stream;
      setCameraActive(true);
      await video.play();
      await waitForVideoReady(video);
      setCameraReady(true);
      faceReadiness.resetTracking();
      setDetectorStatus(
        faceReadiness.isSupported() ? "loading" : "unavailable",
      );
      if (faceReadiness.isSupported()) {
        void faceReadiness
          .ensureReady()
          .then(() => setDetectorStatus("ready"))
          .catch((detectorError) => {
            console.warn("Automatic face guidance unavailable:", detectorError);
            setDetectorStatus("unavailable");
            setAutoStartEnabled(false);
          });
      }
      return video;
    } catch (requestError) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setCameraActive(false);
      setCameraReady(false);
      let message = requestError?.message || "Unable to access the camera.";
      if (requestError?.name === "NotAllowedError")
        message =
          "Camera permission was denied. Allow camera access and try again.";
      if (requestError?.name === "NotFoundError")
        message = "No camera was detected on this device.";
      if (requestError?.name === "NotReadableError")
        message = "The camera is being used by another application or tab.";
      setCameraError(message);
      throw requestError;
    }
  };
  const ensureCamera = async () => {
    const video = videoRef.current;
    if (streamRef.current && video?.srcObject && video.videoWidth > 0) {
      await waitForVideoReady(video);
      return video;
    }
    return startCamera();
  };
  const scheduleCameraStart = () => {
    if (cameraStartFrameRef.current)
      window.cancelAnimationFrame(cameraStartFrameRef.current);
    cameraStartFrameRef.current = window.requestAnimationFrame(() => {
      cameraStartFrameRef.current = window.requestAnimationFrame(() => {
        cameraStartFrameRef.current = null;
        void startCamera().catch(() => {});
      });
    });
  };

  const updateFaceGuidance = (next) => {
    const normalized = { ...DEFAULT_FACE_GUIDANCE, ...(next || {}) };
    faceGuidanceRef.current = normalized;
    setFaceGuidanceState(normalized);
    return normalized;
  };

  const speakFaceGuidance = (analysis) => {
    if (!voiceEnabled || !speechService.isSupported() || !analysis?.guidanceKey)
      return;

    const now = Date.now();
    const previous = lastSpokenGuidanceRef.current;
    const important = [
      "MULTIPLE_FACES",
      "READY",
      "WRONG_DIRECTION",
      "HOLD_CHALLENGE",
      "BLINK_COMPLETE",
    ];
    const cooldown = important.includes(analysis.guidanceKey) ? 1300 : 2400;

    if (previous.key === analysis.guidanceKey && now - previous.at < cooldown)
      return;
    if (
      previous.key !== analysis.guidanceKey ||
      now - previous.at >= cooldown
    ) {
      lastSpokenGuidanceRef.current = { key: analysis.guidanceKey, at: now };
      speechService.speak(analysis.guidance);
    }
  };

  const analyzeFaceNow = async (video = videoRef.current) => {
    if (!faceReadiness.isSupported()) {
      return {
        ...DEFAULT_FACE_GUIDANCE,
        available: false,
        guidanceKey: "UNAVAILABLE",
        guidance: "Use manual secure scan.",
      };
    }

    try {
      const analysis = await faceReadiness.analyzeVideoFrame(video);
      setDetectorStatus("ready");
      return updateFaceGuidance(analysis);
    } catch (analysisError) {
      console.warn("Local face guidance frame failed:", analysisError);
      throw analysisError;
    }
  };

  const captureBaseline = async (video, runId) => {
    setScan((current) => ({
      ...current,
      busy: true,
      phase: "baseline",
      progress: 20,
      error: "",
    }));

    const frames = await captureFrameBurst(video, {
      count: BASELINE_COUNT,
      intervalMs: BASELINE_INTERVAL,
      prefix: "baseline",
      isCancelled: () => scanRunRef.current !== runId,
      onProgress: (completed, total) => {
        setScan((current) => ({
          ...current,
          progress: 20 + Math.round((completed / total) * 24),
        }));
      },
    });

    return { frames };
  };

  const captureChallengeWithGuidance = async ({
    video,
    runId,
    challengeType,
  }) => {
    const normalizedType = String(challengeType || "").toUpperCase();
    const frameCount =
      normalizedType === "BLINK"
        ? BLINK_CHALLENGE_FRAMES
        : TURN_CHALLENGE_FRAMES;

    setScan((current) => ({
      ...current,
      phase: "challenge",
      challengeProgress: 0,
      challengeGuidanceKey: "FOLLOW_PROMPT",
      progress: 48,
    }));

    const frames = await captureFrameBurst(video, {
      count: frameCount,
      intervalMs: CHALLENGE_INTERVAL,
      prefix: "challenge",
      isCancelled: () => scanRunRef.current !== runId,
      onProgress: (completed, total) => {
        setScan((current) => ({
          ...current,
          challengeProgress: Math.round((completed / total) * 100),
          progress: 48 + Math.round((completed / total) * 32),
        }));
      },
    });

    return {
      frames,
      completion: 100,
    };
  };

  /* =======================================================
     LIVE SCAN ENGINE

     SECURITY NOTE:
     Internal challenge IDs/types remain server-authoritative for anti-spoofing.
     User-facing copy intentionally calls them guided live movements/checks so
     the experience stays understandable without weakening the security flow.
  ======================================================= */

  const runGuidedLiveness = async ({
    student,
    mode = "ENROLLMENT",
    conflictId = "",
  }) => {
    if (!student?.id) throw new Error("Student information is unavailable.");

    const normalizedMode = String(mode || "ENROLLMENT").toUpperCase();
    const pendingMatches =
      pendingLiveness &&
      String(pendingLiveness.studentId) === String(student.id) &&
      String(pendingLiveness.mode) === normalizedMode &&
      String(pendingLiveness.conflictId || "") === String(conflictId || "");

    /* Review confirmed -> this is the first verification submission. */
    if (pendingMatches) {
      setScan((current) => ({
        ...current,
        busy: true,
        phase: "verifying",
        progress: 90,
        error: "",
      }));

      try {
        const result =
          normalizedMode === "CONFLICT"
            ? await adviserService.verifyFaceConflictLiveness({
                studentId: student.id,
                conflictId,
                challengeId: pendingLiveness.challengeId,
                baselineImages: pendingLiveness.baselineImages,
                challengeImages: pendingLiveness.challengeImages,
              })
            : await adviserService.verifyEnrollmentLiveness({
                studentId: student.id,
                challengeId: pendingLiveness.challengeId,
                baselineImages: pendingLiveness.baselineImages,
                challengeImages: pendingLiveness.challengeImages,
              });

        setPendingLiveness(null);

        if (result?.passed !== true) {
          const message = humanizeReason(result?.reason);
          setScan((current) => ({
            ...current,
            busy: false,
            phase: "failed",
            progress: 100,
            error: message,
          }));
          speechService.announceLivenessFailure();
          return result;
        }

        setScan((current) => ({
          ...current,
          busy: false,
          phase: "passed",
          progress: 100,
          challengeProgress: 100,
          error: "",
        }));
        return result;
      } catch (requestError) {
        setPendingLiveness(null);
        throw requestError;
      }
    }

    const video = await ensureCamera();
    const runId = scanRunRef.current + 1;
    scanRunRef.current = runId;
    autoStartLockRef.current = true;
    setPendingLiveness(null);
    setCameraError("");

    try {
      speechService.announceEnrollmentReady(student?.name || "Student");
      speechService.speak("Starting face scan.");

      const baseline = await captureBaseline(video, runId);

      if (scanRunRef.current !== runId)
        throw new Error("Liveness capture was cancelled.");

      setScan((current) => ({
        ...current,
        phase: "requesting-challenge",
        progress: 45,
      }));

      const challenge =
        normalizedMode === "CONFLICT"
          ? await adviserService.createFaceConflictLivenessChallenge(
              student.id,
              conflictId,
            )
          : await adviserService.createEnrollmentLivenessChallenge(student.id);

      if (challenge?.assistedVerificationRequired) {
        const assistedError = new Error(
          "Live scan is unavailable for this student's current verification settings. Use the authorized assisted-verification path.",
        );
        assistedError.code = "ASSISTED_VERIFICATION_REQUIRED";
        throw assistedError;
      }

      if (!challenge?.challengeId || !challenge?.challengeType) {
        throw new Error(
          "The server did not return a usable liveness challenge.",
        );
      }

      const challengeType = String(challenge.challengeType).toUpperCase();
      setScan((current) => ({
        ...current,
        phase: "challenge",
        challengeType,
        challengeProgress: 0,
        challengeGuidanceKey:
          challengeType === "BLINK" ? "EYES_OPEN" : "FOLLOW_ARROW",
        progress: 48,
      }));

      speechService.announceChallenge(
        student?.name || "Student",
        challengeType,
      );
      await sleep(650);

      const challengeCapture = await captureChallengeWithGuidance({
        video,
        runId,
        challengeType,
      });

      if (scanRunRef.current !== runId)
        throw new Error("Liveness capture was cancelled.");

      stopCamera({ cancelScan: false });

      setPendingLiveness({
        studentId: student.id,
        mode: normalizedMode,
        conflictId: conflictId || "",
        challengeId: challenge.challengeId,
        challengeType,
        baselineImages: baseline.frames,
        challengeImages: challengeCapture.frames,
        baselineCount: baseline.frames.length,
        challengeCount: challengeCapture.frames.length,
        capturedAt: Date.now(),
      });

      setScan((current) => ({
        ...current,
        busy: false,
        phase: "review",
        challengeType,
        challengeProgress: 100,
        challengeGuidanceKey: "COMPLETE",
        progress: 84,
        error: "",
      }));

      speechService.speak(
        "Scan complete. Review, then verify and save or retake.",
      );

      return {
        reviewPending: true,
        challengeType,
        baselineCount: baseline.frames.length,
        challengeCount: challengeCapture.frames.length,
      };
    } catch (captureError) {
      autoStartLockRef.current = false;
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
        challengeProgress: 0,
        error: getFaceFlowError(
          captureError,
          captureError?.message || "Unable to complete secure face capture.",
        ),
      }));
      throw captureError;
    }
  };

  const markFaceRegistered = async (student) => {
    setLocallyRegisteredFaceIds((currentIds) => {
      const next = new Set(currentIds);
      next.add(student.id);
      return next;
    });
    try {
      await refreshStudents();
    } catch (refreshError) {
      console.warn(
        "Unable to refresh students after face enrollment:",
        refreshError,
      );
    }
  };

  const performEnrollment = async (student) => {
    const result = await runGuidedLiveness({ student, mode: "ENROLLMENT" });
    if (result?.reviewPending) return { type: "REVIEW", result };
    if (result?.passed !== true) return { type: "FAILED", result };

    const outcome = String(
      result?.faceEnrollmentOutcome || result?.outcome || "",
    ).toUpperCase();
    if (outcome === "FACE_CONFLICT") {
      const conflict = normalizeConflict(result);
      setFaceConflict(conflict);
      speechService.announceConflict(student?.name);
      return { type: "FACE_CONFLICT", conflict, result };
    }

    if (outcome === "ENROLLED") {
      await markFaceRegistered(student);
      speechService.announceEnrollmentSuccess(student?.name);
      return { type: "ENROLLED", result };
    }

    throw new Error(
      "The backend returned an unsupported face-enrollment outcome.",
    );
  };

  /* =======================================================
     ADD STUDENT WIZARD
  ======================================================= */

  const resetAddState = () => {
    setStudentNumber("");
    setStudentName("");
    setCreateError("");
    setCreatedStudentRecord(null);
    setEnrollmentStep(1);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    resetScan();
  };

  const openAddStudentModal = () => {
    stopCamera();
    resetAddState();
    setSelectedStudent(null);
    setEditingStudent(null);
    setSuccessMessage("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (creatingStudent || registeringFace || scan.busy) return;
    const pendingName = createdStudentRecord?.name;
    stopCamera();
    setShowAddModal(false);
    resetAddState();
    if (pendingName) {
      setSuccessMessage(
        `${pendingName} is already in ${sectionName}. Face enrollment is still pending and can be completed from the roster anytime.`,
      );
    }
  };

  const validateStudentDetails = () => {
    const number = studentNumber.trim();
    const name = studentName.trim();
    setCreateError("");
    if (!number || !name) {
      setCreateError("Student number and student name are required.");
      return false;
    }
    if (!isValidStudentNumber(number)) {
      setCreateError("Student number must contain exactly 12 digits.");
      return false;
    }
    if (!section?.id) {
      setCreateError("No assigned section is available.");
      return false;
    }
    return true;
  };

  const createRosterRecordIfNeeded = async () => {
    if (createdStudentRecord?.id) return createdStudentRecord;
    if (!validateStudentDetails()) return null;

    const cleanNumber = studentNumber.trim();
    const cleanName = studentName.trim();

    try {
      setCreatingStudent(true);
      setCreateError("");
      const created = await adviserService.createStudent({
        studentNumber: cleanNumber,
        name: cleanName,
        sectionId: section.id,
      });

      let record = created;
      if (!record?.id) {
        const refreshed = await refreshStudents();
        record = refreshed.find(
          (student) => String(student?.studentNumber) === cleanNumber,
        );
      } else {
        setStudents((current) =>
          current.some((student) => student.id === record.id)
            ? current
            : [...current, record],
        );
      }

      if (!record?.id)
        throw new Error(
          "Student was created, but the new student ID could not be resolved.",
        );
      setCreatedStudentRecord(record);
      return record;
    } catch (requestError) {
      setCreateError(
        requestError?.response?.status === 409
          ? "That student number already exists."
          : getErrorMessage(
              requestError,
              "Unable to create the student record.",
            ),
      );
      return null;
    } finally {
      setCreatingStudent(false);
    }
  };

  const goToLiveEnrollment = async () => {
    if (creatingStudent) return;
    const record = await createRosterRecordIfNeeded();
    if (!record) return;
    setEnrollmentStep(2);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    resetScan();
    scheduleCameraStart();
  };

  const runAddEnrollment = async () => {
    const student = createdStudentRecord;
    if (!student?.id) return;
    try {
      setRegisteringFace(true);
      setAddEnrollmentResult(null);
      const outcome = await performEnrollment(student);

      if (outcome.type === "ENROLLED") {
        setAddEnrollmentResult({ enrolled: true, result: outcome.result });
        setEnrollmentStep(3);
      } else if (outcome.type === "FACE_CONFLICT") {
        setAddEnrollmentResult({ enrolled: false, conflict: outcome.conflict });
        setEnrollmentStep(3);
      }
    } catch (requestError) {
      console.error("Secure student face enrollment failed:", requestError);
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
        error: getFaceFlowError(
          requestError,
          "Unable to complete secure face enrollment.",
        ),
      }));
    } finally {
      setRegisteringFace(false);
    }
  };

  const retryAddEnrollment = () => {
    if (registeringFace || scan.busy) return;
    setEnrollmentStep(2);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    resetScan();
    scheduleCameraStart();
  };

  const finishAddEnrollment = () => {
    const completedName =
      createdStudentRecord?.name || studentName.trim() || "Student";
    setSuccessMessage(
      `${completedName} was added to ${sectionName} and secure face enrollment was completed successfully.`,
    );
    stopCamera();
    setShowAddModal(false);
    resetAddState();
  };

  /* =======================================================
     EDIT STUDENT
  ======================================================= */

  const openEditStudent = (student) => {
    if (!student?.id || student?.active === false) return;
    stopCamera();
    setShowAddModal(false);
    setSelectedStudent(null);
    setEditingStudent(student);
    setEditStudentNumber(student.studentNumber || "");
    setEditStudentName(student.name || "");
    setEditError("");
    setSuccessMessage("");
  };

  const closeEditStudent = () => {
    if (updatingStudent) return;
    setEditingStudent(null);
    setEditStudentNumber("");
    setEditStudentName("");
    setEditError("");
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();
    if (!editingStudent?.id) return;

    const cleanNumber = editStudentNumber.trim();
    const cleanName = editStudentName.trim();
    if (!cleanNumber || !cleanName) {
      setEditError("Student number and student name are required.");
      return;
    }
    if (!isValidStudentNumber(cleanNumber)) {
      setEditError("Student number must contain exactly 12 digits.");
      return;
    }

    try {
      setUpdatingStudent(true);
      setEditError("");
      const updated = await adviserService.updateStudent(editingStudent.id, {
        studentNumber: cleanNumber,
        name: cleanName,
      });
      if (updated?.id) {
        setStudents((current) =>
          current.map((student) =>
            student.id === updated.id ? { ...student, ...updated } : student,
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
      closeEditStudent();
    } catch (requestError) {
      setEditError(
        requestError?.response?.status === 409
          ? "That student number already belongs to another student."
          : getErrorMessage(
              requestError,
              "Unable to update the student record.",
            ),
      );
    } finally {
      setUpdatingStudent(false);
    }
  };

  /* =======================================================
     EXISTING STUDENT FACE ENROLLMENT
  ======================================================= */

  const openFaceRegistration = (student) => {
    if (!student?.id || student?.active === false) return;
    stopCamera();
    resetScan();
    setShowAddModal(false);
    setEditingStudent(null);
    setSelectedStudent(student);
    setFaceConflict(null);
    setSuccessMessage("");
    scheduleCameraStart();
  };

  const closeFaceRegistration = () => {
    if (registeringFace || scan.busy) return;
    stopCamera();
    resetScan();
    setSelectedStudent(null);
    setFaceConflict(null);
  };

  const runExistingEnrollment = async () => {
    if (!selectedStudent?.id) return;
    const student = selectedStudent;
    try {
      setRegisteringFace(true);
      const outcome = await performEnrollment(student);
      if (outcome.type === "ENROLLED") {
        setSuccessMessage(
          `Secure face enrollment completed for ${student.name || "Student"}.`,
        );
        stopCamera();
        resetScan();
        setSelectedStudent(null);
        setFaceConflict(null);
      } else if (outcome.type === "FACE_CONFLICT") {
        setFaceConflict(outcome.conflict);
      }
    } catch (requestError) {
      console.error("Unable to complete secure face enrollment:", requestError);
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
        error: getFaceFlowError(
          requestError,
          "Unable to complete secure face enrollment.",
        ),
      }));
    } finally {
      setRegisteringFace(false);
    }
  };

  /* =======================================================
     PROTECTED FACE-CONFLICT WORKFLOW
  ======================================================= */

  const getCurrentEnrollmentTarget = () => {
    if (showAddModal && createdStudentRecord?.id) {
      return { student: createdStudentRecord, origin: "ADD" };
    }
    if (selectedStudent?.id) {
      return { student: selectedStudent, origin: "EXISTING" };
    }
    return null;
  };

  const openConflictVerification = () => {
    const target = getCurrentEnrollmentTarget();
    if (!target?.student?.id || !faceConflict?.conflictId) {
      setScan((current) => ({
        ...current,
        error: "Face conflict information is incomplete.",
      }));
      return;
    }
    if (faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON") {
      speechService.announceSamePerson(target.student?.name);
      return;
    }

    stopCamera();
    resetScan();
    setConflictContext({ ...target, conflict: faceConflict });
    setConflictVerificationResult(null);
    setPendingDecision("");
    setConflictStage("READY");
    setConflictOpen(true);
    scheduleCameraStart();
    speechService.speak(
      `${target.student.name || "Student"}, a fresh live identity verification is ready.`,
    );
  };

  const closeConflictVerification = () => {
    if (conflictBusy || scan.busy) return;
    stopCamera();
    resetScan();
    setConflictOpen(false);
    setConflictContext(null);
    setConflictStage("READY");
    setConflictVerificationResult(null);
    setPendingDecision("");
  };

  const runConflictLiveness = async () => {
    const student = conflictContext?.student;
    const conflict = conflictContext?.conflict;
    if (!student?.id || !conflict?.conflictId) return;

    try {
      setConflictBusy(true);
      const result = await runGuidedLiveness({
        student,
        mode: "CONFLICT",
        conflictId: conflict.conflictId,
      });
      if (result?.reviewPending) {
        return;
      }
      if (result?.passed !== true) {
        setConflictStage("FAILED");
        return;
      }

      setConflictVerificationResult(result);
      const outcome = String(conflictVerificationOutcome(result)).toUpperCase();

      if (outcome === "MANUAL_REVIEW_REQUIRED") {
        setConflictStage("MANUAL_REVIEW");
        speechService.announceManualReview();
        return;
      }
      if (outcome === "CONFLICT_NOT_REPRODUCED") {
        setConflictStage("NOT_REPRODUCED");
        speechService.speak(
          "The original conflict was not reproduced. Please retry secure face enrollment.",
        );
        return;
      }
      if (outcome === "VERIFIED_DIFFERENT_PEOPLE") {
        setFaceConflict((current) => ({
          ...current,
          conflictStatus: "VERIFIED_DIFFERENT_PEOPLE",
        }));
        setConflictContext((current) => ({
          ...current,
          conflict: {
            ...current?.conflict,
            conflictStatus: "VERIFIED_DIFFERENT_PEOPLE",
          },
        }));
        setConflictStage("FINAL_SCAN");
        speechService.announceDifferentPeople(student?.name);
        resetScan();
        scheduleCameraStart();
        return;
      }
      if (outcome === "CONFIRMED_SAME_PERSON") {
        setFaceConflict((current) => ({
          ...current,
          conflictStatus: "CONFIRMED_SAME_PERSON",
        }));
        setConflictStage("SAME_PERSON");
        speechService.announceSamePerson(student?.name);
        return;
      }

      setConflictStage("FAILED");
      setScan((current) => ({
        ...current,
        error:
          "The server returned an unsupported conflict-verification outcome.",
      }));
    } catch (requestError) {
      console.error(
        "Unable to complete conflict liveness verification:",
        requestError,
      );
      setConflictStage("FAILED");
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
        error: getFaceFlowError(
          requestError,
          "Unable to complete live identity verification.",
        ),
      }));
    } finally {
      setConflictBusy(false);
    }
  };

  const requestConflictDecision = (decision) => {
    if (conflictStage !== "MANUAL_REVIEW" || conflictBusy) return;
    setPendingDecision(decision);
  };

  const resolveConflict = async () => {
    const student = conflictContext?.student;
    const conflict = conflictContext?.conflict;
    if (!student?.id || !conflict?.conflictId || !pendingDecision) return;

    try {
      setConflictBusy(true);
      const result = await adviserService.resolveStudentFaceConflict(
        student.id,
        conflict.conflictId,
        pendingDecision,
      );
      setPendingDecision("");

      if (result?.conflictStatus === "VERIFIED_DIFFERENT_PEOPLE") {
        const nextConflict = {
          ...conflict,
          conflictStatus: "VERIFIED_DIFFERENT_PEOPLE",
        };
        setFaceConflict(nextConflict);
        setConflictContext((current) => ({
          ...current,
          conflict: nextConflict,
        }));
        setConflictStage("FINAL_SCAN");
        speechService.announceDifferentPeople(student?.name);
        resetScan();
        scheduleCameraStart();
        return;
      }

      if (result?.conflictStatus === "CONFIRMED_SAME_PERSON") {
        setFaceConflict((current) => ({
          ...current,
          conflictStatus: "CONFIRMED_SAME_PERSON",
        }));
        setConflictStage("SAME_PERSON");
        speechService.announceSamePerson(student?.name);
        return;
      }

      throw new Error("Unsupported conflict-resolution status.");
    } catch (requestError) {
      setScan((current) => ({
        ...current,
        error: getErrorMessage(
          requestError,
          "Unable to save the identity decision.",
        ),
      }));
    } finally {
      setConflictBusy(false);
    }
  };

  const completeFinalEnrollment = async () => {
    const student = conflictContext?.student;
    const origin = conflictContext?.origin;
    if (!student?.id) return;

    try {
      setConflictBusy(true);
      const outcome = await performEnrollment(student);
      if (outcome.type === "ENROLLED") {
        setSuccessMessage(
          `Identity review completed and secure face enrollment was saved for ${student.name || "Student"}.`,
        );
        setConflictOpen(false);
        setFaceConflict(null);
        stopCamera();
        resetScan();
        if (origin === "ADD") {
          setAddEnrollmentResult({ enrolled: true, result: outcome.result });
          setEnrollmentStep(3);
        } else {
          setSelectedStudent(null);
        }
        setConflictContext(null);
        return;
      }

      if (outcome.type === "FACE_CONFLICT") {
        setConflictContext((current) => ({
          ...current,
          conflict: outcome.conflict,
        }));
        setFaceConflict(outcome.conflict);
        setConflictStage("READY");
        resetScan();
        scheduleCameraStart();
        speechService.announceConflict(student?.name);
      }
    } catch (requestError) {
      console.error(
        "Unable to complete final secure enrollment:",
        requestError,
      );
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
        error: getFaceFlowError(
          requestError,
          "Unable to complete the final secure face enrollment.",
        ),
      }));
    } finally {
      setConflictBusy(false);
    }
  };

  const retryConflictNotReproduced = () => {
    const student = conflictContext?.student;
    const origin = conflictContext?.origin;
    stopCamera();
    resetScan();
    setConflictOpen(false);
    setConflictContext(null);
    setConflictStage("READY");
    setConflictVerificationResult(null);
    setPendingDecision("");
    setFaceConflict(null);

    if (origin === "ADD") {
      setEnrollmentStep(2);
      setAddEnrollmentResult(null);
      scheduleCameraStart();
    } else if (student) {
      setSelectedStudent(student);
      scheduleCameraStart();
    }
  };

  const getCurrentAutoStartAction = () => {
    if (
      !cameraActive ||
      !cameraReady ||
      scan.busy ||
      pendingLiveness ||
      !autoStartEnabled
    )
      return null;

    if (conflictOpen && conflictContext) {
      if (["READY", "FAILED"].includes(conflictStage))
        return () => void runConflictLiveness();
      if (conflictStage === "FINAL_SCAN")
        return () => void completeFinalEnrollment();
      return null;
    }

    if (showAddModal && enrollmentStep === 2 && createdStudentRecord?.id) {
      return () => void runAddEnrollment();
    }

    if (selectedStudent?.id) {
      return () => void runExistingEnrollment();
    }

    return null;
  };

  useEffect(() => {
    if (
      !cameraActive ||
      !cameraReady ||
      scan.busy ||
      scan.phase === "review" ||
      scan.phase === "verifying" ||
      scan.phase === "failed" ||
      detectorStatus === "unavailable"
    ) {
      autoReadyChecksRef.current = 0;
      return undefined;
    }

    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;

      try {
        const analysis = await analyzeFaceNow(videoRef.current);
        if (cancelled) return;

        const oneFaceDetected = analysis.faceCount === 1;

        if (
          oneFaceDetected &&
          autoStartEnabled &&
          getCurrentAutoStartAction()
        ) {
          autoReadyChecksRef.current += 1;

          if (
            autoReadyChecksRef.current >= AUTO_FACE_CHECKS &&
            !autoStartLockRef.current
          ) {
            autoStartLockRef.current = true;
            const action = getCurrentAutoStartAction();
            action?.();
            return;
          }
        } else {
          autoReadyChecksRef.current = 0;
          autoStartLockRef.current = false;
        }
      } catch (analysisError) {
        if (!cancelled) {
          console.warn("Automatic face guidance stopped:", analysisError);
          setDetectorStatus("unavailable");
          setAutoStartEnabled(false);
          updateFaceGuidance({
            ...DEFAULT_FACE_GUIDANCE,
            available: false,
            guidanceKey: "UNAVAILABLE",
            guidance: "Auto Capture is unavailable. Use Manual Capture.",
          });
        }
        return;
      }

      faceMonitorTimerRef.current = window.setTimeout(
        loop,
        FACE_MONITOR_INTERVAL_MS,
      );
    };

    faceMonitorTimerRef.current = window.setTimeout(loop, 60);

    return () => {
      cancelled = true;
      if (faceMonitorTimerRef.current) {
        window.clearTimeout(faceMonitorTimerRef.current);
        faceMonitorTimerRef.current = null;
      }
    };
  }, [
    cameraActive,
    cameraReady,
    scan.busy,
    scan.phase,
    autoStartEnabled,
    detectorStatus,
    showAddModal,
    enrollmentStep,
    createdStudentRecord?.id,
    selectedStudent?.id,
    conflictOpen,
    conflictStage,
    conflictContext?.student?.id,
    pendingLiveness,
    voiceEnabled,
  ]);

  const faceRegistrationIntent = location.state?.action === "register-face";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdviserLayout
      title="Students"
      eyebrow="ADVISER PORTAL"
      description="Manage students and secure face identities within your assigned section"
    >
      <section className="student-management">
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
              <strong>Secure Face Enrollment</strong>
              <p>
                Enrollment uses silent anti-spoofing, one guided live movement,
                same-person continuity, and optional voice guidance.
              </p>
            </div>
          </div>
        )}

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
            className={`student-section-badge ${section?.active === false ? "is-inactive" : ""}`}
          >
            <span aria-hidden="true" />
            {section?.active === false ? "INACTIVE" : "ACTIVE"}
          </span>
        </section>

        <section className="student-panel">
          <header className="student-panel-header">
            <div>
              <span>CLASS ROSTER</span>
              <h2>Students</h2>
              <p>Manage student records and secure face identities.</p>
            </div>
            <button
              type="button"
              className="adviser-primary-button"
              disabled={loading || !section?.id}
              onClick={openAddStudentModal}
            >
              <span aria-hidden="true">+</span> Add Student
            </button>
          </header>

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
                  className={`student-filter-button ${filterMenuOpen ? "is-open" : ""}`}
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
                      No student matched <strong>“{searchQuery}”</strong>.
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
                    const active = student?.active !== false;
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
                            className={`student-status-badge ${active ? "is-active" : "is-inactive"}`}
                          >
                            <span aria-hidden="true" />
                            {active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`student-face-badge ${faceRegistered ? "is-registered" : ""}`}
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
                              className={`student-face-action is-face ${faceRegistered ? "is-registered" : ""}`}
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

          {!loading && section && filteredStudents.length > 0 && (
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
                  disabled={safePage === 1}
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
                        className={`student-pagination-page ${safePage === item ? "is-active" : ""}`}
                        aria-current={safePage === item ? "page" : undefined}
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
                  disabled={safePage === totalPages}
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
          ADD STUDENT + SECURE FACE ENROLLMENT
      ==================================================== */}
      {showAddModal && !conflictOpen && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddModal();
          }}
        >
          <div
            className={`adviser-modal student-enrollment-modal student-enrollment-step-${enrollmentStep}`}
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
                      ? "Student information"
                      : enrollmentStep === 2
                        ? "Face enrollment"
                        : "Enrollment result"}
                  </h2>
                  <p>
                    {enrollmentStep === 1
                      ? "Add the student to the class roster first. Face enrollment comes next."
                      : enrollmentStep === 2
                        ? "Use Manual Capture or Auto Capture, follow the live instruction, then review before saving."
                        : "Review the final enrollment result before closing."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={creatingStudent || registeringFace || scan.busy}
                onClick={closeAddModal}
              >
                ×
              </button>
            </header>

            <div className="student-enrollment-progress">
              <div
                className={enrollmentStep === 1 ? "is-current" : "is-complete"}
              >
                <span>{enrollmentStep > 1 ? "✓" : "1"}</span>
                <div>
                  <strong>Student details</strong>
                  <small>Roster information</small>
                </div>
              </div>
              <i />
              <div
                className={
                  enrollmentStep === 2
                    ? "is-current"
                    : enrollmentStep > 2
                      ? "is-complete"
                      : ""
                }
              >
                <span>{enrollmentStep > 2 ? "✓" : "2"}</span>
                <div>
                  <strong>Face scan</strong>
                  <small>Manual or auto</small>
                </div>
              </div>
              <i />
              <div className={enrollmentStep === 3 ? "is-current" : ""}>
                <span>3</span>
                <div>
                  <strong>Complete</strong>
                  <small>Final result</small>
                </div>
              </div>
            </div>

            <div className="student-live-enrollment-body">
              {enrollmentStep === 1 && (
                <section className="student-live-detail-step">
                  <div className="student-enrollment-section-heading">
                    <span>01</span>
                    <div>
                      <strong>Student information</strong>
                      <p>Use the official student number and full name.</p>
                    </div>
                  </div>
                  <div className="student-form student-enrollment-form">
                    <label className="student-form-field">
                      <span>Student Number</span>
                      <input
                        value={studentNumber}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={12}
                        placeholder="12-digit student number"
                        disabled={creatingStudent}
                        onChange={(event) =>
                          setStudentNumber(
                            normalizeStudentNumberInput(event.target.value),
                          )
                        }
                      />
                      <small>{studentNumber.length}/12 digits</small>
                    </label>
                    <label className="student-form-field">
                      <span>Student Name</span>
                      <input
                        value={studentName}
                        autoComplete="off"
                        placeholder="Complete student name"
                        disabled={creatingStudent}
                        onChange={(event) => setStudentName(event.target.value)}
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
                    </div>
                  </div>
                  <div className="student-live-explainer">
                    <span>◎</span>
                    <div>
                      <strong>Face enrollment can be finished later</strong>
                      <p>
                        The student record is saved first, so you can return to
                        the face scan anytime.
                      </p>
                    </div>
                  </div>
                  {createError && (
                    <div
                      className="student-face-feedback is-error"
                      role="alert"
                    >
                      <span>!</span>
                      <div>
                        <strong>Student details</strong>
                        <p>{createError}</p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {enrollmentStep === 2 && createdStudentRecord && (
                <section className="student-live-scan-step">
                  <div className="student-liveness-student-strip">
                    <span className="student-liveness-avatar">
                      {createdStudentRecord.name?.charAt(0)?.toUpperCase() ||
                        "S"}
                    </span>
                    <div>
                      <small>ENROLLING STUDENT</small>
                      <strong>{createdStudentRecord.name}</strong>
                      <span>
                        {createdStudentRecord.studentNumber} • {sectionName}
                      </span>
                    </div>
                    <span className="student-liveness-security-badge">
                      SECURE FACE SCAN
                    </span>
                  </div>
                  <LiveScanner
                    studentName={createdStudentRecord.name || "Student"}
                    videoRef={videoRef}
                    cameraActive={cameraActive}
                    cameraReady={cameraReady}
                    cameraError={cameraError}
                    scan={scan}
                    reviewData={pendingLiveness}
                    faceGuidance={faceGuidanceState}
                    detectorStatus={detectorStatus}
                    autoStartEnabled={autoStartEnabled}
                    onAutoStartChange={setAutoStartEnabled}
                    voiceEnabled={voiceEnabled}
                    onVoiceChange={handleVoiceChange}
                    disabled={registeringFace}
                    onEnableCamera={() => void startCamera().catch(() => {})}
                    onStartScan={() => void runAddEnrollment()}
                    onRetry={() => {
                      resetScan();
                      scheduleCameraStart();
                    }}
                  />
                </section>
              )}

              {enrollmentStep === 3 && (
                <section className="student-live-result-step">
                  {addEnrollmentResult?.enrolled ? (
                    <div className="student-liveness-result-card is-success">
                      <span aria-hidden="true">✓</span>
                      <div>
                        <small>FACE ENROLLMENT COMPLETE</small>
                        <h3>
                          {createdStudentRecord?.name || studentName} is ready
                          for face recognition
                        </h3>
                        <p>
                          Face verification passed and the face record was
                          saved.
                        </p>
                      </div>
                    </div>
                  ) : faceConflict ? (
                    <>
                      <div className="student-liveness-result-card is-warning">
                        <span aria-hidden="true">!</span>
                        <div>
                          <small>IDENTITY REVIEW NEEDED</small>
                          <h3>
                            The student was added, but the face was not saved
                          </h3>
                          <p>
                            A similar enrolled face was found. Run the second
                            face check before making an identity decision.
                          </p>
                        </div>
                      </div>
                      <FaceConflictCard conflict={faceConflict} />
                    </>
                  ) : (
                    <div className="student-liveness-result-card is-neutral">
                      <span aria-hidden="true">↻</span>
                      <div>
                        <small>FACE ENROLLMENT PENDING</small>
                        <h3>Retry face enrollment</h3>
                        <p>
                          The student record is saved. Run a fresh face scan to
                          finish enrollment.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="adviser-modal-actions student-enrollment-actions student-live-modal-footer">
              <div className="student-face-footer-copy">
                <strong>
                  {enrollmentStep === 1
                    ? "Student details"
                    : enrollmentStep === 2
                      ? "Face scan with review"
                      : addEnrollmentResult?.enrolled
                        ? "Enrollment completed"
                        : "Student remains Face Pending until completed"}
                </strong>
                <span>You can finish face enrollment later if needed.</span>
              </div>
              <div className="student-face-action-group">
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
                      className="adviser-primary-button"
                      disabled={creatingStudent}
                      onClick={() => void goToLiveEnrollment()}
                    >
                      {creatingStudent
                        ? "Creating Student…"
                        : "Continue to Live Face"}
                    </button>
                  </>
                )}
                {enrollmentStep === 2 && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={registeringFace || scan.busy}
                      onClick={closeAddModal}
                    >
                      Finish Later
                    </button>
                  </>
                )}
                {enrollmentStep === 3 && addEnrollmentResult?.enrolled && (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    onClick={finishAddEnrollment}
                  >
                    Done
                  </button>
                )}
                {enrollmentStep === 3 &&
                  !addEnrollmentResult?.enrolled &&
                  !faceConflict && (
                    <button
                      type="button"
                      className="adviser-primary-button"
                      onClick={retryAddEnrollment}
                    >
                      Retry Live Enrollment
                    </button>
                  )}
                {enrollmentStep === 3 && faceConflict && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      onClick={closeAddModal}
                    >
                      Review Later
                    </button>
                    <button
                      type="button"
                      className="adviser-primary-button"
                      disabled={
                        faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON"
                      }
                      onClick={openConflictVerification}
                    >
                      {faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON"
                        ? "Enrollment Blocked"
                        : "Verify Identity"}
                    </button>
                  </>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* EDIT STUDENT */}
      {editingStudent && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditStudent();
          }}
        >
          <form
            className="adviser-modal student-edit-modal student-identity-modal"
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
                  <p>
                    Update the student's roster information without changing
                    face enrollment.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={updatingStudent}
                onClick={closeEditStudent}
              >
                ×
              </button>
            </header>
            <div className="student-live-edit-body">
              <div className="student-form">
                <label className="student-form-field">
                  <span>Student Number</span>
                  <input
                    value={editStudentNumber}
                    maxLength={12}
                    inputMode="numeric"
                    disabled={updatingStudent}
                    onChange={(event) =>
                      setEditStudentNumber(
                        normalizeStudentNumberInput(event.target.value),
                      )
                    }
                  />
                </label>
                <label className="student-form-field">
                  <span>Student Name</span>
                  <input
                    value={editStudentName}
                    disabled={updatingStudent}
                    onChange={(event) => setEditStudentName(event.target.value)}
                  />
                </label>
                {editError && (
                  <div className="student-face-feedback is-error">
                    <span>!</span>
                    <div>
                      <strong>Unable to update</strong>
                      <p>{editError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <footer className="adviser-modal-actions">
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
                disabled={updatingStudent}
              >
                {updatingStudent ? "Saving…" : "Save Changes"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* EXISTING STUDENT FACE */}
      {selectedStudent && !conflictOpen && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFaceRegistration();
          }}
        >
          <div
            className="adviser-modal student-face-modal student-identity-modal student-liveness-face-modal"
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
                      ? "Update secure face identity"
                      : "Register secure face identity"}
                  </h2>
                  <p>Complete the guided scan before saving the face record.</p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={registeringFace || scan.busy}
                onClick={closeFaceRegistration}
              >
                ×
              </button>
            </header>
            <div className="student-liveness-student-strip student-liveness-existing-strip">
              <span className="student-liveness-avatar">
                {selectedStudent?.name?.charAt(0)?.toUpperCase() || "S"}
              </span>
              <div>
                <small>STUDENT</small>
                <strong>{selectedStudent?.name}</strong>
                <span>
                  {selectedStudent?.studentNumber || "No student number"} •{" "}
                  {sectionName}
                </span>
              </div>
              <span className="student-liveness-security-badge">
                SECURE FACE SCAN
              </span>
            </div>
            <div className="student-identity-camera">
              <LiveScanner
                studentName={selectedStudent?.name || "Student"}
                videoRef={videoRef}
                cameraActive={cameraActive}
                cameraReady={cameraReady}
                cameraError={cameraError}
                scan={scan}
                reviewData={pendingLiveness}
                faceGuidance={faceGuidanceState}
                detectorStatus={detectorStatus}
                autoStartEnabled={autoStartEnabled}
                onAutoStartChange={setAutoStartEnabled}
                voiceEnabled={voiceEnabled}
                onVoiceChange={handleVoiceChange}
                disabled={registeringFace}
                onEnableCamera={() => void startCamera().catch(() => {})}
                onStartScan={() => void runExistingEnrollment()}
                onRetry={() => {
                  resetScan();
                  scheduleCameraStart();
                }}
              />
              {faceConflict && <FaceConflictCard conflict={faceConflict} />}
            </div>
            <footer className="adviser-modal-actions student-face-modal-actions">
              <div className="student-face-footer-copy">
                <strong>
                  {faceConflict
                    ? "Identity verification required"
                    : "Face enrollment"}
                </strong>
                <span>Retake anytime before saving if needed.</span>
              </div>
              <div className="student-liveness-footer-actions">
                <button
                  type="button"
                  className="adviser-secondary-button"
                  disabled={registeringFace || scan.busy}
                  onClick={closeFaceRegistration}
                >
                  Close
                </button>
                {faceConflict && (
                  <button
                    type="button"
                    className="adviser-primary-button"
                    disabled={
                      registeringFace ||
                      scan.busy ||
                      faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON"
                    }
                    onClick={openConflictVerification}
                  >
                    {faceConflict?.conflictStatus === "CONFIRMED_SAME_PERSON"
                      ? "Enrollment Blocked"
                      : "Verify Identity"}
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* FACE CONFLICT VERIFICATION */}
      {conflictOpen && conflictContext && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
        >
          <div
            className="adviser-modal student-face-verification-modal student-liveness-conflict-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="face-conflict-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  !
                </div>
                <div>
                  <span>PROTECTED IDENTITY REVIEW</span>
                  <h2 id="face-conflict-title">Verify similar face</h2>
                  <p>
                    A fresh guided live scan must reproduce the similar-face
                    result before a manual identity decision is allowed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={conflictBusy || scan.busy}
                onClick={closeConflictVerification}
              >
                ×
              </button>
            </header>

            <div className="student-liveness-conflict-body">
              <FaceConflictCard conflict={conflictContext.conflict} />

              {["READY", "FAILED"].includes(conflictStage) && (
                <LiveScanner
                  studentName={conflictContext?.student?.name || "Student"}
                  videoRef={videoRef}
                  cameraActive={cameraActive}
                  cameraReady={cameraReady}
                  cameraError={cameraError}
                  scan={scan}
                  reviewData={pendingLiveness}
                  faceGuidance={faceGuidanceState}
                  detectorStatus={detectorStatus}
                  autoStartEnabled={autoStartEnabled}
                  onAutoStartChange={setAutoStartEnabled}
                  voiceEnabled={voiceEnabled}
                  onVoiceChange={handleVoiceChange}
                  disabled={conflictBusy}
                  onEnableCamera={() => void startCamera().catch(() => {})}
                  onStartScan={() => void runConflictLiveness()}
                  onRetry={() => {
                    resetScan();
                    scheduleCameraStart();
                  }}
                />
              )}

              {conflictStage === "MANUAL_REVIEW" && (
                <section className="student-liveness-manual-review">
                  <div className="student-liveness-result-card is-warning">
                    <span aria-hidden="true">!</span>
                    <div>
                      <small>LIVE CONFLICT REPRODUCED</small>
                      <h3>Human identity decision required</h3>
                      <p>
                        The similar-face match appeared again. Check the actual
                        students before choosing.
                      </p>
                    </div>
                  </div>
                  <div className="student-liveness-review-evidence">
                    <div>
                      <small>CURRENT STUDENT</small>
                      <strong>{conflictContext?.student?.name}</strong>
                    </div>
                    <span>↔</span>
                    <div>
                      <small>SIMILAR ENROLLED FACE</small>
                      <strong>
                        {conflictContext?.conflict?.conflictingStudentName}
                      </strong>
                    </div>
                  </div>
                  {!pendingDecision ? (
                    <div className="student-liveness-decision-grid">
                      <button
                        type="button"
                        className="student-liveness-decision is-different"
                        disabled={conflictBusy}
                        onClick={() =>
                          requestConflictDecision("DIFFERENT_PEOPLE")
                        }
                      >
                        <span>≠</span>
                        <div>
                          <strong>Two different students</strong>
                          <small>
                            Allow separate face enrollment after one final live
                            scan
                          </small>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="student-liveness-decision is-same"
                        disabled={conflictBusy}
                        onClick={() => requestConflictDecision("SAME_PERSON")}
                      >
                        <span>=</span>
                        <div>
                          <strong>Same physical person</strong>
                          <small>Keep separate face enrollment blocked</small>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`student-liveness-confirmation ${pendingDecision === "SAME_PERSON" ? "is-same" : "is-different"}`}
                      role="alert"
                    >
                      <span aria-hidden="true">
                        {pendingDecision === "SAME_PERSON" ? "=" : "≠"}
                      </span>
                      <div>
                        <small>FINAL CONFIRMATION</small>
                        <h4>
                          {pendingDecision === "SAME_PERSON"
                            ? "Confirm this is the same physical person?"
                            : "Confirm these are two different students?"}
                        </h4>
                        <p>
                          {pendingDecision === "SAME_PERSON"
                            ? "Separate face enrollment will remain blocked for this conflict pair."
                            : "The decision will be saved, then one final face scan will finish enrollment."}
                        </p>
                        <div>
                          <button
                            type="button"
                            className="adviser-secondary-button"
                            disabled={conflictBusy}
                            onClick={() => setPendingDecision("")}
                          >
                            Go Back
                          </button>
                          <button
                            type="button"
                            className="adviser-primary-button"
                            disabled={conflictBusy}
                            onClick={() => void resolveConflict()}
                          >
                            {conflictBusy
                              ? "Saving…"
                              : pendingDecision === "SAME_PERSON"
                                ? "Confirm Same Person"
                                : "Confirm Different Students"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {conflictStage === "NOT_REPRODUCED" && (
                <div className="student-liveness-result-card is-neutral">
                  <span aria-hidden="true">↻</span>
                  <div>
                    <small>CONFLICT NOT REPRODUCED</small>
                    <h3>Retry face enrollment</h3>
                    <p>
                      No manual identity decision was recorded. Return to secure
                      enrollment and run a new live scan.
                    </p>
                    <button
                      type="button"
                      className="adviser-primary-button"
                      onClick={retryConflictNotReproduced}
                    >
                      Return to Face Enrollment
                    </button>
                  </div>
                </div>
              )}

              {conflictStage === "SAME_PERSON" && (
                <div className="student-liveness-result-card is-danger">
                  <span aria-hidden="true">×</span>
                  <div>
                    <small>SAME PERSON CONFIRMED</small>
                    <h3>Separate face enrollment is blocked</h3>
                    <p>
                      This identity decision is already saved for this pair.
                    </p>
                  </div>
                </div>
              )}

              {conflictStage === "FINAL_SCAN" && (
                <section className="student-liveness-final-scan">
                  <div className="student-liveness-result-card is-success">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <small>DIFFERENT PEOPLE VERIFIED</small>
                      <h3>One final face scan</h3>
                      <p>
                        The identity decision is saved. Run one final fresh face
                        scan to finish enrollment.
                      </p>
                    </div>
                  </div>
                  <LiveScanner
                    studentName={conflictContext?.student?.name || "Student"}
                    videoRef={videoRef}
                    cameraActive={cameraActive}
                    cameraReady={cameraReady}
                    cameraError={cameraError}
                    scan={scan}
                    reviewData={pendingLiveness}
                    faceGuidance={faceGuidanceState}
                    detectorStatus={detectorStatus}
                    autoStartEnabled={autoStartEnabled}
                    onAutoStartChange={setAutoStartEnabled}
                    voiceEnabled={voiceEnabled}
                    onVoiceChange={handleVoiceChange}
                    disabled={conflictBusy}
                    onEnableCamera={() => void startCamera().catch(() => {})}
                    onStartScan={() => void completeFinalEnrollment()}
                    onRetry={() => {
                      resetScan();
                      scheduleCameraStart();
                    }}
                  />
                </section>
              )}
            </div>

            <footer className="adviser-modal-actions student-liveness-modal-actions">
              <div className="student-liveness-footer-copy">
                <strong>
                  {conflictStage === "MANUAL_REVIEW"
                    ? "Adviser decision required"
                    : conflictStage === "FINAL_SCAN"
                      ? "Final face scan needed"
                      : conflictStage === "SAME_PERSON"
                        ? "Separate enrollment blocked"
                        : "Second face check"}
                </strong>
                <span>No face is saved until verification succeeds.</span>
              </div>
              <div className="student-liveness-footer-actions">
                <button
                  type="button"
                  className="adviser-secondary-button"
                  disabled={conflictBusy || scan.busy}
                  onClick={closeConflictVerification}
                >
                  Close
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </AdviserLayout>
  );
}

export default StudentManagement;
