import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { analyzeTranscript, emptyAnalysis } from "../lib/callAnalyzer";
import {
  missedMessage,
  nextDailyReminder,
  normalizeReminderType,
  reminderMissMs,
  REMINDER_STATUS,
  statusRank,
} from "../lib/reminders";
import { listenDemoInbox } from "../lib/demoInbox";
import { analyzeSms } from "../lib/smsAnalyzer";
import {
  appendTimeline,
  createPaymentRecord,
  findDecisionTarget,
  isAwaitingFamily,
  PAYMENT_STATUS,
  primaryFamilyName,
  statusFromRuleDecision,
  upsertPayment,
} from "../lib/payments";
import {
  clearRoom,
  connect,
  createRoomCode,
  getClientId,
  getSyncMode,
  hasFirebaseConfig,
  publish,
} from "../lib/sync";
import {
  createHouseholdForFamily,
  ensureAnonymousUser,
  ensureDemoHousehold,
  familySignIn,
  familySignUp,
  getHousehold,
  getUserRecord,
  householdToBoard,
  listenAuth,
  lookupHouseholdIdByCode,
  registerElderOnHousehold,
  seedDemoElderPin,
  signOutFirebase,
} from "../lib/household";
import { hashPin, randomSalt, verifyPin } from "../lib/pin";
import {
  DEFAULT_FAMILY_MEMBERS,
  DEMO_HOUSEHOLD_ID,
  DEMO_PAIRING_CODE,
  UNLOCK_KEY,
  clearPinFailures,
  clearSessionKeys,
  loadElderDevice,
  lockRemainingMs,
  readSession,
  recordPinFailure,
  saveElderDevice,
  writeSession,
} from "../lib/session";
import { clearStashedShareText } from "../lib/shareTarget";

const GlobalStateContext = createContext(null);

const LEVEL = {
  INFO: "INFO",
  WARN: "WARN",
  CRITICAL: "CRITICAL",
};

export function escalationMs(demoMode) {
  return demoMode ? 15_000 : 2 * 60 * 1000;
}

export function callAlarmMs(demoMode) {
  return demoMode ? 15_000 : 20 * 60 * 1000;
}

const emptyBoard = {
  parentName: "Amma",
  lastCheckIn: null,
  events: [],
  messages: [],
  voiceMessages: [],
  spamSenders: [],
  spamCallers: [],
  pendingSms: null,
  safePayees: ["Electricity Board", "Dr. Meera Clinic", "Airtel Recharge"],
  knownPayees: [
    "Electricity Board",
    "Dr. Meera Clinic",
    "Airtel Recharge",
    "Ramesh (neighbour)",
    "Milk Dairy",
  ],
  activeCall: null,
  pendingPayment: null,
  payments: [],
  familyMembers: DEFAULT_FAMILY_MEMBERS,
  elderAge: null,
  elderCity: "",
  reminders: [],
};

const hasSavedSession = Boolean(readSession("aasra-household") || readSession("aasra-room"));

const initialState = {
  ...emptyBoard,
  lang: "en",
  demoMode: true,
  roomCode: readSession("aasra-room"),
  householdId: readSession("aasra-household"),
  role: readSession("aasra-role"),
  syncMode: hasFirebaseConfig() ? "firebase" : "broadcast",
  authReady: !hasFirebaseConfig(),
  needsSetup: false,
  authEmail: "",
  authUid: "",
  boardReady: !hasSavedSession,
};

function createEvent({ level, kind, message, detail, meta }) {
  return {
    id: crypto.randomUUID(),
    level,
    kind,
    message,
    detail,
    time: Date.now(),
    acknowledged: false,
    escalated: false,
    ...(meta ? { meta } : {}),
  };
}

function isPendingApproval(event) {
  const status = event.meta?.status;
  if (status === PAYMENT_STATUS.HELD || status === PAYMENT_STATUS.PENDING_APPROVAL) {
    return true;
  }
  return event.kind === "UPI" && event.meta?.decision === "HOLD";
}

function acknowledgePaymentEvents(events, paymentId) {
  if (!paymentId) return events;
  return events.map((event) =>
    event.meta?.paymentId === paymentId && !event.acknowledged
      ? { ...event, acknowledged: true }
      : event
  );
}

function shouldWatchForEscalation(event) {
  if (event.acknowledged || event.escalated) return false;
  if (event.kind === "ESCALATION") return false;
  return event.level === LEVEL.CRITICAL || isPendingApproval(event);
}

