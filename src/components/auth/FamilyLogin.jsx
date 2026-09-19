import { useState } from "react";
import { KeyRound } from "lucide-react";
import { hasFirebaseConfig } from "../../lib/firebase";
import { authErrorMessage } from "../../lib/household";
import { useGlobalState } from "../../context/GlobalState";
import DemoButtons from "./DemoButtons";

export default function FamilyLogin() {
  const { signInFamily, signUpFamily, createFamilyRoom, joinRoom, syncMode } =
    useGlobalState();
  const firebaseOn = hasFirebaseConfig();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await signUpFamily(email.trim(), password);
      else await signInFamily(email.trim(), password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-50 px-4">
      <div className="w-full max-w-lg min-w-0 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-teal">Aasra</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
          <KeyRound className="size-6 text-teal" aria-hidden="true" />
          Family sign in
        </h1>
        <p className="mt-3 text-slate-600">
          {firebaseOn
            ? "Use your email to open the family dashboard. After the first sign-up you will set up Amma’s phone."
            : "No Firebase .env yet, so this demo syncs only in the same browser."}
        </p>

        {firebaseOn ? (
          <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-teal px-4 py-3 font-semibold text-cream disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-teal"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
              }}
            >
              {mode === "signup" ? "Already have an account? Sign in" : "New family? Create an account"}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => createFamilyRoom()}
              className="w-full rounded-xl bg-teal px-4 py-3 font-semibold text-cream"
              aria-label="Create a 6-digit family room code"
            >
              Create 6-digit code
            </button>
            <p className="mt-6 text-sm font-semibold text-slate-500">Already have a code?</p>
            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                inputMode="numeric"
                maxLength={6}
                value={manual}
                onChange={(event) =>
                  setManual(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 tracking-[0.3em]"
                placeholder="000000"
                aria-label="Family room code"
              />
              <button
                type="button"
                onClick={() => joinRoom(manual, "family")}
                disabled={manual.length !== 6}
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Join
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {syncMode === "firebase" ? "Internet sync" : "Same-browser demo"}
            </p>
          </div>
        )}

        <DemoButtons variant="dashboard" />
      </div>
    </div>
  );
}
