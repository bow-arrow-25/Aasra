import { useState } from "react";
import { useGlobalState } from "../../context/GlobalState";
import { authErrorMessage } from "../../lib/household";
import { DEFAULT_SAFE_PAYEES } from "../../lib/session";
import WaterFluxBackdrop from "../ui/WaterFluxBackdrop";

export default function FamilySetup() {
  const { completeFamilySetup, authEmail } = useGlobalState();
  const [elderName, setElderName] = useState("");
  const [primaryName, setPrimaryName] = useState("");
  const [backupName, setBackupName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [lang, setLang] = useState("en");
  const [safeList, setSafeList] = useState(DEFAULT_SAFE_PAYEES.join("\n"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!elderName.trim()) {
      setError("Enter the elder’s name.");
      return;
    }
    if (!primaryName.trim()) {
      setError("Enter the family member who will watch this household.");
      return;
    }
    setBusy(true);
    try {
      await completeFamilySetup({
        elderName,
        primaryName,
        backupName,
        age,
        city,
        lang,
        safeList,
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
          <p className="flux-kicker">Aasra</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-cream">Set up the household</h1>
          <p className="mt-3 text-sm leading-relaxed text-aqua-100/90 sm:text-base">
            Signed in as {authEmail || "family"}. Add the elder’s name and the family
            names that should appear on the parent phone and payments.
            Then the family dashboard opens. The parent phone is a separate device.
          </p>

          <div className="mt-6 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Elder’s name
              <input
                required
                value={elderName}
                onChange={(event) => setElderName(event.target.value)}
                className="flux-input"
                placeholder="Lakshmi"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Family member who watches this phone
              <input
                required
                value={primaryName}
                onChange={(event) => setPrimaryName(event.target.value)}
                className="flux-input"
                placeholder="Rahul"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Backup family member
              <input
                value={backupName}
                onChange={(event) => setBackupName(event.target.value)}
                className="flux-input"
                placeholder="Meera"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Age
              <input
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
                className="flux-input"
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
              Language on the parent phone
              <select
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="flux-input"
              >
                <option value="en">English</option>
                <option value="te">Telugu</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-aqua-100">
              Family safe list (UPI names or IDs, one per line)
              <textarea
                rows={4}
                value={safeList}
                onChange={(event) => setSafeList(event.target.value)}
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
            {busy ? "Creating household…" : "Save and choose a phone"}
          </button>
        </form>
      </div>
    </WaterFluxBackdrop>
  );
}
