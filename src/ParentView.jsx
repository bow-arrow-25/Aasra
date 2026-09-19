import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Heart,
  IndianRupee,
  MessageSquare,
  Mic,
  Phone,
  Volume2,
} from "lucide-react";
import LanguageToggle from "./components/LanguageToggle";
import VoiceMessageList from "./components/VoiceMessageList";
import VoiceRecorder from "./components/VoiceRecorder";
import ParentCallOverlay from "./components/parent/ParentCallOverlay";
import ParentMessages from "./components/parent/ParentMessages";
import ParentReminders from "./components/parent/ParentReminders";
import ParentShareResult from "./components/parent/ParentShareResult";
import { useGlobalState } from "./context/GlobalState";
import { t } from "./lib/i18n";
import {
  formatRupees,
  parentStatusKey,
  PAYMENT_STATUS,
} from "./lib/payments";
import { dueReminders } from "./lib/reminders";
import { isOkayPhrase } from "./lib/rules";
import { speak, speechLangCode } from "./lib/speak";

function paymentCopy(lang, payment) {
  if (payment.status === PAYMENT_STATUS.COLLECT_REQUEST_DECLINED) {
    return { title: t(lang, "collectDeclinedTitle"), body: t(lang, "collectDeclinedBody") };
  }
  if (payment.status === PAYMENT_STATUS.REJECTED || payment.rejected) {
    return { title: t(lang, "rejectedTitle"), body: t(lang, "rejectedBody") };
  }
  if (payment.status === PAYMENT_STATUS.BLOCKED || payment.decision === "BLOCK") {
    return { title: t(lang, "blockedTitle"), body: t(lang, "blockedBody") };
  }
  if (
    payment.status === PAYMENT_STATUS.HELD ||
    payment.status === PAYMENT_STATUS.PENDING_APPROVAL ||
    payment.decision === "HOLD"
  ) {
    return { title: t(lang, "heldTitle"), body: t(lang, "heldBody") };
  }
  if (payment.status === PAYMENT_STATUS.APPROVED_SENT) {
    return { title: t(lang, "approvedTitle"), body: t(lang, "approvedBody") };
  }
  return { title: t(lang, "allowedTitle"), body: t(lang, "allowedBody") };
}

function collectSpeech(lang) {
  return `${t(lang, "collectTitle")}. ${t(lang, "collectBody")}`;
}

function smsWarningSpeech(lang) {
  return `${t(lang, "smsWarningTitle")}. ${t(lang, "smsWarningBody")}`;
}

