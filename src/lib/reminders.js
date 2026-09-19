export const REMINDER_TYPES = ["medicine", "checkin", "call", "custom"];

export const REMINDER_STATUS = {
  SCHEDULED: "SCHEDULED",
  DUE: "DUE",
  DONE: "DONE",
  MISSED: "MISSED",
};

export const QUICK_CHIPS = [
  { id: "1m", label: "1 min", ms: 60 * 1000 },
  { id: "5m", label: "5 min", ms: 5 * 60 * 1000 },
  { id: "30m", label: "30 min", ms: 30 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function reminderMissMs(demoMode) {
  return demoMode ? 20_000 : 5 * 60 * 1000;
}

export function normalizeReminderType(type) {
  return REMINDER_TYPES.includes(type) ? type : "custom";
}

export function typeLabel(type) {
  if (type === "medicine") return "medicine";
  if (type === "checkin") return "check-in";
  if (type === "call") return "call";
  return "custom";
}

export function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = date.getMinutes();
  let hours = date.getHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  if (!minutes) return `${hours} ${suffix}`;
  return `${hours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDueStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatCountdown(dueAt, now = Date.now()) {
  const delta = Number(dueAt) - Number(now);
  if (delta <= 0) {
    const late = Math.abs(delta);
    if (late < 15_000) return "Due now";
    return `${formatSpan(late)} late`;
  }
  return `in ${formatSpan(delta)}`;
}

function formatSpan(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function isSameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function nextDailyDueAt(dueAt, now = Date.now()) {
  let next = Number(dueAt) + DAY_MS;
  while (next <= now) next += DAY_MS;
  return next;
}

export function nextDailyReminder(reminder, now, id) {
  const seriesId = reminder.seriesId || reminder.id;
  const dueAt = nextDailyDueAt(reminder.dueAt, now);
  return {
    id: id || `${seriesId}-${dueAt}`,
    seriesId,
    title: reminder.title,
    type: reminder.type,
    dueAt,
    repeat: "daily",
    note: reminder.note || "",
    createdBy: reminder.createdBy,
    status: REMINDER_STATUS.SCHEDULED,
    doneAt: null,
  };
}

export function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value) {
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

export function todaysReminders(reminders, now = Date.now()) {
  return (reminders || [])
    .filter((item) => {
      if (item.status === REMINDER_STATUS.DUE) return true;
      return isSameDay(item.dueAt, now);
    })
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function dueReminders(reminders) {
  return (reminders || [])
    .filter((item) => item.status === REMINDER_STATUS.DUE)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function missedCount(reminders) {
  return (reminders || []).filter(
    (item) =>
      item.status === REMINDER_STATUS.DUE || item.status === REMINDER_STATUS.MISSED
  ).length;
}

export function missedMessage(parentName, reminder) {
  const name = parentName || "Amma";
  const time = formatClock(reminder.dueAt);
  const kind = reminder.type === "custom" && reminder.title
    ? reminder.title
    : typeLabel(reminder.type);
  return `${name} missed her ${time} ${kind} reminder`;
}

export function statusRank(status) {
  if (status === REMINDER_STATUS.SCHEDULED) return 0;
  if (status === REMINDER_STATUS.DUE) return 1;
  if (status === REMINDER_STATUS.DONE || status === REMINDER_STATUS.MISSED) return 2;
  return 0;
}
