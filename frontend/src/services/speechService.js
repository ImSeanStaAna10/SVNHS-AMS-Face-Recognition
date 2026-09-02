const STORAGE_KEY = "svnhs_voice_guidance_enabled";

const isSupported = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

const getEnabled = () => {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);

  return stored === null ? true : stored === "true";
};

const setEnabled = (enabled) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(Boolean(enabled)));
  }

  if (!enabled && isSupported()) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Prefer natural-sounding female voices when available.
 *
 * Browser / operating-system voices differ per device,
 * so this is intentionally preference-based with safe
 * fallbacks.
 */
const pickVoice = () => {
  if (!isSupported()) return null;

  const voices = window.speechSynthesis.getVoices();

  if (!voices.length) return null;

  const femaleVoiceNames = [
    "aria",
    "jenny",
    "zira",
    "samantha",
    "victoria",
    "karen",
    "moira",
    "susan",
    "hazel",
    "female",
  ];

  const isFemalePreferred = (voice) => {
    const voiceName = String(voice?.name || "").toLowerCase();

    return femaleVoiceNames.some((preferredName) =>
      voiceName.includes(preferredName),
    );
  };

  // ---------------------------------------------------------
  // 1. Female Philippine-English voice
  // ---------------------------------------------------------

  const femalePhilippineVoice = voices.find(
    (voice) => /^en-PH$/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femalePhilippineVoice) {
    return femalePhilippineVoice;
  }

  // ---------------------------------------------------------
  // 2. Other natural English female voices
  // ---------------------------------------------------------

  const femaleEnglishVoice = voices.find(
    (voice) => /^en/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femaleEnglishVoice) {
    return femaleEnglishVoice;
  }

  // ---------------------------------------------------------
  // 3. Any Philippine-English voice
  // ---------------------------------------------------------

  const philippineVoice = voices.find((voice) => /^en-PH$/i.test(voice.lang));

  if (philippineVoice) {
    return philippineVoice;
  }

  // ---------------------------------------------------------
  // 4. Preferred English locales
  // ---------------------------------------------------------

  const preferredEnglishVoice = voices.find((voice) =>
    /^en-(US|GB|AU)$/i.test(voice.lang),
  );

  if (preferredEnglishVoice) {
    return preferredEnglishVoice;
  }

  // ---------------------------------------------------------
  // 5. Any English voice
  // ---------------------------------------------------------

  const englishVoice = voices.find((voice) => /^en/i.test(voice.lang));

  if (englishVoice) {
    return englishVoice;
  }

  return voices[0] || null;
};

const speak = (
  text,
  {
    interrupt = true,

    // Slower than before so names and instructions
    // are pronounced more completely.
    rate = 0.88,

    // Slightly raised pitch for a softer/feminine sound
    // without making it unnaturally high.
    pitch = 1.04,

    volume = 1,
    lang = "en-PH",
  } = {},
) => {
  const message = String(text || "").trim();

  if (!message || !getEnabled() || !isSupported()) {
    return false;
  }

  if (interrupt) {
    window.speechSynthesis.cancel();
  }

  // Helps recover speech synthesis if Chrome has
  // temporarily paused it.
  window.speechSynthesis.resume();

  const utterance = new SpeechSynthesisUtterance(message);

  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  utterance.lang = lang;

  const voice = pickVoice();

  if (voice) {
    utterance.voice = voice;

    // Use the selected voice's real language where available.
    if (voice.lang) {
      utterance.lang = voice.lang;
    }
  }

  window.speechSynthesis.speak(utterance);

  return true;
};

const stop = () => {
  if (isSupported()) {
    window.speechSynthesis.cancel();
  }
};

const challengeInstruction = (challengeType, studentName = "Student") => {
  const name = String(studentName || "Student").trim();

  switch (String(challengeType || "").toUpperCase()) {
    case "BLINK":
      return `${name}, blink once now.`;

    case "TURN_LEFT":
      return `${name}, slowly turn your head to the left now.`;

    case "TURN_RIGHT":
      return `${name}, slowly turn your head to the right now.`;

    default:
      return `${name}, follow the instruction shown on the screen now.`;
  }
};

const announceEnrollmentReady = (studentName) =>
  speak(
    `${
      studentName || "Student"
    }, look straight at the camera, and keep your eyes open.`,
  );

const announceChallenge = (studentName, challengeType) =>
  speak(challengeInstruction(challengeType, studentName));

const announceEnrollmentSuccess = (studentName) =>
  speak(`${studentName || "Student"}, face enrollment complete.`);

const announceConflict = (studentName) =>
  speak(
    `Identity verification is required for ${studentName || "this student"}.`,
  );

const announceLivenessFailure = () =>
  speak("Live face verification failed. Please try again.");

const announceManualReview = () =>
  speak("Live verification passed. Adviser identity review is required.");

const announceDifferentPeople = (studentName) =>
  speak(
    `Identity confirmed as different people. One final live scan will save ${
      studentName || "the student's"
    } face.`,
  );

const announceSamePerson = (studentName) =>
  speak(
    `Identity review complete. Separate face enrollment is blocked for ${
      studentName || "this student"
    }.`,
  );

const announceAttendanceResult = ({ studentName, name, status } = {}) => {
  const resolvedName =
    String(studentName || name || "Student").trim() || "Student";

  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "LATE") {
    return speak(`${resolvedName}, late.`);
  }

  if (normalizedStatus === "PRESENT") {
    return speak(`${resolvedName}, present.`);
  }

  return speak(`${resolvedName}, attendance recorded.`);
};

export default {
  isSupported,
  getEnabled,
  setEnabled,
  speak,
  stop,
  challengeInstruction,

  announceEnrollmentReady,
  announceChallenge,
  announceEnrollmentSuccess,

  announceConflict,
  announceLivenessFailure,
  announceManualReview,

  announceDifferentPeople,
  announceSamePerson,
  announceAttendanceResult,
};
