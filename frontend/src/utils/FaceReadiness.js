import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "1.0.1";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const ANALYSIS_WIDTH = 640;
const ANALYSIS_MIN_INTERVAL_MS = 120;

let faceLandmarker = null;
let initializing = null;

let analysisCanvas = null;
let analysisContext = null;

let brightnessCanvas = null;
let brightnessContext = null;

let movementHistory = [];
let previousFace = null;

let lastAnalysisAt = 0;
let lastAnalysisResult = null;
let activeAnalysisPromise = null;

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const rangeScore = (value, idealMin, idealMax, hardMin, hardMax) => {
  if (!Number.isFinite(value)) return 0;

  if (value >= idealMin && value <= idealMax) {
    return 100;
  }

  if (value < hardMin || value > hardMax) {
    return 0;
  }

  if (value < idealMin) {
    return clamp(
      ((value - hardMin) / Math.max(0.0001, idealMin - hardMin)) * 100,
    );
  }

  return clamp(
    ((hardMax - value) / Math.max(0.0001, hardMax - idealMax)) * 100,
  );
};

const getBlendshapeScore = (result, name) => {
  const categories = result?.faceBlendshapes?.[0]?.categories || [];
  const match = categories.find(
    (item) => item?.categoryName === name,
  );

  return Number(match?.score || 0);
};

const getYawDegrees = (result) => {
  const data = result?.facialTransformationMatrixes?.[0]?.data;

  if (!data || data.length < 16) {
    return null;
  }

  const matrixValue = clamp(Number(data[8]), -1, 1);

  return (Math.asin(matrixValue) * 180) / Math.PI;
};

