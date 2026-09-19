import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Mic,
  PhoneCall,
  RotateCcw,
  Settings,
} from "lucide-react";
import { useGlobalState } from "./context/GlobalState";
import { pendingCount } from "./lib/payments";
import { missedCount } from "./lib/reminders";
import { unreviewedScamCount } from "./lib/smsAnalyzer";
import { useToast } from "./components/Toast";
import FamilyLiveCall from "./components/family/FamilyLiveCall";
import FamilyMessages from "./components/family/FamilyMessages";
import FamilyOverview from "./components/family/FamilyOverview";
import PaymentsPage from "./components/family/PaymentsPage";
import FamilyReminders from "./components/family/FamilyReminders";
import FamilySettings from "./components/family/FamilySettings";
import FamilyVoice from "./components/family/FamilyVoice";
import { BADGE, formatTime, liveStatus } from "./components/family/helpers";

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "live-call", label: "Live Call", icon: PhoneCall },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "payments", label: "Payments", icon: IndianRupee },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "settings", label: "Settings", icon: Settings },
];

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

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function ChildDashboard() {
  const {
    parentName,
    lastCheckIn,
    events,
    messages,
    voiceMessages,
    payments,
    reminders,
    activeCall,
    roomCode,
    syncMode,
    resetDemo,
  } = useGlobalState();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [notifyPerm, setNotifyPerm] = useState(() =>
    notificationSupported() ? Notification.permission : "unsupported"
  );
  const seenAlertIdsRef = useRef(new Set());
  const alertsPrimedRef = useRef(false);

  const openCritical = events.filter(
    (event) => event.level === "CRITICAL" && !event.acknowledged
  ).length;
  const status = liveStatus({ lastCheckIn, openCritical });
  const unheardVoice = (voiceMessages || []).filter(
    (message) => message.from === "parent" && !message.heard
  ).length;
  const pendingDecision = pendingCount(payments);
  const unreviewedScams = unreviewedScamCount(messages);
  const overviewUnread =
    events.filter(
      (event) =>
        !event.acknowledged &&
        (event.level === "WARN" || event.level === "CRITICAL")
    ).length;
  const badges = {
    overview: overviewUnread,
    "live-call": activeCall ? 1 : 0,
    messages: unreviewedScams,
    payments: pendingDecision,
    reminders: missedCount(reminders),
    voice: unheardVoice,
    settings: 0,
  };

  useEffect(() => {
    if (activeCall) setTab("live-call");
  }, [activeCall?.id]);

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
      voiceMessages.forEach((message) =>
        seenAlertIdsRef.current.add(`msg-${message.id}`)
      );
      alertsPrimedRef.current = true;
      return;
    }

    const freshEvents = events.filter(
      (event) => !seenAlertIdsRef.current.has(event.id)
    );
    freshEvents.forEach((event) => seenAlertIdsRef.current.add(event.id));
    const skipToastKinds = new Set(["UPI_REJECT", "UPI_APPROVE"]);
    for (const event of freshEvents) {
      const isDoneToast = event.kind === "REMINDER_DONE";
      if (
        event.level !== "WARN" &&
        event.level !== "CRITICAL" &&
        !isDoneToast
      ) {
        continue;
      }
      if (skipToastKinds.has(event.kind)) continue;
      toast({
        level: event.level,
        title: `Aasra · ${event.level}`,
        body: event.detail ? `${event.message} — ${event.detail}` : event.message,
      });
      showHiddenTabNotification({
        title: `Aasra · ${event.level}`,
        body: event.detail ? `${event.message} — ${event.detail}` : event.message,
        tag: `event-${event.id}`,
      });
    }

    const freshMessages = voiceMessages.filter(
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
  }, [events, voiceMessages, parentName, toast]);

  async function enableDesktopAlerts() {
    if (!notificationSupported()) {
      setNotifyPerm("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyPerm(result);
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-2 md:flex">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold tracking-wide text-teal">Aasra</p>
          <p className="text-xs text-slate-500">Family dashboard</p>
        </div>
        <nav className="flex flex-col gap-2" aria-label="Family sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={selected ? "page" : undefined}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
                  selected
                    ? "bg-teal text-cream"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                <NavBadge count={badges[item.id]} />
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-2 py-2 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide text-teal">
                {parentName}
              </p>
              <p className="text-xs text-slate-500">
                Last check-in {formatTime(lastCheckIn)} · Pairing {roomCode || "------"} ·{" "}
                {syncMode === "firebase" ? "internet sync" : "same-browser demo"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${BADGE[status.tone]}`}
              >
                <span
                  className={`size-2 rounded-full ${
                    status.tone === "INFO"
                      ? "bg-green-600"
                      : status.tone === "WARN"
                        ? "bg-yellow-500"
                        : "bg-red-600"
                  }`}
                  aria-hidden="true"
                />
                {status.label}
              </span>
              {notifyPerm === "granted" ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-500">
                  <BellRing className="size-4" aria-hidden="true" />
                  Desktop alerts on
                </span>
              ) : notifyPerm === "unsupported" ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-400">
                  <BellOff className="size-4" aria-hidden="true" />
                  Alerts not supported
                </span>
              ) : (
                <button
                  type="button"
                  onClick={enableDesktopAlerts}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white"
                  aria-label="Enable desktop notification alerts"
                >
                  <Bell className="size-4" aria-hidden="true" />
                  Enable desktop alerts
                </button>
              )}
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                aria-label="Reset demo and clear the family room"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset demo
              </button>
            </div>
          </div>
          <nav
            className="mt-2 flex gap-2 overflow-x-auto md:hidden"
            aria-label="Family sections"
          >
            {NAV.map((item) => {
              const Icon = item.icon;
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
                    selected ? "bg-teal text-cream" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                  <NavBadge count={badges[item.id]} />
                </button>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 p-2 sm:p-4">
          {tab === "overview" ? <FamilyOverview /> : null}
          {tab === "live-call" ? <FamilyLiveCall /> : null}
          {tab === "messages" ? <FamilyMessages /> : null}
          {tab === "payments" ? <PaymentsPage /> : null}
          {tab === "reminders" ? <FamilyReminders /> : null}
          {tab === "voice" ? <FamilyVoice /> : null}
          {tab === "settings" ? <FamilySettings /> : null}
        </main>
      </div>
    </div>
  );
}
