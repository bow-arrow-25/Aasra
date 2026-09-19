import { useEffect, useRef, useState } from "react";
import LanguageToggle from "./components/LanguageToggle";
import VoiceMessageList from "./components/VoiceMessageList";
import VoiceRecorder from "./components/VoiceRecorder";
import { useGlobalState } from "./context/GlobalState";
import { t } from "./lib/i18n";
import { isOkayPhrase } from "./lib/rules";
import { speak, speechLangCode } from "./lib/speak";

function formatRupees(amount) {
  const n = Number(String(amount).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return `₹${amount}`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function paymentCopy(lang, payment) {
  if (payment.rejected) {
    return { title: t(lang, "rejectedTitle"), body: t(lang, "rejectedBody") };
  }
  if (payment.decision === "BLOCK") {
    return { title: t(lang, "blockedTitle"), body: t(lang, "blockedBody") };
  }
  if (payment.decision === "HOLD") {
    return { title: t(lang, "heldTitle"), body: t(lang, "heldBody") };
  }
  return { title: t(lang, "allowedTitle"), body: t(lang, "allowedBody") };
}

function scamSpeech(lang) {
  return `${t(lang, "scamTitle")}. ${t(lang, "scamBody")}`;
}

function paymentSpeech(lang, payment) {
  const copy = paymentCopy(lang, payment);
  return `${copy.title}. ${copy.body}`;
}

function SpeakAgainButton({ lang, text }) {
  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      className="mt-4 inline-flex min-h-14 items-center gap-2 self-start rounded-xl border-2 border-teal px-4 text-[24px] font-bold text-teal"
      aria-label={t(lang, "hearAgain")}
    >
      <span aria-hidden="true">🔊</span>
      {t(lang, "hearAgain")}
    </button>
  );
}

export default function ParentView() {
  const {
    lang,
    lastCheckIn,
    activeCall,
    pendingPayment,
    messages,
    checkIn,
    endCall,
    answerCall,
    clearPayment,
  } = useGlobalState();
  const [screen, setScreen] = useState("home");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const checkInRef = useRef(checkIn);
  const lastVoiceCheckInRef = useRef(0);
  checkInRef.current = checkIn;

  const familyMessages = messages.filter((message) => message.from === "family");
  const newestUnheardFamilyMessage = familyMessages.find(
    (message) => !message.heard
  );
  const recorderLabels = {
    idle: t(lang, "recordIdle"),
    recording: t(lang, "recording"),
    stop: t(lang, "tapToStop"),
    permissionDenied: t(lang, "micPermissionDenied"),
    unsupported: t(lang, "recordingUnsupported"),
    failed: t(lang, "recordingFailed"),
  };

  useEffect(() => {
    if (screen !== "home") {
      setListening(false);
      return;
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    let stopped = false;
    const recognition = new SpeechRecognition();
    recognition.lang = speechLangCode(lang);
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      if (!stopped) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      if (isOkayPhrase(text)) {
        const now = Date.now();
        if (now - lastVoiceCheckInRef.current < 8000) return;
        lastVoiceCheckInRef.current = now;
        checkInRef.current({ source: "voice", transcript: text });
        speak(t(lang, "checkedIn"), lang);
      }
    };

    try {
      recognition.start();
    } catch {
      setVoiceSupported(false);
    }

    return () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, [lang, screen]);

  useEffect(() => {
    if (activeCall?.scam) {
      speak(scamSpeech(lang), lang);
    }
  }, [activeCall?.id, activeCall?.scam, lang]);

  useEffect(() => {
    if (pendingPayment && !activeCall) {
      speak(paymentSpeech(lang, pendingPayment), lang);
    }
  }, [pendingPayment?.id, lang, activeCall]);

  useEffect(() => {
    if (
      newestUnheardFamilyMessage &&
      !activeCall &&
      !pendingPayment &&
      screen === "home"
    ) {
      speak(t(lang, "newVoiceFromArjun"), lang);
    }
  }, [newestUnheardFamilyMessage?.id, lang, activeCall, pendingPayment, screen]);

  function handleOkay() {
    checkIn({ source: "tap" });
    speak(t(lang, "checkedIn"), lang);
  }

  if (activeCall) {
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
        <h1 className="text-[32px] font-bold leading-tight wrap-break-word text-teal">
          {title}
        </h1>
        <p className="mt-4 text-[24px] leading-snug wrap-break-word text-teal-dark">{body}</p>
        <p className="mt-3 text-[24px] wrap-break-word text-teal">{activeCall.from}</p>
        {activeCall.alarmed ? (
          <p
            className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] font-bold leading-snug text-red-900"
            role="status"
          >
            {t(lang, "callAlarmBanner")}
          </p>
        ) : null}
        {activeCall.scam || activeCall.kyc ? (
          <SpeakAgainButton lang={lang} text={warning} />
        ) : null}
        {!activeCall.answered ? (
          <PrimaryButton onClick={answerCall} aria-label={t(lang, "answerCall")}>
            {t(lang, "answerCall")}
          </PrimaryButton>
        ) : null}
        <PrimaryButton onClick={endCall} aria-label={t(lang, "hangUp")}>
          {activeCall.answered ? t(lang, "hangUp") : t(lang, "declineCall")}
        </PrimaryButton>
      </ParentShell>
    );
  }

  if (pendingPayment) {
    const copy = paymentCopy(lang, pendingPayment);
    return (
      <ParentShell>
        <h1 className="text-[32px] font-bold leading-tight wrap-break-word text-teal">
          {copy.title}
        </h1>
        <p className="mt-4 text-[24px] leading-snug wrap-break-word text-teal-dark">{copy.body}</p>
        <p className="mt-8 text-[24px] wrap-break-word text-teal">
          {t(lang, "payeeLabel")}: {pendingPayment.payee}
        </p>
        <p className="text-[28px] font-bold wrap-break-word text-teal">
          {t(lang, "amountLabel")}: {formatRupees(pendingPayment.amount)}
        </p>
        <SpeakAgainButton lang={lang} text={paymentSpeech(lang, pendingPayment)} />
        <PrimaryButton onClick={clearPayment} aria-label={t(lang, "gotIt")}>
          {t(lang, "gotIt")}
        </PrimaryButton>
      </ParentShell>
    );
  }

  if (screen === "voice") {
    return (
      <ParentShell>
        <button
          type="button"
          onClick={() => setScreen("home")}
          className="self-start rounded-xl border-2 border-teal px-4 py-2 text-[24px] font-bold"
          aria-label={t(lang, "backHome")}
        >
          ← {t(lang, "backHome")}
        </button>
        <h1 className="mt-6 text-[36px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "voiceScreenTitle")}
        </h1>
        <p className="mt-3 text-[24px] leading-snug text-teal-dark">
          {t(lang, "voiceScreenHint")}
        </p>
        <div className="mt-8">
          <VoiceRecorder from="parent" labels={recorderLabels} />
        </div>
        <h2 className="mt-10 text-[28px] font-bold text-teal">
          {t(lang, "receivedMessages")}
        </h2>
        <div className="mt-4">
          <VoiceMessageList
            messages={familyMessages}
            viewer="parent"
            senderNames={{ parent: "Amma", family: "Arjun" }}
            emptyText={t(lang, "noFamilyMessages")}
            largeControls
          />
        </div>
      </ParentShell>
    );
  }

  const bannerText = t(lang, "newVoiceFromArjun");

  return (
    <ParentShell>
      <h1 className="mt-2 text-[32px] font-bold leading-tight wrap-break-word text-teal sm:text-[40px]">
        {t(lang, "greeting")}
      </h1>
      {newestUnheardFamilyMessage ? (
        <div className="mt-6 rounded-2xl bg-yellow-100 p-4 text-yellow-950">
          <p className="text-[26px] font-bold">{bannerText}</p>
          <SpeakAgainButton lang={lang} text={bannerText} />
          <div className="mt-3">
            <VoiceMessageList
              messages={[newestUnheardFamilyMessage]}
              viewer="parent"
              senderNames={{ parent: "Amma", family: "Arjun" }}
              largeControls
            />
          </div>
        </div>
      ) : null}
      <p className="mt-6 text-[24px] leading-snug text-teal-dark">
        {t(lang, "checkInHint")}
      </p>
      {lastCheckIn ? (
        <p className="mt-4 text-[24px] text-teal">{t(lang, "checkedIn")}</p>
      ) : null}
      <PrimaryButton onClick={handleOkay}>{t(lang, "iAmOkay")}</PrimaryButton>
      <button
        type="button"
        onClick={() => setScreen("voice")}
        className="mt-6 min-h-22 w-full rounded-2xl border-4 border-teal px-5 text-[28px] font-bold wrap-break-word text-teal"
        aria-label={t(lang, "sendVoiceMessage")}
      >
        {t(lang, "sendVoiceMessage")}
      </button>
      <p className="mt-6 text-[24px] text-teal">
        {voiceSupported
          ? listening
            ? t(lang, "listening")
            : t(lang, "checkInHint")
          : t(lang, "voiceUnsupported")}
      </p>
    </ParentShell>
  );
}

function ParentShell({ children }) {
  const { lang } = useGlobalState();
  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[24px] font-bold">{t(lang, "appName")}</p>
          <LanguageToggle />
        </header>
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, "aria-label": ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="mt-10 min-h-22 w-full rounded-2xl bg-teal px-6 text-[32px] font-bold wrap-break-word text-cream"
    >
      {children}
    </button>
  );
}
