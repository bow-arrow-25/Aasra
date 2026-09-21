import { phraseHits } from "./callAnalyzer";
import { speechLangCode } from "./speak";

let recognition = null;
let cancelled = false;
let handler = null;
let armedLang = "en";

function emit(text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  handler?.(clean);
}

function attachHandlers(instance) {
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 3;
  instance.lang = speechLangCode(armedLang);
  instance.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = String(result[0]?.transcript || "").trim();
      if (!text) continue;
      if (result.isFinal || phraseHits(text).length) emit(text);
    }
  };
  instance.onend = () => {
    if (cancelled) return;
    window.setTimeout(() => {
      if (cancelled || !recognition) return;
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    }, 120);
  };
  instance.onerror = (event) => {
    const error = event?.error || "";
    if (error === "not-allowed" || error === "service-not-allowed") {
      cancelled = true;
    }
  };
}

export function setSpeechListenHandler(nextHandler) {
  handler = nextHandler;
}

export function armSpeechListen(lang = "en", nextHandler) {
  if (nextHandler) handler = nextHandler;
  armedLang = lang || "en";
  cancelled = false;
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;

  if (!recognition) {
    recognition = new SpeechRecognition();
    attachHandlers(recognition);
  } else {
    recognition.lang = speechLangCode(armedLang);
  }

  try {
    recognition.start();
    return true;
  } catch {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (cancelled || !recognition) return;
      try {
        recognition.start();
      } catch {
        /* ignore */
      }
    }, 200);
    return true;
  }
}

export function stopSpeechListen() {
  cancelled = true;
  handler = null;
  try {
    recognition?.stop();
  } catch {
    /* ignore */
  }
  recognition = null;
}
