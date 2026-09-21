import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { getFirebaseAuth, getFirebaseDb, hasFirebaseConfig } from "./firebase";
import { hashPin, randomSalt, verifyPin } from "./pin";
import {
  localGetHousehold,
  localGetUser,
  localLookupCode,
  localSaveCode,
  localSaveHousehold,
  localSaveUser,
  localSignIn,
  localSignUp,
} from "./localFamily";
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
  if (code.includes("configuration-not-found")) {
    return "Firebase Authentication is not set up yet. In the Firebase console open Authentication, click Get started, then enable Email/Password and Anonymous.";
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

function isAuthUnavailable(error) {
  const code = String(error?.code || error?.message || "");
  return (
    code.includes("configuration-not-found") ||
    code.includes("CONFIGURATION_NOT_FOUND") ||
    code.includes("operation-not-allowed") ||
    code.includes("admin-restricted-operation") ||
    code.includes("permission-denied") ||
    code.includes("PERMISSION_DENIED")
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function accountKey(email) {
  return normalizeEmail(email).replace(/[.#$\[\]]/g, "_");
}

function assertFamilyCredentials(email, password) {
  if (!normalizeEmail(email).includes("@")) {
    const error = new Error("Enter a valid email address.");
    error.code = "auth/invalid-email";
    throw error;
  }
  if (String(password || "").length < 6) {
    const error = new Error("Use a password with at least 6 characters.");
    error.code = "auth/weak-password";
    throw error;
  }
}

async function signUpFamilyAccount(email, password) {
  const db = getFirebaseDb();
  if (db) {
    try {
      const key = accountKey(email);
      const existing = await get(ref(db, `familyAccounts/${key}`));
      if (existing.exists()) {
        const error = new Error("That email already has an account. Sign in instead.");
        error.code = "auth/email-already-in-use";
        throw error;
      }
      const passwordSalt = randomSalt();
      const passwordHash = await hashPin(password, passwordSalt);
      const uid = `family-${crypto.randomUUID()}`;
      await update(ref(db), {
        [`familyAccounts/${key}`]: {
          uid,
          email,
          passwordHash,
          passwordSalt,
          createdAt: Date.now(),
        },
        [`users/${uid}`]: { role: "family" },
      });
      localSaveUser(uid, { role: "family" });
      return { uid, email };
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") throw error;
      if (!isAuthUnavailable(error)) throw error;
    }
  }
  return localSignUp(email, password);
}

async function signInFamilyAccount(email, password) {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snap = await get(ref(db, `familyAccounts/${accountKey(email)}`));
      if (snap.exists()) {
        const record = snap.val() || {};
        const ok = await verifyPin(password, record.passwordSalt, record.passwordHash);
        if (!ok) {
          const error = new Error("Email or password is incorrect.");
          error.code = "auth/invalid-credential";
          throw error;
        }
        return { uid: record.uid, email: record.email || email };
      }
    } catch (error) {
      if (error?.code === "auth/invalid-credential") throw error;
      if (!isAuthUnavailable(error)) throw error;
    }
  }
  return localSignIn(email, password);
}

export async function familySignUp(email, password) {
  const trimmed = normalizeEmail(email);
  assertFamilyCredentials(trimmed, password);
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmed, password);
      return cred.user;
    } catch (error) {
      if (!isAuthUnavailable(error)) throw error;
    }
  }
  return signUpFamilyAccount(trimmed, password);
}

export async function familySignIn(email, password) {
  const trimmed = normalizeEmail(email);
  assertFamilyCredentials(trimmed, password);
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmed, password);
      return cred.user;
    } catch (error) {
      if (!isAuthUnavailable(error)) throw error;
    }
  }
  return signInFamilyAccount(trimmed, password);
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
  if (!uid) return null;
  const db = getFirebaseDb();
  if (db) {
    try {
      const snap = await get(ref(db, `users/${uid}`));
      if (snap.exists()) return snap.val();
    } catch {
      /* rules or offline */
    }
  }
  return localGetUser(uid);
}

export async function getHousehold(householdId) {
  if (!householdId) return null;
  const db = getFirebaseDb();
  if (db) {
    try {
      const snap = await get(ref(db, `households/${householdId}`));
      if (snap.exists()) return snap.val();
    } catch {
      /* rules or offline */
    }
  }
  return localGetHousehold(householdId);
}

export async function lookupHouseholdIdByCode(code) {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snap = await get(ref(db, `pairingCodes/${code}`));
      if (snap.exists()) {
        const value = snap.val();
        return typeof value === "string" ? value : value?.householdId || null;
      }
    } catch {
      /* rules or offline */
    }
  }
  return localLookupCode(code);
}

