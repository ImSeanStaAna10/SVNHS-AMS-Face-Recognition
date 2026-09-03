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
 * 1. Filipino / Tagalog female voice
 * 2. Any Filipino / Tagalog voice
 * 3. Natural English female voice
 * 4. Philippine English
 * 5. Other English
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

  const isFilipinoVoice = (voice) => {
    const lang = String(voice?.lang || "").toLowerCase();

    return (
      lang === "fil-ph" ||
      lang === "tl-ph" ||
      lang.startsWith("fil") ||
      lang.startsWith("tl")
    );
  };

  /* ---------------------------------------------------------
     1. Filipino / Tagalog female
  --------------------------------------------------------- */

  const filipinoFemaleVoice = voices.find(
    (voice) => isFilipinoVoice(voice) && isFemalePreferred(voice),
  );

  if (filipinoFemaleVoice) {
    return filipinoFemaleVoice;
  }

  /* ---------------------------------------------------------
     2. Any Filipino / Tagalog voice
  --------------------------------------------------------- */

  const filipinoVoice = voices.find((voice) => isFilipinoVoice(voice));

  if (filipinoVoice) {
    return filipinoVoice;
  }

  /* ---------------------------------------------------------
     3. Philippine English female
  --------------------------------------------------------- */

  const femalePhilippineEnglishVoice = voices.find(
    (voice) => /^en-PH$/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femalePhilippineEnglishVoice) {
    return femalePhilippineEnglishVoice;
  }

  /* ---------------------------------------------------------
     4. Other English female voices
  --------------------------------------------------------- */

  const femaleEnglishVoice = voices.find(
    (voice) => /^en/i.test(voice.lang) && isFemalePreferred(voice),
  );

  if (femaleEnglishVoice) {
    return femaleEnglishVoice;
  }

  /* ---------------------------------------------------------
     5. Any Philippine English voice
  --------------------------------------------------------- */

  const philippineEnglishVoice = voices.find((voice) =>
    /^en-PH$/i.test(voice.lang),
  );

  if (philippineEnglishVoice) {
    return philippineEnglishVoice;
  }

  /* ---------------------------------------------------------
     6. Preferred English locales
  --------------------------------------------------------- */

  const preferredEnglishVoice = voices.find((voice) =>
    /^en-(US|GB|AU)$/i.test(voice.lang),
  );

  if (preferredEnglishVoice) {
    return preferredEnglishVoice;
  }

  /* ---------------------------------------------------------
     7. Any English voice
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
     * 0.80 = slightly slower and clearer.
     * Good for names and camera instructions.
     */
    rate = 0.8,

    /*
     * Slightly raised only.
     * We rely primarily on the selected voice,
     * not pitch alone, for a softer voice.
     */
    pitch = 1.03,

    volume = 1,

    /*
     * Filipino language hint.
     */
    lang = "fil-PH",
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
     * Use the selected voice's real language.
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

const challengeInstruction = (challengeType, studentName = "Mag-aaral") => {
  const name = String(studentName || "Mag-aaral").trim() || "Mag-aaral";

  switch (String(challengeType || "").toUpperCase()) {
    case "BLINK":
      return `${name}, kumurap nang isang beses ngayon.`;

    case "TURN_LEFT":
      return `${name}, dahan-dahang lumingon sa kaliwa.`;

    case "TURN_RIGHT":
      return `${name}, dahan-dahang lumingon sa kanan.`;

    default:
      return `${name}, sundin ang instruksyon na nakikita sa screen.`;
  }
};

/* =========================================================
   FACE ENROLLMENT
========================================================= */

const announceEnrollmentReady = (studentName) =>
  speak(
    `${
      studentName || "Mag-aaral"
    }, tumingin nang diretso sa camera. Panatilihing bukas ang iyong mga mata, at huwag munang gumalaw.`,
  );

const announceChallenge = (studentName, challengeType) =>
  speak(challengeInstruction(challengeType, studentName));

const announceEnrollmentSuccess = (studentName) =>
  speak(
    `${studentName || "Mag-aaral"}, matagumpay na na-register ang iyong mukha.`,
  );

/* =========================================================
   FACE CONFLICT
========================================================= */

const announceConflict = (studentName) =>
  speak(
    `Kailangan ng identity verification para kay ${
      studentName || "ang mag-aaral na ito"
    }.`,
  );

const announceLivenessFailure = () =>
  speak("Hindi nakumpirma ang live face verification. Pakisubukan muli.");

const announceManualReview = () =>
  speak(
    "Nakumpirma ang live verification. Kailangan ngayon ng pagsusuri ng adviser.",
  );

const announceDifferentPeople = (studentName) =>
  speak(
    `Nakumpirma na magkaibang tao ang dalawang mukha. Isang huling live scan ang kailangan para ma-save ang face registration ni ${
      studentName || "ang mag-aaral"
    }.`,
  );

const announceSamePerson = (studentName) =>
  speak(
    `Tapos na ang identity review. Hindi maaaring gumawa ng hiwalay na face enrollment para kay ${
      studentName || "ang mag-aaral na ito"
    }.`,
  );

/* =========================================================
   ATTENDANCE RESULT
========================================================= */

const announceAttendanceResult = ({ studentName, name, status } = {}) => {
  const resolvedName =
    String(studentName || name || "Mag-aaral").trim() || "Mag-aaral";

  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "LATE") {
    return speak(`${resolvedName}, late ka.`);
  }

  if (normalizedStatus === "PRESENT") {
    return speak(`${resolvedName}, present ka.`);
  }

  return speak(`${resolvedName}, naitala na ang iyong attendance.`);
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
