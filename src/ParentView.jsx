import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Heart,
  IndianRupee,
  MessageSquare,
  Mic,
  Volume2,
} from "lucide-react";
import LanguageToggle from "./components/LanguageToggle";
import VoiceMessageList from "./components/VoiceMessageList";
import VoiceRecorder from "./components/VoiceRecorder";
import ParentCallOverlay from "./components/parent/ParentCallOverlay";
import ParentMessages from "./components/parent/ParentMessages";
import ParentReminders from "./components/parent/ParentReminders";
import ParentSendMoney from "./components/parent/ParentSendMoney";
import ParentShareResult from "./components/parent/ParentShareResult";
import ReminderPopup from "./components/parent/ReminderPopup";
import { useGlobalState } from "./context/GlobalState";
import { t } from "./lib/i18n";
import {
  displayParentName,
  formatRupees,
  PAYMENT_STATUS,
  primaryFamilyName,
} from "./lib/payments";
import { unlockAudio } from "./lib/demoAudio";
import { dueReminders } from "./lib/reminders";
import { isOkayPhrase } from "./lib/rules";
import { speak, speechLangCode } from "./lib/speak";

function paymentCopy(lang, payment, names) {
  if (payment.status === PAYMENT_STATUS.COLLECT_REQUEST_DECLINED) {
    return { title: t(lang, "collectDeclinedTitle", names), body: t(lang, "collectDeclinedBody", names) };
  }
  if (payment.status === PAYMENT_STATUS.REJECTED || payment.rejected) {
    return { title: t(lang, "rejectedTitle", names), body: t(lang, "rejectedBody", names) };
  }
  if (payment.status === PAYMENT_STATUS.BLOCKED || payment.decision === "BLOCK") {
    return { title: t(lang, "blockedTitle", names), body: t(lang, "blockedBody", names) };
  }
  if (
    payment.status === PAYMENT_STATUS.HELD ||
    payment.status === PAYMENT_STATUS.PENDING_APPROVAL ||
    payment.decision === "HOLD"
  ) {
    return { title: t(lang, "heldTitle", names), body: t(lang, "heldBody", names) };
  }
  if (payment.status === PAYMENT_STATUS.APPROVED_SENT) {
    return { title: t(lang, "approvedTitle", names), body: t(lang, "approvedBody", names) };
  }
  return { title: t(lang, "allowedTitle", names), body: t(lang, "allowedBody", names) };
}

function collectSpeech(lang) {
  return `${t(lang, "collectTitle")}. ${t(lang, "collectBody")}`;
}

function smsWarningSpeech(lang) {
  return `${t(lang, "smsWarningTitle")}. ${t(lang, "smsWarningBody")}`;
}

