export const PHRASES = [
  {
    id: "digital arrest",
    weight: 22,
    patterns: [
      /digital\s*arrest/i,
      /digital\s*giraf+t[ae]ri/i,
      /digital\s*arrestu/i,
      /digital\s*ar[e]?st/i,
    ],
  },
  {
    id: "CBI",
    weight: 12,
    patterns: [/\bc\.?b\.?i\.?\b/i, /see\s*bee\s*eye/i, /सी\s*बी\s*आई/, /सीबीआई/],
  },
  {
    id: "police",
    weight: 12,
    patterns: [/\bpolice\b/i, /\bpulis\b/i, /\bthana\b/i, /\bpolicewala\b/i, /पुलिस/],
  },
  {
    id: "customs",
    weight: 8,
    patterns: [/\bcustoms?\b/i, /custom\s*duty/i, /\bkustoms\b/i, /कस्टम्स/],
  },
  {
    id: "parcel",
    weight: 8,
    patterns: [/\bparcel\b/i, /\bparsal\b/i, /\bcourier\b/i, /पार्सल/],
  },
  {
    id: "drugs",
    weight: 8,
    patterns: [/\bdrugs?\b/i, /\bnasha\b/i, /drug\s*case/i, /ड्रग्स/],
  },
  {
    id: "money laundering",
    weight: 10,
    patterns: [
      /money\s*launder(?:ing)?/i,
      /money\s*lundering/i,
      /black\s*money/i,
      /kala\s*dhan/i,
    ],
  },
  {
    id: "arrest warrant",
    weight: 14,
    patterns: [/arrest\s*warrant/i, /giraf+t[ae]ri\s*warrant/i, /warrant\s*of\s*arrest/i],
  },
  {
    id: "don't tell anyone",
    weight: 16,
    patterns: [
      /don['’]?t\s+tell\s+anyone/i,
      /kisi\s+ko\s+mat\s+bata[oa]?/i,
      /kisi\s+se\s+mat\s+kehna/i,
      /evariki\s+cheppa(?:ku|vaddhu|vaddu)/i,
    ],
  },
  {
    id: "stay on the call",
    weight: 10,
    patterns: [
      /stay\s+on\s+(the\s+)?(call|line)/i,
      /do\s+not\s+cut\s+(this\s+|the\s+)?call/i,
      /don['’]?t\s+cut\s+(this\s+|the\s+)?call/i,
      /call\s+(pe|par)\s+raho/i,
      /call\s+mat\s+ka[t]?na/i,
      /call\s+cut\s+cheyyaku/i,
    ],
  },
  {
    id: "video call",
    weight: 10,
    patterns: [/video\s*call(?:ing)?/i, /video\s*caling/i],
  },
  {
    id: "OTP",
    weight: 16,
    patterns: [/\botp\b/i, /o\s*\.?\s*t\s*\.?\s*p/i, /one[\s-]*time[\s-]*password/i, /ओटीपी/],
  },
  {
    id: "share the code",
    weight: 18,
    patterns: [
      /share\s+(me\s+|us\s+|the\s+)?(code|otp)/i,
      /(code|otp)\s+(batao|bataye|cheppu|share)/i,
      /share\s+the\s+code/i,
    ],
  },
  {
    id: "transfer",
    weight: 8,
    patterns: [/\btransfer\b/i, /paise\s+(bhejo|transfer)/i, /amount\s+transfer/i],
  },
  {
    id: "verification deposit",
    weight: 18,
    patterns: [
      /verif(?:y|ication)\s+(deposit|amount)/i,
      /verification\s+deposit/i,
    ],
  },
  {
    id: "RBI account",
    weight: 16,
    patterns: [/rbi\s+account/i, /reserve\s+bank(?:\s+of\s+india)?\s+account/i],
  },
  {
    id: "Aadhaar misuse",
    weight: 12,
    patterns: [
      /aadhaa?r\s+misuse/i,
      /aadhaa?r.{0,24}misused/i,
      /aadhaa?r\s+galat/i,
      /uidai\s+misuse/i,
    ],
  },
];

export const DIGITAL_ARREST_SCRIPT = [
  {
    at: 2000,
    speaker: "caller",
    text: "This is Inspector Sharma from CBI. Do not cut this call.",
  },
  {
    at: 10000,
    speaker: "amma",
    text: "CBI? What happened? I have not done anything.",
  },
  {
    at: 18000,
    speaker: "caller",
    text: "Your Aadhaar is being misused for money laundering and a drugs case.",
  },
  {
    at: 28000,
    speaker: "amma",
    text: "Aadhaar? I did not give my Aadhaar to anyone.",
  },
  {
    at: 36000,
    speaker: "caller",
    text: "There is an arrest warrant. This is a digital arrest. Stay on the call.",
  },
  {
    at: 46000,
    speaker: "amma",
    text: "Arrest? Please, I am an old woman. Should I call my son?",
  },
  {
    at: 54000,
    speaker: "caller",
    text: "Don't tell anyone. If you tell family, police will come to your house.",
  },
  {
    at: 64000,
    speaker: "amma",
    text: "I will not tell. What should I do?",
  },
  {
    at: 72000,
    speaker: "caller",
    text: "We will start a video call. Then transfer a verification deposit to the RBI account.",
  },
  {
    at: 80000,
    speaker: "amma",
    text: "You need money? And a video call?",
  },
  {
    at: 86000,
    speaker: "caller",
    text: "Share the code. The OTP will come now. Read it to me.",
  },
  {
    at: 90000,
    speaker: "amma",
    text: "I think I should hang up. My family said never share OTP.",
  },
];

function lineText(line) {
  if (typeof line === "string") return line;
  return String(line?.text || "");
}

export function stageFromScore(score) {
  if (score >= 60) return "scam";
  if (score >= 30) return "suspicious";
  return "normal";
}

export function analyzeTranscript(lines = []) {
  const blob = (Array.isArray(lines) ? lines : [lines]).map(lineText).join(" \n ");
  const matched = [];
  let score = 0;

  for (const phrase of PHRASES) {
    if (phrase.patterns.some((pattern) => pattern.test(blob))) {
      matched.push(phrase.id);
      score += phrase.weight;
    }
  }

  const riskScore = Math.max(0, Math.min(100, score));
  return {
    riskScore,
    matchedPhrases: matched,
    stage: stageFromScore(riskScore),
  };
}

export function splitHighlighted(text, matchedPhrases = []) {
  const source = String(text || "");
  if (!source) return [];
  const selected = PHRASES.filter((phrase) => matchedPhrases.includes(phrase.id));
  if (!selected.length) return [{ text: source, hit: false }];

  const combined = new RegExp(
    selected.flatMap((phrase) => phrase.patterns.map((pattern) => pattern.source)).join("|"),
    "gi"
  );
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(combined)) {
    if (!match[0]) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: source.slice(last, start), hit: false });
    parts.push({ text: match[0], hit: true });
    last = start + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), hit: false });
  return parts.length ? parts : [{ text: source, hit: false }];
}

