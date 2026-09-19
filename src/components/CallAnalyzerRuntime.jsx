import { useEffect, useRef } from "react";
import { DIGITAL_ARREST_SCRIPT } from "../lib/callAnalyzer";
import { getClientId } from "../lib/sync";
import { speak, speechLangCode } from "../lib/speak";
import { useGlobalState } from "../context/GlobalState";

const FLUSH_MS = 2000;

export default function CallAnalyzerRuntime() {
  const { activeCall, lang, appendCallTranscript } = useGlobalState();
  const callId = activeCall?.id;
  const answered = Boolean(activeCall?.answered);
  const mode = activeCall?.analyzerMode === "scripted" ? "scripted" : "live";
  const speakCaller = Boolean(activeCall?.speakCaller);
  const pendingRef = useRef([]);
  const flushTimerRef = useRef(0);
  const appendRef = useRef(appendCallTranscript);
  const speakCallerRef = useRef(speakCaller);
  const langRef = useRef(lang);
  appendRef.current = appendCallTranscript;
  speakCallerRef.current = speakCaller;
  langRef.current = lang;
  const isProducer = Boolean(
    activeCall?.producerClientId && activeCall.producerClientId === getClientId()
  );
  const stoppedByRisk = (activeCall?.analysis?.riskScore ?? 0) >= 60;

  useEffect(() => {
    function flush() {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = 0;
      const batch = pendingRef.current;
      pendingRef.current = [];
      if (batch.length) appendRef.current(batch);
    }

    function queueLine(line) {
      const text = String(line?.text || "").trim();
      if (!text) return;
      pendingRef.current.push({
        speaker: line.speaker || "heard",
        text,
        time: line.time || Date.now(),
      });
      if (line.flushNow) {
        flush();
        return;
      }
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(flush, FLUSH_MS);
      }
    }

    if (!callId || !answered || !isProducer || stoppedByRisk) {
      return () => {
        flush();
      };
    }

    let cancelled = false;

    if (mode === "scripted") {
      const timers = DIGITAL_ARREST_SCRIPT.map((line) =>
        window.setTimeout(() => {
          if (cancelled) return;
          queueLine({
            speaker: line.speaker,
            text: line.text,
            time: Date.now(),
            flushNow: /digital arrest|share the code|verification deposit/i.test(
              line.text
            ),
          });
          if (speakCallerRef.current && line.speaker === "caller") {
            speak(line.text, langRef.current);
          }
        }, line.at)
      );

      return () => {
        cancelled = true;
        timers.forEach((timer) => window.clearTimeout(timer));
        flush();
      };
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return () => {
        flush();
      };
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLangCode(langRef.current);
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;
        const text = String(result[0]?.transcript || "").trim();
        if (text) queueLine({ speaker: "heard", text, time: Date.now() });
      }
    };
    recognition.onend = () => {
      if (cancelled) return;
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    };

    try {
      recognition.start();
    } catch {
      /* mic busy or unsupported */
    }

    return () => {
      cancelled = true;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      flush();
    };
  }, [callId, answered, isProducer, stoppedByRisk, mode]);

  return null;
}