function paymentSpeech(lang, payment, names) {
  if (
    payment?.kind === "COLLECT" &&
    payment.status === PAYMENT_STATUS.PENDING_APPROVAL
  ) {
    return collectSpeech(lang);
  }
  const copy = paymentCopy(lang, payment, names);
  return `${copy.title}. ${copy.body}`;
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
    parentName,
    familyMembers,
    safePayees,
    tryPayment,
  } = useGlobalState();
  const familyName = primaryFamilyName(familyMembers);
  const nameVars = { parent: displayParentName(parentName), family: familyName };
  const senderNames = { parent: displayParentName(parentName), family: familyName };
  const [screen, setScreen] = useState("home");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const checkInRef = useRef(checkIn);
  const lastVoiceCheckInRef = useRef(0);
  checkInRef.current = checkIn;

  useEffect(() => {
    function unlock() {
      unlockAudio();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

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
      speak(paymentSpeech(lang, pendingPayment, nameVars), lang);
    }
  }, [pendingPayment?.id, pendingPayment?.status, lang, activeCall, nameVars.parent, nameVars.family]);

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
      speak(t(lang, "newVoiceFromArjun", nameVars), lang);
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
        names={nameVars}
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
        <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-red-800">
          {t(lang, "collectTitle")}
        </h1>
        <p className="mt-3 rounded-2xl bg-red-100 px-3 py-3 text-[24px] leading-snug wrap-break-word text-red-950">
          {t(lang, "collectBody")}
        </p>
        <p className="mt-3 text-[24px] wrap-break-word text-teal">
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
          className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-4 border-teal px-4 text-[24px] font-bold wrap-break-word text-teal"
          aria-label={t(lang, "collectAskFamily")}
        >
          {t(lang, "collectAskFamily")}
        </button>
      </ParentShell>
    );
  }

  if (pendingPayment) {
    const copy = paymentCopy(lang, pendingPayment, nameVars);
    return (
      <ParentShell>
        <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {copy.title}
        </h1>
        <p className="mt-3 text-[24px] leading-snug wrap-break-word text-teal-dark">{copy.body}</p>
        <p className="mt-3 text-[24px] wrap-break-word text-teal">
          {t(lang, "payeeLabel")}: {pendingPayment.payee}
        </p>
        <p className="text-[28px] font-bold wrap-break-word text-teal">
          {t(lang, "amountLabel")}: {formatRupees(pendingPayment.amount)}
        </p>
        <SpeakAgainButton lang={lang} text={paymentSpeech(lang, pendingPayment, nameVars)} />
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
        <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-red-800">
          {t(lang, "smsWarningTitle")}
        </h1>
        <p className="mt-3 rounded-2xl bg-red-100 px-3 py-3 text-[24px] leading-snug wrap-break-word text-red-950">
          {familyMarked ? t(lang, "smsFamilySpam") : t(lang, "smsWarningBody")}
        </p>
        <p className="mt-3 text-[24px] font-bold wrap-break-word text-teal">{pendingSms.sender}</p>
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
          className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-4 border-teal px-4 text-[24px] font-bold wrap-break-word text-teal"
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
        <h1 className="mt-3 text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "voiceScreenTitle")}
        </h1>
        <p className="mt-2 text-[24px] leading-snug text-teal-dark">
          {t(lang, "voiceScreenHint", nameVars)}
        </p>
        <div className="mt-3">
          <VoiceRecorder from="parent" labels={recorderLabels} />
        </div>
        <h2 className="mt-4 text-[26px] font-bold text-teal">
          {t(lang, "receivedMessages")}
        </h2>
        <div className="mt-4">
          <VoiceMessageList
            messages={familyMessages}
            viewer="parent"
            senderNames={senderNames}
            emptyText={t(lang, "noFamilyMessages")}
            largeControls
          />
        </div>
      </ParentShell>
    );
  }

  if (screen === "send-money") {
    return (
      <ParentSendMoney
        lang={lang}
        names={nameVars}
        payments={payments}
        safePayees={safePayees}
        tryPayment={tryPayment}
        onBack={() => setScreen("home")}
        BackButton={BackButton}
        ParentShell={ParentShell}
        PrimaryButton={PrimaryButton}
      />
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

  const bannerText = t(lang, "newVoiceFromArjun", nameVars);
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
      label: t(lang, "sendMoney"),
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
  ];

  const actionTiles = tiles.filter((tile) => tile.id !== "okay");

  return (
    <ParentShell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight wrap-break-word text-teal">
            {t(lang, "greeting", nameVars)}
          </h1>
          <p className="mt-1 text-[24px] leading-snug text-teal-dark">
            {lastCheckIn
              ? t(lang, "checkedIn")
              : voiceSupported
                ? listening
                  ? t(lang, "listening")
                  : t(lang, "checkInHint")
                : t(lang, "voiceUnsupported")}
          </p>
        </div>
      </div>
      {newestUnheardFamilyMessage ? (
        <div className="mt-3 rounded-2xl bg-yellow-100 px-3 py-3 text-yellow-950">
          <p className="text-[22px] font-bold leading-snug">{bannerText}</p>
          <div className="mt-2">
            <VoiceMessageList
              messages={[newestUnheardFamilyMessage]}
              viewer="parent"
              senderNames={senderNames}
              largeControls
            />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleOkay}
        aria-label={t(lang, "iAmOkay")}
        className="mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-teal px-4 text-[26px] font-bold text-cream"
      >
        <Heart className="size-7 shrink-0" aria-hidden="true" strokeWidth={2.25} />
        {t(lang, "iAmOkay")}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actionTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              aria-label={tile.label}
              className="flex min-h-16 items-center gap-3 rounded-2xl border-4 border-teal bg-white px-3 py-2.5 text-left text-teal"
            >
              <Icon className="size-7 shrink-0" aria-hidden="true" strokeWidth={2.25} />
              <span className="text-[24px] font-bold leading-tight wrap-break-word">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
    </ParentShell>
  );
}

function ParentShell({ children, pin = false }) {
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
    <div className="flex h-dvh justify-center overflow-hidden bg-teal">
      <div className="flex h-full w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-3 font-parent text-teal sm:px-5 sm:py-4">
        <header className="mb-2 flex shrink-0 items-center justify-between gap-3">
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
          <LanguageToggle compact />
        </header>
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            pin ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function BackButton({ lang, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border-2 border-teal px-3 py-1.5 text-[24px] font-bold"
      aria-label={t(lang, "backHome")}
    >
      <ArrowLeft className="size-6" aria-hidden="true" />
      {t(lang, "backHome")}
    </button>
  );
}

function PrimaryButton({ children, onClick, "aria-label": ariaLabel, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`mt-4 inline-flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-teal px-4 text-[26px] font-bold wrap-break-word text-cream ${className}`}
    >
      {children}
    </button>
  );
}
