import { useState } from "react";
import { useGlobalState } from "../../context/GlobalState";
import { authErrorMessage } from "../../lib/household";
import { DEFAULT_CHECKUP_TYPES } from "../../lib/careHome";
import WaterFluxBackdrop from "../ui/WaterFluxBackdrop";

export default function OrgSetup() {
  const { completeOrgSetup, authEmail } = useGlobalState();
  const [orgName, setOrgName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [city, setCity] = useState("");
  const [checks, setChecks] = useState(DEFAULT_CHECKUP_TYPES.map((item) => item.label).join("\n"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!orgName.trim()) {
      setError("Enter the home’s name.");
      return;
    }
    if (!staffName.trim()) {
      setError("Enter the duty staff name.");
      return;
    }
    setBusy(true);
    try {
      await completeOrgSetup({
        orgName,
        staffName,
        city,
        checks,
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WaterFluxBackdrop>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="flux-glass w-full max-w-lg p-6 sm:p-9">
          <p className="flux-kicker">Care home</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-cream">Set up the home</h1>
          <p className="mt-3 text-sm leading-relaxed text-aqua-100/90 sm:text-base">
            Signed in as {authEmail || "admin"}. Residents will join with the home
            code, their room number, and their name. You mark food and other daily
            checks from this desk.
          </p>

          <div className="mt-6 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Home name
              <input
                required
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="flux-input"
                placeholder="Sneha Old Age Home"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Duty staff name
              <input
                required
                value={staffName}
                onChange={(event) => setStaffName(event.target.value)}
                className="flux-input"
                placeholder="Sister Priya"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              City
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="flux-input"
                placeholder="Hyderabad"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Daily checks (one per line)
              <textarea
                value={checks}
                onChange={(event) => setChecks(event.target.value)}
                rows={4}
                className="flux-input min-h-28"
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-2xl bg-red-500/20 p-3 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="flux-btn-primary mt-6">
            {busy ? "Please wait…" : "Open the care desk"}
          </button>
        </form>
      </div>
    </WaterFluxBackdrop>
  );
}
