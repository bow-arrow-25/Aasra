import { useState } from "react";
import { Play } from "lucide-react";
import { authErrorMessage } from "../../lib/household";
import { showDemoLoginButtons, useGlobalState } from "../../context/GlobalState";

export default function DemoButtons({ variant = "dashboard" }) {
  const { startDemoFamily, startDemoElder } = useGlobalState();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  if (!showDemoLoginButtons()) return null;

  const wrap = variant === "parent" ? "mt-8 grid gap-3" : "mt-8 grid gap-2";

  async function run(kind) {
    setError("");
    setBusy(kind);
    try {
      if (kind === "family") await startDemoFamily();
      else await startDemoElder();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={wrap}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-aqua-200">
        Hackathon demo
      </p>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-500/20 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {variant === "dashboard" ? (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cream/25 bg-cream/10 px-4 py-3 text-sm font-semibold text-cream"
          disabled={Boolean(busy)}
          onClick={() => run("family")}
          aria-label="Demo: Family dashboard"
        >
          <Play className="size-4" aria-hidden="true" />
          {busy === "family" ? "Please wait…" : "Demo: Family dashboard"}
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cream/25 bg-cream/10 px-4 py-3 text-sm font-semibold text-aqua-100"
          disabled={Boolean(busy)}
          onClick={() => run("elder")}
          aria-label="Demo: Parent phone"
        >
          <Play className="size-4" aria-hidden="true" />
          {busy === "elder" ? "Please wait…" : "Demo: Parent phone"}
        </button>
      )}
    </div>
  );
}
