import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

const ToastContext = createContext(null);
const TOAST_MS = 6000;

const TONE = {
  CRITICAL: {
    wrap: "border-red-200 bg-red-50 text-red-950",
    icon: ShieldAlert,
  },
  WARN: {
    wrap: "border-yellow-200 bg-yellow-50 text-yellow-950",
    icon: AlertTriangle,
  },
  INFO: {
    wrap: "border-slate-200 bg-white text-slate-900",
    icon: AlertTriangle,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ level = "INFO", title, body } = {}) => {
      const id = crypto.randomUUID();
      setToasts((list) => [
        ...list,
        {
          id,
          level: level === "CRITICAL" || level === "WARN" ? level : "INFO",
          title: title || "Aasra",
          body: body || "",
        },
      ]);
      const timer = window.setTimeout(() => dismiss(id), TOAST_MS);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((item) => {
          const tone = TONE[item.level] || TONE.INFO;
          const Icon = tone.icon;
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex gap-2 rounded-2xl border p-4 shadow-sm ${tone.wrap}`}
              role="status"
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.body ? (
                  <p className="mt-1 text-sm wrap-break-word opacity-90">{item.body}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-lg p-1 hover:bg-black/5"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}
