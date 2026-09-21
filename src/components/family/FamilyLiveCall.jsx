import { useEffect, useState } from "react";
import { Mic, PhoneCall, PhoneOff, ShieldAlert } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  speakerLabel,
  splitHighlighted,
} from "../../lib/callAnalyzer";
import CallTimer from "../CallTimer";
import { useLiveVoiceStatus } from "../LiveVoiceRuntime";
import RiskMeter from "../RiskMeter";
import ScamPhraseChips from "../ScamPhraseChips";
import VoiceRecorder from "../VoiceRecorder";
import { startSoftChime, unlockAudio } from "../../lib/demoAudio";
import { t } from "../../lib/i18n";
import { primeLiveVoiceMic } from "../../lib/liveVoice";
import { armSpeechListen } from "../../lib/speechListen";

export default function FamilyLiveCall() {
  const {
    parentName,
    activeCall,
    lang,
    startCall,
    callAmmaNow,
    endCall,
    markCallerSpam,
    setCallAnalyzer,
    appendCallTranscript,
  } = useGlobalState();
  const voice = useLiveVoiceStatus();
  const [analyzerMode, setAnalyzerMode] = useState("live");
  const [speakCaller, setSpeakCaller] = useState(true);
  const [showVoice, setShowVoice] = useState(false);

  useEffect(() => {
    if (activeCall?.fromPhone) setAnalyzerMode("live");
  }, [activeCall?.id, activeCall?.fromPhone]);

  useEffect(() => {
    if (!activeCall?.liveVoice || activeCall.answered) return undefined;
    unlockAudio();
    return startSoftChime(2000);
  }, [activeCall?.id, activeCall?.liveVoice, activeCall?.answered]);

  function applyMode(nextMode) {
    setAnalyzerMode(nextMode);
    if (activeCall) {
      setCallAnalyzer({ analyzerMode: nextMode, speakCaller });
    }
  }

  function startScriptedDemo() {
    setAnalyzerMode("scripted");
    startCall({
      from: "Unknown +91 98XXX 11223",
      scam: true,
      analyzerMode: "scripted",
      speakCaller,
    });
  }

  async function startFamilyVoiceCall() {
    setAnalyzerMode("live");
    unlockAudio();
    armSpeechListen(lang, (text) => {
      appendCallTranscript({ speaker: "heard", text, time: Date.now() });
    });
    try {
      await primeLiveVoiceMic();
    } catch {
      /* LiveVoiceRuntime shows the mic error */
    }
    callAmmaNow({ analyzerMode: "live" });
  }

  function startLiveMicCall() {
    setAnalyzerMode("live");
    unlockAudio();
    armSpeechListen(lang, (text) => {
      appendCallTranscript({ speaker: "heard", text, time: Date.now() });
    });
    startCall({
      from: "Unknown +91 98XXX 11223",
      scam: false,
      analyzerMode: "live",
      speakCaller: false,
    });
  }

  return (
    <section className="grid gap-2">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PhoneCall className="size-5 text-teal" aria-hidden="true" />
          Live Call
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Call {parentName} inside Aasra. After they tap Answer and allow the
          microphone, both phones can hear each other. This is not the Phone app.
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
            Call {parentName} now uses live voice. The live-mic button is only for
            speakerphone listening during a real Phone-app call.
          </p>
        )}
      </div>

      {activeCall ? (
        <ActiveCallCard
          call={activeCall}
          lang={lang}
          parentName={parentName}
          voice={voice}
          onCallAmma={startFamilyVoiceCall}
          onHangUp={endCall}
          onVoice={() => setShowVoice((value) => !value)}
          onSpam={markCallerSpam}
          showVoice={showVoice}
        />
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Speak scam words after the call is answered — CBI, digital arrest, OTP.
            The Safe so far bar should move by itself.
          </p>
          <div className="mt-4 grid gap-2">
            <ActionButton
              onClick={startFamilyVoiceCall}
              label={`Call ${parentName} now`}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton
                onClick={startLiveMicCall}
                label="Start live mic call"
                tone="danger"
              />
              <ActionButton
                onClick={startScriptedDemo}
                label="90s script"
                tone="danger"
              />
            </div>
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

function voiceCopy(lang, call, parentName, voice) {
  if (!call.liveVoice) return null;
  if (voice?.state === "connected") return t(lang, "voiceConnected");
  if (voice?.state === "denied") return t(lang, "voiceDenied");
  if (voice?.state === "failed") return t(lang, "voiceFailed");
  if (call.answered) return t(lang, "voiceConnecting");
  return t(lang, "waitingParentAnswer", { parent: parentName });
}

function ActiveCallCard({
  call,
  lang,
  parentName,
  voice,
  onCallAmma,
  onHangUp,
  onVoice,
  onSpam,
  showVoice,
}) {
  const analysis = call.analysis || { riskScore: 0, matchedPhrases: [], stage: "normal" };
  const lines = call.transcript || [];
  const liveHint = voiceCopy(lang, call, parentName, voice);

  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Caller
        </p>
        <p className="mt-1 text-lg font-semibold wrap-break-word">{call.from}</p>
        {call.fromPhone ? (
          <p className="mt-1 text-sm font-semibold text-teal">
            Forwarded from {parentName}'s phone
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
            <p className="mt-1 text-lg font-semibold text-slate-500">Ringing</p>
          )}
          {liveHint ? (
            <p className="mt-2 text-sm font-semibold text-teal">{liveHint}</p>
          ) : !call.answered && call.fromPhone ? (
            <p className="mt-2 text-sm text-slate-600">
              {t(lang, "waitingForAmmaAnswer", { parent: parentName })}
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <RiskMeter
            score={analysis.riskScore}
            phrases={analysis.matchedPhrases}
          />
          <ScamPhraseChips />
        </div>
        {call.alarmed ? (
          <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-900">
            {t(lang, "callAlarmBanner")}
          </p>
        ) : null}
        {call.spam ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            Marked as spam
          </p>
        ) : null}
        <div className="mt-4 grid gap-2">
          <ActionButton onClick={onHangUp} label={t(lang, "hangUp")} tone="danger" />
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
            {call.liveVoice
              ? call.answered
                ? "Voice is live. Talk on this phone."
                : `Waiting for ${parentName} to answer on Aasra.`
              : call.answered
                ? call.analyzerMode === "scripted"
                  ? "Waiting for the scripted lines…"
                  : "Listening for speakerphone audio…"
                : `Answer the call on ${parentName}’s phone to start the analyser.`}
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
                  {speakerLabel(line.speaker, parentName)}
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
