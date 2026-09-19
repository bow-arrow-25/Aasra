import { useGlobalState } from "../context/GlobalState";

const OPTIONS = [
  { id: "en", label: "EN" },
  { id: "te", label: "తె" },
  { id: "hi", label: "हि" },
];

export default function LanguageToggle() {
  const { lang, setLang } = useGlobalState();

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex flex-wrap gap-2"
    >
      {OPTIONS.map((option) => {
        const selected = lang === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLang(option.id)}
            aria-pressed={selected}
            className={`min-h-12 min-w-14 rounded-xl px-3 text-[24px] font-bold ${
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
