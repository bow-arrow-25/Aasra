import { stageFromScore } from "../lib/callAnalyzer";

const STAGE_COPY = {
  normal: "Safe so far",
  suspicious: "This call sounds suspicious",
  scam: "This call sounds like a scam",
};

const STAGE_FILL = {
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
  phrases = [],
}) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const stage = stageFromScore(clamped);
  const large = size === "lg";
  const heard = (phrases || []).filter(Boolean);

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
        className={`relative mt-3 overflow-hidden rounded-full bg-slate-200 ${
          large ? "h-8" : "h-4"
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${STAGE_FILL[stage]}`}
          style={{ width: `${clamped === 0 ? 0 : Math.max(clamped, 8)}%` }}
        />
      </div>
      {heard.length ? (
        <p
          className={`mt-2 font-semibold leading-snug wrap-break-word ${STAGE_TEXT[stage]} ${
            large ? "text-[22px]" : "text-xs"
          }`}
        >
          Heard: {heard.join(", ")}
        </p>
      ) : (
        <p className={`mt-2 ${large ? "text-[20px] text-teal" : "text-xs text-slate-500"}`}>
          Listening for scam words…
        </p>
      )}
    </div>
  );
}
