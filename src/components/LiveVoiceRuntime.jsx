import { useEffect, useRef, useState } from "react";
import { useGlobalState } from "../context/GlobalState";
import { getClientId } from "../lib/sync";
import { startLiveVoice, subscribeVoiceStatus } from "../lib/liveVoice";

export function useLiveVoiceStatus() {
  const [status, setStatus] = useState({ state: "idle", error: "" });
  useEffect(() => subscribeVoiceStatus(setStatus), []);
  return status;
}

export default function LiveVoiceRuntime() {
  const { role, householdId, roomCode, activeCall } = useGlobalState();
  const audioRef = useRef(null);
  const sessionRef = useRef(null);
  const callId = activeCall?.id;
  const liveVoice = Boolean(activeCall?.liveVoice);
  const answered = Boolean(activeCall?.answered);
  const isOfferer = Boolean(
    liveVoice && activeCall?.callerClientId && activeCall.callerClientId === getClientId()
  );
  const isAnswerer = Boolean(liveVoice && role === "parent" && !isOfferer);
  const ready = Boolean(liveVoice && callId && (isOfferer || (isAnswerer && answered)));

  useEffect(() => {
    if (!ready) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      return undefined;
    }

    const session = startLiveVoice({
      householdId,
      roomCode,
      callId,
      isOfferer,
      waitForAnswer: isOfferer,
      remoteAudio: audioRef.current,
    });
    sessionRef.current = session;
    if (isAnswerer) session.beginAnswer();

    return () => {
      session.stop();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [ready, callId, isOfferer, isAnswerer, householdId, roomCode]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      controls={false}
      className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
    />
  );
}
