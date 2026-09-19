import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  SMS_LABEL_BADGE,
  smsPreview,
} from "../../lib/smsAnalyzer";
import { formatTime } from "./helpers";
import CheckSmsBox from "../CheckSmsBox";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "scam", label: "Scam" },
  { id: "suspicious", label: "Suspicious" },
  { id: "marked", label: "Marked by you" },
];

function matchesFilter(message, filter) {
  if (filter === "scam") return message.analysis?.label === "SCAM";
  if (filter === "suspicious") return message.analysis?.label === "SUSPICIOUS";
  if (filter === "marked") return Boolean(message.familyVerdict);
  return true;
}

export default function FamilyMessages() {
  const { messages, spamSenders, markSmsSpam, markSmsSafe } = useGlobalState();
  const [filter, setFilter] = useState("all");
  const list = messages || [];

  const rows = useMemo(
    () => list.filter((message) => matchesFilter(message, filter)),
    [list, filter]
  );

  return (
    <div className="grid gap-4">
      <CheckSmsBox spamSenders={spamSenders} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="size-5 text-teal" aria-hidden="true" />
            Inbox
          </h2>
          {spamSenders.length > 0 ? (
            <p className="text-sm text-slate-500">{spamSenders.length} spam senders</p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Message filters">
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  selected ? "bg-teal text-cream" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-slate-500">No messages match this filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-semibold">Risk</th>
                  <th className="px-2 py-2 font-semibold">Sender</th>
                  <th className="px-2 py-2 font-semibold">Preview</th>
                  <th className="px-2 py-2 font-semibold">Reasons</th>
                  <th className="px-2 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((message) => (
                  <tr key={message.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          SMS_LABEL_BADGE[message.analysis?.label] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {message.analysis?.label || "SAFE"}
                      </span>
                      {message.familyVerdict ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Marked {message.familyVerdict.toLowerCase()}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">{formatTime(message.time)}</p>
                    </td>
                    <td className="px-2 py-3 font-medium wrap-break-word">
                      {message.sender}
                      {message.fromPhone ? (
                        <p className="mt-1 text-xs font-semibold text-teal">Amma's phone</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 wrap-break-word text-slate-700">
                      {smsPreview(message.body, 110)}
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {message.analysis?.reasons?.length ? (
                        <ul className="list-disc pl-4">
                          {message.analysis.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-36 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => markSmsSpam(message.id)}
                          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                          aria-label={`Mark SMS from ${message.sender} as spam`}
                        >
                          Mark as spam
                        </button>
                        <button
                          type="button"
                          onClick={() => markSmsSafe(message.id)}
                          className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white"
                          aria-label={`Mark SMS from ${message.sender} as safe`}
                        >
                          Mark safe
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
