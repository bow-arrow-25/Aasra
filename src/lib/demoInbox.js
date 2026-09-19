import { onChildAdded, ref } from "firebase/database";
import { getFirebaseDb, hasFirebaseConfig } from "./firebase";

const seenSms = new Set();
const seenCalls = new Set();

const SMS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CALL_MAX_AGE_MS = 5 * 60 * 1000;

export function parseInboxTime(value) {
  if (value == null || value === "") return Date.now();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 1e12 ? Math.round(value * 1000) : value;
  }
  const raw = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n > 0 && n < 1e12 ? Math.round(n * 1000) : n;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function normalizeInboxSms(key, value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    id: `demo-sms-${key}`,
    sender: String(data.sender || data.from || data.number || "Unknown").trim() || "Unknown",
    body: String(data.body || data.text || data.message || "").trim(),
    time: parseInboxTime(data.time),
  };
}

export function normalizeInboxCall(key, value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    id: `demo-call-${key}`,
    number: String(data.number || data.from || data.sender || "Unknown").trim() || "Unknown",
    time: parseInboxTime(data.time),
  };
}

export function listenDemoInbox({ onSms, onCall } = {}) {
  if (!hasFirebaseConfig()) return () => {};
  const db = getFirebaseDb();
  if (!db) return () => {};

  const smsRef = ref(db, "demoInbox/sms");
  const callsRef = ref(db, "demoInbox/calls");
  const now = Date.now();

  const stopSms = onChildAdded(
    smsRef,
    (snap) => {
      if (!snap.exists() || seenSms.has(snap.key)) return;
      seenSms.add(snap.key);
      const item = normalizeInboxSms(snap.key, snap.val());
      if (!item.body) return;
      if (item.time < now - SMS_MAX_AGE_MS) return;
      onSms?.(item);
    },
    (error) => {
      console.warn("demoInbox SMS listen failed", error);
    }
  );

  const stopCalls = onChildAdded(
    callsRef,
    (snap) => {
      if (!snap.exists() || seenCalls.has(snap.key)) return;
      seenCalls.add(snap.key);
      const item = normalizeInboxCall(snap.key, snap.val());
      if (!item.number || item.number === "Unknown") return;
      if (item.time < now - CALL_MAX_AGE_MS) return;
      onCall?.(item);
    },
    (error) => {
      console.warn("demoInbox calls listen failed", error);
    }
  );

  return () => {
    stopSms();
    stopCalls();
  };
}
