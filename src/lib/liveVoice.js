import { onChildAdded, onValue, push, ref, remove, set } from "firebase/database";
import { getFirebaseDb, hasFirebaseConfig } from "./firebase";
import { getClientId } from "./sync";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

let statusListeners = new Set();
let voiceStatus = { state: "idle", error: "" };
let primedStream = null;

export async function primeLiveVoiceMic() {
  if (primedStream) return primedStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("denied");
  }
  primedStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  return primedStream;
}

function takePrimedMic() {
  const stream = primedStream;
  primedStream = null;
  return stream;
}

export function subscribeVoiceStatus(listener) {
  statusListeners.add(listener);
  listener(voiceStatus);
  return () => statusListeners.delete(listener);
}

function emitVoiceStatus(next) {
  voiceStatus = { ...voiceStatus, ...next };
  statusListeners.forEach((listener) => listener(voiceStatus));
}

export function resetVoiceStatus() {
  emitVoiceStatus({ state: "idle", error: "" });
}

function canUseFirebase(householdId) {
  return Boolean(hasFirebaseConfig() && householdId && getFirebaseDb());
}

const pendingRemoves = new Map();

function signalPath(householdId, callId) {
  return `households/${householdId}/webrtc/${callId}`;
}

function cancelSignalRemove(path) {
  const timer = pendingRemoves.get(path);
  if (timer) window.clearTimeout(timer);
  pendingRemoves.delete(path);
}

function scheduleSignalRemove(path) {
  cancelSignalRemove(path);
  pendingRemoves.set(
    path,
    window.setTimeout(() => {
      pendingRemoves.delete(path);
      const db = getFirebaseDb();
      if (!db) return;
      remove(ref(db, path)).catch(() => {});
    }, 1200)
  );
}

function toIcePayload(candidate) {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid || "",
    sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
  };
}

function fromIcePayload(value) {
  if (!value?.candidate) return null;
  return new RTCIceCandidate({
    candidate: value.candidate,
    sdpMid: value.sdpMid || null,
    sdpMLineIndex: value.sdpMLineIndex ?? 0,
  });
}

