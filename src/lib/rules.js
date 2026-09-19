function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseAmount(amount) {
  if (typeof amount === "number") return amount;
  const parsed = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
  return parsed;
}

function listHas(list, payee) {
  const needle = normalizeName(payee);
  if (!needle) return false;
  return (list ?? []).some((item) => normalizeName(item) === needle);
}

export function evaluatePayment({
  payee,
  amount,
  safePayees = [],
  knownPayees = [],
}) {
  const reasons = [];
  const amt = parseAmount(amount);
  const inSafe = listHas(safePayees, payee);
  const inKnown = listHas(knownPayees, payee);

  if (!Number.isFinite(amt) || amt <= 0) {
    return { decision: "HOLD", reasons: ["Amount is missing or invalid"] };
  }

  if (amt > 10000 && !inSafe) {
    reasons.push(
      "Amount is over ₹10,000 and the payee is not on the safe list"
    );
  }

  if (!inSafe && !inKnown) {
    reasons.push("Payee is not a known contact");
  }

  if (reasons.some((reason) => reason.includes("over ₹10,000"))) {
    return { decision: "BLOCK", reasons };
  }

  if (reasons.length > 0) {
    return { decision: "HOLD", reasons };
  }

  return { decision: "ALLOW", reasons: [] };
}

const OKAY_PHRASES = [
  "i am okay",
  "i'm okay",
  "i am ok",
  "i'm ok",
  "im okay",
  "im ok",
  "i am fine",
  "i'm fine",
  "im fine",
  "all okay",
  "all ok",
  "all good",
  "i am alright",
  "i'm alright",
  "nenu bagunnanu",
  "nenu bagunnaanu",
  "bagunnanu",
  "main theek hoon",
  "main theek hun",
  "main thik hoon",
  "theek hoon",
  "theek hun",
];

export function isOkayPhrase(text) {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (normalized === "okay" || normalized === "ok") return true;
  if (
    normalized.includes("నేను బాగున్నాను") ||
    normalized.includes("బాగున్నాను") ||
    normalized.includes("मैं ठीक हूँ") ||
    normalized.includes("मैं ठीक हूं") ||
    normalized.includes("ठीक हूँ") ||
    normalized.includes("ठीक हूं")
  ) {
    return true;
  }
  return OKAY_PHRASES.some(
    (phrase) => normalized === phrase || normalized.includes(phrase)
  );
}
