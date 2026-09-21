import { hashPin, randomSalt, verifyPin } from "./pin";

const ACCOUNTS_KEY = "aasra-local-accounts";
const USERS_KEY = "aasra-local-users";
const HOUSEHOLDS_KEY = "aasra-local-households";
const CODES_KEY = "aasra-local-codes";

function readMap(key) {
  try {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local);
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function writeMap(key, value) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch {
    try {
      sessionStorage.setItem(key, raw);
    } catch {
      /* private mode */
    }
  }
}

export function localAccountKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[.#$[\]]/g, "_");
}

export async function localSignUp(email, password) {
  const key = localAccountKey(email);
  const accounts = readMap(ACCOUNTS_KEY);
  if (accounts[key]) {
    const error = new Error("That email already has an account. Sign in instead.");
    error.code = "auth/email-already-in-use";
    throw error;
  }
  const passwordSalt = randomSalt();
  const passwordHash = await hashPin(password, passwordSalt);
  const uid = `family-${crypto.randomUUID()}`;
  accounts[key] = {
    uid,
    email,
    passwordHash,
    passwordSalt,
    createdAt: Date.now(),
  };
  writeMap(ACCOUNTS_KEY, accounts);
  const users = readMap(USERS_KEY);
  users[uid] = { role: "family" };
  writeMap(USERS_KEY, users);
  return { uid, email };
}

export async function localSignIn(email, password) {
  const record = readMap(ACCOUNTS_KEY)[localAccountKey(email)];
  if (!record) {
    const error = new Error("Email or password is incorrect.");
    error.code = "auth/user-not-found";
    throw error;
  }
  const ok = await verifyPin(password, record.passwordSalt, record.passwordHash);
  if (!ok) {
    const error = new Error("Email or password is incorrect.");
    error.code = "auth/invalid-credential";
    throw error;
  }
  return { uid: record.uid, email: record.email || email };
}

export function localGetUser(uid) {
  if (!uid) return null;
  return readMap(USERS_KEY)[uid] || null;
}

export function localSaveUser(uid, record) {
  if (!uid) return;
  const users = readMap(USERS_KEY);
  users[uid] = { ...users[uid], ...record };
  writeMap(USERS_KEY, users);
}

export function localGetHousehold(householdId) {
  if (!householdId) return null;
  return readMap(HOUSEHOLDS_KEY)[householdId] || null;
}

export function localSaveHousehold(householdId, household) {
  if (!householdId) return;
  const households = readMap(HOUSEHOLDS_KEY);
  households[householdId] = household;
  writeMap(HOUSEHOLDS_KEY, households);
}

export function localLookupCode(code) {
  if (!code) return null;
  return readMap(CODES_KEY)[code] || null;
}

export function localSaveCode(code, householdId) {
  if (!code || !householdId) return;
  const codes = readMap(CODES_KEY);
  codes[code] = householdId;
  writeMap(CODES_KEY, codes);
}
