import { useEffect, useRef } from "react";
import { Bell, Heart, Phone, Pill } from "lucide-react";
import { startSoftChime } from "../../lib/demoAudio";
import { t } from "../../lib/i18n";
import { speak } from "../../lib/speak";

const ICONS = {
  medicine: Pill,
  checkin: Heart,
  call: Phone,
  custom: Bell,
};

export default function ReminderPopup({ lang, reminder, onDone }) {
  const spokenRef = useRef("");
  const speech = [reminder.title, reminder.note].filter(Boolean).join(". ");

  useEffect(() => {
    const key = `${reminder.id}:${lang}`;
    if (spokenRef.current !== key) {
      spokenRef.current = key;
      speak(speech, lang);
    }
    const stop = startSoftChime(3000);
    return () => stop();
  }, [reminder.id, lang, speech]);

  const Icon = ICONS[reminder.type] || Bell;

  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        <Icon className="mx-auto size-16" aria-hidden="true" strokeWidth={2.25} />
        <h1 className="mt-6 text-center text-[36px] font-bold leading-tight wrap-break-word sm:text-[40px]">
          {reminder.title}
        </h1>
        {reminder.note ? (
          <p className="mt-4 text-center text-[28px] leading-snug wrap-break-word text-teal-dark">
            {reminder.note}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => speak(speech, lang)}
          className="mt-6 inline-flex min-h-14 items-center justify-center self-center rounded-xl border-2 border-teal px-4 text-[24px] font-bold"
          aria-label={t(lang, "hearAgain")}
        >
          {t(lang, "hearAgain")}
        </button>
        <button
          type="button"
          onClick={() => onDone(reminder.id)}
          aria-label={t(lang, "reminderDone")}
          className="mt-auto inline-flex min-h-28 w-full items-center justify-center rounded-3xl bg-teal px-6 text-[40px] font-bold text-cream"
        >
          {t(lang, "reminderDone")}
        </button>
      </div>
    </div>
  );
}
