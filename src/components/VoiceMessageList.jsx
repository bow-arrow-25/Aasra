import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useGlobalState } from "../context/GlobalState";

const DEFAULT_NAMES = {
  parent: "Parent",
  family: "Family",
};

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `0:${String(value).padStart(2, "0")}`;
}

function formatTime(time) {
  return new Date(time).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VoiceMessageList({
  messages,
  viewer,
  senderNames = DEFAULT_NAMES,
  emptyText = "No voice messages yet.",
  largeControls = false,
}) {
  const { markVoiceMessageHeard } = useGlobalState();
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  function stopCurrent() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
    setPlayingId(null);
  }

  function togglePlayback(message) {
    if (playingId === message.id) {
      stopCurrent();
      return;
    }

    stopCurrent();
    const audio = new Audio(message.dataUrl);
    audioRef.current = audio;
    setPlayingId(message.id);
    if (message.from !== viewer && !message.heard) {
      markVoiceMessageHeard(message.id);
    }
    audio.onended = () => {
      audioRef.current = null;
      setPlayingId(null);
    };
    audio.onerror = () => {
      audioRef.current = null;
      setPlayingId(null);
    };
    audio.play().catch(() => {
      audioRef.current = null;
      setPlayingId(null);
    });
  }

  useEffect(() => () => stopCurrent(), []);

  if (messages.length === 0) {
    return <p className="text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => {
        const incoming = message.from !== viewer;
        const playing = playingId === message.id;
        return (
          <li
            key={message.id}
            className={`flex ${incoming ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-full min-w-0 rounded-2xl px-4 py-3 ${
                incoming
                  ? "bg-white text-slate-900 ring-1 ring-slate-200"
                  : "bg-teal text-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">
                  {senderNames[message.from] || message.from}
                </span>
                <span className={incoming ? "text-slate-500" : "text-teal-50"}>
                  {formatTime(message.time)}
                </span>
                {incoming && !message.heard ? (
                  <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950">
                    New
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => togglePlayback(message)}
                className={`mt-2 flex items-center gap-2 rounded-xl font-bold ${
                  largeControls
                    ? "min-h-16 w-full justify-center px-6 text-2xl"
                    : "px-3 py-2"
                } ${
                  incoming
                    ? "bg-teal text-white"
                    : "bg-white/20 text-white"
                }`}
                aria-label={`${playing ? "Pause" : "Play"} voice message from ${
                  senderNames[message.from] || message.from
                }`}
              >
                <span aria-hidden="true">
                  {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                </span>
                <span>{playing ? "Pause" : "Play"}</span>
                <span>{formatDuration(message.durationSec)}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
