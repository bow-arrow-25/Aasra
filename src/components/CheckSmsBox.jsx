import { useState } from "react";
import { analyzeSms, SAMPLE_SMS, SMS_LABEL_BADGE } from "../lib/smsAnalyzer";
import { t } from "../lib/i18n";

const DEMO_EXAMPLES = [
  { id: "kyc", labelKey: "demoSmsKyc", sample: SAMPLE_SMS[0] },
  { id: "lottery", labelKey: "demoSmsLottery", sample: SAMPLE_SMS[1] },
  { id: "otp", labelKey: "demoSmsOtp", sample: SAMPLE_SMS[5] },
];

export default function CheckSmsBox({
  lang = "en",
  large = false,
  spamSenders = [],
  onReceive,
}) {
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState(null);
  const demo = typeof onReceive === "function";

  function fillExample(sample) {
    setSender(sample.sender);
    setBody(sample.body);
    setResult(null);
  }

  function handleCheck() {
    const analysis = analyzeSms({
      sender: sender.trim() || "Unknown",
      body,
      spamSenders,
    });
    setResult(analysis);
  }

  function handleShow() {
    const text = body.trim();
    if (!text) return;
    onReceive({
      sender: sender.trim() || "Unknown",
      body: text,
    });
    setSender("");
    setBody("");
    setResult(null);
  }

  const textClass = large ? "text-[24px]" : "text-sm";
  const inputClass = large
    ? "mt-1 w-full rounded-2xl border-4 border-teal bg-white px-3 py-2 text-[24px] text-teal"
    : "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";

  return (
    <section className={large ? "mt-3 shrink-0" : "rounded-2xl bg-white p-4 shadow-sm"}>
      <h2 className={large ? "text-[26px] font-bold text-teal" : "text-lg font-semibold"}>
        {t(lang, demo ? "tryMessageTitle" : "checkMessageTitle")}
      </h2>
      <p className={large ? "mt-1 text-[24px] leading-snug text-teal-dark" : "mt-1 text-sm text-slate-600"}>
        {t(lang, demo ? "tryMessageHint" : "checkMessageHint")}
      </p>
      {demo ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => fillExample(example.sample)}
              className="min-h-11 rounded-xl border-2 border-teal bg-white px-3 text-[20px] font-bold text-teal"
            >
              {t(lang, example.labelKey)}
            </button>
          ))}
        </div>
      ) : null}
      <label className={`mt-3 block font-semibold ${textClass}`}>
        {t(lang, "smsSender")}
        <input
          value={sender}
          onChange={(event) => setSender(event.target.value)}
          className={inputClass}
          placeholder={large ? "VM-SBIBNK" : "Sender"}
        />
      </label>
      <label className={`mt-3 block font-semibold ${textClass}`}>
        {t(lang, "smsBody")}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={large ? 2 : 5}
          className={inputClass}
          placeholder={t(lang, "checkMessagePlaceholder")}
        />
      </label>
      <button
        type="button"
        onClick={demo ? handleShow : handleCheck}
        disabled={demo && !body.trim()}
        className={
          large
            ? "mt-3 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-teal px-4 text-[26px] font-bold text-cream disabled:opacity-40"
            : "mt-3 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
        }
        aria-label={t(lang, demo ? "showMessageAction" : "checkMessageAction")}
      >
        {t(lang, demo ? "showMessageAction" : "checkMessageAction")}
      </button>
      {!demo && result ? (
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
