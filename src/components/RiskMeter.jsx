import { stageFromScore } from "../lib/callAnalyzer";

const STAGE_COPY = {
  normal: "Safe so far",
  suspicious: "This call sounds suspicious",
  scam: "This call sounds like a scam",
};

const STAGE_BAR = {
  normal: "bg-green-600",
  suspicious: "bg-yellow-400",
  scam: "bg-red-600",
};

const STAGE_TEXT = {
  normal: "text-green-800",
  suspicious: "text-yellow-900",
  scam: "text-red-800",
};

export default function RiskMeter({
  score = 0,
  size = "md",
  label,
}) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const stage = stageFromScore(clamped);
  const large = size === "lg";

  return (
    <div
      className={`w-full rounded-2xl ${
        large ? "bg-white p-4" : "bg-slate-50 p-3"
      }`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label || `Call risk ${clamped} percent, ${STAGE_COPY[stage]}`}
    >
      <div className="flex items-end justify-between gap-3">
        <p
          className={`font-bold leading-tight ${STAGE_TEXT[stage]} ${
            large ? "text-[28px]" : "text-sm"
          }`}
        >
          {label || STAGE_COPY[stage]}
        </p>
        <p
          className={`shrink-0 font-bold tabular-nums ${STAGE_TEXT[stage]} ${
            large ? "text-[32px]" : "text-lg"
          }`}
        >
          {clamped}
        </p>
      </div>
      <div
        className={`relative mt-3 overflow-hidden rounded-full bg-linear-to-r from-green-500 via-yellow-300 to-red-500 ${
          large ? "h-5" : "h-3"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white shadow ${STAGE_BAR[stage]}`}
          style={{ left: `calc(${clamped}% - 0.5rem)` }}
        />
      </div>
    </div>
  );
}
