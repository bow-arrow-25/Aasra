import { useGlobalState } from "../context/GlobalState";

const OPTIONS = [
  { id: "en", label: "EN" },
  { id: "te", label: "తె" },
  { id: "hi", label: "हि" },
];

export default function LanguageToggle({ compact = false }) {
  const { lang, setLang } = useGlobalState();

  return (
    <div
      role="group"
      aria-label="Language"
      className={`flex ${compact ? "gap-1" : "flex-wrap gap-2"}`}
    >
      {OPTIONS.map((option) => {
        const selected = lang === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLang(option.id)}
            aria-pressed={selected}
            className={`rounded-xl font-bold ${
              compact
                ? "min-h-10 min-w-11 px-2 text-[20px]"
                : "min-h-12 min-w-14 px-3 text-[24px]"
            } ${
              selected
                ? "bg-teal text-cream"
                : "border-2 border-teal bg-cream text-teal"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
