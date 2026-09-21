import { useState } from "react";
import { Shield } from "lucide-react";
import { authErrorMessage } from "../../lib/household";
import { useGlobalState } from "../../context/GlobalState";
import DemoButtons from "./DemoButtons";
import WaterFluxBackdrop from "../ui/WaterFluxBackdrop";

export default function FamilyLogin({ onBack, variant = "family" }) {
  const { signInFamily, signUpFamily } = useGlobalState();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isOrg = variant === "org";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const kind = isOrg ? "org" : "family";
      if (mode === "signup") await signUpFamily(email.trim(), password, { kind });
      else await signInFamily(email.trim(), password, { kind });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WaterFluxBackdrop>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flux-glass w-full max-w-lg p-6 sm:p-9">
          <p className="flux-kicker">Aasra</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold text-cream">
            <Shield className="size-8 text-aqua-200" aria-hidden="true" />
            {isOrg ? "Care home sign in" : "Family sign in"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-aqua-100/90 sm:text-base">
            {isOrg
              ? mode === "signup"
                ? "Create the home account with the organisation email and a password (at least 6 characters)."
                : "Sign in with the care-home email. This desk watches every resident."
              : mode === "signup"
                ? "Create an account with your email and a password (at least 6 characters). Then we will set up the parent phone."
                : "Sign in with your family email. This screen is only for the family dashboard."}
          </p>

          <form className="mt-7 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flux-input"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="flux-input"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-2xl bg-red-500/20 p-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="flux-btn-primary">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-aqua-200"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
              }}
            >
              {mode === "signup"
                ? "Already have an account? Sign in"
                : isOrg
                  ? "New home? Create an account"
                  : "New family? Create an account"}
            </button>
          </form>

          {onBack ? (
            <button
              type="button"
              className="mt-6 w-full text-sm font-semibold text-aqua-200 underline-offset-4 hover:underline"
              onClick={onBack}
            >
              Back to Aasra
            </button>
          ) : null}

          {isOrg ? null : <DemoButtons variant="dashboard" />}
        </div>
      </div>
    </WaterFluxBackdrop>
  );
}
