import { DEMO_SCAM_LINES } from "../lib/callAnalyzer";
import { useGlobalState } from "../context/GlobalState";

export default function ScamPhraseChips({ large = false }) {
  const { appendCallTranscript, activeCall } = useGlobalState();
  if (!activeCall?.answered) return null;

  return (
    <div className={`grid gap-2 ${large ? "mt-4" : "mt-3"}`}>
      <p className={large ? "text-[22px] font-bold text-teal" : "text-xs font-semibold text-slate-600"}>
        Tap a scam line if the bar is still at 0
      </p>
      <div className={`grid gap-2 ${large ? "" : "sm:grid-cols-3"}`}>
        {DEMO_SCAM_LINES.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() =>
              appendCallTranscript({
                speaker: "caller",
                text: item.text,
                time: Date.now(),
              })
            }
            className={
              large
                ? "min-h-16 rounded-2xl bg-red-700 px-4 text-[24px] font-bold text-white"
                : "rounded-xl bg-red-700 px-3 py-2 text-sm font-semibold text-white"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
