import { get, off, onChildAdded, push, ref, remove } from "firebase/database";
import { getFirebaseDb, hasFirebaseConfig } from "./firebase";

function readSession(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function createClientId() {
  const existing = readSession("aasra-client-id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  writeSession("aasra-client-id", id);
  return id;
}

const clientId = createClientId();

let mode = "broadcast";
let currentRoom = "";
let currentHousehold = "";
let channel = null;
let actionsRef = null;
let householdRef = null;
let childAddedUnsub = null;
let actionLog = [];

export { hasFirebaseConfig };

export function getClientId() {
  return clientId;
}

export function getSyncMode() {
  return mode;
}

export function createRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

function disconnect() {
  if (actionsRef && childAddedUnsub) {
    off(actionsRef, "child_added", childAddedUnsub);
  }
  childAddedUnsub = null;
  actionsRef = null;
  householdRef = null;
  if (channel) {
    channel.close();
    channel = null;
  }
  currentRoom = "";
  currentHousehold = "";
  actionLog = [];
}

function connectFirebase(householdId, onRemoteAction) {
  const db = getFirebaseDb();
  householdRef = ref(db, `households/${householdId}`);
  actionsRef = ref(db, `households/${householdId}/actions`);
  const applied = new Set();

  function applySnap(snap, { live }) {
    if (!snap.exists() || applied.has(snap.key)) return;
    const action = snap.val();
    if (!action || !action.type) return;
    applied.add(snap.key);
    if (live && action.clientId === clientId) return;
    onRemoteAction(action);
  }

  return get(actionsRef)
    .then((snapshot) => {
      snapshot.forEach((child) => {
        applySnap(child, { live: false });
      });
      childAddedUnsub = onChildAdded(actionsRef, (child) => {
        applySnap(child, { live: true });
      });
    })
    .catch((error) => {
      console.warn("Firebase sync failed, falling back to BroadcastChannel", error);
      mode = "broadcast";
      return connectBroadcast(currentRoom || householdId, onRemoteAction);
    });
}

function connectBroadcast(roomCode, onRemoteAction) {
  actionLog = [];
  const channelName = `aasra-room-${roomCode}`;
  channel = new BroadcastChannel(channelName);
  channel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.kind === "HELLO") {
      channel.postMessage({
        kind: "REPLAY",
        from: clientId,
        actions: actionLog,
      });
      return;
    }
    if (data.kind === "REPLAY") {
      if (data.from === clientId || !Array.isArray(data.actions)) return;
      data.actions.forEach((action) => {
        if (action?.type) onRemoteAction(action);
      });
      return;
    }
    if (data.clientId === clientId || !data.type) return;
    actionLog.push(data);
    onRemoteAction(data);
  };
  channel.postMessage({ kind: "HELLO", clientId });
}

export function connect({ householdId, roomCode } = {}, onRemoteAction) {
  disconnect();
  const code = String(roomCode || "").replace(/\D/g, "").slice(0, 6);
  currentRoom = code;
  currentHousehold = String(householdId || code || "");
  if (!currentHousehold) return () => {};

  if (hasFirebaseConfig() && householdId) {
    mode = "firebase";
    connectFirebase(householdId, onRemoteAction);
  } else {
    mode = "broadcast";
    connectBroadcast(code || currentHousehold, onRemoteAction);
  }

  return () => {
    if (currentHousehold === (householdId || code)) disconnect();
  };
}

export function publish(action) {
  if (!action?.type || !currentHousehold) return;
  const payload = stripUndefined({
    ...action,
    clientId,
    sentAt: Date.now(),
  });

  if (mode === "firebase" && actionsRef) {
    push(actionsRef, payload);
    return;
  }

  if (channel) {
    actionLog.push(payload);
    channel.postMessage(payload);
  }
}

export async function clearRoom() {
  if (!currentHousehold) return;

  if (mode === "firebase" && actionsRef) {
    await push(
      actionsRef,
      stripUndefined({ type: "RESET_DEMO", clientId, sentAt: Date.now() })
    );
    await remove(actionsRef);
    return;
  }

  actionLog = [];
  channel?.postMessage({ type: "RESET_DEMO", clientId, sentAt: Date.now() });
}
