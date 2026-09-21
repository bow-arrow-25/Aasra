export const BADGE = {
  INFO: "bg-emerald-100 text-emerald-800",
  WARN: "bg-amber-100 text-amber-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export function formatTime(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function checkInTone(lastCheckIn) {
  if (!lastCheckIn) return "CRITICAL";
  const hours = (Date.now() - lastCheckIn) / (1000 * 60 * 60);
  if (hours <= 12) return "INFO";
  return "WARN";
}

export function liveStatus({ lastCheckIn, openCritical }) {
  if (openCritical > 0) {
    return { tone: "CRITICAL", label: `${openCritical} critical` };
  }
  const tone = checkInTone(lastCheckIn);
  if (tone === "INFO") return { tone, label: "Safe" };
  if (tone === "WARN") return { tone, label: "Check-in overdue" };
  return { tone, label: "Waiting for check-in" };
}
