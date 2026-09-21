import { useEffect, useState } from "react";
import LanguageToggle from "../LanguageToggle";
import { useGlobalState } from "../../context/GlobalState";
import { t } from "../../lib/i18n";
import { authErrorMessage, getHousehold, lookupHouseholdIdByCode } from "../../lib/household";
import { loadElderDevice, lockRemainingMs } from "../../lib/session";
import DemoButtons from "./DemoButtons";
import NumberPad from "./NumberPad";

export default function ElderLogin({ onBack }) {
  const { lang, pairElder, unlockElderWithPin } = useGlobalState();
  const paired = Boolean(loadElderDevice()?.pinHash);
  const [step, setStep] = useState(paired ? "pin" : "pair");
  const [digits, setDigits] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [room, setRoom] = useState("");
  const [residentName, setResidentName] = useState("");
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
  const textStep = step === "room" || step === "name";
  const locked = step === "pin" && lockMs > 0;

  function title() {
    if (step === "pair") return t(lang, "roomTitle");
    if (step === "room") return t(lang, "careRoomTitle");
    if (step === "name") return t(lang, "careNameTitle");
    if (step === "set-pin") return t(lang, "pinCreateTitle");
    if (step === "confirm-pin") return t(lang, "pinConfirmTitle");
    return t(lang, "pinEnterTitle");
  }

  function hint() {
    if (step === "pair") return t(lang, "roomHint");
    if (step === "room") return t(lang, "careRoomHint");
    if (step === "name") return t(lang, "careNameHint");
    if (step === "set-pin") return t(lang, "pinCreateHint");
    if (step === "confirm-pin") return t(lang, "pinConfirmHint");
    return t(lang, "pinEnterHint");
  }

  async function submit() {
    if (locked) return;
    setError("");

    if (step === "pair") {
      if (digits.length !== 6) return;
      setBusy(true);
      try {
        const householdId = await lookupHouseholdIdByCode(digits);
        if (!householdId) throw new Error("That family code was not found.");
        const household = await getHousehold(householdId);
        if (!household) throw new Error("That family code was not found.");
        setPairingCode(digits);
        setDigits("");
        const org = household.kind === "org" || household.profile?.kind === "org";
        setStep(org ? "room" : "set-pin");
      } catch (caught) {
        setError(caught?.message || authErrorMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === "room") {
      if (!room.trim()) {
        setError(t(lang, "careRoomHint"));
        return;
      }
      setError("");
      setStep("name");
      return;
    }

    if (step === "name") {
      if (!residentName.trim()) {
        setError(t(lang, "careNameHint"));
        return;
      }
      setError("");
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
        await pairElder({ pairingCode, pin, room, name: residentName });
      } catch (caught) {
        setError(caught?.message || authErrorMessage(caught));
        setDigits("");
        setStep("pair");
        setPairingCode("");
        setRoom("");
        setResidentName("");
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
        {textStep ? (
          <label className="mt-8 grid gap-2 text-[24px] font-bold">
            {step === "room" ? t(lang, "careRoomTitle") : t(lang, "careNameTitle")}
            <input
              value={step === "room" ? room : residentName}
              onChange={(event) =>
                step === "room"
                  ? setRoom(event.target.value)
                  : setResidentName(event.target.value)
              }
              className="min-h-16 rounded-2xl border-4 border-teal bg-white px-4 text-[28px] font-bold text-teal"
              autoComplete="off"
            />
          </label>
        ) : (
          <p className="mt-8 min-h-16 text-center text-[32px] font-bold tracking-[0.2em] sm:text-[40px] sm:tracking-[0.35em]">
            {display}
          </p>
        )}
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
        {textStep ? (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-6 inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-teal text-[26px] font-bold text-cream disabled:opacity-40"
          >
            {t(lang, "careNameNext")}
          </button>
        ) : (
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
        )}
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
        {onBack ? (
          <button
            type="button"
            className="mt-6 text-center text-[20px] font-bold text-teal"
            onClick={onBack}
          >
            Back to Aasra
          </button>
        ) : null}
        <DemoButtons variant="parent" />
      </div>
    </div>
  );
}
