const SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "rb.gy",
  "tiny.cc",
  "shorturl.at",
  "lnkd.in",
  "bl.ink",
  "rebrand.ly",
];

const ODD_TLDS = [
  "xyz",
  "top",
  "click",
  "loan",
  "vip",
  "gq",
  "tk",
  "ml",
  "cf",
  "zip",
  "mov",
  "rest",
  "work",
  "buzz",
  "monster",
];

const SCARE_TERMS = [
  { re: /\bkyc\b/i, reason: "Talks about KYC" },
  { re: /account.{0,20}(block|suspend)|khata\s*band/i, reason: "Says an account is blocked or suspended" },
  { re: /\bsuspend/i, reason: "Says something is suspended" },
  { re: /\blottery\b|\blotto\b/i, reason: "Talks about a lottery" },
  { re: /\bprize\b|\binaam\b|\binam\b/i, reason: "Talks about a prize" },
  { re: /\brefund\b|\bvapas\s*paise/i, reason: "Talks about a refund" },
  {
    re: /electricity\s+disconnect|power\s+disconnect|bijli.{0,12}(kat|cut)|current\s+cut/i,
    reason: "Warns that electricity will be cut",
  },
  { re: /\bparcel\b|\bcourier\b/i, reason: "Talks about a parcel or courier" },
  { re: /\bcustoms?\b|\bcustom\s+duty/i, reason: "Asks about customs or duty" },
  { re: /\barrest\b|\bgiraftar/i, reason: "Threatens arrest" },
  { re: /\bcbi\b/i, reason: "Mentions CBI" },
  { re: /\bpolice\b|\bthana\b/i, reason: "Mentions police" },
  {
    re: /aadhaa?r\s+update|\buidai\b|aadhaar\s+updation/i,
    reason: "Asks to update Aadhaar",
  },
  { re: /\botp\b|ओटीपी/i, reason: "Mentions an OTP" },
  { re: /\bpin\b/i, reason: "Mentions a PIN" },
];

const URGENCY_TERMS = [
  { re: /\btoday\b|\baaj\s*hi\b/i, reason: "Says you must act today" },
  { re: /\bimmediately\b|\bturant\b|\babhi\b|\bjaldi\b|\bright now\b/i, reason: "Says you must act immediately" },
  { re: /within\s*24\s*(hours?|hrs?)|24\s*hours?/i, reason: "Gives a 24-hour deadline" },
  { re: /last\s+warning|final\s+warning|last\s+chance/i, reason: "Uses a last-warning threat" },
];

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const BARE_DOMAIN_RE = /\b[a-z0-9][a-z0-9-]{1,40}\.(?:com|in|net|org|co|io|app|xyz|top|click|loan|vip|gq|tk|ml|cf|zip|link)(?:\/[^\s]*)?/gi;

export const SMS_LABEL_BADGE = {
  SAFE: "bg-green-100 text-green-800",
  SUSPICIOUS: "bg-yellow-100 text-yellow-800",
  SCAM: "bg-red-100 text-red-800",
};

export function normalizeSender(sender) {
  return String(sender || "")
    .trim()
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function isMobileSender(sender) {
  const raw = String(sender || "").replace(/[\s-]/g, "");
  const digits = raw.replace(/^\+/, "").replace(/^0+/, "");
  if (/^91[6-9]\d{9}$/.test(digits)) return true;
  if (/^[6-9]\d{9}$/.test(digits)) return true;
  return false;
}

export function isBankHeader(sender) {
  const value = String(sender || "").trim();
  if (!value || isMobileSender(value)) return false;
  return /^[A-Za-z0-9]{2}-[A-Za-z0-9]{2,}$/.test(value);
}

function uniqueReasons(reasons) {
  const seen = new Set();
  return reasons.filter((reason) => {
    if (seen.has(reason)) return false;
    seen.add(reason);
    return true;
  });
}

function extractLinks(body) {
  const text = String(body || "");
  const found = [];
  for (const match of text.matchAll(URL_RE)) {
    found.push(match[0]);
  }
  for (const match of text.matchAll(BARE_DOMAIN_RE)) {
    if (!found.some((item) => item.includes(match[0]))) found.push(match[0]);
  }
  return found;
}

function hostOf(link) {
  const raw = String(link || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return raw.split("/")[0].toLowerCase();
}

function isShortener(host) {
  return SHORTENERS.some((item) => host === item || host.endsWith(`.${item}`));
}

function isOddDomain(host) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  const tld = host.split(".").pop();
  return ODD_TLDS.includes(tld);
}

function asksToCall(body) {
  return /(?:call|dial|ring)\s+(?:this\s+)?(?:number|us|now)|phone\s+this|missed\s+call\s+to\s+\d/i.test(
    body
  );
}

function asksToShareCode(body) {
  return /(?:share|send|tell|give|forward)\s+(?:me\s+|us\s+|your\s+|the\s+)?(?:otp|pin|code|password|cvv)/i.test(
    body
  );
}

function labelFromScore(score, forcedScam) {
  if (forcedScam || score >= 70) return "SCAM";
  if (score >= 35) return "SUSPICIOUS";
  return "SAFE";
}

export function analyzeSms({ sender, body, spamSenders = [] } = {}) {
  const reasons = [];
  let score = 0;
  const text = String(body || "");
  const from = String(sender || "");
  const spamSet = new Set((spamSenders || []).map(normalizeSender).filter(Boolean));

  if (spamSet.has(normalizeSender(from))) {
    return {
      score: 100,
      label: "SCAM",
      reasons: ["This sender is on your family's spam list"],
    };
  }

  for (const term of SCARE_TERMS) {
    if (term.re.test(text)) {
      score += 16;
      reasons.push(term.reason);
    }
  }

  const links = extractLinks(text);
  if (links.length > 0) {
    score += 18;
    reasons.push("Contains a link. Do not tap it");
    if (links.some((link) => isShortener(hostOf(link)))) {
      score += 22;
      reasons.push("Uses a shortened link, which often hides the real website");
    }
    if (links.some((link) => isOddDomain(hostOf(link)))) {
      score += 16;
      reasons.push("The website looks unusual");
    }
  }

  let urgencyHits = 0;
  for (const term of URGENCY_TERMS) {
    if (term.re.test(text)) {
      urgencyHits += 1;
      reasons.push(term.reason);
    }
  }
  if (urgencyHits > 0) score += Math.min(28, urgencyHits * 14);

  if (isMobileSender(from)) {
    score += 22;
    reasons.push("Sender is a mobile number, not a bank SMS header like VM-SBIBNK");
  }

  if (asksToCall(text)) {
    score += 20;
    reasons.push("Asks you to call a number");
  }
  if (asksToShareCode(text)) {
    score += 22;
    reasons.push("Asks you to share a code, OTP, or PIN");
  }

  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    label: labelFromScore(clamped, false),
    reasons: uniqueReasons(reasons),
  };
}

