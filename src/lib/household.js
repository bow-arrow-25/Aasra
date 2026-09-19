import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { getFirebaseAuth, getFirebaseDb, hasFirebaseConfig } from "./firebase";
import { hashPin, randomSalt } from "./pin";
import {
  DEFAULT_FAMILY_MEMBERS,
  DEFAULT_SAFE_PAYEES,
  DEMO_HOUSEHOLD_ID,
  DEMO_PAIRING_CODE,
  DEMO_PIN,
} from "./session";

export { hasFirebaseConfig };

export function createPairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Sign in instead.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (code.includes("operation-not-allowed")) {
    return "Enable Email/Password and Anonymous sign-in in the Firebase console (Authentication > Sign-in method).";
  }
  return error?.message || "Something went wrong. Please try again.";
}

export function listenAuth(callback) {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function familySignUp(email, password) {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function familySignIn(email, password) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function ensureAnonymousUser() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signOutFirebase() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
}

export async function getUserRecord(uid) {
  const db = getFirebaseDb();
  if (!db || !uid) return null;
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export async function getHousehold(householdId) {
  const db = getFirebaseDb();
  if (!db || !householdId) return null;
  const snap = await get(ref(db, `households/${householdId}`));
  return snap.exists() ? snap.val() : null;
}

export async function lookupHouseholdIdByCode(code) {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(ref(db, `pairingCodes/${code}`));
  if (!snap.exists()) return null;
  const value = snap.val();
  return typeof value === "string" ? value : value?.householdId || null;
}

async function allocatePairingCode() {
  const db = getFirebaseDb();
  for (let i = 0; i < 12; i += 1) {
    const code = createPairingCode();
    const snap = await get(ref(db, `pairingCodes/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error("Could not create a free pairing code. Try again.");
}

function demoHouseholdPayload() {
  return {
    pairingCode: DEMO_PAIRING_CODE,
    profile: {
      elderName: "Amma",
      age: 72,
      city: "Hyderabad",
      lang: "en",
      familyMembers: DEFAULT_FAMILY_MEMBERS,
    },
    safePayees: DEFAULT_SAFE_PAYEES,
    createdAt: Date.now(),
    demo: true,
  };
}

export async function createHouseholdForFamily({ uid, email, profile, safePayees }) {
  const db = getFirebaseDb();
  const pairingCode = await allocatePairingCode();
  const householdId = crypto.randomUUID();
  const payees = (safePayees || []).map((item) => String(item).trim()).filter(Boolean);
  const household = {
    pairingCode,
    profile: {
      elderName: profile.elderName.trim(),
      age: Number(profile.age) || 0,
      city: String(profile.city || "").trim(),
      lang: profile.lang || "en",
      familyMembers: DEFAULT_FAMILY_MEMBERS,
    },
    safePayees: payees.length ? payees : DEFAULT_SAFE_PAYEES,
    members: {
      [uid]: {
        uid,
        role: "family",
        email: email || "",
        joinedAt: Date.now(),
      },
    },
    createdAt: Date.now(),
  };

  await update(ref(db), {
    [`households/${householdId}`]: household,
    [`pairingCodes/${pairingCode}`]: householdId,
    [`users/${uid}`]: { householdId, role: "family" },
  });

  return { householdId, pairingCode, household };
}

export async function registerElderOnHousehold({
  uid,
  householdId,
  pinHash,
  pinSalt,
}) {
  const db = getFirebaseDb();
  await update(ref(db), {
    [`households/${householdId}/members/${uid}`]: {
      uid,
      role: "elder",
      pinHash,
      pinSalt,
      joinedAt: Date.now(),
    },
    [`users/${uid}`]: { householdId, role: "elder" },
  });
}

export async function ensureDemoHousehold(uid, role, { pinHash, pinSalt } = {}) {
  const db = getFirebaseDb();
  const existing = await getHousehold(DEMO_HOUSEHOLD_ID);
  const member = {
    uid,
    role,
    joinedAt: Date.now(),
    demo: true,
  };
  if (role === "elder" && pinHash && pinSalt) {
    member.pinHash = pinHash;
    member.pinSalt = pinSalt;
  }

  const updates = {};
  if (!existing) {
    updates[`households/${DEMO_HOUSEHOLD_ID}`] = {
      ...demoHouseholdPayload(),
      members: { [uid]: member },
    };
    updates[`pairingCodes/${DEMO_PAIRING_CODE}`] = DEMO_HOUSEHOLD_ID;
  } else {
    updates[`households/${DEMO_HOUSEHOLD_ID}/members/${uid}`] = member;
  }
  updates[`users/${uid}`] = { householdId: DEMO_HOUSEHOLD_ID, role };

  await update(ref(db), updates);
  const household = (await getHousehold(DEMO_HOUSEHOLD_ID)) || {
    ...demoHouseholdPayload(),
    pairingCode: DEMO_PAIRING_CODE,
  };
  return {
    householdId: DEMO_HOUSEHOLD_ID,
    pairingCode: household.pairingCode || DEMO_PAIRING_CODE,
    household,
  };
}

export async function seedDemoElderPin() {
  const pinSalt = randomSalt();
  const pinHash = await hashPin(DEMO_PIN, pinSalt);
  return { pinSalt, pinHash };
}

export function householdToBoard(household) {
  const profile = household?.profile || {};
  const safePayees = household?.safePayees?.length
    ? household.safePayees
    : DEFAULT_SAFE_PAYEES;
  return {
    parentName: profile.elderName || "Amma",
    safePayees,
    knownPayees: [
      ...safePayees,
      "Ramesh (neighbour)",
      "Milk Dairy",
    ],
    familyMembers: profile.familyMembers?.length
      ? profile.familyMembers
      : DEFAULT_FAMILY_MEMBERS,
    lang: profile.lang === "te" || profile.lang === "hi" ? profile.lang : "en",
    pairingCode: household?.pairingCode || "",
    elderAge: profile.age || null,
    elderCity: profile.city || "",
  };
}
