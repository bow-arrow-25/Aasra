import { useEffect, useState } from "react";
import LanguageToggle from "../LanguageToggle";
import { useGlobalState } from "../../context/GlobalState";
import { t } from "../../lib/i18n";
import { authErrorMessage } from "../../lib/household";
import { loadElderDevice, lockRemainingMs } from "../../lib/session";
import DemoButtons from "./DemoButtons";
import NumberPad from "./NumberPad";

export default function ElderLogin() {
  const { lang, pairElder, unlockElderWithPin } = useGlobalState();
  const paired = Boolean(loadElderDevice()?.pinHash);
  const [step, setStep] = useState(paired ? "pin" : "pair");
  const [digits, setDigits] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockMs, setLockMs] = useState(lockRemainingMs());

  useEffect(() => {
    if (lockMs <= 0) return undefined;
    const timer = window.setInterval(() => {
      const remaining = lockRemainingMs();
      setLockMs(remaining);
      if (remaining <= 0) setError("");
    }, 250);
    return () => window.clearInterval(timer);
  }, [lockMs]);

  const maxLength = step === "pair" ? 6 : 4;
  const locked = step === "pin" && lockMs > 0;

  function title() {
    if (step === "pair") return t(lang, "roomTitle");
    if (step === "set-pin") return t(lang, "pinCreateTitle");
    if (step === "confirm-pin") return t(lang, "pinConfirmTitle");
    return t(lang, "pinEnterTitle");
  }

  function hint() {
    if (step === "pair") return t(lang, "roomHint");
    if (step === "set-pin") return t(lang, "pinCreateHint");
    if (step === "confirm-pin") return t(lang, "pinConfirmHint");
    return t(lang, "pinEnterHint");
  }

  async function submit() {
    if (locked) return;
    setError("");

    if (step === "pair") {
      if (digits.length !== 6) return;
      setPairingCode(digits);
      setDigits("");
      setStep("set-pin");
      return;
    }

    if (step === "set-pin") {
      if (digits.length !== 4) return;
      setPin(digits);
      setDigits("");
      setStep("confirm-pin");
      return;
    }

    if (step === "confirm-pin") {
      if (digits !== pin) {
        setError(t(lang, "pinMismatch"));
        setDigits("");
        setStep("set-pin");
        setPin("");
        return;
      }
      setBusy(true);
      try {
        await pairElder({ pairingCode, pin });
      } catch (caught) {
        setError(caught?.message || authErrorMessage(caught));
        setDigits("");
        setStep("pair");
        setPairingCode("");
        setPin("");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await unlockElderWithPin(digits);
    } catch (caught) {
      setError(caught?.message || t(lang, "pinWrong"));
      setDigits("");
      setLockMs(lockRemainingMs());
    } finally {
      setBusy(false);
    }
  }

  const display =
    step === "pair"
      ? digits.padEnd(6, "·")
      : "•".repeat(digits.length).padEnd(4, "·");

  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <p className="text-[24px] font-bold">{t(lang, "appName")}</p>
          <LanguageToggle />
        </header>
        <h1 className="text-[32px] font-bold leading-tight sm:text-[36px]">{title()}</h1>
        <p className="mt-3 text-[24px] leading-snug text-teal-dark">{hint()}</p>
        <p className="mt-8 min-h-16 text-center text-[32px] font-bold tracking-[0.2em] sm:text-[40px] sm:tracking-[0.35em]">
          {display}
        </p>
        {locked ? (
          <p className="mt-4 text-center text-[24px] font-bold text-red-800" role="alert">
            {t(lang, "pinLocked")} {Math.ceil(lockMs / 1000)}s
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-center text-[24px] text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <NumberPad
          digits={digits}
          maxLength={maxLength}
          onChange={setDigits}
          submitLabel={
            step === "pair" ? t(lang, "roomJoin") : t(lang, "pinNext")
          }
          onSubmit={submit}
          submitDisabled={busy || locked || digits.length !== maxLength}
          clearLabel={t(lang, "roomClear")}
        />
        {paired && step === "pin" ? (
          <button
            type="button"
            className="mt-6 text-center text-[20px] font-bold text-teal"
            onClick={() => {
              setStep("pair");
              setDigits("");
              setError("");
            }}
          >
            {t(lang, "pinUseNewCode")}
          </button>
        ) : null}
        <DemoButtons variant="parent" />
      </div>
    </div>
  );
}
