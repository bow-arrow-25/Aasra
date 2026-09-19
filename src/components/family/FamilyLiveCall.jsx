import { useEffect, useState } from "react";
import { Mic, PhoneCall, PhoneOff, ShieldAlert } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  speakerLabel,
  splitHighlighted,
} from "../../lib/callAnalyzer";
import CallAnalyzerRuntime from "../CallAnalyzerRuntime";
import CallTimer from "../CallTimer";
import RiskMeter from "../RiskMeter";
import VoiceRecorder from "../VoiceRecorder";
import { t } from "../../lib/i18n";

export default function FamilyLiveCall() {
  const {
    parentName,
    activeCall,
    lang,
    startCall,
    callAmmaNow,
    markCallerSpam,
    setCallAnalyzer,
  } = useGlobalState();
  const [analyzerMode, setAnalyzerMode] = useState("live");
  const [speakCaller, setSpeakCaller] = useState(true);
  const [showVoice, setShowVoice] = useState(false);

  useEffect(() => {
    if (activeCall?.fromPhone) setAnalyzerMode("live");
  }, [activeCall?.id, activeCall?.fromPhone]);

  function applyMode(nextMode) {
    setAnalyzerMode(nextMode);
    if (activeCall) {
      setCallAnalyzer({ analyzerMode: nextMode, speakCaller });
    }
  }

  function startScriptedDemo() {
    startCall({
      from: "Unknown +91 98XXX 11223",
      scam: true,
      analyzerMode: "scripted",
      speakCaller,
    });
  }

  function startLiveDemo() {
    startCall({
      from: "Unknown +91 98XXX 11223",
      scam: false,
      analyzerMode: "live",
      speakCaller: false,
    });
  }

  return (
    <section className="grid gap-2">
      <CallAnalyzerRuntime />
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PhoneCall className="size-5 text-teal" aria-hidden="true" />
          Live Call
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Watch {parentName}'s call. The analyser highlights digital-arrest
          language and warns the family when risk crosses 60.
        </p>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Analyser mode">
          <ModeButton
            selected={analyzerMode === "live"}
            onClick={() => applyMode("live")}
            label="Live mic"
          />
          <ModeButton
            selected={analyzerMode === "scripted"}
            onClick={() => applyMode("scripted")}
            label="Scripted demo"
          />
        </div>
        {analyzerMode === "scripted" ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={speakCaller}
              onChange={(event) => {
                const next = event.target.checked;
                setSpeakCaller(next);
                if (activeCall) setCallAnalyzer({ speakCaller: next });
              }}
            />
            Speak caller lines
          </label>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            After Amma answers, this browser listens to speakerphone audio with
            the Web Speech API.
          </p>
        )}
      </div>

      {activeCall ? (
        <ActiveCallCard
          call={activeCall}
          parentName={parentName}
          onCallAmma={() => callAmmaNow({ analyzerMode: "live" })}
          onVoice={() => setShowVoice((value) => !value)}
          onSpam={markCallerSpam}
          showVoice={showVoice}
        />
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            No live call. Start a demo or call {parentName} now.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ActionButton
              onClick={() => callAmmaNow({ analyzerMode: "live" })}
              label={`Call ${parentName} now`}
            />
            <ActionButton
              onClick={() => setShowVoice((value) => !value)}
              label="Send voice message"
            />
            {analyzerMode === "scripted" ? (
              <ActionButton
                onClick={startScriptedDemo}
                label="Start 90s digital-arrest script"
                tone="danger"
              />
            ) : (
              <ActionButton
                onClick={startLiveDemo}
                label="Start live mic call"
                tone="danger"
              />
            )}
          </div>
          {showVoice ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <VoiceRecorder from="family" />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ActiveCallCard({
  call,
  parentName,
  onCallAmma,
  onVoice,
  onSpam,
  showVoice,
}) {
  const analysis = call.analysis || { riskScore: 0, matchedPhrases: [], stage: "normal" };
  const lines = call.transcript || [];

  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Caller
        </p>
        <p className="mt-1 text-lg font-semibold wrap-break-word">{call.from}</p>
        {call.fromPhone ? (
          <p className="mt-1 text-sm font-semibold text-teal">
            Forwarded from Amma's phone
          </p>
        ) : null}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Duration
          </p>
          {call.answered ? (
            <CallTimer
              startedAt={call.answeredAt || call.startedAt}
              className="mt-1 text-3xl font-bold tabular-nums text-teal"
            />
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold text-slate-500">Ringing</p>
              {call.fromPhone ? (
                <p className="mt-2 text-sm text-slate-600">
                  {t(lang, "waitingForAmmaAnswer")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-4">
          <RiskMeter score={analysis.riskScore} />
        </div>
        {analysis.matchedPhrases.length ? (
          <p className="mt-3 text-sm text-red-800">
            Heard: {analysis.matchedPhrases.join(", ")}
          </p>
        ) : null}
        {call.spam ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            Marked as spam
          </p>
        ) : null}
        <div className="mt-4 grid gap-2">
          <ActionButton onClick={onCallAmma} label={`Call ${parentName} now`} />
          <ActionButton onClick={onVoice} label="Send voice message" />
          <ActionButton
            onClick={onSpam}
            label="Mark caller as spam"
            tone="danger"
            disabled={Boolean(call.spam)}
          />
        </div>
        {showVoice ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <VoiceRecorder from="family" />
          </div>
        ) : null}
      </article>

      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Live transcript</h3>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {call.answered
              ? call.analyzerMode === "scripted"
                ? "Waiting for the scripted lines…"
                : "Listening for speakerphone audio…"
              : "Answer the call on Amma’s phone to start the analyser."}
          </p>
        ) : (
          <ul className="mt-3 max-h-112 space-y-2 overflow-y-auto">
            {lines.map((line) => (
              <li
                key={line.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  line.speaker === "caller"
                    ? "bg-red-50"
                    : line.speaker === "amma"
                      ? "bg-teal/10"
                      : "bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {speakerLabel(line.speaker)}
                </p>
                <p className="mt-1 wrap-break-word leading-relaxed">
                  {splitHighlighted(line.text, analysis.matchedPhrases).map(
                    (part, index) =>
                      part.hit ? (
                        <mark
                          key={`${line.id}-${index}`}
                          className="rounded bg-red-200 px-0.5 text-red-950"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={`${line.id}-${index}`}>{part.text}</span>
                      )
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function ModeButton({ selected, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        selected ? "bg-teal text-cream" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function ActionButton({ onClick, label, tone = "default", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "bg-red-700 text-white"
          : "bg-slate-900 text-white"
      }`}
    >
      {tone === "danger" ? (
        <ShieldAlert className="size-4" aria-hidden="true" />
      ) : label.toLowerCase().includes("voice") ? (
        <Mic className="size-4" aria-hidden="true" />
      ) : (
        <PhoneOff className="size-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
