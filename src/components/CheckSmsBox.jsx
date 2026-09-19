import { useState } from "react";
import { analyzeSms, SMS_LABEL_BADGE } from "../lib/smsAnalyzer";
import { t } from "../lib/i18n";

export default function CheckSmsBox({ lang = "en", large = false, spamSenders = [] }) {
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState(null);

  function handleCheck() {
    const analysis = analyzeSms({
      sender: sender.trim() || "Unknown",
      body,
      spamSenders,
    });
    setResult(analysis);
  }

  const textClass = large ? "text-[24px]" : "text-sm";
  const inputClass = large
    ? "mt-2 w-full rounded-2xl border-4 border-teal bg-white px-4 py-3 text-[24px] text-teal"
    : "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";

  return (
    <section className={large ? "mt-8" : "rounded-2xl bg-white p-4 shadow-sm"}>
      <h2 className={large ? "text-[28px] font-bold text-teal" : "text-lg font-semibold"}>
        {t(lang, "checkMessageTitle")}
      </h2>
      <p className={large ? "mt-2 text-[24px] text-teal-dark" : "mt-1 text-sm text-slate-600"}>
        {t(lang, "checkMessageHint")}
      </p>
      <label className={`mt-4 block font-semibold ${textClass}`}>
        {t(lang, "smsSender")}
        <input
          value={sender}
          onChange={(event) => setSender(event.target.value)}
          className={inputClass}
          placeholder={large ? "VM-SBIBNK" : "Sender"}
        />
      </label>
      <label className={`mt-4 block font-semibold ${textClass}`}>
        {t(lang, "smsBody")}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={large ? 4 : 5}
          className={inputClass}
          placeholder={t(lang, "checkMessagePlaceholder")}
        />
      </label>
      <button
        type="button"
        onClick={handleCheck}
        className={
          large
            ? "mt-4 inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-teal px-6 text-[28px] font-bold text-cream"
            : "mt-3 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-cream"
        }
        aria-label={t(lang, "checkMessageAction")}
      >
        {t(lang, "checkMessageAction")}
      </button>
      {result ? (
        <div
          className={`mt-4 rounded-2xl p-4 ${
            result.label === "SCAM"
              ? "bg-red-100 text-red-950"
              : result.label === "SUSPICIOUS"
                ? "bg-yellow-100 text-yellow-950"
                : "bg-green-50 text-green-900"
          }`}
          role="status"
        >
          <p className={large ? "text-[28px] font-bold" : "font-semibold"}>
            <span
              className={`mr-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                SMS_LABEL_BADGE[result.label]
              }`}
            >
              {result.label}
            </span>
            {result.label === "SCAM"
              ? t(lang, "smsLikelyScam")
              : result.label === "SUSPICIOUS"
                ? t(lang, "smsSuspicious")
                : t(lang, "smsLooksSafe")}
          </p>
          <p className={large ? "mt-2 text-[24px]" : "mt-1 text-sm"}>Score {result.score}/100</p>
          {result.reasons.length > 0 ? (
            <ul className={`mt-2 list-disc pl-5 ${large ? "text-[24px]" : "text-sm"}`}>
              {result.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
