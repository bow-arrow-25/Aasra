import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useGlobalState } from "../context/GlobalState";

const MAX_SECONDS = 30;
const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

const DEFAULT_LABELS = {
  idle: "Hold to record or tap to start",
  recording: "Recording",
  stop: "Tap to stop",
  permissionDenied:
    "Microphone permission was denied. Allow microphone access and try again.",
  unsupported: "Voice recording is not supported in this browser.",
  failed: "Recording could not start. Please try again.",
};

function selectMimeType() {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function VoiceRecorder({ from, labels = {} }) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const { sendVoiceMessage } = useGlobalState();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const pointerStartedAtRef = useRef(0);
  const pointerDownRef = useRef(false);
  const intervalRef = useRef(null);
  const stoppingRef = useRef(false);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearTimer() {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive" || stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimer();
    recorder.stop();
  }

  async function startRecording() {
    if (recording || recorderRef.current?.state === "recording") return;
    setError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(copy.unsupported);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = selectMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      chunksRef.current = [];
      stoppingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError(copy.failed);
        clearTimer();
        stopTracks();
        setRecording(false);
      };

      recorder.onstop = async () => {
        const durationSec = Math.max(
          1,
          Math.min(MAX_SECONDS, Math.ceil((Date.now() - startedAtRef.current) / 1000))
        );
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm",
        });

        clearTimer();
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
        setSeconds(0);

        if (blob.size === 0) {
          setError(copy.failed);
          return;
        }

        try {
          const dataUrl = await blobToDataUrl(blob);
          sendVoiceMessage({ from, dataUrl, durationSec });
        } catch {
          setError(copy.failed);
        }
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setSeconds(0);
      setRecording(true);
      if (
        !pointerDownRef.current &&
        Date.now() - pointerStartedAtRef.current >= 350
      ) {
        stopRecording();
        return;
      }
      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.min(
          MAX_SECONDS,
          Math.floor((Date.now() - startedAtRef.current) / 1000)
        );
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch (caught) {
      stopTracks();
      setRecording(false);
      const denied =
        caught?.name === "NotAllowedError" || caught?.name === "SecurityError";
      setError(denied ? copy.permissionDenied : copy.failed);
    }
  }

  function handlePointerDown(event) {
    event.preventDefault();
    pointerDownRef.current = true;
    if (recorderRef.current?.state === "recording") {
      stopRecording();
      return;
    }
    pointerStartedAtRef.current = Date.now();
    startRecording();
  }

  function handlePointerUp() {
    pointerDownRef.current = false;
    const heldMs = Date.now() - pointerStartedAtRef.current;
    if (recorderRef.current?.state === "recording" && heldMs >= 350) {
      stopRecording();
    }
  }

  useEffect(
    () => () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      stopTracks();
    },
    []
  );

  return (
    <div>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
            event.preventDefault();
            recording ? stopRecording() : startRecording();
          }
        }}
        className={`flex min-h-20 w-full touch-none items-center justify-center gap-3 rounded-2xl px-5 text-center text-xl font-bold text-white ${
          recording ? "bg-red-600" : "bg-teal"
        }`}
        aria-label={recording ? copy.stop : copy.idle}
        aria-pressed={recording}
      >
        <span aria-hidden="true">
          {recording ? <Square className="size-5 fill-current" /> : <Mic className="size-5" />}
        </span>
        <span>
          {recording
            ? `${copy.recording} ${seconds}s / ${MAX_SECONDS}s`
            : copy.idle}
        </span>
      </button>
      {recording ? (
        <p className="mt-2 text-center font-semibold text-red-700">{copy.stop}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
