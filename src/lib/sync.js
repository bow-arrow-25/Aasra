import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  get,
  onChildAdded,
  off,
  remove,
} from "firebase/database";

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
let channel = null;
let actionsRef = null;
let roomRef = null;
let childAddedUnsub = null;
let actionLog = [];

export function hasFirebaseConfig() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_DATABASE_URL
  );
}

export function getClientId() {
  return clientId;
}

export function getSyncMode() {
  return mode;
}

export function createRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function getDb() {
  const app = getApps()[0] || initializeApp(firebaseConfig());
  return getDatabase(app);
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
  roomRef = null;
  if (channel) {
    channel.close();
    channel = null;
  }
  currentRoom = "";
  actionLog = [];
}

function connectFirebase(roomCode, onRemoteAction) {
  const db = getDb();
  roomRef = ref(db, `rooms/${roomCode}`);
  actionsRef = ref(db, `rooms/${roomCode}/actions`);
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
      return connectBroadcast(roomCode, onRemoteAction);
    });
}

function connectBroadcast(roomCode, onRemoteAction) {
  actionLog = [];
  channel = new BroadcastChannel(`aasra-room-${roomCode}`);
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

export function connect(roomCode, onRemoteAction) {
  disconnect();
  currentRoom = String(roomCode || "").replace(/\D/g, "").slice(0, 6);
  if (!currentRoom) return () => {};

  if (hasFirebaseConfig()) {
    mode = "firebase";
    connectFirebase(currentRoom, onRemoteAction);
  } else {
    mode = "broadcast";
    connectBroadcast(currentRoom, onRemoteAction);
  }

  return () => {
    if (currentRoom === roomCode) disconnect();
  };
}

export function publish(action) {
  if (!action?.type || !currentRoom) return;
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
  if (!currentRoom) return;

  if (mode === "firebase" && roomRef && actionsRef) {
    await push(
      actionsRef,
      stripUndefined({ type: "RESET_DEMO", clientId, sentAt: Date.now() })
    );
    await remove(roomRef);
    return;
  }

  actionLog = [];
  channel?.postMessage({ type: "RESET_DEMO", clientId, sentAt: Date.now() });
}
