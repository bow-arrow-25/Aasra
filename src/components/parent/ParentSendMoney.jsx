import { useState } from "react";
import { IndianRupee } from "lucide-react";
import NumberPad from "../auth/NumberPad";
import { t } from "../../lib/i18n";
import { formatRupees, parentStatusKey } from "../../lib/payments";

function paymentTone(status) {
  const key = parentStatusKey(status);
  if (key === "statusSent") {
    return {
      card: "border-green-700 bg-green-50",
      status: "text-green-800",
    };
  }
  if (key === "statusWaiting") {
    return {
      card: "border-yellow-600 bg-yellow-50",
      status: "text-yellow-950",
    };
  }
  return {
    card: "border-red-700 bg-red-50",
    status: "text-red-800",
  };
}

function PaymentRow({ payment, lang, names }) {
  const tone = paymentTone(payment.status);
  return (
    <li className={`rounded-2xl border-4 px-3 py-2.5 ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[24px] font-bold leading-tight wrap-break-word text-teal">
          {payment.payee}
        </p>
        <p className="shrink-0 text-[24px] font-bold tabular-nums text-teal">
          {formatRupees(payment.amount)}
        </p>
      </div>
      <p className={`mt-1 text-[24px] font-bold leading-tight wrap-break-word ${tone.status}`}>
        {t(lang, parentStatusKey(payment.status), names)}
      </p>
    </li>
  );
}

export default function ParentSendMoney({
  lang,
  names,
  payments,
  safePayees,
  tryPayment,
  onBack,
  BackButton,
  ParentShell,
  PrimaryButton,
}) {
  const [step, setStep] = useState("list");
  const [payee, setPayee] = useState("");
  const [other, setOther] = useState("");
  const [digits, setDigits] = useState("");
  const history = payments || [];
  const amount = Number(digits) || 0;

  function choosePayee(name) {
    setPayee(name);
    setDigits("");
    setStep("amount");
  }

  function send() {
    if (!payee || amount <= 0) return;
    tryPayment({ payee, amount });
    setStep("list");
    setPayee("");
    setOther("");
    setDigits("");
  }

  if (step === "payee") {
    return (
      <ParentShell pin>
        <BackButton lang={lang} onClick={() => setStep("list")} />
        <h1 className="mt-3 shrink-0 text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "whoToPay")}
        </h1>
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {(safePayees || []).map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => choosePayee(name)}
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border-4 border-teal bg-white px-4 text-left text-[24px] font-bold wrap-break-word text-teal"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
        <PrimaryButton
          className="mt-3"
          onClick={() => setStep("other")}
          aria-label={t(lang, "someoneElse")}
        >
          {t(lang, "someoneElse")}
        </PrimaryButton>
      </ParentShell>
    );
  }

  if (step === "other") {
    return (
      <ParentShell>
        <BackButton lang={lang} onClick={() => setStep("payee")} />
        <h1 className="mt-3 text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "typePayee")}
        </h1>
        <label className="mt-3 grid gap-2 text-[24px] font-bold text-teal">
          {t(lang, "payeeLabel")}
          <input
            value={other}
            onChange={(event) => setOther(event.target.value)}
            className="min-h-14 rounded-2xl border-4 border-teal bg-white px-4 text-[26px] font-bold text-teal"
            autoComplete="off"
          />
        </label>
        <PrimaryButton
          onClick={() => {
            if (!other.trim()) return;
            choosePayee(other.trim());
          }}
          aria-label={t(lang, "howMuch")}
        >
          {t(lang, "howMuch")}
        </PrimaryButton>
      </ParentShell>
    );
  }

  if (step === "amount") {
    return (
      <ParentShell>
        <BackButton lang={lang} onClick={() => setStep("payee")} />
        <h1 className="mt-3 text-[28px] font-bold leading-tight wrap-break-word text-teal">
          {t(lang, "howMuch")}
        </h1>
        <p className="mt-2 text-[24px] wrap-break-word text-teal-dark">{payee}</p>
        <p className="mt-3 text-center text-[36px] font-bold text-teal">
          {formatRupees(amount)}
        </p>
        <NumberPad
          digits={digits}
          maxLength={7}
          onChange={setDigits}
          submitLabel={t(lang, "sendNow")}
          onSubmit={send}
          submitDisabled={amount <= 0}
          clearLabel={t(lang, "roomClear")}
        />
      </ParentShell>
    );
  }

  return (
    <ParentShell pin>
      <BackButton lang={lang} onClick={onBack} />
      <h1 className="mt-3 shrink-0 text-[28px] font-bold leading-tight wrap-break-word text-teal">
        {t(lang, "myPayments")}
      </h1>
      <PrimaryButton
        className="mt-3"
        onClick={() => setStep("payee")}
        aria-label={t(lang, "sendMoney")}
      >
        <IndianRupee className="size-7" aria-hidden="true" />
        {t(lang, "sendMoney")}
      </PrimaryButton>
      {history.length === 0 ? (
        <p className="mt-4 text-[24px] leading-snug text-teal">
          {t(lang, "noPaymentsYet")}
        </p>
      ) : (
        <section className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-baseline justify-between gap-3">
            <h2 className="text-[24px] font-bold text-teal">{t(lang, "recentPayments")}</h2>
            <p className="text-[24px] tabular-nums text-teal-dark">{history.length}</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <ul className="absolute inset-0 space-y-2 overflow-y-auto pr-1">
              {history.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  lang={lang}
                  names={names}
                />
              ))}
            </ul>
            {history.length > 3 ? (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-cream to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-cream to-transparent"
                />
              </>
            ) : null}
          </div>
        </section>
      )}
    </ParentShell>
  );
}
