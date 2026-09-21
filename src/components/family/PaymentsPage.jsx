import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Search, ShieldCheck, X } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  formatRupees,
  formatWaiting,
  isAwaitingFamily,
  matchesPaymentFilter,
  pendingCount,
  STATUS_BADGE,
  statusLabel,
  sumProtected,
  sumSentThisWeek,
} from "../../lib/payments";
import { formatTime } from "./helpers";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "blocked", label: "Blocked" },
  { id: "sent", label: "Sent" },
];

export default function PaymentsPage() {
  const { payments, approvePayment, rejectPayment, tryPayment, safePayees } =
    useGlobalState();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [payee, setPayee] = useState(safePayees?.[0] || "");
  const [customPayee, setCustomPayee] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!payee && safePayees?.[0]) setPayee(safePayees[0]);
  }, [payee, safePayees]);

  const list = payments || [];
  const awaiting = list.filter(isAwaitingFamily);
  const sentWeek = sumSentThisWeek(list, now);
  const protectedAmount = sumProtected(list);
  const pending = pendingCount(list);
  const selected = list.find((payment) => payment.id === selectedId) || null;

  const history = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((payment) => {
      if (!matchesPaymentFilter(payment, filter)) return false;
      if (!needle) return true;
      return String(payment.payee || "").toLowerCase().includes(needle);
    });
  }, [list, filter, query]);

  function submitAttempt(event) {
    event.preventDefault();
    const name = payee === "__other" ? customPayee.trim() : payee;
    const rupees = Number(String(amount).replace(/[^0-9.]/g, ""));
    if (!name || !rupees) return;
    tryPayment({ payee: name, amount: rupees });
    setAmount("");
    if (payee === "__other") setCustomPayee("");
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Watch a payment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Log a payment the parent is trying to make. Safe payees go through.
          Unknown names or more than ₹10,000 are held or blocked.
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_8rem_auto]" onSubmit={submitAttempt}>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Payee
            <select
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-900"
            >
              {(safePayees || []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__other">Someone new</option>
            </select>
          </label>
          {payee === "__other" ? (
            <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-3">
              Name or UPI
              <input
                value={customPayee}
                onChange={(event) => setCustomPayee(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-900"
                placeholder="Refund Officer"
              />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Amount
            <input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-900"
              placeholder="500"
            />
          </label>
          <button
            type="submit"
            className="self-end min-h-11 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-cream"
          >
            Check payment
          </button>
        </form>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          label="Sent this week"
          value={formatRupees(sentWeek)}
          tone="INFO"
        />
        <SummaryCard
          label="₹ protected"
          value={formatRupees(protectedAmount)}
          tone="CRITICAL"
        />
        <SummaryCard
          label="Pending decisions"
          value={String(pending)}
          tone={pending ? "WARN" : "INFO"}
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Needs your decision</h2>
        {awaiting.length === 0 ? (
          <p className="mt-2 text-slate-500">
            Nothing waiting. Held and collect requests will show here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {awaiting.map((payment) => (
              <li
                key={payment.id}
                className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-yellow-800">
                      {payment.status === "HELD" ? "Cooling-off" : "Needs approval"}
                    </p>
                    <p className="mt-1 text-xl font-semibold wrap-break-word text-slate-900">
                      {payment.payee}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {formatRupees(payment.amount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatWaiting(payment.time, now)} · {formatTime(payment.time)}
                    </p>
                    {payment.note ? (
                      <p className="mt-1 text-sm text-slate-500">{payment.note}</p>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-40">
                    <button
                      type="button"
                      onClick={() => approvePayment(payment.id)}
                      className="min-h-12 rounded-xl bg-green-700 px-4 py-3 text-base font-semibold text-white"
                      aria-label={`Approve payment to ${payment.payee} of ${payment.amount} rupees`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectPayment(payment.id)}
                      className="min-h-12 rounded-xl bg-red-700 px-4 py-3 text-base font-semibold text-white"
                      aria-label={`Reject payment to ${payment.payee} of ${payment.amount} rupees`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {payment.reasons?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-yellow-950">
                    {payment.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Payment history</h2>
          <label className="relative min-w-56 flex-1 sm:max-w-xs">
            <span className="sr-only">Search by payee</span>
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by payee"
              className="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Payment filters">
          {FILTERS.map((item) => {
            const selectedFilter = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selectedFilter}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  selectedFilter
                    ? "bg-teal text-cream"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {history.length === 0 ? (
          <p className="mt-4 text-slate-500">No payments match this filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-semibold">Payee</th>
                  <th className="px-2 py-2 font-semibold">Amount</th>
                  <th className="px-2 py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((payment) => (
                  <tr
                    key={payment.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(payment.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(payment.id);
                      }
                    }}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    aria-label={`Open details for ${payment.payee}`}
                  >
                    <td className="px-2 py-3">
                      <p className="font-medium wrap-break-word">{payment.payee}</p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE[payment.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabel(payment.status)}
                      </span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {formatRupees(payment.amount)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-slate-500">
                      {formatTime(payment.time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <PaymentDrawer
          payment={paymentWithNow(selected, now)}
          onClose={() => setSelectedId(null)}
          onApprove={() => approvePayment(selected.id)}
          onReject={() => rejectPayment(selected.id)}
        />
      ) : null}
    </div>
  );
}

function paymentWithNow(payment, now) {
  return { ...payment, waitingLabel: formatWaiting(payment.time, now) };
}

function SummaryCard({ label, value, tone }) {
  const toneClass =
    tone === "CRITICAL"
      ? "bg-red-50 text-red-800"
      : tone === "WARN"
        ? "bg-yellow-50 text-yellow-800"
        : "bg-green-50 text-green-800";
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        {label === "₹ protected" ? (
          <ShieldCheck className="size-4 text-slate-400" aria-hidden="true" />
        ) : (
          <IndianRupee className="size-4 text-slate-400" aria-hidden="true" />
        )}
      </div>
      <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-lg font-semibold ${toneClass}`}>
        {value}
      </p>
    </article>
  );
}

function PaymentDrawer({ payment, onClose, onApprove, onReject }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const waiting = isAwaitingFamily(payment);
  const steps = payment.timeline?.length
    ? payment.timeline
    : [{ at: payment.time, actor: "Aasra", label: "Payment recorded" }];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" role="presentation">
      <button
        type="button"
        className="h-full flex-1 cursor-default"
        aria-label="Close payment details"
        onClick={onClose}
      />
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-drawer-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Payment detail
            </p>
            <h3 id="payment-drawer-title" className="mt-1 text-xl font-semibold wrap-break-word">
              {payment.payee}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close payment details"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-3xl font-bold">{formatRupees(payment.amount)}</p>
        <span
          className={`mt-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            STATUS_BADGE[payment.status] || "bg-slate-100 text-slate-700"
          }`}
        >
          {statusLabel(payment.status)}
        </span>
        <p className="mt-2 text-sm text-slate-500">{formatTime(payment.time)}</p>
        {payment.note ? <p className="mt-2 text-sm text-slate-600">{payment.note}</p> : null}
        {payment.decidedBy ? (
          <p className="mt-2 text-sm text-slate-600">
            Decided by {payment.decidedBy}
            {payment.decidedAt ? ` · ${formatTime(payment.decidedAt)}` : ""}
          </p>
        ) : payment.waitingLabel ? (
          <p className="mt-2 text-sm text-slate-600">{payment.waitingLabel}</p>
        ) : null}

        {payment.reasons?.length ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-700">Rule reasons</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {payment.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <h4 className="mt-6 text-sm font-semibold text-slate-700">Timeline</h4>
        <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
          {steps.map((step, index) => (
            <li key={`${step.at}-${index}`}>
              <p className="text-sm font-medium text-slate-800">{step.label}</p>
              <p className="text-xs text-slate-500">
                {step.actor ? `${step.actor} · ` : ""}
                {formatTime(step.at)}
              </p>
            </li>
          ))}
        </ol>

        {waiting ? (
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="min-h-12 rounded-xl bg-green-700 px-4 py-3 font-semibold text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="min-h-12 rounded-xl bg-red-700 px-4 py-3 font-semibold text-white"
            >
              Reject
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
