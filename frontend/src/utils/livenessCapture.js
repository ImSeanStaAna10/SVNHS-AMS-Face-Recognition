const sleep = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const waitForVideoReady = async (video, { timeoutMs = 5000 } = {}) => {
  if (!video) throw new Error("Camera preview is unavailable.");
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
    await sleep(50);
  }
  throw new Error("Camera is taking too long to become ready.");
};

const canvasToFile = (canvas, filename, { quality = 0.86 } = {}) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Unable to capture a liveness frame."));
      resolve(new File([blob], filename, { type: "image/jpeg" }));
    }, "image/jpeg", quality);
  });

const captureVideoFrame = async (
  video,
  { prefix = "frame", index = 0, maxWidth = 960, quality = 0.86 } = {},
) => {
  await waitForVideoReady(video);
  const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Unable to prepare the liveness frame.");
  context.drawImage(video, 0, 0, width, height);
  return canvasToFile(
    canvas,
    `${prefix}-${String(index + 1).padStart(2, "0")}-${Date.now()}.jpg`,
    { quality },
  );
};

const captureFrameBurst = async (
  video,
  { count, intervalMs, prefix, isCancelled = () => false, onProgress },
) => {
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    if (isCancelled()) throw new Error("Liveness capture was cancelled.");
    const frame = await captureVideoFrame(video, { prefix, index });
    frames.push(frame);
    onProgress?.(index + 1, count, frame);
    if (index < count - 1) await sleep(intervalMs);
  }
  return frames;
};

const createPreviewUrl = (file) => (file ? URL.createObjectURL(file) : "");

export { sleep, waitForVideoReady, captureVideoFrame, captureFrameBurst, createPreviewUrl };
