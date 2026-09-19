import { useEffect, useRef, useState } from "react";
import { useGlobalState } from "./context/GlobalState";
import ReportModal, { isReportableEvent } from "./components/ReportModal";
import VoiceMessageList from "./components/VoiceMessageList";
import VoiceRecorder from "./components/VoiceRecorder";

const BADGE = {
  INFO: "bg-green-100 text-green-800",
  WARN: "bg-yellow-100 text-yellow-800",
  CRITICAL: "bg-red-100 text-red-800",
};

function formatTime(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function checkInTone(lastCheckIn) {
  if (!lastCheckIn) return "CRITICAL";
  const hours = (Date.now() - lastCheckIn) / (1000 * 60 * 60);
  if (hours <= 12) return "INFO";
  return "WARN";
}

function notificationSupported() {
  return typeof Notification !== "undefined";
}

function showHiddenTabNotification({ title, body, tag }) {
  if (!notificationSupported()) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
    return;
  }
  try {
    new Notification(title, { body, tag });
  } catch {
    /* ignore browsers that reject Notification construction */
  }
}

export default function ChildDashboard() {
  const {
    parentName,
    lastCheckIn,
    events,
    messages,
    safePayees,
    familyMembers,
    pendingPayment,
    acknowledgeEvent,
    rejectPayment,
    roomCode,
    syncMode,
    resetDemo,
  } = useGlobalState();
  const [reportEvent, setReportEvent] = useState(null);
  const [notifyPerm, setNotifyPerm] = useState(() =>
    notificationSupported() ? Notification.permission : "unsupported"
  );
  const seenAlertIdsRef = useRef(new Set());
  const alertsPrimedRef = useRef(false);
  const primaryMember = familyMembers.find((member) => member.role === "primary");
  const tone = checkInTone(lastCheckIn);

  useEffect(() => {
    if (!notificationSupported()) {
      setNotifyPerm("unsupported");
      return undefined;
    }
    function syncPermission() {
      setNotifyPerm(Notification.permission);
    }
    syncPermission();
    document.addEventListener("visibilitychange", syncPermission);
    return () => document.removeEventListener("visibilitychange", syncPermission);
  }, []);

  useEffect(() => {
    if (!alertsPrimedRef.current) {
      events.forEach((event) => seenAlertIdsRef.current.add(event.id));
      messages.forEach((message) =>
        seenAlertIdsRef.current.add(`msg-${message.id}`)
      );
      alertsPrimedRef.current = true;
      return;
    }

    const freshEvents = events.filter(
      (event) => !seenAlertIdsRef.current.has(event.id)
    );
    freshEvents.forEach((event) => seenAlertIdsRef.current.add(event.id));
    for (const event of freshEvents) {
      if (event.level !== "WARN" && event.level !== "CRITICAL") continue;
      showHiddenTabNotification({
        title: `Aasra · ${event.level}`,
        body: event.detail ? `${event.message} — ${event.detail}` : event.message,
        tag: `event-${event.id}`,
      });
    }

    const freshMessages = messages.filter(
      (message) => !seenAlertIdsRef.current.has(`msg-${message.id}`)
    );
    freshMessages.forEach((message) =>
      seenAlertIdsRef.current.add(`msg-${message.id}`)
    );
    for (const message of freshMessages) {
      if (message.from !== "parent") continue;
      showHiddenTabNotification({
        title: "Aasra · Voice message",
        body: `New voice message from ${parentName}`,
        tag: `msg-${message.id}`,
      });
    }
  }, [events, messages, parentName]);

  async function enableDesktopAlerts() {
    if (!notificationSupported()) {
      setNotifyPerm("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyPerm(result);
  }
  const openCritical = events.filter(
    (event) => event.level === "CRITICAL" && !event.acknowledged
  ).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-teal">Aasra</p>
            <h1 className="text-2xl font-semibold">Family dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Room {roomCode || "------"} ·{" "}
              {syncMode === "firebase" ? "internet sync" : "same-browser demo"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {notifyPerm === "granted" ? (
              <span className="whitespace-nowrap text-sm text-slate-500">Desktop alerts on</span>
            ) : notifyPerm === "unsupported" ? (
              <span className="whitespace-nowrap text-sm text-slate-400">Alerts not supported</span>
            ) : (
              <button
                type="button"
                onClick={enableDesktopAlerts}
                className="whitespace-nowrap rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white"
                aria-label="Enable desktop notification alerts"
              >
                Enable desktop alerts
              </button>
            )}
            <button
              type="button"
              onClick={resetDemo}
              className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              aria-label="Reset demo and clear the family room"
            >
              Reset demo
            </button>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${BADGE[tone]}`}>
            {openCritical > 0
              ? `${openCritical} critical`
              : lastCheckIn
                ? "Parent checked in"
                : "Waiting for check-in"}
          </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold">Check-in</h2>
          <p className="mt-2 text-slate-600">{parentName}</p>
          <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${BADGE[tone]}`}>
            {formatTime(lastCheckIn)}
          </p>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Family members
          </h3>
          <ul className="mt-3 space-y-2">
            {familyMembers.map((member) => (
              <li
                key={`${member.role}-${member.name}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="font-medium">{member.name}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Safe payees
          </h3>
          <ul className="mt-3 space-y-2">
            {safePayees.map((payee) => (
              <li key={payee} className="rounded-lg bg-green-50 px-3 py-2 text-green-800">
                {payee}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">Events</h2>
          {pendingPayment && !pendingPayment.rejected ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900">Pending family decision</p>
                <p className="mt-1 wrap-break-word text-red-800">
                  {pendingPayment.payee} · ₹{pendingPayment.amount}
                </p>
              </div>
              <button
                type="button"
                onClick={rejectPayment}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                aria-label={`Reject payment to ${pendingPayment.payee} of ${pendingPayment.amount} rupees`}
              >
                Reject
              </button>
            </div>
          ) : null}
          {events.length === 0 ? (
            <p className="mt-4 text-slate-500">No events yet. Press ` to open the simulator.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[event.level]}`}
                      >
                        {event.level}
                      </span>
                      {event.escalated ? (
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                          Escalated
                        </span>
                      ) : null}
                      <span className="text-sm text-slate-500">
                        {formatTime(event.time)}
                      </span>
                    </div>
                    <p className="mt-2 font-medium wrap-break-word">{event.message}</p>
                    <p className="mt-1 text-sm wrap-break-word text-slate-600">{event.detail}</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
                    {isReportableEvent(event) ? (
                      <button
                        type="button"
                        onClick={() => setReportEvent(event)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        aria-label={`Report ${event.message} to 1930`}
                      >
                        Report to 1930
                      </button>
                    ) : null}
                    {!event.acknowledged ? (
                      <button
                        type="button"
                        onClick={() => acknowledgeEvent(event.id)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                        aria-label={`Acknowledge ${event.message}`}
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-sm text-slate-400">Seen</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-3">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)]">
            <div>
              <h2 className="text-lg font-semibold">Voice messages</h2>
              <p className="mt-2 text-sm text-slate-600">
                Record a message for {parentName}.
              </p>
              <div className="mt-5">
                <VoiceRecorder from="family" />
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <VoiceMessageList
                messages={messages}
                viewer="family"
                senderNames={{ parent: parentName, family: primaryMember?.name || "Arjun" }}
              />
            </div>
          </div>
        </section>
      </main>

      {reportEvent ? (
        <ReportModal
          event={reportEvent}
          victimName={parentName}
          onClose={() => setReportEvent(null)}
        />
      ) : null}
    </div>
  );
}