function paymentSpeech(lang, payment) {
  if (
    payment?.kind === "COLLECT" &&
    payment.status === PAYMENT_STATUS.PENDING_APPROVAL
  ) {
    return collectSpeech(lang);
  }
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
      <Volume2 className="size-6" aria-hidden="true" />
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
    payments,
    voiceMessages,
    pendingSms,
    reminders,
    checkIn,
    endCall,
    answerCall,
    completeReminder,
    clearSmsWarning,
    clearPayment,
    declineCollectRequest,
    askFamilyAboutPayment,
    deleteSms,
    askFamilyAboutSms,
  } = useGlobalState();
  const [screen, setScreen] = useState("home");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const checkInRef = useRef(checkIn);
  const lastVoiceCheckInRef = useRef(0);
  checkInRef.current = checkIn;

  const familyMessages = (voiceMessages || []).filter((message) => message.from === "family");
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
    if (screen !== "home" || activeCall || dueReminders(reminders)[0]) {
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
  }, [lang, screen, activeCall, reminders]);

  useEffect(() => {
    if (pendingPayment && !activeCall) {
      speak(paymentSpeech(lang, pendingPayment), lang);
    }
  }, [pendingPayment?.id, pendingPayment?.status, lang, activeCall]);

  useEffect(() => {
    if (pendingSms && !pendingSms.shared && !activeCall && !pendingPayment) {
      speak(smsWarningSpeech(lang), lang);
    }
  }, [pendingSms?.id, lang, activeCall, pendingPayment]);

  useEffect(() => {
    if (
      newestUnheardFamilyMessage &&
      !activeCall &&
      !pendingPayment &&
      !pendingSms &&
      screen === "home"
    ) {
      speak(t(lang, "newVoiceFromArjun"), lang);
    }
  }, [
    newestUnheardFamilyMessage?.id,
    lang,
    activeCall,
    pendingPayment,
    pendingSms,
    screen,
  ]);

  function handleOkay() {
    checkIn({ source: "tap" });
    speak(t(lang, "checkedIn"), lang);
  }

  const isCollectWarning =
    pendingPayment?.kind === "COLLECT" &&
    pendingPayment.status === PAYMENT_STATUS.PENDING_APPROVAL;

  if (activeCall) {
    return (
      <ParentCallOverlay
        lang={lang}
        activeCall={activeCall}
        answerCall={answerCall}
        endCall={endCall}
        ParentShell={ParentShell}
      />
    );
  }

  const dueReminder = dueReminders(reminders)[0];
  if (dueReminder) {
    return (
      <ReminderPopup
        lang={lang}
        reminder={dueReminder}
        onDone={completeReminder}
      />
    );
  }

  if (pendingSms?.shared) {
    return (
      <ParentShareResult
        lang={lang}
        message={pendingSms}
        onDone={clearSmsWarning}
        ParentShell={ParentShell}
      />
    );
  }

  if (isCollectWarning) {
    const warning = `${t(lang, "collectTitle")}. ${t(lang, "collectBody")}`;
    return (
      <ParentShell>
        <h1 className="text-[32px] font-bold leading-tight wrap-break-word text-red-800">
          {t(lang, "collectTitle")}
        </h1>
        <p className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] leading-snug wrap-break-word text-red-950">
          {t(lang, "collectBody")}
        </p>
        <p className="mt-8 text-[24px] wrap-break-word text-teal">
          {t(lang, "payeeLabel")}: {pendingPayment.payee}
        </p>
        <p className="text-[28px] font-bold wrap-break-word text-teal">
          {t(lang, "amountLabel")}: {formatRupees(pendingPayment.amount)}
        </p>
        <SpeakAgainButton lang={lang} text={warning} />
        <PrimaryButton
          onClick={() => declineCollectRequest(pendingPayment.id)}
          aria-label={t(lang, "collectDecline")}
        >
          {t(lang, "collectDecline")}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => askFamilyAboutPayment(pendingPayment.id)}
          className="mt-4 inline-flex min-h-16 w-full items-center justify-center rounded-2xl border-4 border-teal px-6 text-[24px] font-bold wrap-break-word text-teal"
          aria-label={t(lang, "collectAskFamily")}
        >
          {t(lang, "collectAskFamily")}
        </button>
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

  if (pendingSms) {
    const familyMarked = pendingSms.familyVerdict === "SPAM";
    return (
      <ParentShell>
        <h1 className="text-[32px] font-bold leading-tight wrap-break-word text-red-800">
          {t(lang, "smsWarningTitle")}
        </h1>
        <p className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] leading-snug wrap-break-word text-red-950">
          {familyMarked ? t(lang, "smsFamilySpam") : t(lang, "smsWarningBody")}
        </p>
        <p className="mt-6 text-[24px] font-bold wrap-break-word text-teal">{pendingSms.sender}</p>
        <p className="mt-2 text-[24px] leading-snug wrap-break-word text-teal-dark">
          {pendingSms.body}
        </p>
        <SpeakAgainButton lang={lang} text={smsWarningSpeech(lang)} />
        <PrimaryButton
          onClick={() => deleteSms(pendingSms.id)}
          aria-label={t(lang, "smsDelete")}
        >
          {t(lang, "smsDelete")}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => askFamilyAboutSms(pendingSms.id)}
          className="mt-4 inline-flex min-h-16 w-full items-center justify-center rounded-2xl border-4 border-teal px-6 text-[24px] font-bold wrap-break-word text-teal"
          aria-label={t(lang, "collectAskFamily")}
        >
          {t(lang, "collectAskFamily")}
        </button>
      </ParentShell>
    );
  }

  if (screen === "voice") {
    return (
      <ParentShell>
        <BackButton lang={lang} onClick={() => setScreen("home")} />
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

  if (screen === "send-money") {
    const recent = (payments || []).slice(0, 10);
    return (
      <ParentShell>
        <BackButton lang={lang} onClick={() => setScreen("home")} />
        <h1 className="mt-6 text-[32px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "myPayments")}
        </h1>
        <p className="mt-3 text-[24px] leading-snug text-teal-dark">
          {t(lang, "myPaymentsHint")}
        </p>
        {recent.length === 0 ? (
          <p className="mt-8 text-[24px] text-teal">{t(lang, "noPaymentsYet")}</p>
        ) : (
          <ul className="mt-8 grid gap-3">
            {recent.map((payment) => (
              <li
                key={payment.id}
                className="rounded-2xl border-4 border-teal bg-white px-4 py-4"
              >
                <p className="text-[24px] wrap-break-word text-teal-dark">{payment.payee}</p>
                <p className="text-[28px] font-bold text-teal">
                  {formatRupees(payment.amount)}
                </p>
                <p className="mt-2 text-[32px] font-bold leading-tight wrap-break-word text-teal">
                  {t(lang, parentStatusKey(payment.status))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ParentShell>
    );
  }

  if (screen === "messages") {
    return (
      <ParentMessages
        lang={lang}
        onBack={() => setScreen("home")}
        BackButton={BackButton}
        ParentShell={ParentShell}
        PrimaryButton={PrimaryButton}
      />
    );
  }

  if (screen === "reminders") {
    return (
      <ParentReminders
        lang={lang}
        reminders={reminders}
        onBack={() => setScreen("home")}
        BackButton={BackButton}
        ParentShell={ParentShell}
      />
    );
  }

  if (screen === "call-family") {
    return (
      <ComingSoonScreen
        lang={lang}
        title={t(lang, "callFamily")}
        body={t(lang, "callFamilyBody")}
        onBack={() => setScreen("home")}
      />
    );
  }

  const bannerText = t(lang, "newVoiceFromArjun");
  const tiles = [
    {
      id: "okay",
      label: t(lang, "iAmOkay"),
      icon: Heart,
      primary: true,
      onClick: handleOkay,
    },
    {
      id: "send-money",
      label: t(lang, "myPayments"),
      icon: IndianRupee,
      onClick: () => setScreen("send-money"),
    },
    {
      id: "messages",
      label: t(lang, "messagesTile"),
      icon: MessageSquare,
      onClick: () => setScreen("messages"),
    },
    {
      id: "voice",
      label: t(lang, "voiceTile"),
      icon: Mic,
      onClick: () => setScreen("voice"),
    },
    {
      id: "reminders",
      label: t(lang, "remindersTile"),
      icon: Bell,
      onClick: () => setScreen("reminders"),
    },
    {
      id: "call-family",
      label: t(lang, "callFamily"),
      icon: Phone,
      onClick: () => setScreen("call-family"),
    },
  ];

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
      <div className="mt-6 grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              aria-label={tile.label}
              className={`flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 text-center ${
                tile.primary
                  ? "bg-teal text-cream"
                  : "border-4 border-teal bg-white text-teal"
              }`}
            >
              <Icon className="size-10 shrink-0" aria-hidden="true" strokeWidth={2.25} />
              <span className="text-[26px] font-bold leading-tight wrap-break-word">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
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
  const { lang, signOutUser } = useGlobalState();
  const holdRef = useRef(0);

  useEffect(() => () => window.clearTimeout(holdRef.current), []);

  function startHold(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      signOutUser();
    }, 800);
  }

  function endHold() {
    window.clearTimeout(holdRef.current);
  }

  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onPointerLeave={endHold}
            className="text-[24px] font-bold"
            aria-label={t(lang, "signOutHold")}
          >
            {t(lang, "appName")}
          </button>
          <LanguageToggle />
        </header>
        {children}
      </div>
    </div>
  );
}

function BackButton({ lang, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 self-start rounded-xl border-2 border-teal px-4 py-2 text-[24px] font-bold"
      aria-label={t(lang, "backHome")}
    >
      <ArrowLeft className="size-6" aria-hidden="true" />
      {t(lang, "backHome")}
    </button>
  );
}

function ComingSoonScreen({ lang, title, body, onBack }) {
  return (
    <ParentShell>
      <BackButton lang={lang} onClick={onBack} />
      <h1 className="mt-6 text-[32px] font-bold leading-tight wrap-break-word text-teal">
        {title}
      </h1>
      <p className="mt-3 text-[24px] leading-snug text-teal-dark">{t(lang, "comingSoon")}</p>
      <p className="mt-4 text-[24px] leading-snug wrap-break-word text-teal">{body}</p>
    </ParentShell>
  );
}

function PrimaryButton({ children, onClick, "aria-label": ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="mt-10 inline-flex min-h-22 w-full items-center justify-center gap-3 rounded-2xl bg-teal px-6 text-[32px] font-bold wrap-break-word text-cream"
    >
      {children}
    </button>
  );
}
