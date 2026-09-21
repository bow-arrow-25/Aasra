export const PAYMENT_STATUS = {
  SENT: "SENT",
  HELD: "HELD",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED_SENT: "APPROVED_SENT",
  REJECTED: "REJECTED",
  BLOCKED: "BLOCKED",
  COLLECT_REQUEST_DECLINED: "COLLECT_REQUEST_DECLINED",
};

export const STATUS_BADGE = {
  SENT: "bg-green-100 text-green-800",
  APPROVED_SENT: "bg-green-100 text-green-800",
  HELD: "bg-yellow-100 text-yellow-800",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
  BLOCKED: "bg-red-100 text-red-800",
  REJECTED: "bg-red-100 text-red-800",
  COLLECT_REQUEST_DECLINED: "bg-red-100 text-red-800",
};

export function statusFromRuleDecision(decision) {
  if (decision === "BLOCK") return PAYMENT_STATUS.BLOCKED;
  if (decision === "HOLD") return PAYMENT_STATUS.HELD;
  return PAYMENT_STATUS.SENT;
}

export function isAwaitingFamily(payment) {
  return (
    payment?.status === PAYMENT_STATUS.HELD ||
    payment?.status === PAYMENT_STATUS.PENDING_APPROVAL
  );
}

export function isSentStatus(status) {
  return status === PAYMENT_STATUS.SENT || status === PAYMENT_STATUS.APPROVED_SENT;
}

export function isBlockedLike(status) {
  return (
    status === PAYMENT_STATUS.BLOCKED ||
    status === PAYMENT_STATUS.REJECTED ||
    status === PAYMENT_STATUS.COLLECT_REQUEST_DECLINED
  );
}

export function statusLabel(status) {
  switch (status) {
    case PAYMENT_STATUS.SENT:
      return "Sent";
    case PAYMENT_STATUS.HELD:
      return "Held";
    case PAYMENT_STATUS.PENDING_APPROVAL:
      return "Pending approval";
    case PAYMENT_STATUS.APPROVED_SENT:
      return "Approved & sent";
    case PAYMENT_STATUS.REJECTED:
      return "Rejected";
    case PAYMENT_STATUS.BLOCKED:
      return "Blocked";
    case PAYMENT_STATUS.COLLECT_REQUEST_DECLINED:
      return "Collect declined";
    default:
      return status || "Unknown";
  }
}

export function parentStatusKey(status) {
  if (isSentStatus(status)) return "statusSent";
  if (
    status === PAYMENT_STATUS.HELD ||
    status === PAYMENT_STATUS.PENDING_APPROVAL
  ) {
    return "statusWaiting";
  }
  return "statusStopped";
}

export function formatRupees(amount) {
  const n = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return `₹${amount ?? ""}`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function parseAmount(amount) {
  const n = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatWaiting(from, now = Date.now()) {
  const ms = Math.max(0, now - Number(from || now));
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function weekAgo(now = Date.now()) {
  return now - 7 * 24 * 60 * 60 * 1000;
}

export function sumSentThisWeek(payments, now = Date.now()) {
  const from = weekAgo(now);
  return (payments || [])
    .filter((payment) => isSentStatus(payment.status) && payment.time >= from)
    .reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
}

export function sumProtected(payments) {
  return (payments || [])
    .filter((payment) => isBlockedLike(payment.status))
    .reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
}

export function pendingCount(payments) {
  return (payments || []).filter(isAwaitingFamily).length;
}

export function matchesPaymentFilter(payment, filter) {
  if (filter === "pending") return isAwaitingFamily(payment);
  if (filter === "blocked") return isBlockedLike(payment.status);
  if (filter === "sent") return isSentStatus(payment.status);
  return true;
}

export function displayParentName(parentName) {
  return String(parentName || "").trim() || "Parent";
}

export function primaryFamilyName(familyMembers) {
  return (
    String(
      (familyMembers || []).find((member) => member.role === "primary")?.name ||
        (familyMembers || [])[0]?.name ||
        ""
    ).trim() || "Family"
  );
}

export function createPaymentRecord({
  id,
  payee,
  amount,
  note = "",
  time,
  status,
  reasons = [],
  decidedBy = null,
  decidedAt = null,
  kind = "SEND",
  timeline = [],
}) {
  return {
    id,
    payee,
    amount,
    note,
    time,
    status,
    reasons: [...reasons],
    decidedBy,
    decidedAt,
    kind,
    timeline: [...timeline],
  };
}

export function appendTimeline(payment, entry) {
  return {
    ...payment,
    timeline: [...(payment.timeline || []), entry],
  };
}

export function upsertPayment(list, payment) {
  const payments = list || [];
  if (payments.some((item) => item.id === payment.id)) {
    return payments.map((item) => (item.id === payment.id ? payment : item));
  }
  return [payment, ...payments];
}

export function findDecisionTarget(state, id) {
  const payments = state.payments || [];
  if (id) {
    return (
      payments.find((payment) => payment.id === id) ||
      (state.pendingPayment?.id === id ? state.pendingPayment : null)
    );
  }
  return (
    payments.find(isAwaitingFamily) ||
    (isAwaitingFamily(state.pendingPayment) ? state.pendingPayment : null)
  );
}
