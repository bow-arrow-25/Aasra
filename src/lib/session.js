export const DEMO_HOUSEHOLD_ID = "aasra-demo";
export const DEMO_PAIRING_CODE = "123456";
export const DEMO_PIN = "1234";

export const ELDER_STORE_KEY = "aasra-elder-device";
export const PIN_GUARD_KEY = "aasra-pin-guard";
export const UNLOCK_KEY = "aasra-elder-unlocked";

export const DEFAULT_SAFE_PAYEES = [
  "Electricity Board",
  "Dr. Meera Clinic",
  "Airtel Recharge",
];

export const DEFAULT_FAMILY_MEMBERS = [
  { name: "Arjun", role: "primary" },
  { name: "Meera", role: "backup" },
];

export function buildFamilyMembers(primaryName, backupName) {
  const primary = String(primaryName || "").trim();
  const backup = String(backupName || "").trim();
  return [
    { name: primary || "Family", role: "primary" },
    { name: backup || "Backup", role: "backup" },
  ];
}

export function readSavedProfile() {
  const raw = readSession("aasra-profile");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSavedProfile(profile) {
  if (!profile) {
    writeSession("aasra-profile", "");
    return;
  }
  writeSession(
    "aasra-profile",
    JSON.stringify({
      parentName: profile.parentName || "",
      familyMembers: profile.familyMembers || [],
      elderAge: profile.elderAge ?? null,
      elderCity: profile.elderCity || "",
      lang: profile.lang || "en",
      safePayees: profile.safePayees || [],
      knownPayees: profile.knownPayees || [],
      householdKind: profile.householdKind || "family",
      orgName: profile.orgName || "",
      residents: profile.residents || [],
      checkupTypes: profile.checkupTypes || [],
      dailyChecks: profile.dailyChecks || [],
      reviews: profile.reviews || [],
      currentResidentId: profile.currentResidentId || "",
    })
  );
}

export function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export function clearKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readSession(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function writeSession(key, value) {
  try {
    if (value == null || value === "") sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export function clearSessionKeys() {
  ["aasra-room", "aasra-role", "aasra-household", "aasra-email", "aasra-profile", UNLOCK_KEY].forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

export function saveElderDevice(record) {
  writeJson(ELDER_STORE_KEY, record);
}

export function loadElderDevice() {
  return readJson(ELDER_STORE_KEY);
}

export function loadPinGuard() {
  const guard = readJson(PIN_GUARD_KEY) || { fails: 0, lockedUntil: 0 };
  if (guard.lockedUntil && Date.now() > guard.lockedUntil) {
    const reset = { fails: 0, lockedUntil: 0 };
    writeJson(PIN_GUARD_KEY, reset);
    return reset;
  }
  return guard;
}

export function recordPinFailure() {
  const guard = loadPinGuard();
  const fails = (guard.fails || 0) + 1;
  const next = {
    fails,
    lockedUntil: fails >= 3 ? Date.now() + 30_000 : 0,
  };
  writeJson(PIN_GUARD_KEY, next);
  return next;
}

export function clearPinFailures() {
  writeJson(PIN_GUARD_KEY, { fails: 0, lockedUntil: 0 });
}

export function lockRemainingMs() {
  const guard = loadPinGuard();
  return Math.max(0, (guard.lockedUntil || 0) - Date.now());
}
