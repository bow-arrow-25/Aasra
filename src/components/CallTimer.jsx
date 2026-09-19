import { useEffect, useState } from "react";

export function formatCallClock(ms) {
  const elapsed = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function CallTimer({ startedAt, className = "" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const label = startedAt ? formatCallClock(now - startedAt) : "00:00";

  return (
    <p className={`tabular-nums ${className}`} role="timer" aria-live="off">
      {label}
    </p>
  );
}
