import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Phone, X } from "lucide-react";
import { useGlobalState } from "../context/GlobalState";

const MISSING = "Not recorded";

function formatDateTime(time) {
  if (!time) return MISSING;
  return new Date(time).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAmount(amount) {
  if (amount == null || amount === "") return MISSING;
  const n = Number(String(amount).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return String(amount);
  return `₹${n.toLocaleString("en-IN")}`;
}

function extractPhone(event) {
  if (event?.meta?.phone) return event.meta.phone;
  const match = String(event?.detail ?? "").match(
    /(?:from|call(?:er)?)\s+(.+)$/i
  );
  return match?.[1]?.trim() || MISSING;
}

function extractUpiId(event) {
  if (event?.meta?.upiId) return event.meta.upiId;
  const match = String(event?.detail ?? "").match(/^([^·—-]+)/);
  const value = match?.[1]?.trim();
  if (!value || event?.kind !== "UPI") return MISSING;
  return value;
}

function extractAmount(event) {
  if (event?.meta?.amount != null) return formatAmount(event.meta.amount);
  const match = String(event?.detail ?? "").match(/₹\s*[\d,]+(?:\.\d+)?/);
  return match?.[0] || MISSING;
}

function extractCallType(event) {
  if (event?.meta?.callType) return event.meta.callType;
  if (event?.kind === "KYC_CALL") return "KYC verification call";
  if (event?.kind === "SCAM_CALL") return "Suspected scam call";
  if (event?.kind === "CALL_ALARM") return "Long-call alarm";
  if (event?.kind === "CALL") return "Incoming call";
  if (event?.kind === "UPI" || event?.kind === "UPI_REJECT" || event?.kind === "UPI_COLLECT") {
    return "Not a call — UPI payment";
  }
  return MISSING;
}

export function isReportableEvent(event) {
  return event?.level === "CRITICAL" || event?.kind === "SCAM_CALL";
}

export function buildComplaintDraft(event, victimName) {
  const when = formatDateTime(event?.time);
  const phone = extractPhone(event);
  const upiId = extractUpiId(event);
  const amount = extractAmount(event);
  const callType = extractCallType(event);
  const victim = victimName || "Parent";

  let summary;
  if (event?.kind === "SCAM_CALL" || event?.kind === "KYC_CALL") {
    summary = `On ${when}, ${victim} received a suspected scam call from ${phone}. The family is reporting this so the number can be investigated and any linked payment can be frozen.`;
  } else if (event?.kind === "UPI") {
    const reasons = event?.meta?.reasons?.length
      ? ` Aasra flagged it because ${event.meta.reasons.join("; ").toLowerCase()}.`
      : "";
    summary = `On ${when}, ${victim} was asked to send ${amount} to UPI ID ${upiId}.${reasons} This payment was ${
      event?.meta?.decision === "BLOCK" ? "blocked" : "flagged"
    } to protect the family's money.`;
  } else {
    summary = `On ${when}, Aasra recorded a critical incident for ${victim}: ${
      event?.message || "unknown event"
    }. ${event?.detail || ""}`.trim();
  }

  return [
    "Aasra — Cybercrime complaint draft (Helpline 1930)",
    "",
    `Victim name: ${victim}`,
    `Date / time: ${when}`,
    `Scammer phone number: ${phone}`,
    `UPI ID: ${upiId}`,
    `Amount: ${amount}`,
    `Call type: ${callType}`,
    "",
    "Incident summary:",
    summary,
    "",
    "Report within the first hour for the best chance of freezing the money.",
  ].join("\n");
}

export default function ReportModal({ event, victimName, onClose }) {
  const { logReportPrepared } = useGlobalState();
  const [status, setStatus] = useState("");
  const draft = useMemo(
    () => buildComplaintDraft(event, victimName),
    [event, victimName]
  );

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available");
      }
      await navigator.clipboard.writeText(draft);
      logReportPrepared(event);
      setStatus("Report copied. Paste it into the 1930 call or the cybercrime form.");
    } catch {
      setStatus("Copy failed. Select the draft and copy it manually.");
    }
  }

  function handleDownload() {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aasra-1930-report-${event?.id || "draft"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logReportPrepared(event);
    setStatus("Report downloaded as a .txt file.");
  }

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="report-modal-title" className="text-xl font-semibold">
            Report to 1930
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close 1930 report"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-3 rounded-xl bg-yellow-100 px-4 py-3 text-sm font-semibold text-yellow-950">
          Report within the first hour for the best chance of freezing the money.
        </p>

        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
          {draft}
        </pre>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Copy className="size-4" aria-hidden="true" />
            Copy report
          </button>
          <a
            href="tel:1930"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call 1930
          </a>
          <a
            href="https://www.cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-center text-sm font-semibold text-cream"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open cybercrime.gov.in
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold"
          >
            <Download className="size-4" aria-hidden="true" />
            Download as .txt
          </button>
        </div>

        {status ? (
          <p role="status" className="mt-4 text-sm text-slate-600">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