const getBoundingBox = (landmarks) => {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return null;
  }

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  landmarks.forEach((point) => {
    const x = Number(point?.x);
    const y = Number(point?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const ensureAnalysisCanvas = () => {
  if (!analysisCanvas) {
    analysisCanvas = document.createElement("canvas");
    analysisContext = analysisCanvas.getContext("2d", {
      alpha: false,
      willReadFrequently: false,
    });
  }

  return {
    canvas: analysisCanvas,
    context: analysisContext,
  };
};

const ensureBrightnessCanvas = () => {
  if (!brightnessCanvas) {
    brightnessCanvas = document.createElement("canvas");
    brightnessCanvas.width = 48;
    brightnessCanvas.height = 48;

    brightnessContext = brightnessCanvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
  }

  return {
    canvas: brightnessCanvas,
    context: brightnessContext,
  };
};

const prepareAnalysisFrame = (video) => {
  if (!video) {
    throw new Error("Camera preview is unavailable.");
  }

  const sourceWidth =
    Number(video.videoWidth) ||
    Number(video.clientWidth) ||
    0;

  const sourceHeight =
    Number(video.videoHeight) ||
    Number(video.clientHeight) ||
    0;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Camera frame is not ready yet.");
  }

  const targetWidth = Math.min(ANALYSIS_WIDTH, sourceWidth);
  const aspectRatio = sourceHeight / sourceWidth;
  const targetHeight = Math.max(
    1,
    Math.round(targetWidth * aspectRatio),
  );

  const { canvas, context } = ensureAnalysisCanvas();

  if (!context) {
    throw new Error("Unable to prepare local face analysis.");
  }

  if (
    canvas.width !== targetWidth ||
    canvas.height !== targetHeight
  ) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.drawImage(
    video,
    0,
    0,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return canvas;
};

const getFaceBrightness = (source, box) => {
  try {
    const { canvas, context } = ensureBrightnessCanvas();

    if (!context || !box || !source) {
      return 128;
    }

    const sourceWidth =
      Number(source.width) ||
      Number(source.videoWidth) ||
      0;

    const sourceHeight =
      Number(source.height) ||
      Number(source.videoHeight) ||
      0;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return 128;
    }

    const paddingX = box.width * 0.08;
    const paddingY = box.height * 0.08;

    const normalizedMinX = Math.max(
      0,
      box.minX - paddingX,
    );

    const normalizedMinY = Math.max(
      0,
      box.minY - paddingY,
    );

    const normalizedMaxX = Math.min(
      1,
      box.maxX + paddingX,
    );

    const normalizedMaxY = Math.min(
      1,
      box.maxY + paddingY,
    );

    const sx = normalizedMinX * sourceWidth;
    const sy = normalizedMinY * sourceHeight;
    const sw =
      Math.max(0, normalizedMaxX - normalizedMinX) *
      sourceWidth;

    const sh =
      Math.max(0, normalizedMaxY - normalizedMinY) *
      sourceHeight;

    if (sw <= 1 || sh <= 1) {
      return 128;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.drawImage(
      source,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const { data } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    let total = 0;
    let count = 0;

    for (let index = 0; index < data.length; index += 16) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      total +=
        0.2126 * r +
        0.7152 * g +
        0.0722 * b;

      count += 1;
    }

    return count > 0 ? total / count : 128;
  } catch {
    return 128;
  }
};

const getStabilityScore = (
  box,
  noseRatio,
  yawDegrees,
) => {
  if (!previousFace) {
    previousFace = {
      centerX: box.centerX,
      centerY: box.centerY,
      width: box.width,
      height: box.height,
      noseRatio,
      yawDegrees,
    };

    movementHistory = [];
    return 55;
  }

  const centerMovement = Math.hypot(
    box.centerX - previousFace.centerX,
    box.centerY - previousFace.centerY,
  );

  const sizeMovement = Math.abs(
    box.height - previousFace.height,
  );

  const noseMovement = Math.abs(
    noseRatio - previousFace.noseRatio,
  );

  const yawMovement =
    Number.isFinite(yawDegrees) &&
    Number.isFinite(previousFace.yawDegrees)
      ? Math.abs(
          yawDegrees - previousFace.yawDegrees,
        ) / 90
      : 0;

  const movement =
    centerMovement * 3.1 +
    sizeMovement * 1.8 +
    noseMovement * 0.8 +
    yawMovement * 0.6;

  movementHistory.push(movement);

  if (movementHistory.length > 6) {
    movementHistory.shift();
  }

  const averageMovement =
    movementHistory.reduce(
      (sum, value) => sum + value,
      0,
    ) /
    Math.max(1, movementHistory.length);

  previousFace = {
    centerX: box.centerX,
    centerY: box.centerY,
    width: box.width,
    height: box.height,
    noseRatio,
    yawDegrees,
  };

  if (movementHistory.length < 3) {
    return 65;
  }

  return clamp(
    100 - averageMovement * 1650,
  );
};

const resetTrackingState = () => {
  movementHistory = [];
  previousFace = null;

  lastAnalysisAt = 0;
  lastAnalysisResult = null;
  activeAnalysisPromise = null;
};

const createLandmarkerWithDelegate = async (
  delegate,
) => {
  const vision =
    await FilesetResolver.forVisionTasks(
      WASM_ROOT,
    );

  return FaceLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    },
  );
};

const ensureLandmarker = async () => {
  if (faceLandmarker) {
    return faceLandmarker;
  }

  if (initializing) {
    return initializing;
  }

  initializing = (async () => {
    try {
      faceLandmarker =
        await createLandmarkerWithDelegate(
          "GPU",
        );

      return faceLandmarker;
    } catch (gpuError) {
      console.warn(
        "MediaPipe GPU delegate unavailable; using CPU.",
        gpuError,
      );

      try {
        faceLandmarker =
          await createLandmarkerWithDelegate(
            "CPU",
          );

        return faceLandmarker;
      } catch (cpuError) {
        console.error(
          "Unable to initialize MediaPipe face guidance.",
          cpuError,
        );

        throw cpuError;
      }
    }
  })();

  try {
    return await initializing;
  } finally {
    initializing = null;
  }
};

const buildNoFaceResult = (faceCount) => ({
  available: true,
  faceCount,
  readiness: 0,
  position: 0,
  lighting: 0,
  stability: 0,
  frontal: 0,
  guidanceKey:
    faceCount > 1
      ? "MULTIPLE_FACES"
      : "NO_FACE",
  guidance:
    faceCount > 1
      ? "Only one person should be visible."
      : "Position your face inside the guide.",
  ready: false,
  eyesOpen: false,
  blinkScore: 0,
  noseRatio: 0.5,
  yawDegrees: null,
});

const analyzePreparedFrame = async (
  source,
  timestampMs,
) => {
  const task = await ensureLandmarker();

  const result = task.detectForVideo(
    source,
    timestampMs,
  );

  const faces =
    result?.faceLandmarks || [];

  const faceCount = faces.length;

  if (faceCount !== 1) {
    movementHistory = [];
    previousFace = null;

    return buildNoFaceResult(faceCount);
  }

  const landmarks = faces[0];
  const box = getBoundingBox(landmarks);

  if (!box) {
    movementHistory = [];
    previousFace = null;

    return {
      available: true,
      faceCount: 1,
      readiness: 0,
      position: 0,
      lighting: 0,
      stability: 0,
      frontal: 0,
      guidanceKey: "FACE_UNCLEAR",
      guidance:
        "Keep your whole face visible.",
      ready: false,
      eyesOpen: false,
      blinkScore: 0,
      noseRatio: 0.5,
      yawDegrees: null,
    };
  }

  const nose =
    landmarks[1] ||
    landmarks[4] ||
    landmarks[0];

  const rawNoseX = Number(
    nose?.x ?? box.centerX,
  );

  const noseRatio = clamp(
    (rawNoseX - box.minX) /
      Math.max(0.0001, box.width),
    0,
    1,
  );

  const yawDegrees =
    getYawDegrees(result);

  const centerDistance = Math.hypot(
    (box.centerX - 0.5) / 0.26,
    (box.centerY - 0.47) / 0.31,
  );

  const centerScore = clamp(
    100 - centerDistance * 100,
  );

  const sizeScore =
    rangeScore(
      box.height,
      0.39,
      0.67,
      0.24,
      0.82,
    ) *
      0.7 +
    rangeScore(
      box.width,
      0.27,
      0.54,
      0.18,
      0.7,
    ) *
      0.3;

  const frontalByNose = clamp(
    100 -
      Math.abs(noseRatio - 0.5) * 520,
  );

  const frontalByYaw =
    Number.isFinite(yawDegrees)
      ? clamp(
          100 -
            Math.max(
              0,
              Math.abs(yawDegrees) - 4,
            ) *
              5.2,
        )
      : frontalByNose;

  const frontal =
    frontalByNose * 0.55 +
    frontalByYaw * 0.45;

  const brightness =
    getFaceBrightness(source, box);

  const lighting = rangeScore(
    brightness,
    82,
    194,
    48,
    232,
  );

  const stability =
    getStabilityScore(
      box,
      noseRatio,
      yawDegrees,
    );

  const position = clamp(
    centerScore * 0.48 +
      sizeScore * 0.27 +
      frontal * 0.25,
  );

  let readiness = clamp(
    position * 0.56 +
      lighting * 0.18 +
      stability * 0.26,
  );

  if (movementHistory.length < 3) {
    readiness = Math.min(
      readiness,
      86,
    );
  }

  const blinkLeft =
    getBlendshapeScore(
      result,
      "eyeBlinkLeft",
    );

  const blinkRight =
    getBlendshapeScore(
      result,
      "eyeBlinkRight",
    );

  const blinkScore = clamp(
    ((blinkLeft + blinkRight) / 2) *
      100,
    0,
    100,
  );

  const eyesOpen =
    blinkScore < 28;

  let guidanceKey = "READY";
  let guidance =
    "Great. Hold that position.";

  if (box.height < 0.34) {
    guidanceKey = "MOVE_CLOSER";
    guidance =
      "Move a little closer.";
  } else if (box.height > 0.72) {
    guidanceKey = "MOVE_BACK";
    guidance =
      "Move slightly farther back.";
  } else if (centerScore < 76) {
    guidanceKey = "CENTER_FACE";
    guidance =
      "Center your face inside the guide.";
  } else if (frontal < 78) {
    guidanceKey = "LOOK_STRAIGHT";
    guidance =
      "Look straight at the camera.";
  } else if (lighting < 64) {
    guidanceKey =
      brightness < 82
        ? "MORE_LIGHT"
        : "LESS_LIGHT";

    guidance =
      brightness < 82
        ? "Move to brighter front lighting."
        : "Reduce the strong light on your face.";
  } else if (stability < 72) {
    guidanceKey = "HOLD_STILL";
    guidance =
      "Hold still for a moment.";
  } else if (readiness < 90) {
    guidanceKey = "ALMOST_READY";
    guidance =
      "Almost ready. Keep that position.";
  }

  return {
    available: true,
    faceCount,

    readiness:
      Math.round(readiness),

    position:
      Math.round(position),

    lighting:
      Math.round(lighting),

    stability:
      Math.round(stability),

    frontal:
      Math.round(frontal),

    guidanceKey,
    guidance,

    ready:
      readiness >= 90,

    eyesOpen,

    blinkScore:
      Math.round(blinkScore),

    noseRatio,
    yawDegrees,

    faceHeight:
      box.height,

    faceWidth:
      box.width,

    centerX:
      box.centerX,

    centerY:
      box.centerY,
  };
};

const analyzeVideoFrame = async (
  video,
) => {
  if (!video) {
    throw new Error(
      "Camera preview is unavailable.",
    );
  }

  if (
    video.readyState < 2 ||
    video.videoWidth <= 0 ||
    video.videoHeight <= 0
  ) {
    throw new Error(
      "Camera frame is not ready yet.",
    );
  }

  const now = performance.now();

  if (
    lastAnalysisResult &&
    now - lastAnalysisAt <
      ANALYSIS_MIN_INTERVAL_MS
  ) {
    return lastAnalysisResult;
  }

  if (activeAnalysisPromise) {
    return activeAnalysisPromise;
  }

  activeAnalysisPromise = (async () => {
    const preparedFrame =
      prepareAnalysisFrame(video);

    const timestamp =
      performance.now();

    const result =
      await analyzePreparedFrame(
        preparedFrame,
        timestamp,
      );

    lastAnalysisAt =
      performance.now();

    lastAnalysisResult = result;

    return result;
  })();

  try {
    return await activeAnalysisPromise;
  } finally {
    activeAnalysisPromise = null;
  }
};

const ensureReady = async () => {
  await ensureLandmarker();
  return true;
};

const isSupported = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof HTMLCanvasElement !==
    "undefined" &&
  typeof performance !== "undefined";

const resetTracking = () => {
  resetTrackingState();
};

const destroy = () => {
  resetTrackingState();

  try {
    faceLandmarker?.close?.();
  } catch {
    // Ignore cleanup failures.
  }

  faceLandmarker = null;
  initializing = null;

  analysisCanvas = null;
  analysisContext = null;

  brightnessCanvas = null;
  brightnessContext = null;
};

const faceReadiness = {
  isSupported,
  ensureReady,
  analyzeVideoFrame,
  resetTracking,
  destroy,
};

export default faceReadiness;