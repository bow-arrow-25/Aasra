import { Play } from "lucide-react";
import { showDemoLoginButtons, useGlobalState } from "../../context/GlobalState";

export default function DemoButtons({ variant = "dashboard" }) {
  const { demoMode, startDemoFamily, startDemoElder } = useGlobalState();
  if (!showDemoLoginButtons(demoMode)) return null;

  const familyClass =
    variant === "parent"
      ? "inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-teal px-4 text-[24px] font-bold text-cream"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-cream";
  const elderClass =
    variant === "parent"
      ? "inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-4 border-teal bg-white px-4 text-[24px] font-bold text-teal"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold";

  return (
    <div className={variant === "parent" ? "mt-8 grid gap-3" : "mt-6 grid gap-2"}>
      <p className={variant === "parent" ? "text-center text-[24px] text-teal" : "text-sm font-semibold text-slate-500"}>
        Demo
      </p>
      <button
        type="button"
        className={familyClass}
        onClick={() => startDemoFamily()}
        aria-label="Demo: Family"
      >
        <Play className="size-4" aria-hidden="true" />
        Demo: Family
      </button>
      <button
        type="button"
        className={elderClass}
        onClick={() => startDemoElder()}
        aria-label="Demo: Amma"
      >
        <Play className="size-4" aria-hidden="true" />
        Demo: Amma
      </button>
    </div>
  );
}
