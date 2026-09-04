import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import AdviserLayout from "../../layouts/AdviserLayout";
import adviserService from "../../services/adviserService";
import authService from "../../services/authService";
import speechService from "../../services/speechService";

import {
  useAdviserSections,
  useAdviserStudents,
} from "../../hooks/queries/useStudentsQueries";
import { useOutgoingTransfers } from "../../hooks/queries/useTransferQueries";

import { invalidateTransferCache } from "../../hooks/queries/invalidateCache";
import queryKeys from "../../lib/query/queryKeys";

import faceReadiness from "../../utils/FaceReadiness";
import {
  captureFrameBurst,
  sleep,
  waitForVideoReady,
} from "../../utils/livenessCapture";

import "../../styles/adviser/studentManagement.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementAttendanceScan.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementAutoGuided.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementEnrollmentPolish.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementEnrollmentTypographyBoost.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementLiveness.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementProductionReview.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementSimpleScan.css";
import "../../styles/adviser/StudentManagementFaceScanning/studentManagementTransferPending.css";

const PASSIVE_FRAME_COUNT = 10;
const PASSIVE_FRAME_INTERVAL = 560;
const PASSIVE_FRAME_SPLIT = 5;
const PASSIVE_CAPTURE_SECONDS = Math.max(
  1,
  Math.round(((PASSIVE_FRAME_COUNT - 1) * PASSIVE_FRAME_INTERVAL) / 1000),
);
const AUTO_FACE_CHECKS = 2;
const FACE_MONITOR_INTERVAL_MS = 180;

