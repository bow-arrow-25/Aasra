import { useEffect } from "react";
import { Volume2 } from "lucide-react";
import { t } from "../../lib/i18n";
import { speak } from "../../lib/speak";

const TONE = {
  SCAM: "bg-red-100 text-red-950",
  SUSPICIOUS: "bg-yellow-100 text-yellow-950",
  SAFE: "bg-green-100 text-green-950",
};

function resultCopy(lang, label) {
  if (label === "SCAM") {
    return {
      title: t(lang, "smsWarningTitle"),
      body: t(lang, "smsLikelyScam"),
    };
  }
  if (label === "SUSPICIOUS") {
    return {
      title: t(lang, "smsSuspicious"),
      body: t(lang, "smsSuspicious"),
    };
  }
  return {
    title: t(lang, "smsLooksSafe"),
    body: t(lang, "smsLooksSafe"),
  };
}

export default function ParentShareResult({
  lang,
  message,
  onDone,
  ParentShell,
}) {
  const label = message.analysis?.label || "SAFE";
  const copy = resultCopy(lang, label);
  const reasons = message.analysis?.reasons || [];
  const speech = `${copy.title}. ${message.body || ""}`;

  useEffect(() => {
    speak(speech, lang);
  }, [message.id, lang, speech]);

  return (
    <ParentShell>
      <h1
        className={`rounded-2xl p-4 text-[32px] font-bold leading-tight wrap-break-word sm:text-[40px] ${TONE[label] || TONE.SAFE}`}
      >
        {copy.title}
      </h1>
      <p className="mt-4 text-[24px] font-bold wrap-break-word text-teal">
        {message.sender}
      </p>
      <p className="mt-3 text-[24px] leading-snug wrap-break-word text-teal-dark">
        {message.body}
      </p>
      {reasons.length ? (
        <ul className="mt-6 grid gap-2">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="rounded-xl bg-white px-4 py-3 text-[24px] leading-snug wrap-break-word text-teal-dark"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[24px] leading-snug text-teal">{copy.body}</p>
      )}
      <button
        type="button"
        onClick={() => speak(speech, lang)}
        className="mt-6 inline-flex min-h-14 items-center gap-2 self-start rounded-xl border-2 border-teal px-4 text-[24px] font-bold text-teal"
        aria-label={t(lang, "hearAgain")}
      >
        <Volume2 className="size-6" aria-hidden="true" />
        {t(lang, "hearAgain")}
      </button>
      <button
        type="button"
        onClick={onDone}
        aria-label={t(lang, "gotIt")}
        className="mt-10 inline-flex min-h-22 w-full items-center justify-center rounded-2xl bg-teal px-6 text-[32px] font-bold text-cream"
      >
        {t(lang, "gotIt")}
      </button>
    </ParentShell>
  );
}
