import { useEffect, useRef } from "react";
import { DIGITAL_ARREST_SCRIPT } from "../lib/callAnalyzer";
import {
  armSpeechListen,
  setSpeechListenHandler,
  stopSpeechListen,
} from "../lib/speechListen";
import { speak } from "../lib/speak";
import { useGlobalState } from "../context/GlobalState";

export default function CallAnalyzerRuntime() {
  const { activeCall, lang, appendCallTranscript } = useGlobalState();
  const callId = activeCall?.id;
  const answered = Boolean(activeCall?.answered);
  const answeredAt = Number(activeCall?.answeredAt || 0);
  const mode = activeCall?.analyzerMode === "scripted" ? "scripted" : "live";
  const speakCaller = Boolean(activeCall?.speakCaller);
  const appendRef = useRef(appendCallTranscript);
  const speakCallerRef = useRef(speakCaller);
  const langRef = useRef(lang);
  const seenRef = useRef(new Set());
  appendRef.current = appendCallTranscript;
  speakCallerRef.current = speakCaller;
  langRef.current = lang;
  const stoppedByRisk = (activeCall?.analysis?.riskScore ?? 0) >= 60;

  useEffect(() => {
    seenRef.current = new Set();
  }, [callId]);

  useEffect(() => {
    function queueLine(line) {
      const text = String(line?.text || "").trim();
      if (!text) return;
      const key = `${line.speaker || "heard"}:${text.toLowerCase()}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      appendRef.current({
        speaker: line.speaker || "heard",
        text,
        time: line.time || Date.now(),
      });
    }

    if (!callId) {
      stopSpeechListen();
      return undefined;
    }

    if (stoppedByRisk) {
      stopSpeechListen();
      return undefined;
    }

    if (mode === "scripted") {
      if (!answered) return undefined;
      stopSpeechListen();
      const origin = answeredAt || Date.now();
      const timers = DIGITAL_ARREST_SCRIPT.map((line) => {
        const wait = Math.max(0, origin + line.at - Date.now());
        return window.setTimeout(() => {
          queueLine({
            speaker: line.speaker,
            text: line.text,
            time: Date.now(),
          });
          if (speakCallerRef.current && line.speaker === "caller") {
            speak(line.text, langRef.current);
          }
        }, wait);
      });
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    setSpeechListenHandler((text) => {
      queueLine({ speaker: "heard", text, time: Date.now() });
    });
    armSpeechListen(langRef.current);
    return undefined;
  }, [callId, answered, answeredAt, stoppedByRisk, mode]);

  return null;
}