const GUARDIAN_RELATIONSHIP_OPTIONS = [
  { value: "MOTHER", label: "Mother" },
  { value: "FATHER", label: "Father" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "GRANDPARENT", label: "Grandparent" },
  { value: "SIBLING", label: "Sibling" },
  { value: "OTHER", label: "Other" },
];

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
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
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
    SPOOF_DETECTED:
      "The scan looked like a photo or screen presentation. Use the live student and try again.",
    LIVENESS_UNCERTAIN:
      "The system could not confidently confirm a live face. Improve front lighting and retry.",
    INVALID_PASSIVE_FACE:
      "One or more frames did not contain one clear face. Stay centered and try again.",
    CONTINUITY_FAILED:
      "The face changed during verification. The same student must stay in frame.",
    FACE_CONTINUITY_FAILED:
      "The face changed during verification. The same student must stay in frame.",
    CHALLENGE_FAILED:
      "The silent live-face check could not be confirmed. Please try again.",
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
  if (status === 413)
    return "The capture was too large to send. Retake the scan and try again.";
  if (status === 401)
    return "Your sign-in session is no longer authorized for this verification. Sign in again before retrying.";
  if (status === 403)
    return "This account is not allowed to complete this face verification.";
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
  const preparing = scan.phase === "preparing";
  const capturing = scan.phase === "capturing";
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
    if (preparing) {
      return {
        eyebrow: "PREPARING",
        title: "Get ready",
        description: "Keep one face centered inside the guide.",
      };
    }
    if (capturing) {
      return {
        eyebrow: "SECURE SCAN",
        title: "Hold still",
        description:
          scan.secondsRemaining > 0
            ? `${scan.secondsRemaining} second${scan.secondsRemaining === 1 ? "" : "s"} remaining.`
            : "Finishing the secure scan…",
      };
    }
    if (failed) {
      return {
        eyebrow: "SCAN UNSUCCESSFUL",
        title: "Please try again",
        description: "Keep one student centered and hold still.",
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
          "Look straight at the camera and hold still for five seconds.",
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
              ? verifying
                ? "Verifying..."
                : "Scanning..."
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

                {capturing && (
                  <div
                    className="student-enroll-challenge-prompt is-passive-countdown"
                    role="timer"
                    aria-live="polite"
                    aria-label={`${Math.max(0, scan.secondsRemaining)} seconds remaining in face scan`}
                  >
                    <span
                      className="student-enroll-challenge-icon"
                      aria-hidden="true"
                    >
                      {Math.max(0, scan.secondsRemaining)}
                    </span>
                    <strong>
                      {scan.secondsRemaining > 0
                        ? `${scan.secondsRemaining} second${scan.secondsRemaining === 1 ? "" : "s"} remaining`
                        : "Almost done"}
                    </strong>
                    <small>Keep looking straight and hold still.</small>
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
                The silent live-face capture is complete. Nothing has been saved
                yet.
              </p>
              <div className="student-enroll-review-note">
                <strong>Review before saving</strong>
                <span>
                  Retake creates a fresh scan. Verify &amp; Save sends this
                  capture through passive anti-spoofing and continuity checks.
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
                  <p>Hold still during the silent live-face check</p>
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
  const queryClient = useQueryClient();

  /* =======================================================
     REUSABLE SERVER CACHE

     These three requests used to be fetched manually together
     every time Student Management mounted.

     TanStack Query now owns:
     - request deduplication
     - stale/fresh timing
     - window-focus refresh
     - reconnect refresh
     - shared cache with Student Transfers
  ======================================================= */

  const sectionsQuery = useAdviserSections();
  const studentsQuery = useAdviserStudents();
  const outgoingTransfersQuery = useOutgoingTransfers();

  const section = useMemo(() => {
    const sections = normalizeArray(sectionsQuery.data);

    return (
      sections.find((item) => item?.active !== false) || sections[0] || null
    );
  }, [sectionsQuery.data]);

  /*
   * Keep local roster state because this page already performs
   * immediate optimistic UI updates after successful mutations.
   *
   * TanStack Query remains the server-state source and the
   * effects below synchronize fresh query data into this local
   * presentation state.
   */
  const [students, setStudents] = useState(() =>
    scopeStudentsToSection(normalizeArray(studentsQuery.data), section?.id),
  );

  const [outgoingTransferRequests, setOutgoingTransferRequests] = useState(() =>
    normalizeArray(outgoingTransfersQuery.data),
  );

  const loading =
    sectionsQuery.isLoading ||
    studentsQuery.isLoading ||
    outgoingTransfersQuery.isLoading;

  const loadingTransferStatuses =
    outgoingTransfersQuery.isFetching && !outgoingTransfersQuery.isLoading;

  const initialQueryError =
    (sectionsQuery.data == null && sectionsQuery.error) ||
    (studentsQuery.data == null && studentsQuery.error) ||
    (outgoingTransfersQuery.data == null && outgoingTransfersQuery.error) ||
    null;

  const error = initialQueryError
    ? getErrorMessage(initialQueryError, "Unable to load student records.")
    : "";

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
  const addStudentCommittedRef = useRef(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [faceFilter, setFaceFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DEFAULT");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [studentActionMenu, setStudentActionMenu] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("MOTHER");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [cancellingAddEnrollment, setCancellingAddEnrollment] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdStudentRecord, setCreatedStudentRecord] = useState(null);
  const [enrollmentStep, setEnrollmentStep] = useState(1);
  const [addEnrollmentResult, setAddEnrollmentResult] = useState(null);

  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentNumber, setEditStudentNumber] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editGuardianName, setEditGuardianName] = useState("");
  const [editGuardianRelationship, setEditGuardianRelationship] =
    useState("MOTHER");
  const [editGuardianEmail, setEditGuardianEmail] = useState("");
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [editError, setEditError] = useState("");

  const [studentToDeactivate, setStudentToDeactivate] = useState(null);
  const [deactivatingStudent, setDeactivatingStudent] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const [studentToReactivate, setStudentToReactivate] = useState(null);
  const [reactivatingStudent, setReactivatingStudent] = useState(false);
  const [reactivateError, setReactivateError] = useState("");

  const [studentToTransfer, setStudentToTransfer] = useState(null);
  const [transferSectionId, setTransferSectionId] = useState("");
  const [transferSectionOptions, setTransferSectionOptions] = useState([]);
  const [loadingTransferSections, setLoadingTransferSections] = useState(false);
  const [transferringStudent, setTransferringStudent] = useState(false);
  const [transferError, setTransferError] = useState("");

  const [transferToCancel, setTransferToCancel] = useState(null);
  const [cancellingTransfer, setCancellingTransfer] = useState(false);
  const [cancelTransferError, setCancelTransferError] = useState("");

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
    progress: 0,
    secondsRemaining: PASSIVE_CAPTURE_SECONDS,
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

  /* =======================================================
     QUERY DATA -> EXISTING LOCAL PRESENTATION STATE

     This preserves the current UI/mutation behavior while
     moving network ownership into TanStack Query.
  ======================================================= */

  useEffect(() => {
    if (studentsQuery.data == null) return;

    setStudents(
      scopeStudentsToSection(normalizeArray(studentsQuery.data), section?.id),
    );
  }, [studentsQuery.data, section?.id]);

  useEffect(() => {
    if (outgoingTransfersQuery.data == null) return;

    setOutgoingTransferRequests(normalizeArray(outgoingTransfersQuery.data));
  }, [outgoingTransfersQuery.data]);

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
    Boolean(studentToDeactivate) ||
    Boolean(studentToReactivate) ||
    Boolean(studentToTransfer) ||
    Boolean(transferToCancel) ||
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

  useEffect(() => {
    if (!studentActionMenu) return undefined;

    const closeOnOutsideClick = (event) => {
      const target = event.target;
      if (
        target?.closest?.(".student-actions-trigger") ||
        target?.closest?.(".student-actions-dropdown")
      ) {
        return;
      }
      setStudentActionMenu(null);
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setStudentActionMenu(null);
    };

    const closeOnViewportChange = () => setStudentActionMenu(null);

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [studentActionMenu]);

  const adviserName = user?.name?.trim() || section?.adviserName || "Adviser";
  const sectionName = section?.name || "No assigned section";

  const pendingTransferByStudentId = useMemo(() => {
    const map = new Map();

    normalizeArray(outgoingTransferRequests).forEach((request) => {
      const status = String(request?.status || "")
        .trim()
        .toUpperCase();
      const studentId = request?.studentId || request?.student?.id || "";

      if (status === "PENDING" && studentId) {
        map.set(String(studentId), request);
      }
    });

    return map;
  }, [outgoingTransferRequests]);

  const getPendingTransferForStudent = (student) => {
    if (!student?.id) return null;
    return pendingTransferByStudentId.get(String(student.id)) || null;
  };

  const transferPendingCount = pendingTransferByStudentId.size;

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
      const transferPending = Boolean(getPendingTransferForStudent(student));
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
        (statusFilter === "ACTIVE" && active && !transferPending) ||
        (statusFilter === "TRANSFER_PENDING" && transferPending) ||
        (statusFilter === "INACTIVE" && !active && !transferPending);
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
    outgoingTransferRequests,
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
    setStudentActionMenu(null);
  };

  const toggleStudentActionMenu = (event, student) => {
    if (!student?.id) return;

    if (studentActionMenu?.studentId === student.id) {
      setStudentActionMenu(null);
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 236;
    const transferPending = Boolean(getPendingTransferForStudent(student));
    const menuHeight = transferPending
      ? 238
      : student?.active === false
        ? 170
        : 306;
    const viewportPadding = 12;
    const gap = 8;

    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, triggerRect.right - menuWidth),
    );

    const canOpenAbove =
      triggerRect.bottom + gap + menuHeight > window.innerHeight &&
      triggerRect.top - gap - menuHeight >= viewportPadding;

    const top = canOpenAbove
      ? Math.max(viewportPadding, triggerRect.top - menuHeight - gap)
      : Math.min(
          window.innerHeight - menuHeight - viewportPadding,
          triggerRect.bottom + gap,
        );

    setFilterMenuOpen(false);
    setStudentActionMenu({
      studentId: student.id,
      student,
      top,
      left,
    });
  };

  const refreshStudents = async () => {
    const result = await studentsQuery.refetch();

    if (result.isError) {
      throw result.error;
    }

    const data = scopeStudentsToSection(
      normalizeArray(result.data),
      section?.id,
    );

    setStudents(data);
    return data;
  };

  const refreshTransferRequests = async () => {
    const result = await outgoingTransfersQuery.refetch();

    if (result.isError) {
      throw result.error;
    }

    const normalized = normalizeArray(result.data);

    setOutgoingTransferRequests(normalized);
    return normalized;
  };

  /*
   * Manual window focus / visibility listeners are intentionally
   * removed here. QueryClient already has:
   *
   * refetchOnWindowFocus: true
   * refetchOnReconnect: true
   *
   * and it only refreshes stale data, avoiding duplicate calls.
   */

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
      progress: 0,
      secondsRemaining: PASSIVE_CAPTURE_SECONDS,
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
    const important = ["MULTIPLE_FACES", "READY"];
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

  const capturePassiveSequence = async (video, runId) => {
    const captureStartedAt = Date.now();
    setScan((current) => ({
      ...current,
      busy: true,
      phase: "capturing",
      progress: 20,
      secondsRemaining: PASSIVE_CAPTURE_SECONDS,
      error: "",
    }));

    const countdownTimer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - captureStartedAt) / 1000);
      const secondsRemaining = Math.max(
        0,
        PASSIVE_CAPTURE_SECONDS - elapsedSeconds,
      );
      setScan((current) =>
        current.phase === "capturing"
          ? { ...current, secondsRemaining }
          : current,
      );
    }, 100);

    try {
      const frames = await captureFrameBurst(video, {
        count: PASSIVE_FRAME_COUNT,
        intervalMs: PASSIVE_FRAME_INTERVAL,
        prefix: "passive",
        isCancelled: () => scanRunRef.current !== runId,
        onProgress: (completed, total) => {
          setScan((current) => ({
            ...current,
            progress: 20 + Math.round((completed / total) * 64),
          }));
        },
      });
      setScan((current) => ({ ...current, secondsRemaining: 0 }));
      return { frames };
    } finally {
      window.clearInterval(countdownTimer);
    }
  };

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
      speechService.speak(
        "Starting secure face scan. Look straight and hold still.",
      );
      setScan((current) => ({
        ...current,
        busy: true,
        phase: "preparing",
        progress: 12,
        error: "",
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
      if (!challenge?.challengeId)
        throw new Error(
          "The server did not return a usable verification transaction.",
        );

      await sleep(250);
      const capture = await capturePassiveSequence(video, runId);
      if (scanRunRef.current !== runId)
        throw new Error("Liveness capture was cancelled.");

      const baselineImages = capture.frames.slice(0, PASSIVE_FRAME_SPLIT);
      const challengeImages = capture.frames.slice(PASSIVE_FRAME_SPLIT);
      if (
        baselineImages.length < PASSIVE_FRAME_SPLIT ||
        challengeImages.length < PASSIVE_FRAME_SPLIT
      ) {
        throw new Error(
          "The passive face capture did not contain enough frames.",
        );
      }

      stopCamera({ cancelScan: false });
      setPendingLiveness({
        studentId: student.id,
        mode: normalizedMode,
        conflictId: conflictId || "",
        challengeId: challenge.challengeId,
        transactionType: String(
          challenge?.challengeType || "PASSIVE",
        ).toUpperCase(),
        baselineImages,
        challengeImages,
        frameCount: capture.frames.length,
        capturedAt: Date.now(),
      });
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "review",
        progress: 84,
        error: "",
      }));
      speechService.speak(
        "Scan complete. Review, then verify and save or retake.",
      );
      return { reviewPending: true, frameCount: capture.frames.length };
    } catch (captureError) {
      autoStartLockRef.current = false;
      setScan((current) => ({
        ...current,
        busy: false,
        phase: "failed",
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
     ADD STUDENT — CANCEL-SAFE FLOW
  ======================================================= */

  const resetAddState = () => {
    addStudentCommittedRef.current = false;
    setStudentNumber("");
    setStudentName("");
    setGuardianName("");
    setGuardianRelationship("MOTHER");
    setGuardianEmail("");
    setCreateError("");
    setCreatedStudentRecord(null);
    setEnrollmentStep(1);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    setCancellingAddEnrollment(false);
    resetScan();
  };

  const openAddStudentModal = () => {
    stopCamera();
    resetAddState();
    setSelectedStudent(null);
    setEditingStudent(null);
    setStudentToDeactivate(null);
    setStudentToReactivate(null);
    setStudentToTransfer(null);
    setSuccessMessage("");
    setShowAddModal(true);
  };

  const validateStudentDetails = () => {
    const number = studentNumber.trim();
    const name = studentName.trim();
    const parentOrGuardianName = guardianName.trim();
    const parentOrGuardianEmail = normalizeEmail(guardianEmail);

    setCreateError("");

    if (!number || !name) {
      setCreateError("Student number and student name are required.");
      return false;
    }

    if (!isValidStudentNumber(number)) {
      setCreateError("Student number must contain exactly 12 digits.");
      return false;
    }

    if (!parentOrGuardianName) {
      setCreateError("Parent or guardian name is required.");
      return false;
    }

    if (
      !GUARDIAN_RELATIONSHIP_OPTIONS.some(
        (option) => option.value === guardianRelationship,
      )
    ) {
      setCreateError("Choose a valid parent or guardian relationship.");
      return false;
    }

    if (!parentOrGuardianEmail) {
      setCreateError("Parent or guardian email is required.");
      return false;
    }

    if (!isValidEmail(parentOrGuardianEmail)) {
      setCreateError("Enter a valid parent or guardian email address.");
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
    const cleanGuardianName = guardianName.trim();
    const cleanGuardianEmail = normalizeEmail(guardianEmail);

    try {
      setCreatingStudent(true);
      setCreateError("");
      const created = await adviserService.createStudent({
        studentNumber: cleanNumber,
        name: cleanName,
        sectionId: section.id,
        guardian: {
          name: cleanGuardianName,
          relationship: guardianRelationship,
          email: cleanGuardianEmail,
        },
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

        /*
         * The backend already returned the created student, so
         * update the shared roster cache without making another
         * GET request.
         */
        queryClient.setQueryData(queryKeys.adviser.allStudents(), (current) => {
          const list = normalizeArray(current);

          return list.some(
            (student) => String(student?.id) === String(record.id),
          )
            ? list.map((student) =>
                String(student?.id) === String(record.id)
                  ? { ...student, ...record }
                  : student,
              )
            : [...list, record];
        });
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

  const rollbackUnfinishedAddStudent = async () => {
    const student = createdStudentRecord;
    if (!student?.id) return true;

    const enrollmentCompleted =
      addStudentCommittedRef.current ||
      addEnrollmentResult?.enrolled === true ||
      locallyRegisteredFaceIds.has(student.id);
    if (enrollmentCompleted) return true;

    try {
      setCancellingAddEnrollment(true);
      await adviserService.deleteStudent(student.id);
      setStudents((current) =>
        current.filter((item) => String(item?.id) !== String(student.id)),
      );

      queryClient.setQueryData(queryKeys.adviser.allStudents(), (current) =>
        normalizeArray(current).filter(
          (item) => String(item?.id) !== String(student.id),
        ),
      );

      setLocallyRegisteredFaceIds((current) => {
        const next = new Set(current);
        next.delete(student.id);
        return next;
      });
      return true;
    } catch (requestError) {
      console.error(
        "Unable to roll back cancelled student enrollment:",
        requestError,
      );
      const message = getErrorMessage(
        requestError,
        "Unable to cancel this enrollment safely.",
      );
      if (enrollmentStep === 1) setCreateError(message);
      else
        setScan((current) => ({
          ...current,
          busy: false,
          phase: "failed",
          error: message,
        }));
      return false;
    } finally {
      setCancellingAddEnrollment(false);
    }
  };

  const closeAddModal = async () => {
    if (
      creatingStudent ||
      cancellingAddEnrollment ||
      registeringFace ||
      scan.busy
    )
      return;

    stopCamera();
    speechService.stop();
    const cancelledSafely = await rollbackUnfinishedAddStudent();
    if (!cancelledSafely) return;
    setShowAddModal(false);
    resetAddState();
  };

  const goToLiveEnrollment = async () => {
    if (creatingStudent || cancellingAddEnrollment) return;
    if (!validateStudentDetails()) return;
    setEnrollmentStep(2);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    resetScan();
    scheduleCameraStart();
  };

  const runAddEnrollment = async () => {
    try {
      setRegisteringFace(true);
      setAddEnrollmentResult(null);

      let student = createdStudentRecord;
      if (!student?.id) student = await createRosterRecordIfNeeded();
      if (!student?.id) return;

      const outcome = await performEnrollment(student);
      if (outcome.type === "ENROLLED") {
        addStudentCommittedRef.current = true;
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
    if (registeringFace || scan.busy || cancellingAddEnrollment) return;
    setEnrollmentStep(2);
    setAddEnrollmentResult(null);
    setFaceConflict(null);
    resetScan();
    scheduleCameraStart();
  };

  const finishAddEnrollment = () => {
    const completedName =
      createdStudentRecord?.name || studentName.trim() || "Student";
    addStudentCommittedRef.current = true;
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
    if (
      !student?.id ||
      student?.active === false ||
      getPendingTransferForStudent(student)
    )
      return;

    const currentGuardian = student?.guardian || null;
    const currentRelationship = String(
      currentGuardian?.relationship || "MOTHER",
    )
      .trim()
      .toUpperCase();

    stopCamera();
    setShowAddModal(false);
    setSelectedStudent(null);
    setStudentToDeactivate(null);
    setStudentToReactivate(null);
    setStudentToTransfer(null);
    setEditingStudent(student);
    setEditStudentNumber(student.studentNumber || "");
    setEditStudentName(student.name || "");
    setEditGuardianName(currentGuardian?.name || "");
    setEditGuardianRelationship(
      GUARDIAN_RELATIONSHIP_OPTIONS.some(
        (option) => option.value === currentRelationship,
      )
        ? currentRelationship
        : "OTHER",
    );
    setEditGuardianEmail(currentGuardian?.email || "");
    setEditError("");
    setSuccessMessage("");
  };

  const closeEditStudent = () => {
    if (updatingStudent) return;
    setEditingStudent(null);
    setEditStudentNumber("");
    setEditStudentName("");
    setEditGuardianName("");
    setEditGuardianRelationship("MOTHER");
    setEditGuardianEmail("");
    setEditError("");
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();
    if (!editingStudent?.id) return;

    const cleanNumber = editStudentNumber.trim();
    const cleanName = editStudentName.trim();
    const cleanGuardianName = editGuardianName.trim();
    const cleanGuardianEmail = normalizeEmail(editGuardianEmail);

    if (!cleanNumber || !cleanName) {
      setEditError("Student number and student name are required.");
      return;
    }

    if (!isValidStudentNumber(cleanNumber)) {
      setEditError("Student number must contain exactly 12 digits.");
      return;
    }

    if (!cleanGuardianName) {
      setEditError("Parent or guardian name is required.");
      return;
    }

    if (
      !GUARDIAN_RELATIONSHIP_OPTIONS.some(
        (option) => option.value === editGuardianRelationship,
      )
    ) {
      setEditError("Choose a valid parent or guardian relationship.");
      return;
    }

    if (!cleanGuardianEmail) {
      setEditError("Parent or guardian email is required.");
      return;
    }

    if (!isValidEmail(cleanGuardianEmail)) {
      setEditError("Enter a valid parent or guardian email address.");
      return;
    }

    try {
      setUpdatingStudent(true);
      setEditError("");

      const updated = await adviserService.updateStudent(editingStudent.id, {
        studentNumber: cleanNumber,
        name: cleanName,
        guardian: {
          name: cleanGuardianName,
          relationship: editGuardianRelationship,
          email: cleanGuardianEmail,
        },
      });

      if (updated?.id) {
        setStudents((current) =>
          current.map((student) =>
            student.id === updated.id ? { ...student, ...updated } : student,
          ),
        );

        queryClient.setQueryData(queryKeys.adviser.allStudents(), (current) =>
          normalizeArray(current).map((student) =>
            String(student?.id) === String(updated.id)
              ? { ...student, ...updated }
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
        `${cleanName}'s student and parent or guardian information was updated successfully.`,
      );
      closeEditStudent();
    } catch (requestError) {
      setEditError(
        requestError?.response?.status === 409
          ? getErrorMessage(
              requestError,
              "That student number already belongs to another student.",
            )
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
     DEACTIVATE STUDENT — SOFT DELETE
  ======================================================= */

  const openDeactivateStudent = (student) => {
    if (
      !student?.id ||
      student?.active === false ||
      getPendingTransferForStudent(student)
    )
      return;
    stopCamera();
    setShowAddModal(false);
    setSelectedStudent(null);
    setEditingStudent(null);
    setStudentToReactivate(null);
    setStudentToTransfer(null);
    setStudentToDeactivate(student);
    setDeactivateError("");
    setSuccessMessage("");
  };

  const closeDeactivateStudent = () => {
    if (deactivatingStudent) return;
    setStudentToDeactivate(null);
    setDeactivateError("");
  };

  const handleDeactivateStudent = async () => {
    if (!studentToDeactivate?.id) {
      setDeactivateError("Student information is unavailable.");
      return;
    }

    const studentId = studentToDeactivate.id;
    const deactivatedName = studentToDeactivate.name || "Student";

    try {
      setDeactivatingStudent(true);
      setDeactivateError("");
      setSuccessMessage("");
      await adviserService.deleteStudent(studentId);

      setStudents((current) =>
        current.map((student) =>
          String(student?.id) === String(studentId)
            ? { ...student, active: false }
            : student,
        ),
      );

      try {
        await refreshStudents();
      } catch (refreshError) {
        console.warn(
          "Unable to refresh students after deactivation:",
          refreshError,
        );
      }

      setSuccessMessage(
        `${deactivatedName} was deactivated successfully. Existing attendance history and face records were preserved.`,
      );
      setStudentToDeactivate(null);
      setDeactivateError("");
    } catch (requestError) {
      console.error("Unable to deactivate student:", requestError);
      setDeactivateError(
        getErrorMessage(requestError, "Unable to deactivate the student."),
      );
    } finally {
      setDeactivatingStudent(false);
    }
  };

  /* =======================================================
     REACTIVATE STUDENT
  ======================================================= */

  const openReactivateStudent = (student) => {
    if (
      !student?.id ||
      student?.active !== false ||
      getPendingTransferForStudent(student)
    )
      return;

    stopCamera();
    setShowAddModal(false);
    setSelectedStudent(null);
    setEditingStudent(null);
    setStudentToDeactivate(null);
    setStudentToTransfer(null);
    setStudentToReactivate(student);
    setReactivateError("");
    setSuccessMessage("");
  };

  const closeReactivateStudent = () => {
    if (reactivatingStudent) return;
    setStudentToReactivate(null);
    setReactivateError("");
  };

  const handleReactivateStudent = async () => {
    if (!studentToReactivate?.id) {
      setReactivateError("Student information is unavailable.");
      return;
    }

    const studentId = studentToReactivate.id;
    const studentNameToRestore = studentToReactivate.name || "Student";

    try {
      setReactivatingStudent(true);
      setReactivateError("");
      setSuccessMessage("");

      const updated = await adviserService.reactivateStudent(studentId);

      setStudents((current) =>
        current.map((student) =>
          String(student?.id) === String(studentId)
            ? { ...student, ...(updated || {}), active: true }
            : student,
        ),
      );

      try {
        await refreshStudents();
      } catch (refreshError) {
        console.warn(
          "Unable to refresh students after reactivation:",
          refreshError,
        );
      }

      setSuccessMessage(
        `${studentNameToRestore} was reactivated successfully. Existing face registration and attendance history were preserved.`,
      );
      setStudentToReactivate(null);
      setReactivateError("");
    } catch (requestError) {
      console.error("Unable to reactivate student:", requestError);
      setReactivateError(
        getErrorMessage(requestError, "Unable to reactivate the student."),
      );
    } finally {
      setReactivatingStudent(false);
    }
  };

  /* =======================================================
     TRANSFER STUDENT SECTION
  ======================================================= */

  const openTransferStudent = async (student) => {
    if (
      !student?.id ||
      student?.active === false ||
      getPendingTransferForStudent(student)
    )
      return;

    stopCamera();
    setShowAddModal(false);
    setSelectedStudent(null);
    setEditingStudent(null);
    setStudentToDeactivate(null);
    setStudentToReactivate(null);
    setStudentToTransfer(student);
    setTransferSectionId("");
    setTransferSectionOptions([]);
    setTransferError("");
    setSuccessMessage("");

    try {
      setLoadingTransferSections(true);

      const options = normalizeArray(
        await adviserService.getEligibleStudentTransferSections(student.id),
      );

      setTransferSectionOptions(options);
      setTransferSectionId(options[0]?.id || "");
    } catch (requestError) {
      console.error("Unable to load transfer destinations:", requestError);
      setTransferError(
        getErrorMessage(
          requestError,
          "Unable to load eligible destination sections.",
        ),
      );
    } finally {
      setLoadingTransferSections(false);
    }
  };

  const closeTransferStudent = () => {
    if (transferringStudent || loadingTransferSections) return;
    setStudentToTransfer(null);
    setTransferSectionId("");
    setTransferSectionOptions([]);
    setTransferError("");
  };

  const handleTransferStudent = async () => {
    if (!studentToTransfer?.id) {
      setTransferError("Student information is unavailable.");
      return;
    }

    if (!transferSectionId) {
      setTransferError("Choose a destination section first.");
      return;
    }

    const destinationSection = transferSectionOptions.find(
      (item) => String(item?.id) === String(transferSectionId),
    );

    if (!destinationSection) {
      setTransferError("The selected destination section is unavailable.");
      return;
    }

    const studentId = studentToTransfer.id;
    const studentNameToTransfer = studentToTransfer.name || "Student";

    try {
      setTransferringStudent(true);
      setTransferError("");
      setSuccessMessage("");

      const createdRequest = await adviserService.createStudentTransferRequest({
        studentId,
        destinationSectionId: transferSectionId,
      });

      if (createdRequest?.id) {
        setOutgoingTransferRequests((current) => [
          createdRequest,
          ...normalizeArray(current).filter(
            (request) =>
              String(request?.id || "") !== String(createdRequest.id),
          ),
        ]);
      } else {
        await refreshTransferRequests();
      }

      /*
       * Backend also marks the student operationally inactive
       * while the transfer request is pending. Mirror that state
       * immediately so AttendanceSession pages that rely on
       * student.active cannot use this student.
       */
      setStudents((current) =>
        current.map((student) =>
          String(student?.id) === String(studentId)
            ? { ...student, active: false }
            : student,
        ),
      );

      /*
       * Keep Student Transfers, Student Management, and any
       * cached roster consumer synchronized with the successful
       * transfer mutation.
       */
      await invalidateTransferCache(queryClient);

      setSuccessMessage(
        `Transfer request for ${studentNameToTransfer} was sent to ${destinationSection.adviserName || "the destination Adviser"} for ${destinationSection.name || "the selected section"}. The student is now marked Being Transferred and attendance is paused until the request is approved, rejected, or cancelled.`,
      );

      setStudentToTransfer(null);
      setTransferSectionId("");
      setTransferSectionOptions([]);
      setTransferError("");
    } catch (requestError) {
      console.error("Unable to send student transfer request:", requestError);
      setTransferError(
        getErrorMessage(requestError, "Unable to send the transfer request."),
      );
    } finally {
      setTransferringStudent(false);
    }
  };

  /* =======================================================
     CANCEL PENDING TRANSFER REQUEST
  ======================================================= */

  const openCancelTransfer = (student, transferRequest) => {
    const requestStatus = String(transferRequest?.status || "")
      .trim()
      .toUpperCase();

    if (!student?.id || !transferRequest?.id || requestStatus !== "PENDING") {
      return;
    }

    stopCamera();
    setStudentActionMenu(null);
    setShowAddModal(false);
    setSelectedStudent(null);
    setEditingStudent(null);
    setStudentToDeactivate(null);
    setStudentToReactivate(null);
    setStudentToTransfer(null);
    setTransferToCancel({
      student,
      request: transferRequest,
    });
    setCancelTransferError("");
    setSuccessMessage("");
  };

  const closeCancelTransfer = () => {
    if (cancellingTransfer) return;
    setTransferToCancel(null);
    setCancelTransferError("");
  };

  const handleCancelTransfer = async () => {
    const student = transferToCancel?.student;
    const request = transferToCancel?.request;

    if (!student?.id || !request?.id) {
      setCancelTransferError("Transfer request information is unavailable.");
      return;
    }

    const studentId = student.id;
    const studentNameToRestore = student.name || "Student";

    try {
      setCancellingTransfer(true);
      setCancelTransferError("");
      setSuccessMessage("");

      const cancelled = await adviserService.cancelStudentTransferRequest(
        request.id,
      );

      setOutgoingTransferRequests((current) =>
        normalizeArray(current).map((item) =>
          String(item?.id || "") === String(request.id)
            ? { ...item, ...(cancelled || {}), status: "CANCELLED" }
            : item,
        ),
      );

      /*
       * A pending transfer temporarily blocks attendance by setting
       * the student operationally inactive. Cancelling restores the
       * student immediately to normal active attendance operations.
       */
      setStudents((current) =>
        current.map((item) =>
          String(item?.id || "") === String(studentId)
            ? { ...item, active: true }
            : item,
        ),
      );

      try {
        await invalidateTransferCache(queryClient);
      } catch (refreshError) {
        console.warn(
          "Unable to synchronize cached records after transfer cancellation:",
          refreshError,
        );
      }

      setSuccessMessage(
        `${studentNameToRestore}'s transfer request was cancelled. The student remains in ${request?.sourceSectionName || student?.sectionName || sectionName} and is available for attendance again.`,
      );

      setTransferToCancel(null);
      setCancelTransferError("");
    } catch (requestError) {
      console.error("Unable to cancel student transfer request:", requestError);
      setCancelTransferError(
        getErrorMessage(requestError, "Unable to cancel the transfer request."),
      );

      /*
       * If the destination Adviser resolved the request just before
       * this click, refresh so the roster reflects the authoritative
       * server state instead of leaving a stale pending badge.
       */
      if (requestError?.response?.status === 409) {
        void invalidateTransferCache(queryClient);
      }
    } finally {
      setCancellingTransfer(false);
    }
  };

  /* =======================================================
     EXISTING STUDENT FACE ENROLLMENT
  ======================================================= */

  const openFaceRegistration = (student) => {
    if (
      !student?.id ||
      student?.active === false ||
      getPendingTransferForStudent(student)
    )
      return;
    stopCamera();
    resetScan();
    setShowAddModal(false);
    setEditingStudent(null);
    setStudentToDeactivate(null);
    setStudentToReactivate(null);
    setStudentToTransfer(null);
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
      if (result?.reviewPending) return;
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
        if (origin === "ADD") addStudentCommittedRef.current = true;
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

    if (showAddModal && enrollmentStep === 2) {
      return () => void runAddEnrollment();
    }
    if (selectedStudent?.id) return () => void runExistingEnrollment();
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
  const addEnrollmentDisplayStudent =
    createdStudentRecord ||
    (studentName.trim() && studentNumber.trim()
      ? {
          id: "",
          name: studentName.trim(),
          studentNumber: studentNumber.trim(),
          sectionId: section?.id || "",
        }
      : null);

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
                Enrollment uses one silent multi-frame scan, passive
                anti-spoofing, same-person continuity, and optional voice
                guidance.
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
              <span>TRANSFER PENDING</span>
              <strong>
                {loading || loadingTransferStatuses
                  ? "—"
                  : transferPendingCount}
              </strong>
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
                          <option value="TRANSFER_PENDING">
                            Being transferred
                          </option>
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
                    const pendingTransfer =
                      getPendingTransferForStudent(student);
                    const transferPending = Boolean(pendingTransfer);
                    return (
                      <tr
                        key={student.id || student.studentNumber}
                        className={
                          transferPending ? "student-row-transfer-pending" : ""
                        }
                      >
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
                              transferPending
                                ? "is-transfer-pending"
                                : !active
                                  ? "is-inactive"
                                  : "is-active"
                            }`}
                            title={
                              transferPending
                                ? `Waiting for ${
                                    pendingTransfer?.destinationSectionName ||
                                    "destination section"
                                  } approval`
                                : undefined
                            }
                          >
                            <span aria-hidden="true" />
                            {transferPending
                              ? "Being Transferred"
                              : !active
                                ? "Inactive"
                                : "Active"}
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
                              className={`student-actions-trigger ${
                                studentActionMenu?.studentId === student.id
                                  ? "is-open"
                                  : ""
                              }`}
                              aria-haspopup="menu"
                              aria-expanded={
                                studentActionMenu?.studentId === student.id
                              }
                              onClick={(event) =>
                                toggleStudentActionMenu(event, student)
                              }
                            >
                              <span
                                className="student-actions-trigger-dots"
                                aria-hidden="true"
                              >
                                •••
                              </span>
                              <span>Actions</span>
                              <span
                                className="student-actions-trigger-chevron"
                                aria-hidden="true"
                              >
                                {studentActionMenu?.studentId === student.id
                                  ? "⌃"
                                  : "⌄"}
                              </span>
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

          {studentActionMenu?.student && (
            <div
              className="student-actions-dropdown"
              role="menu"
              aria-label={`Actions for ${
                studentActionMenu.student.name || "student"
              }`}
              style={{
                top: `${studentActionMenu.top}px`,
                left: `${studentActionMenu.left}px`,
              }}
            >
              <div className="student-actions-dropdown-head">
                <small>STUDENT ACTIONS</small>
                <strong>
                  {studentActionMenu.student.name || "Unnamed Student"}
                </strong>
              </div>

              {getPendingTransferForStudent(studentActionMenu.student) ? (
                <>
                  <div
                    className="student-actions-transfer-pending"
                    role="status"
                  >
                    <span
                      className="student-actions-dropdown-icon"
                      aria-hidden="true"
                    >
                      ↔
                    </span>
                    <span>
                      <strong>Being Transferred</strong>
                      <small>
                        Waiting for{" "}
                        {getPendingTransferForStudent(studentActionMenu.student)
                          ?.destinationSectionName ||
                          "destination section"}{" "}
                        to review this request. Attendance is paused while the
                        request is pending.
                      </small>
                    </span>
                  </div>

                  <div className="student-actions-dropdown-divider" />

                  <button
                    type="button"
                    role="menuitem"
                    className="student-actions-dropdown-item is-warning"
                    onClick={() => {
                      const student = studentActionMenu.student;
                      const transferRequest =
                        getPendingTransferForStudent(student);
                      openCancelTransfer(student, transferRequest);
                    }}
                  >
                    <span
                      className="student-actions-dropdown-icon is-warning"
                      aria-hidden="true"
                    >
                      ↩
                    </span>
                    <span>
                      <strong>Cancel Transfer</strong>
                      <small>
                        Stop this pending request and restore attendance
                      </small>
                    </span>
                  </button>
                </>
              ) : studentActionMenu.student?.active === false ? (
                <button
                  type="button"
                  role="menuitem"
                  className="student-actions-dropdown-item"
                  onClick={() => {
                    const student = studentActionMenu.student;
                    setStudentActionMenu(null);
                    openReactivateStudent(student);
                  }}
                >
                  <span
                    className="student-actions-dropdown-icon is-face"
                    aria-hidden="true"
                  >
                    ↻
                  </span>
                  <span>
                    <strong>Reactivate Student</strong>
                    <small>Return to the active class roster</small>
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="student-actions-dropdown-item"
                    onClick={() => {
                      const student = studentActionMenu.student;
                      setStudentActionMenu(null);
                      openEditStudent(student);
                    }}
                  >
                    <span
                      className="student-actions-dropdown-icon"
                      aria-hidden="true"
                    >
                      ✎
                    </span>
                    <span>
                      <strong>Edit Student</strong>
                      <small>Update roster information</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="student-actions-dropdown-item"
                    onClick={() => {
                      const student = studentActionMenu.student;
                      setStudentActionMenu(null);
                      openFaceRegistration(student);
                    }}
                  >
                    <span
                      className="student-actions-dropdown-icon is-face"
                      aria-hidden="true"
                    >
                      ◎
                    </span>
                    <span>
                      <strong>
                        {hasFaceRegistered(
                          studentActionMenu.student,
                          locallyRegisteredFaceIds,
                        )
                          ? "Update Face"
                          : "Register Face"}
                      </strong>
                      <small>Manage secure face identity</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="student-actions-dropdown-item"
                    onClick={() => {
                      const student = studentActionMenu.student;
                      setStudentActionMenu(null);
                      void openTransferStudent(student);
                    }}
                  >
                    <span
                      className="student-actions-dropdown-icon"
                      aria-hidden="true"
                    >
                      ↔
                    </span>
                    <span>
                      <strong>Transfer Section</strong>
                      <small>Request transfer to another section</small>
                    </span>
                  </button>

                  <div className="student-actions-dropdown-divider" />

                  <button
                    type="button"
                    role="menuitem"
                    className="student-actions-dropdown-item is-danger"
                    onClick={() => {
                      const student = studentActionMenu.student;
                      setStudentActionMenu(null);
                      openDeactivateStudent(student);
                    }}
                  >
                    <span
                      className="student-actions-dropdown-icon is-danger"
                      aria-hidden="true"
                    >
                      ×
                    </span>
                    <span>
                      <strong>Deactivate Student</strong>
                      <small>Remove from the active roster</small>
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

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

      {/* ADD STUDENT + SECURE FACE ENROLLMENT */}
      {showAddModal && !conflictOpen && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) void closeAddModal();
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
                      ? "Enter the student details, then continue to the secure face scanner. Nothing is added just by opening the next step."
                      : enrollmentStep === 2
                        ? "Use Manual Capture or Auto Capture, hold still briefly, then review before saving."
                        : "Review the final enrollment result before closing."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={
                  creatingStudent ||
                  cancellingAddEnrollment ||
                  registeringFace ||
                  scan.busy
                }
                onClick={() => void closeAddModal()}
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
                        disabled={creatingStudent || cancellingAddEnrollment}
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
                        disabled={creatingStudent || cancellingAddEnrollment}
                        onChange={(event) => setStudentName(event.target.value)}
                      />
                    </label>
                    <label className="student-form-field">
                      <span>Parent / Guardian Name</span>
                      <input
                        value={guardianName}
                        autoComplete="name"
                        placeholder="Complete parent or guardian name"
                        disabled={creatingStudent || cancellingAddEnrollment}
                        onChange={(event) => setGuardianName(event.target.value)}
                      />
                    </label>
                    <label className="student-form-field">
                      <span>Relationship</span>
                      <select
                        value={guardianRelationship}
                        disabled={creatingStudent || cancellingAddEnrollment}
                        onChange={(event) =>
                          setGuardianRelationship(event.target.value)
                        }
                      >
                        {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="student-form-field">
                      <span>Parent / Guardian Email</span>
                      <input
                        type="email"
                        value={guardianEmail}
                        autoComplete="email"
                        placeholder="Parent or guardian email"
                        disabled={creatingStudent || cancellingAddEnrollment}
                        onChange={(event) => setGuardianEmail(event.target.value)}
                      />
                      <small>Used for attendance notices and secure parent communication.</small>
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
                      <strong>Nothing is added just by continuing</strong>
                      <p>
                        Continue only opens the secure face scanner. The student
                        record is created when the secure scan actually begins.
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

              {enrollmentStep === 2 && addEnrollmentDisplayStudent && (
                <section className="student-live-scan-step">
                  <div className="student-liveness-student-strip">
                    <span className="student-liveness-avatar">
                      {addEnrollmentDisplayStudent.name
                        ?.charAt(0)
                        ?.toUpperCase() || "S"}
                    </span>
                    <div>
                      <small>ENROLLING STUDENT</small>
                      <strong>{addEnrollmentDisplayStudent.name}</strong>
                      <span>
                        {addEnrollmentDisplayStudent.studentNumber} •{" "}
                        {sectionName}
                      </span>
                    </div>
                    <span className="student-liveness-security-badge">
                      SECURE FACE SCAN
                    </span>
                  </div>
                  <LiveScanner
                    studentName={addEnrollmentDisplayStudent.name || "Student"}
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
                    disabled={
                      registeringFace ||
                      creatingStudent ||
                      cancellingAddEnrollment
                    }
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
                          <h3>Enrollment needs an identity review</h3>
                          <p>
                            A similar enrolled face was found. No face was
                            saved. Verify the identity, or cancel this new
                            enrollment.
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
                          The enrollment is not complete. Retry the secure face
                          scan, or cancel to discard this new student.
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
                        : "Complete or cancel this enrollment"}
                </strong>
                <span>
                  An unfinished new enrollment is discarded on cancel.
                </span>
              </div>
              <div className="student-face-action-group">
                {enrollmentStep === 1 && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={creatingStudent || cancellingAddEnrollment}
                      onClick={() => void closeAddModal()}
                    >
                      {cancellingAddEnrollment ? "Cancelling…" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="adviser-primary-button"
                      disabled={creatingStudent || cancellingAddEnrollment}
                      onClick={() => void goToLiveEnrollment()}
                    >
                      {creatingStudent ? "Preparing…" : "Continue to Live Face"}
                    </button>
                  </>
                )}
                {enrollmentStep === 2 && (
                  <button
                    type="button"
                    className="adviser-secondary-button"
                    disabled={
                      registeringFace ||
                      creatingStudent ||
                      scan.busy ||
                      cancellingAddEnrollment
                    }
                    onClick={() => void closeAddModal()}
                  >
                    {cancellingAddEnrollment
                      ? "Cancelling…"
                      : "Cancel Enrollment"}
                  </button>
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
                    <>
                      <button
                        type="button"
                        className="adviser-secondary-button"
                        disabled={
                          cancellingAddEnrollment ||
                          registeringFace ||
                          scan.busy
                        }
                        onClick={() => void closeAddModal()}
                      >
                        {cancellingAddEnrollment
                          ? "Cancelling…"
                          : "Cancel Enrollment"}
                      </button>
                      <button
                        type="button"
                        className="adviser-primary-button"
                        disabled={cancellingAddEnrollment}
                        onClick={retryAddEnrollment}
                      >
                        Retry Live Enrollment
                      </button>
                    </>
                  )}
                {enrollmentStep === 3 && faceConflict && (
                  <>
                    <button
                      type="button"
                      className="adviser-secondary-button"
                      disabled={
                        cancellingAddEnrollment || registeringFace || scan.busy
                      }
                      onClick={() => void closeAddModal()}
                    >
                      {cancellingAddEnrollment
                        ? "Cancelling…"
                        : "Cancel Enrollment"}
                    </button>
                    <button
                      type="button"
                      className="adviser-primary-button"
                      disabled={
                        cancellingAddEnrollment ||
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
            className="adviser-modal student-edit-modal student-record-modal"
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
                <label className="student-form-field">
                  <span>Parent / Guardian Name</span>
                  <input
                    value={editGuardianName}
                    autoComplete="name"
                    placeholder="Complete parent or guardian name"
                    disabled={updatingStudent}
                    onChange={(event) =>
                      setEditGuardianName(event.target.value)
                    }
                  />
                </label>
                <label className="student-form-field">
                  <span>Relationship</span>
                  <select
                    value={editGuardianRelationship}
                    disabled={updatingStudent}
                    onChange={(event) =>
                      setEditGuardianRelationship(event.target.value)
                    }
                  >
                    {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="student-form-field">
                  <span>Parent / Guardian Email</span>
                  <input
                    type="email"
                    value={editGuardianEmail}
                    autoComplete="email"
                    placeholder="Parent or guardian email"
                    disabled={updatingStudent}
                    onChange={(event) =>
                      setEditGuardianEmail(event.target.value)
                    }
                  />
                  <small>
                    Used for attendance notices and secure parent communication.
                  </small>
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

      {/* DEACTIVATE STUDENT */}
      {studentToDeactivate && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeactivateStudent();
          }}
        >
          <div
            className="adviser-modal student-edit-modal student-record-modal student-deactivate-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-student-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon student-deactivate-icon"
                  aria-hidden="true"
                >
                  !
                </div>
                <div>
                  <span>STUDENT STATUS</span>
                  <h2 id="deactivate-student-title">Deactivate student</h2>
                  <p>
                    Remove this student from active attendance operations
                    without deleting historical records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={deactivatingStudent}
                onClick={closeDeactivateStudent}
              >
                ×
              </button>
            </header>

            <div className="student-live-edit-body student-deactivate-body">
              <div className="student-liveness-student-strip student-liveness-existing-strip">
                <span className="student-liveness-avatar">
                  {studentToDeactivate.name?.charAt(0)?.toUpperCase() || "S"}
                </span>
                <div>
                  <small>STUDENT</small>
                  <strong>
                    {studentToDeactivate.name || "Unnamed Student"}
                  </strong>
                  <span>
                    {studentToDeactivate.studentNumber || "No student number"} •{" "}
                    {sectionName}
                  </span>
                </div>
                <span className="student-status-badge is-active">
                  <span aria-hidden="true" /> ACTIVE
                </span>
              </div>

              <div className="student-live-explainer student-deactivate-note">
                <span aria-hidden="true">!</span>
                <div>
                  <strong>Attendance history will be preserved</strong>
                  <p>
                    This is a soft delete. The student becomes inactive, while
                    existing attendance history and registered face data remain
                    preserved for records and auditing.
                  </p>
                </div>
              </div>

              {deactivateError && (
                <div className="student-face-feedback is-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Unable to deactivate</strong>
                    <p>{deactivateError}</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="adviser-modal-actions student-deactivate-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={deactivatingStudent}
                onClick={closeDeactivateStudent}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="adviser-primary-button student-deactivate-confirm"
                disabled={deactivatingStudent}
                onClick={() => void handleDeactivateStudent()}
              >
                {deactivatingStudent ? "Deactivating…" : "Deactivate Student"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* REACTIVATE STUDENT */}
      {studentToReactivate && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReactivateStudent();
          }}
        >
          <div
            className="adviser-modal student-edit-modal student-record-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactivate-student-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  ↻
                </div>
                <div>
                  <span>STUDENT STATUS</span>
                  <h2 id="reactivate-student-title">Reactivate student</h2>
                  <p>
                    Return this existing student to the active roster without
                    creating a duplicate student record.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={reactivatingStudent}
                onClick={closeReactivateStudent}
              >
                ×
              </button>
            </header>

            <div className="student-live-edit-body">
              <div className="student-liveness-student-strip student-liveness-existing-strip">
                <span className="student-liveness-avatar">
                  {studentToReactivate.name?.charAt(0)?.toUpperCase() || "S"}
                </span>
                <div>
                  <small>INACTIVE STUDENT</small>
                  <strong>
                    {studentToReactivate.name || "Unnamed Student"}
                  </strong>
                  <span>
                    {studentToReactivate.studentNumber || "No student number"} •{" "}
                    {studentToReactivate.sectionName || sectionName}
                  </span>
                </div>
                <span className="student-status-badge is-inactive">
                  <span aria-hidden="true" /> INACTIVE
                </span>
              </div>

              <div className="student-live-explainer">
                <span aria-hidden="true">↻</span>
                <div>
                  <strong>The existing identity will be restored</strong>
                  <p>
                    Student ID, student number, registered face, current
                    section, and previous attendance history remain preserved.
                  </p>
                </div>
              </div>

              {reactivateError && (
                <div className="student-face-feedback is-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Unable to reactivate</strong>
                    <p>{reactivateError}</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="adviser-modal-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={reactivatingStudent}
                onClick={closeReactivateStudent}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adviser-primary-button"
                disabled={reactivatingStudent}
                onClick={() => void handleReactivateStudent()}
              >
                {reactivatingStudent ? "Reactivating…" : "Reactivate Student"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* CANCEL PENDING TRANSFER */}
      {transferToCancel?.student && transferToCancel?.request && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancelTransfer();
          }}
        >
          <div
            className="adviser-modal student-edit-modal student-record-modal student-cancel-transfer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-transfer-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon student-transfer-cancel-icon"
                  aria-hidden="true"
                >
                  ↩
                </div>
                <div>
                  <span>SECTION TRANSFER REQUEST</span>
                  <h2 id="cancel-transfer-title">Cancel transfer request</h2>
                  <p>
                    Stop this request before the destination Adviser approves or
                    rejects it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={cancellingTransfer}
                onClick={closeCancelTransfer}
              >
                ×
              </button>
            </header>

            <div className="student-live-edit-body">
              <div className="student-liveness-student-strip student-liveness-existing-strip">
                <span className="student-liveness-avatar">
                  {transferToCancel.student.name?.charAt(0)?.toUpperCase() ||
                    "S"}
                </span>
                <div>
                  <small>BEING TRANSFERRED</small>
                  <strong>
                    {transferToCancel.student.name || "Unnamed Student"}
                  </strong>
                  <span>
                    {transferToCancel.student.studentNumber ||
                      "No student number"}
                  </span>
                </div>
                <span className="student-status-badge is-transfer-pending">
                  <span aria-hidden="true" /> PENDING
                </span>
              </div>

              <div className="student-transfer-route-card">
                <div>
                  <small>FROM</small>
                  <strong>
                    {transferToCancel.request.sourceSectionName ||
                      transferToCancel.student.sectionName ||
                      sectionName}
                  </strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>REQUESTED DESTINATION</small>
                  <strong>
                    {transferToCancel.request.destinationSectionName ||
                      "Destination section"}
                  </strong>
                  {transferToCancel.request.destinationAdviserName && (
                    <span>
                      Adviser: {transferToCancel.request.destinationAdviserName}
                    </span>
                  )}
                </div>
              </div>

              <div className="student-live-explainer student-transfer-cancel-note">
                <span aria-hidden="true">i</span>
                <div>
                  <strong>The student will stay in the current section</strong>
                  <p>
                    Cancelling does not delete or move the student. The pending
                    attendance block is removed immediately, so the student can
                    participate in attendance again.
                  </p>
                </div>
              </div>

              {cancelTransferError && (
                <div className="student-face-feedback is-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Unable to cancel transfer</strong>
                    <p>{cancelTransferError}</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="adviser-modal-actions student-record-modal-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={cancellingTransfer}
                onClick={closeCancelTransfer}
              >
                Keep Request
              </button>
              <button
                type="button"
                className="adviser-primary-button student-cancel-transfer-confirm"
                disabled={cancellingTransfer}
                onClick={() => void handleCancelTransfer()}
              >
                {cancellingTransfer ? "Cancelling…" : "Cancel Transfer"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* TRANSFER STUDENT SECTION */}
      {studentToTransfer && (
        <div
          className="adviser-modal-backdrop student-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTransferStudent();
          }}
        >
          <div
            className="adviser-modal student-edit-modal student-record-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-student-title"
          >
            <header className="adviser-modal-header student-modal-header">
              <div className="student-modal-heading">
                <div
                  className="adviser-modal-icon student-modal-icon"
                  aria-hidden="true"
                >
                  ↔
                </div>
                <div>
                  <span>SECTION TRANSFER REQUEST</span>
                  <h2 id="transfer-student-title">Request section transfer</h2>
                  <p>
                    Choose the destination section. The destination Adviser must
                    approve the request before the student is moved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="student-modal-close"
                disabled={transferringStudent || loadingTransferSections}
                onClick={closeTransferStudent}
              >
                ×
              </button>
            </header>

            <div className="student-live-edit-body">
              <div className="student-liveness-student-strip student-liveness-existing-strip">
                <span className="student-liveness-avatar">
                  {studentToTransfer.name?.charAt(0)?.toUpperCase() || "S"}
                </span>
                <div>
                  <small>STUDENT</small>
                  <strong>{studentToTransfer.name || "Unnamed Student"}</strong>
                  <span>
                    {studentToTransfer.studentNumber || "No student number"}
                  </span>
                </div>
                <span className="student-status-badge is-active">
                  <span aria-hidden="true" /> ACTIVE
                </span>
              </div>

              <div className="student-form">
                <div className="student-form-field">
                  <span>Current Section</span>
                  <div className="student-locked-field">
                    <div>
                      <small>CURRENT</small>
                      <strong>
                        {studentToTransfer.sectionName || sectionName}
                      </strong>
                    </div>
                    <span className="student-locked-badge">CURRENT</span>
                  </div>
                </div>

                <label className="student-form-field">
                  <span>Request Transfer To</span>
                  <select
                    value={transferSectionId}
                    disabled={transferringStudent || loadingTransferSections}
                    onChange={(event) => {
                      setTransferSectionId(event.target.value);
                      setTransferError("");
                    }}
                  >
                    {loadingTransferSections ? (
                      <option value="">Loading eligible sections…</option>
                    ) : transferSectionOptions.length === 0 ? (
                      <option value="">No eligible destination section</option>
                    ) : (
                      transferSectionOptions.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.name || "Unnamed section"}
                          {destination.adviserName
                            ? ` — Adviser: ${destination.adviserName}`
                            : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              <div className="student-live-explainer">
                <span aria-hidden="true">i</span>
                <div>
                  <strong>Approval is required before anything moves</strong>
                  <p>
                    Sending this request does not change the student's current
                    section. The destination Adviser can review, approve, or
                    reject it. Only approval performs the actual transfer.
                  </p>
                </div>
              </div>

              <div className="student-live-explainer">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Student identity remains the same</strong>
                  <p>
                    Student ID, student number, registered face, and historical
                    attendance remain preserved when an approved transfer is
                    completed.
                  </p>
                </div>
              </div>

              {transferError && (
                <div className="student-face-feedback is-error" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Unable to request transfer</strong>
                    <p>{transferError}</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="adviser-modal-actions">
              <button
                type="button"
                className="adviser-secondary-button"
                disabled={transferringStudent || loadingTransferSections}
                onClick={closeTransferStudent}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adviser-primary-button"
                disabled={
                  transferringStudent ||
                  loadingTransferSections ||
                  !transferSectionId
                }
                onClick={() => void handleTransferStudent()}
              >
                {transferringStudent
                  ? "Sending Request…"
                  : "Send Transfer Request"}
              </button>
            </footer>
          </div>
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
