import { useEffect, useRef } from "react";
import { PhoneIncoming, PhoneOff, Volume2 } from "lucide-react";
import CallTimer from "../CallTimer";
import { useLiveVoiceStatus } from "../LiveVoiceRuntime";
import RiskMeter from "../RiskMeter";
import ScamPhraseChips from "../ScamPhraseChips";
import { useGlobalState } from "../../context/GlobalState";
import { startPhoneRing, unlockAudio } from "../../lib/demoAudio";
import { t } from "../../lib/i18n";
import { primeLiveVoiceMic } from "../../lib/liveVoice";
import { armSpeechListen } from "../../lib/speechListen";
import { speak } from "../../lib/speak";

function scamSpeech(lang) {
  return `${t(lang, "scamTitle")}. ${t(lang, "scamBody")}`;
}

function digitalArrestSpeech(lang) {
  return `${t(lang, "digitalArrestTitle")} ${t(lang, "digitalArrestBody")}`;
}

function SpeakAgainButton({ lang, text }) {
  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      className="mt-3 inline-flex min-h-12 items-center gap-2 self-start rounded-xl border-2 border-teal px-3 text-[24px] font-bold text-teal"
      aria-label={t(lang, "hearAgain")}
    >
      <Volume2 className="size-6" aria-hidden="true" />
      {t(lang, "hearAgain")}
    </button>
  );
}

function HangUpButton({ lang, answered, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(lang, "hangUp")}
      className="mt-4 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-teal px-4 text-[26px] font-bold wrap-break-word text-cream"
    >
      <PhoneOff className="size-8" aria-hidden="true" />
      {answered ? t(lang, "hangUp") : t(lang, "declineCall")}
    </button>
  );
}

