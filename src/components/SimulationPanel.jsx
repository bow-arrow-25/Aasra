import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  IndianRupee,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  RotateCcw,
  ShieldAlert,
  Timer,
  UserCheck,
  X,
} from "lucide-react";
import { silentWavDataUrl } from "../lib/demoAudio";
import { SAMPLE_SMS } from "../lib/smsAnalyzer";
import { useGlobalState } from "../context/GlobalState";

const DEMO_GAP_MS = 3000;
const DEMO_VOICE_SECONDS = 3;

const PANEL_BUTTON =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50";

export default function SimulationPanel() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const cancelRef = useRef(false);
  const timerRef = useRef(0);
  const {
    startCall,
    answerCall,
    endCall,
    logCallAlarm,
    tryPayment,
    startCollectRequest,
    checkIn,
    rejectPayment,
    approvePayment,
    sendVoiceMessage,
    receiveSms,
    addReminder,
    resetDemo,
    resetBoard,
    demoMode,
    setDemoMode,
    roomCode,
    syncMode,
  } = useGlobalState();

  useEffect(() => {
    function onKey(event) {
      if (event.key === "`" && !event.repeat) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(
    () => () => {
      cancelRef.current = true;
      window.clearTimeout(timerRef.current);
    },
    []
  );

  function wait(ms) {
    return new Promise((resolve) => {
      timerRef.current = window.setTimeout(resolve, ms);
    });
  }

  function stopDemo() {
    cancelRef.current = true;
    window.clearTimeout(timerRef.current);
    setRunning(false);
    setStepLabel("Demo stopped");
  }

  async function runFullDemo() {
    cancelRef.current = false;
    setRunning(true);
    setStepLabel("Resetting board");
    resetBoard();
    await wait(400);
    if (cancelRef.current) return;

    const steps = [
      {
        label: "Check-in",
        run: () => checkIn({ source: "tap" }),
      },
      {
        label: "KYC call answered",
        run: () =>
          startCall({
            from: "Aadhaar KYC +91 140XXXX112",
            scam: true,
            kyc: true,
            answered: true,
          }),
      },
      {
        label: "20-min alarm",
        run: () => logCallAlarm(),
      },
      {
        label: "₹25,000 blocked",
        run: () => {
          endCall();
          tryPayment({ payee: "Refund Officer", amount: 25000 });
        },
      },
      {
        label: "Unknown ₹500 held",
        run: () => tryPayment({ payee: "Unknown Shop", amount: 500 }),
      },
      {
        label: "Family rejects",
        run: () => rejectPayment(),
      },
      {
        label: "Parent voice message",
        run: () =>
          sendVoiceMessage({
            from: "parent",
            dataUrl: silentWavDataUrl(DEMO_VOICE_SECONDS),
            durationSec: DEMO_VOICE_SECONDS,
          }),
      },
    ];

    for (const step of steps) {
      if (cancelRef.current) return;
      setStepLabel(step.label);
      step.run();
      await wait(DEMO_GAP_MS);
    }

    if (cancelRef.current) return;
    setStepLabel("Demo complete");
    setRunning(false);
  }

  if (!open) return null;

  return (
    <aside
      className="fixed right-4 bottom-4 z-50 max-h-[min(80vh,calc(100dvh-2rem))] w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
      role="complementary"
      aria-label="Demo simulation panel"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" id="simulation-panel-title">
          SimulationPanel
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-slate-500"
          aria-label="Close simulation panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold">DEMO_MODE</p>
          <p className="text-xs text-slate-500">
            {demoMode ? "15s escalation / 15s call alarm" : "2 min escalation / 20 min call alarm"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={demoMode}
          aria-label="Demo mode. When on, escalation and call alarms use short timers."
          onClick={() => setDemoMode(!demoMode)}
          className={`relative h-7 w-12 shrink-0 rounded-full ${
            demoMode ? "bg-teal" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              demoMode ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="mb-3 grid gap-2">
        <button
          type="button"
          className={`${PANEL_BUTTON} inline-flex items-center gap-2 bg-teal font-semibold text-cream`}
          onClick={runFullDemo}
          disabled={running}
          aria-label="Run full demo sequence"
        >
          <Play className="size-4" aria-hidden="true" />
          {running ? "Running full demo…" : "Run full demo"}
        </button>
        {running ? (
          <button
            type="button"
            className={`${PANEL_BUTTON} border border-slate-300`}
            onClick={stopDemo}
            aria-label="Stop full demo"
          >
            Stop demo
          </button>
        ) : null}
        <p className="text-xs text-slate-600" role="status" aria-live="polite">
          {stepLabel
            ? stepLabel
            : "Plays check-in, KYC call, 20-min alarm, ₹25,000 block, hold, family reject, parent voice. 3s gaps."}
        </p>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-red-600 text-white`}
          disabled={running}
          onClick={() =>
            startCall({ from: "Unknown +91 98XXX 11223", scam: true })
          }
          aria-label="Simulate a scam call overlay"
        >
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          Scam call overlay
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-red-900 text-white`}
          disabled={running}
          onClick={() =>
            startCall({
              from: "Unknown +91 98XXX 11223",
              scam: true,
              analyzerMode: "scripted",
              speakCaller: true,
            })
          }
          aria-label="Start the 90 second digital arrest scripted demo"
        >
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          Digital-arrest script (90s)
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-teal text-cream`}
          disabled={running}
          onClick={() =>
            startCall({
              from: "Unknown +91 98XXX 11223",
              scam: false,
              analyzerMode: "live",
            })
          }
          aria-label="Start a live microphone call analyser"
        >
          <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
          Live mic call
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-orange-700 text-white`}
          disabled={running}
          onClick={() =>
            startCall({
              from: "Aadhaar KYC +91 140XXXX112",
              scam: true,
              kyc: true,
            })
          }
          aria-label="Simulate an incoming KYC scam call"
        >
          <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
          KYC call
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-slate-800 text-white`}
          disabled={running}
          onClick={() => startCall({ from: "Dr. Meera Clinic", scam: false })}
          aria-label="Simulate a normal incoming call"
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          Normal call
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-slate-200`}
          disabled={running}
          onClick={answerCall}
          aria-label="Answer the active call"
        >
          <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
          Answer call
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-slate-200`}
          disabled={running}
          onClick={endCall}
          aria-label="End the active call"
        >
          <PhoneOff className="size-4 shrink-0" aria-hidden="true" />
          End call
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-orange-500 text-slate-900`}
          disabled={running}
          onClick={logCallAlarm}
          aria-label="Fire the 20-minute call alarm now"
        >
          <Timer className="size-4 shrink-0" aria-hidden="true" />
          20-min call alarm
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-green-700 text-white`}
          disabled={running}
          onClick={() => tryPayment({ payee: "Electricity Board", amount: 850 })}
          aria-label="Simulate an allowed UPI payment of 850 rupees"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          UPI ALLOW — Electricity ₹850
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-yellow-500 text-slate-900`}
          disabled={running}
          onClick={() => tryPayment({ payee: "Unknown Shop", amount: 500 })}
          aria-label="Simulate a held UPI payment of 500 rupees"
        >
          <IndianRupee className="size-4 shrink-0" aria-hidden="true" />
          UPI HOLD — Unknown ₹500
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-red-700 text-white`}
          disabled={running}
          onClick={() => tryPayment({ payee: "Refund Officer", amount: 25000 })}
          aria-label="Simulate a blocked UPI payment of 25,000 rupees"
        >
          <IndianRupee className="size-4 shrink-0" aria-hidden="true" />
          UPI BLOCK — Unknown ₹25,000
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-purple-700 text-white`}
          disabled={running}
          onClick={() =>
            startCollectRequest({ from: "Refund Officer", amount: 18000 })
          }
          aria-label="Simulate a UPI collect request scam asking Amma for money"
        >
          <IndianRupee className="size-4 shrink-0" aria-hidden="true" />
          Collect request — ₹18,000
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-red-800 text-white`}
          disabled={running}
          onClick={() =>
            receiveSms({
              sender: SAMPLE_SMS[0].sender,
              body: SAMPLE_SMS[0].body,
            })
          }
          aria-label="Simulate a scam KYC SMS"
        >
          <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
          SMS SCAM — KYC link
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-green-800 text-white`}
          disabled={running}
          onClick={() =>
            receiveSms({
              sender: SAMPLE_SMS[5].sender,
              body: SAMPLE_SMS[5].body,
            })
          }
          aria-label="Simulate a genuine bank OTP SMS"
        >
          <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
          SMS SAFE — SBI OTP
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-green-800 text-white`}
          disabled={running}
          onClick={() => approvePayment()}
          aria-label="Approve the pending payment as the family"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Family approves payment
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-slate-900 text-white`}
          disabled={running}
          onClick={() => rejectPayment()}
          aria-label="Reject the pending payment as the family"
        >
          <X className="size-4 shrink-0" aria-hidden="true" />
          Family rejects payment
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-teal text-cream`}
          disabled={running}
          onClick={() => checkIn({ source: "tap" })}
          aria-label="Simulate a parent check-in"
        >
          <UserCheck className="size-4 shrink-0" aria-hidden="true" />
          Parent check-in
        </button>
        <button
          type="button"
          className={`${PANEL_BUTTON} bg-sky-700 text-white`}
          disabled={running}
          onClick={() =>
            addReminder({
              title: "Night medicine",
              type: "medicine",
              dueAt: Date.now() + (demoMode ? 15_000 : 60_000),
              repeat: "none",
              note: "Take your tablet with water.",
            })
          }
          aria-label="Create a night medicine reminder that is due soon"
        >
          <Bell className="size-4 shrink-0" aria-hidden="true" />
          Medicine reminder soon
        </button>
        <p className="pt-1 text-xs text-slate-500">
          Pairing {roomCode || "none"} · {syncMode}
        </p>
        <button
          type="button"
          className={`${PANEL_BUTTON} border border-slate-300`}
          disabled={running}
          onClick={resetDemo}
          aria-label="Reset demo and clear the family room"
        >
          <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
          Reset demo (clears room)
        </button>
      </div>
    </aside>
  );
}
