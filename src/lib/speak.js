export const LANG_CODES = {
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
};

export function speechLangCode(lang = "en") {
  return LANG_CODES[lang] || LANG_CODES.en;
}

function pickVoice(langCode) {
  const voices = window.speechSynthesis.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang === langCode) ||
    voices.find((voice) => voice.lang.startsWith(langCode.slice(0, 2))) ||
    null
  );
}

export function speak(text, lang = "en") {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
    return;
  }
  if (!text) return;

  const utterance = new window.SpeechSynthesisUtterance(String(text));
  utterance.lang = speechLangCode(lang);
  const voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech can fail on locked or unsupported devices; stay silent.
  }
}
