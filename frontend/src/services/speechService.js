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

/* =========================================================
   VOICE SELECTION
========================================================= */

/**
 * Prefer:
 * 1. Philippine English female voice
 * 2. Natural English female voice
 * 3. Any Philippine English voice
 * 4. Preferred English locales
 * 5. Any English voice
 *
 * Available voices depend on the browser and operating system.
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

  /* ---------------------------------------------------------
     1. Philippine English female
  --------------------------------------------------------- */

  const femalePhilippineEnglishVoice = voices.find(
    (voice) => /^en-PH$/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femalePhilippineEnglishVoice) {
    return femalePhilippineEnglishVoice;
  }

  /* ---------------------------------------------------------
     2. Other English female voices
  --------------------------------------------------------- */

  const femaleEnglishVoice = voices.find(
    (voice) => /^en/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femaleEnglishVoice) {
    return femaleEnglishVoice;
  }

  /* ---------------------------------------------------------
     3. Any Philippine English voice
  --------------------------------------------------------- */

  const philippineEnglishVoice = voices.find((voice) =>
    /^en-PH$/i.test(voice.lang),
  );

  if (philippineEnglishVoice) {
    return philippineEnglishVoice;
  }

  /* ---------------------------------------------------------
     4. Preferred English locales
  --------------------------------------------------------- */

  const preferredEnglishVoice = voices.find((voice) =>
    /^en-(US|GB|AU)$/i.test(voice.lang),
  );

  if (preferredEnglishVoice) {
    return preferredEnglishVoice;
  }

  /* ---------------------------------------------------------
     5. Any English voice
  --------------------------------------------------------- */

  const englishVoice = voices.find((voice) => /^en/i.test(voice.lang));

  if (englishVoice) {
    return englishVoice;
  }

  return voices[0] || null;
};

/* =========================================================
   SPEAK
========================================================= */

const speak = (
  text,
  {
    interrupt = true,

    /*
     * Slightly slower speech for clearer
     * names and camera instructions.
     */
    rate = 0.8,

    /*
     * Slightly raised pitch.
     * The selected voice determines most
     * of the voice's natural character.
     */
    pitch = 1.03,

    volume = 1,

    /*
     * Philippine English language hint.
     */
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

  /*
   * Helps Chrome recover if speech synthesis
   * temporarily enters a paused state.
   */
  window.speechSynthesis.resume();

  const utterance = new SpeechSynthesisUtterance(message);

  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  utterance.lang = lang;

  const voice = pickVoice();

  if (voice) {
    utterance.voice = voice;

    /*
     * Use the selected voice's actual language.
     * This prevents browser inconsistencies.
     */
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

/* =========================================================
   LIVENESS / CHALLENGE INSTRUCTIONS
========================================================= */

const challengeInstruction = (challengeType, studentName = "Student") => {
  const name = String(studentName || "Student").trim() || "Student";

  switch (String(challengeType || "").toUpperCase()) {
    case "BLINK":
      return `${name}, please blink once now.`;

    case "TURN_LEFT":
      return `${name}, slowly turn your head to the left.`;

    case "TURN_RIGHT":
      return `${name}, slowly turn your head to the right.`;

    default:
      return `${name}, please follow the instruction shown on the screen.`;
  }
};

/* =========================================================
   FACE ENROLLMENT
========================================================= */

const announceEnrollmentReady = (studentName) =>
  speak(
    `${
      studentName || "Student"
    }, look directly at the camera. Keep your eyes open and remain still.`,
  );

const announceChallenge = (studentName, challengeType) =>
  speak(challengeInstruction(challengeType, studentName));

const announceEnrollmentSuccess = (studentName) =>
  speak(
    `${studentName || "Student"}, your face has been successfully registered.`,
  );

/* =========================================================
   FACE CONFLICT
========================================================= */

const announceConflict = (studentName) =>
  speak(
    `Identity verification is required for ${studentName || "this student"}.`,
  );

const announceLivenessFailure = () =>
  speak("Live face verification could not be confirmed. Please try again.");

const announceManualReview = () =>
  speak("Live verification was successful. Adviser review is now required.");

const announceDifferentPeople = (studentName) =>
  speak(
    `The two faces have been confirmed as different people. One final live scan is required to save the face registration for ${
      studentName || "this student"
    }.`,
  );

const announceSamePerson = (studentName) =>
  speak(
    `The identity review is complete. A separate face enrollment cannot be created for ${
      studentName || "this student"
    }.`,
  );

/* =========================================================
   ATTENDANCE RESULT
========================================================= */

const announceAttendanceResult = ({ studentName, name, status } = {}) => {
  const resolvedName =
    String(studentName || name || "Student").trim() || "Student";

  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "LATE") {
    return speak(`${resolvedName}, you are marked late.`);
  }

  if (normalizedStatus === "PRESENT") {
    return speak(`${resolvedName}, you are marked present.`);
  }

  return speak(`${resolvedName}, your attendance has been recorded.`);
};

/* =========================================================
   EXPORT
========================================================= */

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