function normalizeCaller(value) {
  return String(value || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

function isSpamCaller(from, spamCallers = []) {
  const target = normalizeCaller(from);
  if (!target) return false;
  return (spamCallers || []).some((item) => {
    const known = normalizeCaller(item);
    return Boolean(known) && (target.includes(known) || known.includes(target));
  });
}

function persistSession({ householdId, roomCode, role }) {
  writeSession("aasra-household", householdId || "");
  writeSession("aasra-room", roomCode || "");
  writeSession("aasra-role", role || "");
}

function reducer(state, action) {
  switch (action.type) {
    case "CHECK_IN":
      return {
        ...state,
        lastCheckIn: action.time,
        events: [action.event, ...state.events],
      };
    case "ACKNOWLEDGE_EVENT":
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.id ? { ...event, acknowledged: true } : event
        ),
      };
    case "START_CALL":
      if (state.activeCall?.id === action.call?.id) return state;
      return {
        ...state,
        activeCall: action.call,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "ANSWER_CALL":
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: {
          ...state.activeCall,
          answered: true,
          answeredAt: action.answeredAt || state.activeCall.answeredAt,
          producerClientId:
            action.producerClientId || state.activeCall.producerClientId,
        },
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "APPEND_CALL_TRANSCRIPT":
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: {
          ...state.activeCall,
          transcript: [
            ...(state.activeCall.transcript || []),
            ...(action.lines || []),
          ],
          analysis: action.analysis || state.activeCall.analysis,
          riskAlerted: Boolean(
            action.riskAlerted || state.activeCall.riskAlerted
          ),
        },
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "SET_CALL_ANALYZER":
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: {
          ...state.activeCall,
          analyzerMode:
            action.analyzerMode || state.activeCall.analyzerMode,
          speakCaller:
            action.speakCaller === undefined
              ? state.activeCall.speakCaller
              : Boolean(action.speakCaller),
        },
      };
    case "FAMILY_CALLING":
      return {
        ...state,
        activeCall: state.activeCall
          ? { ...state.activeCall, familyCalling: true }
          : state.activeCall,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "MARK_CALLER_SPAM":
      return {
        ...state,
        spamCallers: action.spamCallers || state.spamCallers,
        activeCall: state.activeCall
          ? { ...state.activeCall, spam: true, scam: true }
          : state.activeCall,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "UPSERT_REMINDERS": {
      let reminders = [...(state.reminders || [])];
      for (const next of action.reminders || []) {
        if (!next?.id) continue;
        const index = reminders.findIndex((item) => item.id === next.id);
        if (index === -1) {
          reminders = [next, ...reminders];
          continue;
        }
        const current = reminders[index];
        if (statusRank(next.status) < statusRank(current.status)) continue;
        reminders[index] = { ...current, ...next };
      }
      let events = state.events;
      const incoming = action.events || (action.event ? [action.event] : []);
      for (const event of incoming) {
        if (!event?.id || events.some((item) => item.id === event.id)) continue;
        events = [event, ...events];
      }
      return { ...state, reminders, events };
    }
    case "DELETE_REMINDER":
      return {
        ...state,
        reminders: (state.reminders || []).filter((item) => item.id !== action.id),
      };
    case "CALL_ALARM":
      return {
        ...state,
        activeCall: state.activeCall
          ? { ...state.activeCall, alarmed: true }
          : state.activeCall,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "END_CALL":
      return {
        ...state,
        activeCall: null,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "START_PAYMENT":
      return {
        ...state,
        pendingPayment: action.revealOnParent === false ? state.pendingPayment : action.payment,
        payments: upsertPayment(state.payments, action.payment),
        events: [action.event, ...state.events],
      };
    case "CLEAR_PAYMENT":
      return { ...state, pendingPayment: null };
    case "DECIDE_PAYMENT": {
      const payments = upsertPayment(state.payments, action.payment);
      const resolved = !isAwaitingFamily(action.payment);
      const baseEvents = resolved
        ? acknowledgePaymentEvents(state.events, action.payment.id)
        : state.events;
      const events = action.event ? [action.event, ...baseEvents] : baseEvents;
      let pendingPayment = state.pendingPayment;
      if (action.revealOnParent === false) {
        pendingPayment =
          state.pendingPayment?.id === action.payment.id ? null : state.pendingPayment;
      } else {
        pendingPayment = action.payment;
      }
      return {
        ...state,
        payments,
        pendingPayment,
        events,
      };
    }
    case "REJECT_PAYMENT":
      return {
        ...state,
        pendingPayment: state.pendingPayment
          ? { ...state.pendingPayment, rejected: true }
          : null,
        events: [
          action.event,
          ...state.events.map((event) =>
            event.kind === "UPI" &&
            !event.acknowledged &&
            (event.meta?.decision === "BLOCK" || event.meta?.decision === "HOLD")
              ? { ...event, acknowledged: true }
              : event
          ),
        ],
      };
    case "SEND_VOICE_MESSAGE":
      return {
        ...state,
        voiceMessages: [action.message, ...(state.voiceMessages || [])],
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "MARK_VOICE_MESSAGE_HEARD":
      return {
        ...state,
        voiceMessages: (state.voiceMessages || []).map((message) =>
          message.id === action.id ? { ...message, heard: true } : message
        ),
      };
    case "RECEIVE_SMS":
      if ((state.messages || []).some((item) => item.id === action.message.id)) {
        return state;
      }
      return {
        ...state,
        messages: [action.message, ...state.messages],
        pendingSms:
          action.revealOnParent === false
            ? state.pendingSms
            : action.revealOnParent === true ||
                action.message.analysis?.label === "SCAM"
              ? action.message
              : state.pendingSms,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "UPDATE_SMS": {
      const messages = (state.messages || []).map((item) =>
        item.id === action.message.id ? action.message : item
      );
      let pendingSms = state.pendingSms;
      if (state.pendingSms?.id === action.message.id) {
        pendingSms = action.clearPending ? null : action.message;
      }
      return {
        ...state,
        messages,
        pendingSms,
        spamSenders: action.spamSenders || state.spamSenders,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    }
    case "CLEAR_SMS_WARNING":
      return { ...state, pendingSms: null };
    case "ADD_EVENT":
      return {
        ...state,
        events: [action.event, ...state.events],
      };
    case "ESCALATE_EVENT": {
      const source = state.events.find((event) => event.id === action.id);
      if (!source || source.escalated) return state;
      const alreadyLogged = state.events.some(
        (event) =>
          event.id === action.event.id ||
          (event.kind === "ESCALATION" && event.meta?.sourceId === action.id)
      );
      return {
        ...state,
        events: alreadyLogged
          ? state.events.map((event) =>
              event.id === action.id ? { ...event, escalated: true } : event
            )
          : [
              action.event,
              ...state.events.map((event) =>
                event.id === action.id ? { ...event, escalated: true } : event
              ),
            ],
      };
    }
    case "SET_LANG":
      return {
        ...state,
        lang: action.lang,
      };
    case "SET_DEMO_MODE":
      return {
        ...state,
        demoMode: Boolean(action.demoMode),
      };
    case "SET_ROOM":
    case "SET_SESSION":
      return {
        ...state,
        householdId: action.householdId ?? action.roomCode ?? state.householdId,
        roomCode: action.roomCode,
        role: action.role,
        syncMode: getSyncMode(),
        authReady: true,
        needsSetup: false,
        boardReady: false,
        ...(action.board || {}),
      };
    case "BOARD_READY":
      return {
        ...state,
        boardReady: true,
      };
    case "SET_SYNC_MODE":
      return {
        ...state,
        syncMode: action.syncMode,
      };
    case "AUTH_READY":
      return {
        ...state,
        authReady: true,
        needsSetup: action.needsSetup ? true : state.needsSetup,
        authEmail: action.email ?? state.authEmail,
        authUid: action.uid ?? state.authUid,
      };
    case "NEED_SETUP":
      return {
        ...state,
        authReady: true,
        needsSetup: true,
        authEmail: action.email || "",
        authUid: action.uid || "",
        roomCode: "",
        householdId: "",
        role: "family",
        boardReady: true,
      };
    case "SIGN_OUT":
      return {
        ...emptyBoard,
        lang: state.lang,
        demoMode: state.demoMode,
        syncMode: hasFirebaseConfig() ? "firebase" : "broadcast",
        roomCode: "",
        householdId: "",
        role: "",
        authReady: true,
        needsSetup: false,
        authEmail: "",
        authUid: "",
        boardReady: true,
      };
    case "RESET_DEMO":
    case "HYDRATE_RESET":
      return {
        ...state,
        lastCheckIn: null,
        events: [],
        messages: [],
        voiceMessages: [],
        spamSenders: [],
        spamCallers: [],
        pendingSms: null,
        activeCall: null,
        pendingPayment: null,
        payments: [],
        reminders: [],
        boardReady: action.type === "HYDRATE_RESET" ? false : state.boardReady,
      };
    default:
      return state;
  }
}

function levelForDecision(decision) {
  if (decision === "BLOCK") return LEVEL.CRITICAL;
  if (decision === "HOLD") return LEVEL.WARN;
  return LEVEL.INFO;
}

export function GlobalStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!hasFirebaseConfig()) return undefined;
    return listenAuth(async (user) => {
      const current = stateRef.current;
      if (current.needsSetup) {
        dispatch({ type: "AUTH_READY", email: user?.email || current.authEmail, uid: user?.uid || current.authUid });
        return;
      }
      if (!user) {
        dispatch({ type: "AUTH_READY" });
        return;
      }
      try {
        const record = await getUserRecord(user.uid);
        if (!record?.householdId) {
          if (user.isAnonymous) {
            dispatch({ type: "AUTH_READY" });
            return;
          }
          dispatch({
            type: "NEED_SETUP",
            email: user.email || "",
            uid: user.uid,
          });
          return;
        }
        if (record.role === "elder" && !readSession(UNLOCK_KEY)) {
          dispatch({ type: "AUTH_READY" });
          return;
        }
        if (current.householdId === record.householdId && current.role) {
          dispatch({ type: "AUTH_READY" });
          return;
        }
        const household = await getHousehold(record.householdId);
        const role = record.role === "elder" ? "parent" : "family";
        const roomCode = household?.pairingCode || "";
        persistSession({
          householdId: record.householdId,
          roomCode,
          role,
        });
        dispatch({
          type: "SET_SESSION",
          householdId: record.householdId,
          roomCode,
          role,
          board: householdToBoard(household || {}),
        });
      } catch (error) {
        console.warn("Auth restore failed", error);
        dispatch({ type: "AUTH_READY" });
      }
    });
  }, []);

  useEffect(() => {
    const syncKey = state.householdId || state.roomCode;
    if (!syncKey) return undefined;
    dispatch({ type: "HYDRATE_RESET" });
    const stop = connect(
      { householdId: state.householdId, roomCode: state.roomCode },
      (remote) => {
        if (!remote?.type) return;
        if (remote.type === "RESET_DEMO") {
          dispatch({ type: "RESET_DEMO" });
          return;
        }
        dispatch(remote);
      }
    );
    dispatch({ type: "SET_SYNC_MODE", syncMode: getSyncMode() });
    dispatch({ type: "BOARD_READY" });
    return stop;
  }, [state.householdId, state.roomCode]);

  const actions = useMemo(
    () => {
      function send(action) {
        dispatch(action);
        stateRef.current = reducer(stateRef.current, action);
        if (
          action.type !== "HYDRATE_RESET" &&
          action.type !== "BOARD_READY" &&
          action.type !== "SET_ROOM" &&
          action.type !== "SET_SESSION" &&
          action.type !== "SET_SYNC_MODE" &&
          action.type !== "AUTH_READY" &&
          action.type !== "NEED_SETUP" &&
          action.type !== "SIGN_OUT"
        ) {
          publish(action);
        }
      }

      function enterSession({ householdId, roomCode, role, board }) {
        persistSession({ householdId, roomCode, role });
        dispatch({
          type: "SET_SESSION",
          householdId,
          roomCode,
          role,
          board,
        });
      }

      return {
        joinRoom(roomCode, role) {
          const code = String(roomCode || "").replace(/\D/g, "").slice(0, 6);
          if (code.length !== 6) return;
          enterSession({
            householdId: code,
            roomCode: code,
            role,
          });
        },
        createFamilyRoom() {
          const code = createRoomCode();
          enterSession({
            householdId: code,
            roomCode: code,
            role: "family",
          });
          return code;
        },
        async signUpFamily(email, password) {
          const user = await familySignUp(email, password);
          dispatch({
            type: "NEED_SETUP",
            email: user.email || email,
            uid: user.uid,
          });
        },
        async signInFamily(email, password) {
          const user = await familySignIn(email, password);
          const record = await getUserRecord(user.uid);
          if (!record?.householdId) {
            dispatch({
              type: "NEED_SETUP",
              email: user.email || email,
              uid: user.uid,
            });
            return;
          }
          const household = await getHousehold(record.householdId);
          enterSession({
            householdId: record.householdId,
            roomCode: household?.pairingCode || "",
            role: "family",
            board: householdToBoard(household || {}),
          });
        },
        async completeFamilySetup({ elderName, age, city, lang, safeList }) {
          const uid = stateRef.current.authUid;
          if (!uid) throw new Error("Sign in first, then finish setup.");
          const safePayees = String(safeList || "")
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean);
          const result = await createHouseholdForFamily({
            uid,
            email: stateRef.current.authEmail,
            profile: { elderName, age, city, lang },
            safePayees,
          });
          enterSession({
            householdId: result.householdId,
            roomCode: result.pairingCode,
            role: "family",
            board: householdToBoard(result.household),
          });
        },
        async pairElder({ pairingCode, pin }) {
          const code = String(pairingCode || "").replace(/\D/g, "").slice(0, 6);
          const pinValue = String(pin || "").replace(/\D/g, "").slice(0, 4);
          if (code.length !== 6) throw new Error("Type all 6 numbers.");
          if (pinValue.length !== 4) throw new Error("Choose a 4-digit PIN.");
          const saltHex = randomSalt();
          const pinHash = await hashPin(pinValue, saltHex);

          if (hasFirebaseConfig()) {
            const user = await ensureAnonymousUser();
            const householdId = await lookupHouseholdIdByCode(code);
            if (!householdId) throw new Error("That family code was not found.");
            const household = await getHousehold(householdId);
            await registerElderOnHousehold({
              uid: user.uid,
              householdId,
              pinHash,
              pinSalt: saltHex,
            });
            saveElderDevice({
              householdId,
              pairingCode: code,
              pinHash,
              pinSalt: saltHex,
              uid: user.uid,
            });
            writeSession(UNLOCK_KEY, "1");
            clearPinFailures();
            enterSession({
              householdId,
              roomCode: household?.pairingCode || code,
              role: "parent",
              board: householdToBoard(household || {}),
            });
            return;
          }

          saveElderDevice({
            householdId: code,
            pairingCode: code,
            pinHash,
            pinSalt: saltHex,
            uid: "offline-elder",
          });
          writeSession(UNLOCK_KEY, "1");
          clearPinFailures();
          enterSession({
            householdId: code,
            roomCode: code,
            role: "parent",
          });
        },
        async unlockElderWithPin(pin) {
          const wait = lockRemainingMs();
          if (wait > 0) {
            throw new Error(`Locked. Try again in ${Math.ceil(wait / 1000)} seconds.`);
          }
          const device = loadElderDevice();
          if (!device?.pinHash) throw new Error("This phone is not paired yet.");
          const pinValue = String(pin || "").replace(/\D/g, "").slice(0, 4);
          const ok = await verifyPin(pinValue, device.pinSalt, device.pinHash);
          if (!ok) {
            const guard = recordPinFailure();
            if (guard.lockedUntil) {
              throw new Error("Wrong PIN three times. Locked for 30 seconds.");
            }
            throw new Error(`Wrong PIN. ${3 - guard.fails} tries left.`);
          }
          clearPinFailures();
          writeSession(UNLOCK_KEY, "1");

          if (hasFirebaseConfig()) {
            const user = await ensureAnonymousUser();
            await registerElderOnHousehold({
              uid: user.uid,
              householdId: device.householdId,
              pinHash: device.pinHash,
              pinSalt: device.pinSalt,
            });
            saveElderDevice({ ...device, uid: user.uid });
            const household = await getHousehold(device.householdId);
            enterSession({
              householdId: device.householdId,
              roomCode: device.pairingCode,
              role: "parent",
              board: householdToBoard(household || {}),
            });
            return;
          }

          enterSession({
            householdId: device.householdId,
            roomCode: device.pairingCode,
            role: "parent",
          });
        },
        async startDemoFamily() {
          if (hasFirebaseConfig()) {
            const user = await ensureAnonymousUser();
            const result = await ensureDemoHousehold(user.uid, "family");
            enterSession({
              householdId: result.householdId,
              roomCode: result.pairingCode,
              role: "family",
              board: householdToBoard(result.household),
            });
            return;
          }
          enterSession({
            householdId: DEMO_HOUSEHOLD_ID,
            roomCode: DEMO_PAIRING_CODE,
            role: "family",
          });
        },
        async startDemoElder() {
          const seeded = await seedDemoElderPin();
          if (hasFirebaseConfig()) {
            const user = await ensureAnonymousUser();
            const result = await ensureDemoHousehold(user.uid, "elder", seeded);
            saveElderDevice({
              householdId: result.householdId,
              pairingCode: result.pairingCode,
              pinHash: seeded.pinHash,
              pinSalt: seeded.pinSalt,
              uid: user.uid,
            });
            writeSession(UNLOCK_KEY, "1");
            clearPinFailures();
            enterSession({
              householdId: result.householdId,
              roomCode: result.pairingCode,
              role: "parent",
              board: householdToBoard(result.household),
            });
            return;
          }
          saveElderDevice({
            householdId: DEMO_HOUSEHOLD_ID,
            pairingCode: DEMO_PAIRING_CODE,
            pinHash: seeded.pinHash,
            pinSalt: seeded.pinSalt,
            uid: "offline-elder",
          });
          writeSession(UNLOCK_KEY, "1");
          clearPinFailures();
          enterSession({
            householdId: DEMO_HOUSEHOLD_ID,
            roomCode: DEMO_PAIRING_CODE,
            role: "parent",
          });
        },
        async signOutUser() {
          clearSessionKeys();
          dispatch({ type: "SIGN_OUT" });
          try {
            await signOutFirebase();
          } catch {
            /* offline or already signed out */
          }
        },
        checkIn({ source = "tap", transcript = "" } = {}) {
          const time = Date.now();
          const name = stateRef.current.parentName || "Amma";
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "CHECK_IN",
            message: `${name} checked in — I am okay`,
            detail:
              source === "voice"
                ? `Voice: “${transcript}”`
                : "Tapped I am okay",
          });
          send({ type: "CHECK_IN", time, event });
        },
        acknowledgeEvent(id) {
          send({ type: "ACKNOWLEDGE_EVENT", id });
        },
        startCall({
          from,
          scam,
          kyc = false,
          answered = false,
          analyzerMode = "live",
          speakCaller = false,
          id,
          startedAt,
          fromPhone = false,
        } = {}) {
          const current = stateRef.current;
          if (id && current.activeCall?.id === id) return;
          if (
            fromPhone &&
            current.activeCall?.from &&
            normalizeCaller(current.activeCall.from) === normalizeCaller(from) &&
            Date.now() - current.activeCall.startedAt < 30_000
          ) {
            return;
          }
          const isKyc = Boolean(kyc);
          const listedSpam = isSpamCaller(from, current.spamCallers);
          const isScam = Boolean(scam || isKyc || listedSpam);
          const now = startedAt || Date.now();
          const mode = analyzerMode === "scripted" ? "scripted" : "live";
          const call = {
            id: id || crypto.randomUUID(),
            from,
            scam: isScam,
            kyc: isKyc,
            answered: Boolean(answered),
            alarmed: false,
            startedAt: now,
            answeredAt: answered ? now : null,
            analyzerMode: mode,
            speakCaller: Boolean(speakCaller),
            producerClientId: answered ? getClientId() : null,
            transcript: [],
            analysis: emptyAnalysis(),
            riskAlerted: false,
            familyCalling: false,
            spam: listedSpam,
            fromPhone: Boolean(fromPhone),
          };
          let kind = "CALL";
          let message = fromPhone ? "Incoming call on Amma's phone" : "Incoming call";
          let level = listedSpam ? LEVEL.CRITICAL : LEVEL.INFO;
          let callType = "Incoming call";
          if (isKyc && answered) {
            kind = "KYC_CALL";
            message = "KYC call answered";
            level = LEVEL.CRITICAL;
            callType = "KYC verification call";
          } else if (isKyc) {
            kind = "KYC_CALL";
            message = "Possible KYC scam call";
            level = LEVEL.CRITICAL;
            callType = "KYC verification call";
          } else if (isScam) {
            kind = "SCAM_CALL";
            message = listedSpam
              ? "Flagged number is calling Amma"
              : "Possible scam call";
            level = LEVEL.CRITICAL;
            callType = "Suspected scam call";
          }
          const event = createEvent({
            level,
            kind,
            message,
            detail: `${answered ? "Answered" : "Incoming"} call from ${from}`,
            meta: {
              phone: from,
              callType,
              flagged: isScam,
              kyc: isKyc,
              fromPhone: Boolean(fromPhone),
            },
          });
          send({ type: "START_CALL", call, event });
        },
        answerCall() {
          const call = stateRef.current.activeCall;
          if (!call || call.answered) return;
          const event = createEvent({
            level: call.scam || call.kyc ? LEVEL.CRITICAL : LEVEL.INFO,
            kind: call.kyc ? "KYC_CALL" : "CALL_ANSWERED",
            message: call.kyc ? "KYC call answered" : "Call answered",
            detail: `Answered call from ${call.from}`,
            meta: {
              phone: call.from,
              callType: call.kyc
                ? "KYC verification call"
                : call.scam
                  ? "Suspected scam call"
                  : "Incoming call",
              flagged: Boolean(call.scam || call.kyc),
              kyc: Boolean(call.kyc),
            },
          });
          send({
            type: "ANSWER_CALL",
            answeredAt: Date.now(),
            producerClientId: call.producerClientId || getClientId(),
            event,
          });
        },
        appendCallTranscript(rawLines = []) {
          const call = stateRef.current.activeCall;
          if (!call) return;
          const lines = (Array.isArray(rawLines) ? rawLines : [rawLines])
            .map((line) => ({
              id: crypto.randomUUID(),
              speaker: line.speaker || "heard",
              text: String(line.text || line || "").trim(),
              time: line.time || Date.now(),
            }))
            .filter((line) => line.text);
          if (!lines.length) return;
          const seen = new Set((call.transcript || []).map((item) => item.id));
          const unique = lines.filter((line) => !seen.has(line.id));
          if (!unique.length) return;
          const analysis = analyzeTranscript([
            ...(call.transcript || []),
            ...unique,
          ]);
          const crossed = analysis.riskScore >= 60 && !call.riskAlerted;
          const event = crossed
            ? createEvent({
                level: LEVEL.CRITICAL,
                kind: "CALL_ANALYSER",
                message: "Digital arrest scam language detected",
                detail: `Risk ${analysis.riskScore}. Heard: ${
                  analysis.matchedPhrases.join(", ") || "scam phrases"
                }`,
                meta: {
                  phone: call.from,
                  callType: "Live call analyser",
                  flagged: true,
                  riskScore: analysis.riskScore,
                  matchedPhrases: analysis.matchedPhrases,
                },
              })
            : null;
          send({
            type: "APPEND_CALL_TRANSCRIPT",
            lines: unique,
            analysis,
            riskAlerted: crossed || Boolean(call.riskAlerted),
            event,
          });
        },
        setCallAnalyzer({ analyzerMode, speakCaller } = {}) {
          if (!stateRef.current.activeCall) return;
          send({
            type: "SET_CALL_ANALYZER",
            analyzerMode:
              analyzerMode === "scripted"
                ? "scripted"
                : analyzerMode === "live"
                  ? "live"
                  : undefined,
            speakCaller,
          });
        },
        callAmmaNow({ analyzerMode = "live", speakCaller = false } = {}) {
          const current = stateRef.current;
          const name = primaryFamilyName(current.familyMembers);
          if (current.activeCall) {
            const risk = current.activeCall.analysis?.riskScore ?? 0;
            const event = createEvent({
              level: risk >= 60 ? LEVEL.CRITICAL : LEVEL.WARN,
              kind: "FAMILY_CALL",
              message: `${name} is calling Amma`,
              detail: `Family called during a live call from ${current.activeCall.from}`,
              meta: {
                phone: current.activeCall.from,
                callType: "Family callback",
                flagged: risk >= 60,
              },
            });
            send({ type: "FAMILY_CALLING", event });
            return;
          }
          const mode = analyzerMode === "scripted" ? "scripted" : "live";
          actions.startCall({
            from: name,
            scam: false,
            analyzerMode: mode,
            speakCaller: mode === "scripted" ? speakCaller : false,
          });
        },
        markCallerSpam() {
          const current = stateRef.current;
          const call = current.activeCall;
          if (!call?.from) return;
          const already = isSpamCaller(call.from, current.spamCallers);
          const spamCallers = already
            ? current.spamCallers
            : [...(current.spamCallers || []), call.from];
          const event = createEvent({
            level: LEVEL.WARN,
            kind: "CALL_SPAM",
            message: "Family marked a caller as spam",
            detail: `${call.from} added to the spam caller list`,
            meta: { phone: call.from, flagged: true },
          });
          send({ type: "MARK_CALLER_SPAM", spamCallers, event });
        },
        logCallAlarm() {
          const call = stateRef.current.activeCall;
          if (call?.alarmed) return;
          const event = createEvent({
            level: LEVEL.CRITICAL,
            kind: "CALL_ALARM",
            message: "20-minute call alarm",
            detail: call
              ? `Call from ${call.from} has lasted 20 minutes`
              : "A call lasted 20 minutes",
            meta: {
              phone: call?.from,
              callType: call?.kyc
                ? "KYC verification call"
                : call?.scam
                  ? "Suspected scam call"
                  : "Incoming call",
              flagged: true,
            },
          });
          send({ type: "CALL_ALARM", event });
        },
        endCall() {
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "CALL_ENDED",
            message: "Call ended",
            detail: "Parent hung up",
          });
          send({ type: "END_CALL", event });
        },
        tryPayment({ payee, amount, note = "" }) {
          const current = stateRef.current;
          const result = evaluatePayment({
            payee,
            amount,
            safePayees: current.safePayees,
            knownPayees: current.knownPayees,
          });
          const status = statusFromRuleDecision(result.decision);
          const time = Date.now();
          const id = crypto.randomUUID();
          const timeline = [
            {
              at: time,
              actor: current.parentName || "Amma",
              label: `Payment of ₹${amount} to ${payee} was attempted`,
            },
          ];
          if (status === PAYMENT_STATUS.BLOCKED) {
            timeline.push({
              at: time,
              actor: "Aasra",
              label: `Blocked by family rules — ${result.reasons.join("; ")}`,
            });
          } else if (status === PAYMENT_STATUS.HELD) {
            timeline.push({
              at: time,
              actor: "Aasra",
              label: `Held for cooling-off — ${result.reasons.join("; ")}`,
            });
          } else {
            timeline.push({
              at: time,
              actor: "Aasra",
              label: "Looks safe. Payment sent.",
            });
          }
          const payment = createPaymentRecord({
            id,
            payee,
            amount,
            note: note || "UPI send",
            time,
            status,
            reasons: result.reasons,
            kind: "SEND",
            timeline,
          });
          const decisionWord =
            status === PAYMENT_STATUS.BLOCKED
              ? "BLOCKED"
              : status === PAYMENT_STATUS.HELD
                ? "HELD"
                : "SENT";
          const event = createEvent({
            level: levelForDecision(result.decision),
            kind: "UPI",
            message: `UPI payment ${decisionWord}`,
            detail: `${payee} · ₹${amount}${
              result.reasons.length ? ` — ${result.reasons.join("; ")}` : ""
            }`,
            meta: {
              paymentId: id,
              upiId: payee,
              amount,
              reasons: result.reasons,
              decision: result.decision,
              status,
            },
          });
          send({ type: "START_PAYMENT", payment, event });
        },
        startCollectRequest({ from, amount, note = "" }) {
          const current = stateRef.current;
          const time = Date.now();
          const id = crypto.randomUUID();
          const payee = from;
          const reasons = [
            "Someone is asking for money. Entering a PIN would SEND money, not receive it.",
          ];
          const payment = createPaymentRecord({
            id,
            payee,
            amount,
            note: note || "UPI collect request",
            time,
            status: PAYMENT_STATUS.PENDING_APPROVAL,
            reasons,
            kind: "COLLECT",
            timeline: [
              {
                at: time,
                actor: payee,
                label: `${payee} asked ${current.parentName || "Amma"} to pay ₹${amount}`,
              },
              {
                at: time,
                actor: "Aasra",
                label: "Warned that a collect request sends money. Waiting for a decision.",
              },
            ],
          });
          const event = createEvent({
            level: LEVEL.WARN,
            kind: "UPI_COLLECT",
            message: "UPI collect request — someone is asking for money",
            detail: `${payee} asked for ₹${amount}. Entering a PIN would send money, not receive it.`,
            meta: {
              paymentId: id,
              upiId: payee,
              amount,
              reasons,
              status: PAYMENT_STATUS.PENDING_APPROVAL,
            },
          });
          send({ type: "START_PAYMENT", payment, event });
        },
        clearPayment() {
          send({ type: "CLEAR_PAYMENT" });
        },
        askFamilyAboutPayment(id) {
          const current = stateRef.current;
          const payment =
            findDecisionTarget(current, id) || current.pendingPayment;
          if (!payment) return;
          const next = appendTimeline(payment, {
            at: Date.now(),
            actor: current.parentName || "Amma",
            label: `${current.parentName || "Amma"} asked family to decide.`,
          });
          send({
            type: "DECIDE_PAYMENT",
            payment: next,
            revealOnParent: false,
          });
        },
        approvePayment(id) {
          const current = stateRef.current;
          const payment = findDecisionTarget(current, id);
          if (!payment || !isAwaitingFamily(payment)) return;
          const decidedAt = Date.now();
          const decidedBy = primaryFamilyName(current.familyMembers);
          const next = appendTimeline(
            {
              ...payment,
              status: PAYMENT_STATUS.APPROVED_SENT,
              decidedBy,
              decidedAt,
            },
            {
              at: decidedAt,
              actor: decidedBy,
              label: `${decidedBy} approved. Money sent.`,
            }
          );
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "UPI_APPROVE",
            message: "Family approved the payment",
            detail: `${next.payee} · ₹${next.amount}`,
            meta: {
              paymentId: next.id,
              upiId: next.payee,
              amount: next.amount,
              reasons: next.reasons,
              status: next.status,
              decidedBy,
            },
          });
          send({
            type: "DECIDE_PAYMENT",
            payment: next,
            event,
            revealOnParent: true,
          });
        },
        rejectPayment(id) {
          const current = stateRef.current;
          const payment = findDecisionTarget(current, id);
          if (!payment || !isAwaitingFamily(payment)) return;
          const decidedAt = Date.now();
          const decidedBy = primaryFamilyName(current.familyMembers);
          const next = appendTimeline(
            {
              ...payment,
              status: PAYMENT_STATUS.REJECTED,
              decidedBy,
              decidedAt,
            },
            {
              at: decidedAt,
              actor: decidedBy,
              label: `${decidedBy} rejected this payment. Do not send the money.`,
            }
          );
          const event = createEvent({
            level: LEVEL.CRITICAL,
            kind: "UPI_REJECT",
            message: "Family rejected the payment",
            detail: `${next.payee} · ₹${next.amount}`,
            meta: {
              paymentId: next.id,
              upiId: next.payee,
              amount: next.amount,
              decision: "REJECT",
              reasons: next.reasons,
              status: next.status,
              decidedBy,
            },
          });
          send({
            type: "DECIDE_PAYMENT",
            payment: next,
            event,
            revealOnParent: true,
          });
        },
        declineCollectRequest(id) {
          const current = stateRef.current;
          const payment =
            findDecisionTarget(current, id) ||
            (current.pendingPayment?.kind === "COLLECT"
              ? current.pendingPayment
              : null);
          if (!payment || payment.kind !== "COLLECT") return;
          if (
            payment.status !== PAYMENT_STATUS.PENDING_APPROVAL &&
            payment.status !== PAYMENT_STATUS.HELD
          ) {
            return;
          }
          const decidedAt = Date.now();
          const decidedBy = current.parentName || "Amma";
          const next = appendTimeline(
            {
              ...payment,
              status: PAYMENT_STATUS.COLLECT_REQUEST_DECLINED,
              decidedBy,
              decidedAt,
            },
            {
              at: decidedAt,
              actor: decidedBy,
              label: `${decidedBy} declined. No money was sent.`,
            }
          );
          const event = createEvent({
            level: LEVEL.WARN,
            kind: "UPI_COLLECT_DECLINED",
            message: "Collect request declined",
            detail: `${next.payee} asked for ₹${next.amount}. ${decidedBy} declined.`,
            meta: {
              paymentId: next.id,
              upiId: next.payee,
              amount: next.amount,
              reasons: next.reasons,
              status: next.status,
              decidedBy,
            },
          });
          send({
            type: "DECIDE_PAYMENT",
            payment: next,
            event,
            revealOnParent: true,
          });
        },
        addReminder({
          title,
          type = "custom",
          dueAt,
          repeat = "none",
          note = "",
        } = {}) {
          const due = Number(dueAt);
          if (!title || !due) return;
          const reminderType = normalizeReminderType(type);
          const reminder = {
            id: crypto.randomUUID(),
            title: String(title).trim(),
            type: reminderType,
            dueAt: due,
            repeat: repeat === "daily" ? "daily" : "none",
            note: String(note || "").trim(),
            createdBy:
              stateRef.current.role === "parent"
                ? stateRef.current.parentName || "Amma"
                : primaryFamilyName(stateRef.current.familyMembers),
            status: REMINDER_STATUS.SCHEDULED,
            doneAt: null,
          };
          reminder.seriesId = reminder.id;
          send({ type: "UPSERT_REMINDERS", reminders: [reminder] });
        },
        updateReminder(id, fields = {}) {
          const current = (stateRef.current.reminders || []).find(
            (item) => item.id === id
          );
          if (!current) return;
          const dueAt = Number(fields.dueAt ?? current.dueAt);
          let status = current.status;
          if (dueAt > Date.now() && status === REMINDER_STATUS.DUE) {
            status = REMINDER_STATUS.SCHEDULED;
          }
          const next = {
            ...current,
            title: String(fields.title ?? current.title).trim() || current.title,
            type: normalizeReminderType(fields.type ?? current.type),
            dueAt,
            repeat: (fields.repeat ?? current.repeat) === "daily" ? "daily" : "none",
            note: String(fields.note ?? current.note ?? "").trim(),
            status,
          };
          send({ type: "UPSERT_REMINDERS", reminders: [next] });
        },
        deleteReminder(id) {
          if (!id) return;
          send({ type: "DELETE_REMINDER", id });
        },
        completeReminder(id) {
          const current = (stateRef.current.reminders || []).find(
            (item) => item.id === id
          );
          if (!current || current.status === REMINDER_STATUS.DONE) return;
          const now = Date.now();
          const done = { ...current, status: REMINDER_STATUS.DONE, doneAt: now };
          const extras = [];
          if (current.repeat === "daily") {
            extras.push(nextDailyReminder(current, now));
          }
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "REMINDER_DONE",
            message: `${stateRef.current.parentName || "Amma"} finished a reminder`,
            detail: current.title,
            meta: { reminderId: current.id, type: current.type },
          });
          send({
            type: "UPSERT_REMINDERS",
            reminders: [done, ...extras],
            events: [event],
          });
        },
        tickReminders(now = Date.now()) {
          const current = stateRef.current;
          const missAfter = reminderMissMs(current.demoMode);
          const updates = [];
          const extras = [];
          const events = [];
          for (const reminder of current.reminders || []) {
            if (
              reminder.status === REMINDER_STATUS.SCHEDULED &&
              now >= reminder.dueAt
            ) {
              updates.push({ ...reminder, status: REMINDER_STATUS.DUE });
              continue;
            }
            if (
              reminder.status === REMINDER_STATUS.DUE &&
              now >= reminder.dueAt + missAfter
            ) {
              updates.push({ ...reminder, status: REMINDER_STATUS.MISSED });
              events.push({
                ...createEvent({
                  level: LEVEL.WARN,
                  kind: "REMINDER_MISSED",
                  message: missedMessage(current.parentName, reminder),
                  detail: reminder.note || reminder.title,
                  meta: {
                    reminderId: reminder.id,
                    type: reminder.type,
                    dueAt: reminder.dueAt,
                  },
                }),
                id: `reminder-missed-${reminder.id}`,
              });
              if (reminder.repeat === "daily") {
                extras.push(nextDailyReminder(reminder, now));
              }
            }
          }
          if (!updates.length && !extras.length) return;
          send({
            type: "UPSERT_REMINDERS",
            reminders: [...updates, ...extras],
            events,
          });
        },
        resetBoard() {
          send({ type: "RESET_DEMO" });
        },
        setDemoMode(demoMode) {
          send({ type: "SET_DEMO_MODE", demoMode: Boolean(demoMode) });
        },
        sendVoiceMessage({ from, dataUrl, durationSec }) {
          const time = Date.now();
          const message = {
            id: crypto.randomUUID(),
            from,
            dataUrl,
            durationSec,
            time,
            heard: false,
          };
          const name = stateRef.current.parentName || "Amma";
          const event =
            from === "parent"
              ? createEvent({
                  level: LEVEL.INFO,
                  kind: "VOICE_MESSAGE",
                  message: `New voice message from ${name}`,
                  detail: `${durationSec} second voice message`,
                })
              : null;
          send({ type: "SEND_VOICE_MESSAGE", message, event });
        },
        markVoiceMessageHeard(id) {
          send({ type: "MARK_VOICE_MESSAGE_HEARD", id });
        },
        receiveSms({ sender, body, shared = false, id, time, fromPhone = false } = {}) {
          const current = stateRef.current;
          const messageId = id || crypto.randomUUID();
          if ((current.messages || []).some((item) => item.id === messageId)) return;
          const receivedAt = time || Date.now();
          const analysis = analyzeSms({
            sender,
            body,
            spamSenders: current.spamSenders,
          });
          const message = {
            id: messageId,
            sender,
            body,
            time: receivedAt,
            analysis,
            familyVerdict: null,
            readByElder: false,
            deletedByElder: false,
            askedFamily: false,
            shared: Boolean(shared),
            fromPhone: Boolean(fromPhone),
          };
          const risky =
            analysis.label === "SCAM" ||
            ((shared || fromPhone) && analysis.label === "SUSPICIOUS");
          const event = risky
            ? createEvent({
                level: LEVEL.WARN,
                kind: analysis.label === "SCAM" ? "SMS_SCAM" : "SMS_SUSPICIOUS",
                message: shared
                  ? analysis.label === "SCAM"
                    ? "Shared message looks like a scam"
                    : "Shared message looks suspicious"
                  : fromPhone
                    ? analysis.label === "SCAM"
                      ? "SMS on Amma's phone looks like a scam"
                      : "SMS on Amma's phone looks suspicious"
                    : "Scam SMS blocked from view — do not reply or click",
                detail: `${sender}: ${String(body).slice(0, 120)}`,
                meta: {
                  smsId: messageId,
                  sender,
                  label: analysis.label,
                  score: analysis.score,
                  reasons: analysis.reasons,
                  shared: Boolean(shared),
                  fromPhone: Boolean(fromPhone),
                },
              })
            : null;
          send({
            type: "RECEIVE_SMS",
            message,
            event,
            revealOnParent: Boolean(shared) || analysis.label === "SCAM",
          });
        },
        clearSmsWarning() {
          if (stateRef.current.pendingSms?.shared) {
            clearStashedShareText();
          }
          const pending = stateRef.current.pendingSms;
          if (pending && !pending.readByElder) {
            send({
              type: "UPDATE_SMS",
              message: { ...pending, readByElder: true },
              clearPending: true,
            });
            return;
          }
          send({ type: "CLEAR_SMS_WARNING" });
        },
        deleteSms(id) {
          const current = stateRef.current;
          const message = current.messages.find((item) => item.id === id);
          if (!message || message.deletedByElder) return;
          send({
            type: "UPDATE_SMS",
            message: {
              ...message,
              deletedByElder: true,
              readByElder: true,
            },
            clearPending: current.pendingSms?.id === id,
          });
        },
        askFamilyAboutSms(id) {
          const current = stateRef.current;
          const message = current.messages.find((item) => item.id === id);
          if (!message) return;
          const next = {
            ...message,
            askedFamily: true,
            readByElder: true,
          };
          const event = createEvent({
            level: message.analysis?.label === "SCAM" ? LEVEL.WARN : LEVEL.WARN,
            kind: "SMS_ASK_FAMILY",
            message: `${current.parentName || "Amma"} asked family to check an SMS`,
            detail: `${message.sender}: ${String(message.body).slice(0, 120)}`,
            meta: {
              smsId: message.id,
              sender: message.sender,
              label: message.analysis?.label,
            },
          });
          send({
            type: "UPDATE_SMS",
            message: next,
            event,
            clearPending: current.pendingSms?.id === id,
          });
        },
        markSmsSpam(id) {
          const current = stateRef.current;
          const message = current.messages.find((item) => item.id === id);
          if (!message) return;
          const senderKey = String(message.sender || "").trim();
          const spamSenders = current.spamSenders.some(
            (item) => item.toUpperCase() === senderKey.toUpperCase()
          )
            ? current.spamSenders
            : [...current.spamSenders, senderKey];
          const analysis = analyzeSms({
            sender: message.sender,
            body: message.body,
            spamSenders,
          });
          const next = {
            ...message,
            familyVerdict: "SPAM",
            analysis,
          };
          const event = createEvent({
            level: LEVEL.WARN,
            kind: "SMS_MARK_SPAM",
            message: "Family marked an SMS as spam",
            detail: `${message.sender} added to the spam list`,
            meta: { smsId: message.id, sender: message.sender },
          });
          send({
            type: "UPDATE_SMS",
            message: next,
            spamSenders,
            event,
          });
        },
        markSmsSafe(id) {
          const current = stateRef.current;
          const message = current.messages.find((item) => item.id === id);
          if (!message) return;
          const spamSenders = current.spamSenders.filter(
            (item) => item.toUpperCase() !== String(message.sender || "").trim().toUpperCase()
          );
          const next = {
            ...message,
            familyVerdict: "SAFE",
          };
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "SMS_MARK_SAFE",
            message: "Family marked an SMS as safe",
            detail: `${message.sender}`,
            meta: { smsId: message.id, sender: message.sender },
          });
          send({
            type: "UPDATE_SMS",
            message: next,
            spamSenders,
            event,
          });
        },
        setLang(lang) {
          if (lang !== "en" && lang !== "te" && lang !== "hi") return;
          send({ type: "SET_LANG", lang });
        },
        logReportPrepared(sourceEvent) {
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "REPORT",
            message: "Report prepared for 1930",
            detail: sourceEvent?.message
              ? `Draft prepared from “${sourceEvent.message}”`
              : "Complaint draft copied or downloaded",
          });
          send({ type: "ADD_EVENT", event });
        },
        escalateIfNeeded(id) {
          const current = stateRef.current;
          const source = current.events.find((event) => event.id === id);
          if (!source || source.acknowledged || source.escalated) return;
          if (source.kind === "ESCALATION") return;
          const backup = current.familyMembers.find((member) => member.role === "backup");
          const backupName = backup?.name || "Meera";
          const event = {
            ...createEvent({
              level: LEVEL.CRITICAL,
              kind: "ESCALATION",
              message: `Escalated to ${backupName} (second family member)`,
              detail: `No acknowledgement for “${source.message}”`,
              meta: { sourceId: id },
            }),
            id: `escalation-${id}`,
          };
          send({ type: "ESCALATE_EVENT", id, event });
        },
        resetDemo() {
          dispatch({ type: "RESET_DEMO" });
          clearRoom();
        },
      };
    },
    [state.safePayees, state.knownPayees]
  );

  useEffect(() => {
    if (state.role !== "family") return undefined;
    const delay = escalationMs(state.demoMode);
    const timers = state.events.filter(shouldWatchForEscalation).map((event) => {
      const wait = Math.max(0, delay - (Date.now() - event.time));
      return setTimeout(() => {
        actions.escalateIfNeeded(event.id);
      }, wait);
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [state.events, state.role, state.demoMode, actions]);

  useEffect(() => {
    if (!state.role) return undefined;
    const timer = window.setInterval(() => {
      actions.tickReminders(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.role, actions]);

  useEffect(() => {
    if (state.role !== "family" || !state.activeCall || state.activeCall.alarmed) {
      return undefined;
    }
    const wait = Math.max(
      0,
      callAlarmMs(state.demoMode) - (Date.now() - state.activeCall.startedAt)
    );
    const timer = setTimeout(() => {
      actions.logCallAlarm();
    }, wait);
    return () => clearTimeout(timer);
  }, [state.activeCall, state.role, state.demoMode, actions]);

  useEffect(() => {
    if (!hasFirebaseConfig() || !state.role) return undefined;
    return listenDemoInbox({
      onSms(item) {
        actions.receiveSms({
          id: item.id,
          sender: item.sender,
          body: item.body,
          time: item.time,
          fromPhone: true,
        });
      },
      onCall(item) {
        actions.startCall({
          id: item.id,
          from: item.number,
          startedAt: item.time,
          fromPhone: true,
        });
      },
    });
  }, [state.role, actions]);

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const value = useContext(GlobalStateContext);
  if (!value) {
    throw new Error("useGlobalState must be used inside GlobalStateProvider");
  }
  return value;
}

export function showDemoLoginButtons(demoMode) {
  return Boolean(demoMode) || !hasFirebaseConfig();
}