export function emptyAnalysis() {
  return { riskScore: 0, matchedPhrases: [], stage: "normal" };
}

export function speakerLabel(speaker) {
  if (speaker === "caller") return "Caller";
  if (speaker === "amma") return "Amma";
  return "Heard";
}

const SAMPLE_TRANSCRIPTS = [
  {
    id: "safe-hello",
    expect: "normal",
    lines: ["Hello Amma, this is Meera. Did you take your medicine?"],
  },
  {
    id: "suspicious-cbi",
    expect: "suspicious",
    lines: [
      "This is Inspector Sharma from CBI. Your Aadhaar is being misused. Stay on the call.",
    ],
  },
  {
    id: "scam-digital-arrest",
    expect: "scam",
    lines: DIGITAL_ARREST_SCRIPT.map((line) => line.text),
  },
];

export function selfTestCallAnalyzer() {
  const results = SAMPLE_TRANSCRIPTS.map((sample) => {
    const analysis = analyzeTranscript(sample.lines);
    return {
      id: sample.id,
      expect: sample.expect,
      got: analysis.stage,
      score: analysis.riskScore,
      pass: analysis.stage === sample.expect,
      matchedPhrases: analysis.matchedPhrases,
    };
  });
  return { ok: results.every((item) => item.pass), results };
}

if (import.meta.env?.DEV) {
  const check = selfTestCallAnalyzer();
  if (!check.ok) {
    console.warn("Call analyzer self-test failed", check.results);
  }
}