export function startLiveVoice({
  householdId,
  roomCode,
  callId,
  isOfferer,
  waitForAnswer = false,
  remoteAudio,
  onStatus,
} = {}) {
  let pc = null;
  let localStream = null;
  let cancelled = false;
  let processedRemote = false;
  const pendingIce = [];
  const unsubscribers = [];
  let channel = null;

  function status(state, error = "") {
    if (cancelled) return;
    emitVoiceStatus({ state, error });
    onStatus?.({ state, error });
  }

  function attachRemote(stream) {
    if (!remoteAudio || !stream) return;
    remoteAudio.srcObject = stream;
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.setAttribute("playsinline", "true");
    remoteAudio.muted = false;
    const tryPlay = () => {
      remoteAudio.play().catch(() => {});
    };
    tryPlay();
    const timer = window.setInterval(() => {
      if (cancelled || !remoteAudio.paused) {
        window.clearInterval(timer);
        return;
      }
      tryPlay();
    }, 700);
    unsubscribers.push(() => window.clearInterval(timer));
  }

  async function ensureMic() {
    if (localStream) return localStream;
    const primed = takePrimedMic();
    if (primed) {
      localStream = primed;
      return localStream;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("denied");
    }
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return localStream;
  }

  async function flushIce() {
    if (!pc?.remoteDescription) return;
    const queued = pendingIce.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* stale candidate */
      }
    }
  }

  async function applyRemoteIce(payload) {
    const candidate = fromIcePayload(payload);
    if (!candidate || !pc) return;
    if (!pc.remoteDescription) {
      pendingIce.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* ignore */
    }
  }

  function publishSignal(kind, payload) {
    if (cancelled) return;
    if (canUseFirebase(householdId)) {
      const db = getFirebaseDb();
      const root = signalPath(householdId, callId);
      if (kind === "offer" || kind === "answer") {
        set(ref(db, `${root}/${kind}`), {
          type: payload.type,
          sdp: payload.sdp,
          from: getClientId(),
          at: Date.now(),
        }).catch(() => {});
        return;
      }
      if (kind === "ice") {
        const side = isOfferer ? "callerCandidates" : "calleeCandidates";
        push(ref(db, `${root}/${side}`), {
          ...payload,
          from: getClientId(),
        }).catch(() => {});
      }
      return;
    }

    channel?.postMessage({
      kind,
      callId,
      from: getClientId(),
      payload,
      role: isOfferer ? "caller" : "callee",
    });
  }

  async function ensurePeer() {
    if (pc) return pc;
    const stream = await ensureMic();
    pc = new RTCPeerConnection(ICE_SERVERS);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const [remote] = event.streams;
      attachRemote(remote || new MediaStream([event.track]));
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) publishSignal("ice", toIcePayload(event.candidate));
    };
    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      if (state === "connected") status("connected");
      if (state === "connecting") status("connecting");
      if (state === "failed") status("failed", "peer");
    };
    pc.oniceconnectionstatechange = () => {
      const state = pc?.iceConnectionState;
      if (state === "connected" || state === "completed") status("connected");
      if (state === "checking") status("connecting");
      if (state === "failed") status("failed", "peer");
    };
    return pc;
  }

  async function handleOffer(desc) {
    if (isOfferer || processedRemote || !desc?.sdp) return;
    processedRemote = true;
    status("connecting");
    const peer = await ensurePeer();
    await peer.setRemoteDescription(new RTCSessionDescription(desc));
    await flushIce();
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    publishSignal("answer", { type: answer.type, sdp: answer.sdp });
  }

  async function handleAnswer(desc) {
    if (!isOfferer || processedRemote || !desc?.sdp || !pc) return;
    processedRemote = true;
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    await flushIce();
    status("connecting");
  }

  function listenFirebase() {
    const db = getFirebaseDb();
    const root = signalPath(householdId, callId);
    cancelSignalRemove(root);
    const offerRef = ref(db, `${root}/offer`);
    const answerRef = ref(db, `${root}/answer`);
    const remoteIce = ref(
      db,
      `${root}/${isOfferer ? "calleeCandidates" : "callerCandidates"}`
    );

    const stopOffer = onValue(offerRef, (snap) => {
      const value = snap.val();
      if (!value || value.from === getClientId()) return;
      handleOffer({ type: value.type || "offer", sdp: value.sdp }).catch(() => {
        status("failed", "signal");
      });
    });
    const stopAnswer = onValue(answerRef, (snap) => {
      const value = snap.val();
      if (!value || value.from === getClientId()) return;
      handleAnswer({ type: value.type || "answer", sdp: value.sdp }).catch(() => {
        status("failed", "signal");
      });
    });
    const stopIce = onChildAdded(remoteIce, (snap) => {
      if (!snap.exists()) return;
      applyRemoteIce(snap.val());
    });
    unsubscribers.push(stopOffer, stopAnswer, stopIce);
  }

  function listenBroadcast() {
    const name = `aasra-webrtc-${roomCode || householdId || "local"}`;
    channel = new BroadcastChannel(name);
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.callId !== callId || data.from === getClientId()) return;
      if (data.kind === "offer") {
        handleOffer(data.payload).catch(() => status("failed", "signal"));
      }
      if (data.kind === "answer") {
        handleAnswer(data.payload).catch(() => status("failed", "signal"));
      }
      if (data.kind === "ice") applyRemoteIce(data.payload);
    };
    unsubscribers.push(() => {
      channel?.close();
      channel = null;
    });
  }

  async function createOfferNow() {
    status(waitForAnswer ? "ringing" : "connecting");
    const peer = await ensurePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    publishSignal("offer", { type: offer.type, sdp: offer.sdp });
  }

  async function start() {
    if (!callId) return;
    if (!window.RTCPeerConnection) {
      status("failed", "unsupported");
      return;
    }
    if (canUseFirebase(householdId)) listenFirebase();
    else listenBroadcast();

    if (isOfferer) {
      try {
        await createOfferNow();
      } catch (error) {
        status(
          error?.name === "NotAllowedError" || error?.message === "denied"
            ? "denied"
            : "failed",
          "mic"
        );
      }
    } else if (!waitForAnswer) {
      status("connecting");
    }
  }

  start();

  return {
    async beginAnswer() {
      if (isOfferer || cancelled) return;
      try {
        await ensureMic();
        status("connecting");
      } catch (error) {
        status(
          error?.name === "NotAllowedError" || error?.message === "denied"
            ? "denied"
            : "failed",
          "mic"
        );
      }
    },
    stop() {
      cancelled = true;
      unsubscribers.splice(0).forEach((stop) => {
        try {
          stop();
        } catch {
          /* ignore */
        }
      });
      try {
        pc?.getSenders().forEach((sender) => sender.track?.stop());
        pc?.close();
      } catch {
        /* ignore */
      }
      pc = null;
      localStream?.getTracks().forEach((track) => track.stop());
      localStream = null;
      if (remoteAudio) remoteAudio.srcObject = null;
      if (canUseFirebase(householdId) && callId) {
        scheduleSignalRemove(signalPath(householdId, callId));
      }
      resetVoiceStatus();
    },
  };
}
