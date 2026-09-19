import { useState } from "react";
import { useGlobalState } from "../../context/GlobalState";
import { authErrorMessage } from "../../lib/household";
import { DEFAULT_SAFE_PAYEES } from "../../lib/session";

export default function FamilySetup() {
  const { completeFamilySetup, authEmail } = useGlobalState();
  const [elderName, setElderName] = useState("Amma");
  const [age, setAge] = useState("72");
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
    setBusy(true);
    try {
      await completeFamilySetup({
        elderName,
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
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg min-w-0 rounded-2xl bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold tracking-wide text-teal">Aasra</p>
        <h1 className="mt-2 text-2xl font-semibold">Set up the household</h1>
        <p className="mt-3 text-slate-600">
          Signed in as {authEmail || "family"}. Add Amma’s details and trusted UPI names.
          We will give you a 6-digit pairing code for her phone.
        </p>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Elder’s name
            <input
              required
              value={elderName}
              onChange={(event) => setElderName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Age
            <input
              inputMode="numeric"
              value={age}
              onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
              placeholder="Hyderabad"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Language on her phone
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
            >
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="hi">Hindi</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Family safe list (UPI names or IDs, one per line)
            <textarea
              rows={4}
              value={safeList}
              onChange={(event) => setSafeList(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-900"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-teal px-4 py-3 font-semibold text-cream disabled:opacity-50"
        >
          {busy ? "Creating household…" : "Save and show pairing code"}
        </button>
      </form>
    </div>
  );
}