export const SAMPLE_SMS = [
  {
    id: "scam-kyc",
    expect: "SCAM",
    sender: "9876543210",
    body: "Dear customer, KYC pending. Your account will be blocked today. Click http://bit.ly/kyc-now immediately or within 24 hours.",
  },
  {
    id: "scam-lottery",
    expect: "SCAM",
    sender: "9988776655",
    body: "You won a lottery prize of Rs 25 lakh. Pay customs fee. Last warning. Call 9000011111 now.",
  },
  {
    id: "scam-power",
    expect: "SCAM",
    sender: "+919876543210",
    body: "Electricity disconnection today. Pay refund at http://tinyurl.com/billpay and send OTP to confirm.",
  },
  {
    id: "scam-parcel",
    expect: "SCAM",
    sender: "9123456789",
    body: "Your parcel is held at customs. Update Aadhaar and enter PIN at http://pay.xyz/parcel",
  },
  {
    id: "scam-cbi",
    expect: "SCAM",
    sender: "9000011122",
    body: "CBI and police will arrest you. Share OTP with us and call this number immediately.",
  },
  {
    id: "safe-sbi-otp",
    expect: "SAFE",
    sender: "VM-SBIBNK",
    body: "Your OTP is 482910 for SBI net banking. Do not share with anyone.",
  },
  {
    id: "safe-bill",
    expect: "SAFE",
    sender: "VM-TSSPDC",
    body: "TSSPDCL: Your bill of Rs 850 is generated. Pay by 28 Sep using your electricity app.",
  },
  {
    id: "safe-clinic",
    expect: "SAFE",
    sender: "VM-CLINIC",
    body: "Reminder: Dr. Meera Clinic appointment tomorrow at 10am. Please arrive 10 minutes early.",
  },
  {
    id: "safe-airtel",
    expect: "SAFE",
    sender: "VK-AIRTEL",
    body: "Airtel: Recharge of Rs 199 is successful. Validity 28 days. Helpline 198.",
  },
  {
    id: "safe-amazon",
    expect: "SAFE",
    sender: "AD-AMZON",
    body: "Your order has been shipped and will arrive by Friday. Track it in the Amazon app.",
  },
];

export function selfTestSmsAnalyzer() {
  const results = SAMPLE_SMS.map((sample) => {
    const analysis = analyzeSms({ sender: sample.sender, body: sample.body });
    return {
      id: sample.id,
      expect: sample.expect,
      got: analysis.label,
      score: analysis.score,
      pass: analysis.label === sample.expect,
      reasons: analysis.reasons,
    };
  });
  const failed = results.filter((item) => !item.pass);
  return { ok: failed.length === 0, failed, results };
}

export function unreviewedScamCount(messages) {
  return (messages || []).filter(
    (item) => item.analysis?.label === "SCAM" && !item.familyVerdict
  ).length;
}

export function smsPreview(body, max = 90) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

if (import.meta.env?.DEV) {
  const check = selfTestSmsAnalyzer();
  if (!check.ok) {
    console.warn("SMS analyzer self-test failed", check.failed);
  }
}
