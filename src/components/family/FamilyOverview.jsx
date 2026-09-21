import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  IndianRupee,
  Mic,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import { formatRupees, isAwaitingFamily, pendingCount } from "../../lib/payments";
import ReportModal, { isReportableEvent } from "../ReportModal";
import { BADGE, checkInTone, formatTime } from "./helpers";

export default function FamilyOverview() {
  const {
    parentName,
    lastCheckIn,
    events,
    voiceMessages,
    safePayees,
    familyMembers,
    payments,
    acknowledgeEvent,
    approvePayment,
    rejectPayment,
  } = useGlobalState();
  const [reportEvent, setReportEvent] = useState(null);

  const tone = checkInTone(lastCheckIn);
  const openCritical = events.filter(
    (event) => event.level === "CRITICAL" && !event.acknowledged
  ).length;
  const openWarn = events.filter(
    (event) => event.level === "WARN" && !event.acknowledged
  ).length;
  const unheardVoice = (voiceMessages || []).filter(
    (message) => message.from === "parent" && !message.heard
  ).length;
  const awaitingPayments = (payments || []).filter(isAwaitingFamily);
  const pendingDecision = pendingCount(payments);

  return (
    <div className="grid gap-2">
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <CounterCard
          icon={ShieldAlert}
          label="Open critical"
          value={openCritical}
          tone={openCritical ? "CRITICAL" : "INFO"}
        />
        <CounterCard
          icon={AlertTriangle}
          label="Open warnings"
          value={openWarn}
          tone={openWarn ? "WARN" : "INFO"}
        />
        <CounterCard
          icon={IndianRupee}
          label="Pending payments"
          value={pendingDecision}
          tone={pendingDecision ? "CRITICAL" : "INFO"}
        />
        <CounterCard
          icon={Mic}
          label="Unheard voice"
          value={unheardVoice}
          tone={unheardVoice ? "WARN" : "INFO"}
        />
      </section>

      <div className="grid gap-2 lg:grid-cols-3">
        <section className="flux-card p-5 lg:col-span-1">
          <h2 className="text-lg font-semibold">Check-in</h2>
          <p className="mt-2 text-slate-600">{parentName}</p>
          <p
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${BADGE[tone]}`}
          >
            {formatTime(lastCheckIn)}
          </p>
          <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Users className="size-4" aria-hidden="true" />
            Family members
          </h3>
          <ul className="mt-2 space-y-2">
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
          <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Safe payees
          </h3>
          <ul className="mt-2 space-y-2">
            {safePayees.map((payee) => (
              <li
                key={payee}
                className="rounded-lg bg-green-50 px-3 py-2 text-green-800"
              >
                {payee}
              </li>
            ))}
          </ul>
        </section>

        <section className="flux-card p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Alert feed</h2>
          {awaitingPayments.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {awaitingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-900">
                      Needs your decision
                    </p>
                    <p className="mt-1 wrap-break-word text-red-800">
                      {payment.payee} · {formatRupees(payment.amount)}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => approvePayment(payment.id)}
                      className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white"
                      aria-label={`Approve payment to ${payment.payee} of ${payment.amount} rupees`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectPayment(payment.id)}
                      className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                      aria-label={`Reject payment to ${payment.payee} of ${payment.amount} rupees`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {events.length === 0 ? (
            <p className="mt-2 text-slate-500">
              No events yet. Press ` to open the simulator.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between"
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
                    <p className="mt-2 font-medium wrap-break-word">
                      {event.message}
                    </p>
                    <p className="mt-1 text-sm wrap-break-word text-slate-600">
                      {event.detail}
                    </p>
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
      </div>

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

function CounterCard({ icon: Icon, label, value, tone }) {
  return (
    <article className="flux-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-400" aria-hidden="true" />
      </div>
      <p
        className={`mt-2 inline-flex rounded-full px-3 py-1 text-lg font-semibold ${BADGE[tone]}`}
      >
        {value}
      </p>
    </article>
  );
}
