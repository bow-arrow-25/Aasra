import { useState } from "react";
import { useGlobalState } from "../../context/GlobalState";
import { t } from "../../lib/i18n";
import { formatTime } from "../family/helpers";
import CheckSmsBox from "../CheckSmsBox";

function smsTone(message) {
  if (message.familyVerdict === "SPAM" || message.analysis?.label === "SCAM") {
    return "scam";
  }
  if (message.familyVerdict === "SAFE") return "safe";
  if (message.analysis?.label === "SUSPICIOUS") return "warn";
  return "ok";
}

export default function ParentMessages({ lang, onBack, BackButton, ParentShell, PrimaryButton }) {
  const {
    messages,
    spamSenders,
    deleteSms,
    askFamilyAboutSms,
    receiveSms,
  } = useGlobalState();
  const [openId, setOpenId] = useState(null);
  const visible = (messages || []).filter((item) => !item.deletedByElder);
  const opened = visible.find((item) => item.id === openId) || null;

  if (opened) {
    const tone = smsTone(opened);
    return (
      <ParentShell>
        <BackButton lang={lang} onClick={() => setOpenId(null)} />
        <h1 className="mt-3 text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {opened.sender}
        </h1>
        {opened.familyVerdict === "SPAM" ? (
          <p className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] font-bold leading-snug text-red-950">
            {t(lang, "smsFamilySpam")}
          </p>
        ) : tone === "scam" ? (
          <p className="mt-4 rounded-2xl bg-red-100 p-4 text-[24px] font-bold leading-snug text-red-950">
            {t(lang, "smsLikelyScam")}
          </p>
        ) : opened.familyVerdict === "SAFE" ? (
          <p className="mt-4 rounded-2xl bg-green-100 p-4 text-[24px] font-bold leading-snug text-green-900">
            {t(lang, "smsFamilySafe")}
          </p>
        ) : null}
        <p className="mt-4 text-[24px] leading-snug wrap-break-word text-teal-dark">{opened.body}</p>
        {opened.analysis?.reasons?.length ? (
          <ul className="mt-4 list-disc space-y-2 pl-6 text-[24px] text-teal-dark">
            {opened.analysis.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <PrimaryButton
          onClick={() => {
            deleteSms(opened.id);
            setOpenId(null);
          }}
          aria-label={t(lang, "smsDelete")}
        >
          {t(lang, "smsDelete")}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => {
            askFamilyAboutSms(opened.id);
            setOpenId(null);
          }}
          className="mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-4 border-teal px-4 text-[24px] font-bold wrap-break-word text-teal"
          aria-label={t(lang, "collectAskFamily")}
        >
          {t(lang, "collectAskFamily")}
        </button>
      </ParentShell>
    );
  }

  return (
    <ParentShell pin>
      <BackButton lang={lang} onClick={onBack} />
      <h1 className="mt-3 shrink-0 text-[28px] font-bold leading-tight wrap-break-word text-teal">
        {t(lang, "messagesTile")}
      </h1>
      <CheckSmsBox lang={lang} large spamSenders={spamSenders} onReceive={receiveSms} />
      {visible.length === 0 ? (
        <p className="mt-3 text-[24px] text-teal">{t(lang, "smsEmpty")}</p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {visible.map((message) => {
            const tone = smsTone(message);
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(message.id)}
                  className={`w-full rounded-2xl border-4 px-3 py-3 text-left ${
                    tone === "scam"
                      ? "border-red-700 bg-red-100 text-red-950"
                      : tone === "warn"
                        ? "border-yellow-600 bg-yellow-50 text-yellow-950"
                        : "border-teal bg-white text-teal"
                  }`}
                  aria-label={`Open message from ${message.sender}`}
                >
                  <p className="text-[24px] font-bold wrap-break-word">{message.sender}</p>
                  <p className="mt-1 line-clamp-2 text-[24px] leading-snug wrap-break-word">
                    {message.body}
                  </p>
                  {tone === "scam" ? (
                    <p className="mt-2 text-[24px] font-bold">{t(lang, "smsLikelyScam")}</p>
                  ) : null}
                  {message.familyVerdict === "SPAM" ? (
                    <p className="mt-2 text-[24px] font-bold">{t(lang, "smsFamilySpam")}</p>
                  ) : null}
                  <p className="mt-1 text-[20px] opacity-80">{formatTime(message.time)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ParentShell>
  );
}