export default function ParentCallOverlay({
  lang,
  names,
  activeCall,
  answerCall,
  endCall,
  ParentShell,
}) {
  const { appendCallTranscript } = useGlobalState();
  const risk = activeCall.analysis?.riskScore ?? 0;
  const interrupt = Boolean(activeCall.answered && risk >= 60);
  const spokenRef = useRef("");
  const voice = useLiveVoiceStatus();

  useEffect(() => {
    if (!activeCall?.liveVoice || activeCall.answered) return undefined;
    unlockAudio();
    return startPhoneRing();
  }, [activeCall?.id, activeCall?.liveVoice, activeCall?.answered]);

  useEffect(() => {
    if (!activeCall?.id) return;
    if (interrupt) {
      const key = `${activeCall.id}:arrest`;
      if (spokenRef.current === key) return;
      spokenRef.current = key;
      speak(digitalArrestSpeech(lang), lang);
      return;
    }
    if (activeCall.scam && !activeCall.answered) {
      const key = `${activeCall.id}:incoming`;
      if (spokenRef.current === key) return;
      spokenRef.current = key;
      speak(scamSpeech(lang), lang);
    }
  }, [activeCall?.id, activeCall?.scam, activeCall?.answered, interrupt, lang]);

  useEffect(() => {
    if (!activeCall?.familyCalling || interrupt) return;
    speak(t(lang, "familyCallingBanner", names), lang);
  }, [activeCall?.familyCalling, interrupt, lang, names]);

  if (interrupt) {
    return (
      <div className="flex min-h-screen justify-center overflow-x-hidden bg-red-800">
        <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col px-4 py-6 font-parent text-white sm:px-6 sm:py-8">
          <CallTimer
            startedAt={activeCall.answeredAt || activeCall.startedAt}
            className="text-center text-[40px] font-bold"
          />
          <h1 className="mt-6 text-[36px] font-bold leading-tight wrap-break-word sm:text-[40px]">
            {t(lang, "digitalArrestTitle")}
          </h1>
          <p className="mt-4 text-[28px] leading-snug wrap-break-word">
            {t(lang, "digitalArrestBody")}
          </p>
          <button
            type="button"
            onClick={() => speak(digitalArrestSpeech(lang), lang)}
            className="mt-6 inline-flex min-h-14 items-center gap-2 self-start rounded-xl border-2 border-white px-4 text-[24px] font-bold"
            aria-label={t(lang, "hearAgain")}
          >
            <Volume2 className="size-6" aria-hidden="true" />
            {t(lang, "hearAgain")}
          </button>
          <button
            type="button"
            onClick={endCall}
            aria-label={t(lang, "hangUp")}
            className="mt-auto inline-flex min-h-28 w-full items-center justify-center gap-3 rounded-3xl bg-white px-6 text-[40px] font-bold text-red-800"
          >
            <PhoneOff className="size-10" aria-hidden="true" />
            {t(lang, "hangUp")}
          </button>
        </div>
      </div>
    );
  }

  if (activeCall.answered) {
    return (
      <ParentShell>
        <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "inCallTitle")}
        </h1>
        <p className="mt-2 text-[24px] wrap-break-word text-teal">{activeCall.from}</p>
        <CallTimer
          startedAt={activeCall.answeredAt || activeCall.startedAt}
          className="mt-3 text-center text-[36px] font-bold text-teal"
        />
        <div className="mt-3">
          <RiskMeter
            score={risk}
            size="lg"
            phrases={activeCall.analysis?.matchedPhrases}
          />
          <ScamPhraseChips large />
        </div>
        {activeCall.alarmed ? (
          <p
            className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] font-bold leading-snug text-red-900"
            role="status"
          >
            {t(lang, "callAlarmBanner")}
          </p>
        ) : null}
        {activeCall.familyCalling ? (
          <p
            className="mt-4 rounded-2xl bg-yellow-100 p-4 text-[24px] font-bold leading-snug text-yellow-950"
            role="status"
          >
            {t(lang, "familyCallingBanner", names)}
          </p>
        ) : null}
        <p className="mt-4 text-[24px] text-teal">
          {activeCall.liveVoice
            ? voice.state === "connected"
              ? t(lang, "talkNow", names)
              : voice.state === "denied"
                ? t(lang, "voiceDenied")
                : voice.state === "failed"
                  ? t(lang, "voiceFailed")
                  : t(lang, "voiceConnecting")
            : activeCall.analyzerMode === "scripted"
              ? t(lang, "scriptedCallHint")
              : t(lang, "listeningToCall")}
        </p>
        <HangUpButton lang={lang} answered onClick={endCall} />
      </ParentShell>
    );
  }

  const title = activeCall.kyc
    ? t(lang, "kycTitle")
    : activeCall.scam
      ? t(lang, "scamTitle")
      : t(lang, "incomingCall");
  const body = activeCall.kyc
    ? t(lang, "kycBody")
    : activeCall.scam
      ? t(lang, "scamBody")
      : `${t(lang, "incomingCall")}: ${activeCall.from}`;
  const warning = activeCall.kyc
    ? `${t(lang, "kycTitle")}. ${t(lang, "kycBody")}`
    : activeCall.scam
      ? scamSpeech(lang)
      : `${t(lang, "incomingCall")}. ${activeCall.from}`;

  return (
    <ParentShell>
      <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-teal">
        {title}
      </h1>
      <p className="mt-3 text-[24px] leading-snug wrap-break-word text-teal-dark">{body}</p>
      <p className="mt-2 text-[24px] wrap-break-word text-teal">{activeCall.from}</p>
      {activeCall.fromPhone ? (
        <p className="mt-4 rounded-2xl bg-yellow-100 p-4 text-[24px] leading-snug wrap-break-word text-yellow-950">
          {t(lang, "phoneAnswerHint")}
        </p>
      ) : null}
      {activeCall.liveVoice ? (
        <p className="mt-4 rounded-2xl bg-yellow-100 p-4 text-[24px] leading-snug wrap-break-word text-yellow-950">
          {t(lang, "inAppCallHint", names)}
        </p>
      ) : null}
      {activeCall.scam || activeCall.kyc ? (
        <SpeakAgainButton lang={lang} text={warning} />
      ) : null}
      <button
        type="button"
        onClick={async () => {
          unlockAudio();
          armSpeechListen(lang, (text) => {
            appendCallTranscript({ speaker: "heard", text, time: Date.now() });
          });
          if (activeCall.liveVoice) {
            try {
              await primeLiveVoiceMic();
            } catch {
              /* LiveVoiceRuntime shows the mic error */
            }
          }
          answerCall();
        }}
        aria-label={t(lang, "answerCall")}
        className="mt-4 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-teal px-4 text-[26px] font-bold wrap-break-word text-cream"
      >
        <PhoneIncoming className="size-8" aria-hidden="true" />
        {t(lang, "answerCall")}
      </button>
      <HangUpButton lang={lang} answered={false} onClick={endCall} />
    </ParentShell>
  );
}