async function allocatePairingCode() {
  const db = getFirebaseDb();
  for (let i = 0; i < 12; i += 1) {
    const code = createPairingCode();
    if (db) {
      try {
        const snap = await get(ref(db, `pairingCodes/${code}`));
        if (!snap.exists() && !localLookupCode(code)) return code;
        continue;
      } catch {
        if (!localLookupCode(code)) return code;
      }
    } else if (!localLookupCode(code)) {
      return code;
    }
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

export async function createHouseholdForFamily({ uid, email, profile, safePayees, kind = "family" }) {
  const db = getFirebaseDb();
  const pairingCode = await allocatePairingCode();
  const householdId = crypto.randomUUID();
  const payees = (safePayees || []).map((item) => String(item).trim()).filter(Boolean);
  const isOrg = kind === "org";
  const household = {
    pairingCode,
    kind: isOrg ? "org" : "family",
    profile: {
      kind: isOrg ? "org" : "family",
      elderName: isOrg ? String(profile.orgName || "").trim() : profile.elderName.trim(),
      orgName: isOrg ? String(profile.orgName || "").trim() : "",
      age: Number(profile.age) || 0,
      city: String(profile.city || "").trim(),
      lang: profile.lang || "en",
      familyMembers: profile.familyMembers?.length
        ? profile.familyMembers
        : DEFAULT_FAMILY_MEMBERS,
      residents: profile.residents || [],
      checkupTypes: profile.checkupTypes || [],
      dailyChecks: profile.dailyChecks || [],
      reviews: profile.reviews || [],
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

  if (db) {
    try {
      await update(ref(db), {
        [`households/${householdId}`]: household,
        [`pairingCodes/${pairingCode}`]: householdId,
        [`users/${uid}`]: { householdId, role: "family" },
      });
    } catch {
      /* Auth may be off; keep the household on this device for the demo. */
    }
  }
  localSaveHousehold(householdId, household);
  localSaveCode(pairingCode, householdId);
  localSaveUser(uid, { householdId, role: "family", email: email || "" });

  return { householdId, pairingCode, household };
}

export async function updateHouseholdProfile(householdId, profilePatch) {
  if (!householdId || !profilePatch) return null;
  const household = (await getHousehold(householdId)) || {};
  const next = {
    ...household,
    profile: {
      ...(household.profile || {}),
      ...profilePatch,
    },
  };
  const db = getFirebaseDb();
  if (db) {
    try {
      await update(ref(db), {
        [`households/${householdId}/profile`]: next.profile,
      });
    } catch {
      /* keep the household on this device */
    }
  }
  localSaveHousehold(householdId, next);
  return next;
}

export async function registerElderOnHousehold({
  uid,
  householdId,
  pinHash,
  pinSalt,
}) {
  const db = getFirebaseDb();
  const member = {
    uid,
    role: "elder",
    pinHash,
    pinSalt,
    joinedAt: Date.now(),
  };
  if (db) {
    try {
      await update(ref(db), {
        [`households/${householdId}/members/${uid}`]: member,
        [`users/${uid}`]: { householdId, role: "elder" },
      });
    } catch {
      /* local pairing still works for the demo */
    }
  }
  const household = localGetHousehold(householdId) || {};
  localSaveHousehold(householdId, {
    ...household,
    members: { ...(household.members || {}), [uid]: member },
  });
  localSaveUser(uid, { householdId, role: "elder" });
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

  try {
    if (db) await update(ref(db), updates);
    else throw new Error("offline");
  } catch {
    const local = localGetHousehold(DEMO_HOUSEHOLD_ID) || demoHouseholdPayload();
    localSaveHousehold(DEMO_HOUSEHOLD_ID, {
      ...local,
      pairingCode: DEMO_PAIRING_CODE,
      members: { ...(local.members || {}), [uid]: member },
    });
    localSaveCode(DEMO_PAIRING_CODE, DEMO_HOUSEHOLD_ID);
    localSaveUser(uid, { householdId: DEMO_HOUSEHOLD_ID, role });
  }
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
  const householdKind = profile.kind === "org" || household?.kind === "org" ? "org" : "family";
  return {
    parentName: profile.elderName || "",
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
    householdKind,
    orgName: profile.orgName || (householdKind === "org" ? profile.elderName : "") || "",
    residents: profile.residents || [],
    checkupTypes: profile.checkupTypes || [],
    dailyChecks: profile.dailyChecks || [],
    reviews: profile.reviews || [],
  };
}
