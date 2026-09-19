import { useEffect, useState } from "react";
import { formatCountdown, todaysReminders } from "../../lib/reminders";
import { t } from "../../lib/i18n";

export default function ParentReminders({
  lang,
  reminders,
  onBack,
  BackButton,
  ParentShell,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const today = todaysReminders(reminders, now);

  return (
    <ParentShell>
      <BackButton lang={lang} onClick={onBack} />
      <h1 className="mt-6 text-[32px] font-bold leading-tight wrap-break-word text-teal sm:text-[40px]">
        {t(lang, "remindersTile")}
      </h1>
      {today.length === 0 ? (
        <p className="mt-8 text-[28px] leading-snug text-teal">
          {t(lang, "reminderNoToday")}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {today.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border-4 px-4 py-5 ${
                item.status === "DUE"
                  ? "border-red-700 bg-red-50"
                  : item.status === "MISSED"
                    ? "border-yellow-600 bg-yellow-50"
                    : item.status === "DONE"
                      ? "border-green-700 bg-green-50"
                      : "border-teal bg-white"
              }`}
            >
              <p className="text-[32px] font-bold leading-tight wrap-break-word text-teal">
                {item.title}
              </p>
              {item.note ? (
                <p className="mt-2 text-[24px] leading-snug wrap-break-word text-teal-dark">
                  {item.note}
                </p>
              ) : null}
              <p className="mt-3 text-[28px] font-bold tabular-nums text-teal">
                {item.status === "DONE"
                  ? t(lang, "reminderDone")
                  : item.status === "MISSED"
                    ? t(lang, "reminderMissed")
                    : formatCountdown(item.dueAt, now)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ParentShell>
  );
}
