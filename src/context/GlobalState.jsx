import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { evaluatePayment } from "../lib/rules";
import {
  clearRoom,
  connect,
  createRoomCode,
  getSyncMode,
  hasFirebaseConfig,
  publish,
} from "../lib/sync";

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

const DEFAULT_FAMILY_MEMBERS = [
  { name: "Arjun", role: "primary" },
  { name: "Meera", role: "backup" },
];

function readSession(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

const emptyBoard = {
  parentName: "Amma",
  lastCheckIn: null,
  events: [],
  messages: [],
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
  familyMembers: DEFAULT_FAMILY_MEMBERS,
};

const initialState = {
  ...emptyBoard,
  lang: "en",
  demoMode: true,
  roomCode: readSession("aasra-room"),
  role: readSession("aasra-role"),
  syncMode: hasFirebaseConfig() ? "firebase" : "broadcast",
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
  return event.kind === "UPI" && event.meta?.decision === "HOLD";
}

function shouldWatchForEscalation(event) {
  if (event.acknowledged || event.escalated) return false;
  if (event.kind === "ESCALATION") return false;
  return event.level === LEVEL.CRITICAL || isPendingApproval(event);
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
      return {
        ...state,
        activeCall: action.call,
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "ANSWER_CALL":
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: { ...state.activeCall, answered: true },
        events: action.event ? [action.event, ...state.events] : state.events,
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
        pendingPayment: action.payment,
        events: [action.event, ...state.events],
      };
    case "CLEAR_PAYMENT":
      return { ...state, pendingPayment: null };
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
        messages: [action.message, ...state.messages],
        events: action.event ? [action.event, ...state.events] : state.events,
      };
    case "MARK_VOICE_MESSAGE_HEARD":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.id ? { ...message, heard: true } : message
        ),
      };
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
      return {
        ...state,
        roomCode: action.roomCode,
        role: action.role,
        syncMode: getSyncMode(),
      };
    case "SET_SYNC_MODE":
      return {
        ...state,
        syncMode: action.syncMode,
      };
    case "RESET_DEMO":
    case "HYDRATE_RESET":
      return {
        ...state,
        ...emptyBoard,
        lang: state.lang,
        demoMode: state.demoMode,
        roomCode: state.roomCode,
        role: state.role,
        syncMode: state.syncMode,
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
    if (!state.roomCode) return undefined;
    dispatch({ type: "HYDRATE_RESET" });
    const stop = connect(state.roomCode, (remote) => {
      if (!remote?.type) return;
      if (remote.type === "RESET_DEMO") {
        dispatch({ type: "RESET_DEMO" });
        return;
      }
      dispatch(remote);
    });
    dispatch({ type: "SET_SYNC_MODE", syncMode: getSyncMode() });
    return stop;
  }, [state.roomCode]);

  const actions = useMemo(
    () => {
      function send(action) {
        dispatch(action);
        stateRef.current = reducer(stateRef.current, action);
        if (
          action.type !== "HYDRATE_RESET" &&
          action.type !== "SET_ROOM" &&
          action.type !== "SET_SYNC_MODE"
        ) {
          publish(action);
        }
      }

      return {
        joinRoom(roomCode, role) {
          const code = String(roomCode || "").replace(/\D/g, "").slice(0, 6);
          if (code.length !== 6) return;
          try {
            sessionStorage.setItem("aasra-room", code);
            sessionStorage.setItem("aasra-role", role);
          } catch {
            /* ignore */
          }
          dispatch({ type: "SET_ROOM", roomCode: code, role });
        },
        createFamilyRoom() {
          const code = createRoomCode();
          try {
            sessionStorage.setItem("aasra-room", code);
            sessionStorage.setItem("aasra-role", "family");
          } catch {
            /* ignore */
          }
          dispatch({ type: "SET_ROOM", roomCode: code, role: "family" });
          return code;
        },
        checkIn({ source = "tap", transcript = "" } = {}) {
          const time = Date.now();
          const event = createEvent({
            level: LEVEL.INFO,
            kind: "CHECK_IN",
            message: "Amma checked in — I am okay",
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
        startCall({ from, scam, kyc = false, answered = false }) {
          const isKyc = Boolean(kyc);
          const isScam = Boolean(scam || isKyc);
          const call = {
            id: crypto.randomUUID(),
            from,
            scam: isScam,
            kyc: isKyc,
            answered: Boolean(answered),
            alarmed: false,
            startedAt: Date.now(),
          };
          let kind = "CALL";
          let message = "Incoming call";
          let level = LEVEL.INFO;
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
            message = "Possible scam call";
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
          send({ type: "ANSWER_CALL", event });
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
        tryPayment({ payee, amount }) {
          const result = evaluatePayment({
            payee,
            amount,
            safePayees: state.safePayees,
            knownPayees: state.knownPayees,
          });
          const decisionWord =
            result.decision === "BLOCK"
              ? "BLOCKED"
              : result.decision === "HOLD"
                ? "HOLD"
                : "ALLOWED";
          const event = createEvent({
            level: levelForDecision(result.decision),
            kind: "UPI",
            message: `UPI payment ${decisionWord}`,
            detail: `${payee} · ₹${amount}${
              result.reasons.length ? ` — ${result.reasons.join("; ")}` : ""
            }`,
            meta: {
              upiId: payee,
              amount,
              reasons: result.reasons,
              decision: result.decision,
            },
          });
          send({
            type: "START_PAYMENT",
            payment: {
              id: crypto.randomUUID(),
              payee,
              amount,
              decision: result.decision,
              reasons: result.reasons,
              time: Date.now(),
            },
            event,
          });
        },
        clearPayment() {
          send({ type: "CLEAR_PAYMENT" });
        },
        rejectPayment() {
          const payment = stateRef.current.pendingPayment;
          if (!payment || payment.rejected) return;
          const event = createEvent({
            level: LEVEL.CRITICAL,
            kind: "UPI_REJECT",
            message: "Family rejected the payment",
            detail: `${payment.payee} · ₹${payment.amount}`,
            meta: {
              upiId: payment.payee,
              amount: payment.amount,
              decision: "REJECT",
              reasons: payment.reasons,
            },
          });
          send({ type: "REJECT_PAYMENT", event });
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
          const event =
            from === "parent"
              ? createEvent({
                  level: LEVEL.INFO,
                  kind: "VOICE_MESSAGE",
                  message: "New voice message from Amma",
                  detail: `${durationSec} second voice message`,
                })
              : null;
          send({ type: "SEND_VOICE_MESSAGE", message, event });
        },
        markVoiceMessageHeard(id) {
          send({ type: "MARK_VOICE_MESSAGE_HEARD", id });
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
