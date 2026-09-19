import { useState } from "react";
import LanguageToggle from "./LanguageToggle";
import { useGlobalState } from "../context/GlobalState";
import { t } from "../lib/i18n";

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "join"];

export function ParentJoinRoom() {
  const { lang, joinRoom } = useGlobalState();
  const [digits, setDigits] = useState("");

  function press(value) {
    if (value === "clear") {
      setDigits("");
      return;
    }
    if (value === "join") {
      if (digits.length === 6) joinRoom(digits, "parent");
      return;
    }
    setDigits((current) => (current.length < 6 ? `${current}${value}` : current));
  }

  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <p className="text-[24px] font-bold">{t(lang, "appName")}</p>
          <LanguageToggle />
        </header>
        <h1 className="text-[32px] font-bold leading-tight sm:text-[36px]">
          {t(lang, "roomTitle")}
        </h1>
        <p className="mt-3 text-[24px] leading-snug text-teal-dark">
          {t(lang, "roomHint")}
        </p>
        <p className="mt-8 min-h-16 text-center text-[32px] font-bold tracking-[0.2em] sm:text-[40px] sm:tracking-[0.35em]">
          {digits.padEnd(6, "·")}
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {PAD.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={key === "join" && digits.length !== 6}
              aria-label={
                key === "clear"
                  ? t(lang, "roomClear")
                  : key === "join"
                    ? t(lang, "roomJoin")
                    : `Digit ${key}`
              }
              className={`min-h-20 rounded-2xl text-[28px] font-bold disabled:opacity-40 ${
                key === "join"
                  ? "bg-teal text-cream"
                  : "border-4 border-teal bg-white text-teal"
              }`}
            >
              {key === "clear"
                ? t(lang, "roomClear")
                : key === "join"
                  ? t(lang, "roomJoin")
                  : key}
            </button>
          ))}
        </div>
        {digits.length > 0 && digits.length < 6 ? (
          <p className="mt-6 text-center text-[24px]">{t(lang, "roomNeedSix")}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FamilyCreateRoom() {
  const { createFamilyRoom, joinRoom, syncMode } = useGlobalState();
  const [manual, setManual] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-50 px-4">
      <div className="w-full max-w-lg min-w-0 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-teal">Aasra</p>
        <h1 className="mt-2 text-2xl font-semibold">Create a family room</h1>
        <p className="mt-3 text-slate-600">
          Make a 6-digit code and type the same numbers on the parent phone.
          {syncMode === "firebase"
            ? " This room syncs over the internet."
            : " No Firebase .env yet, so this demo syncs only in the same browser."}
        </p>
        <button
          type="button"
          onClick={() => createFamilyRoom()}
          className="mt-6 w-full rounded-xl bg-teal px-4 py-3 font-semibold text-cream"
          aria-label="Create a 6-digit family room code"
        >
          Create 6-digit code
        </button>
        <p className="mt-8 text-sm font-semibold text-slate-500">
          Already have a code?
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            inputMode="numeric"
            maxLength={6}
            value={manual}
            onChange={(event) =>
              setManual(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 tracking-[0.3em]"
            placeholder="000000"
            aria-label="Family room code"
          />
          <button
            type="button"
            onClick={() => joinRoom(manual, "family")}
            disabled={manual.length !== 6}
            className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
            aria-label="Join family room with this code"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
