import { Copy, LogOut, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalState } from "../../context/GlobalState";
import { primaryFamilyName } from "../../lib/payments";

export default function FamilySettings() {
  const {
    parentName,
    elderAge,
    elderCity,
    roomCode,
    authEmail,
    safePayees,
    familyMembers,
    signOutUser,
    syncMode,
    updateHouseholdNames,
  } = useGlobalState();
  const [copied, setCopied] = useState(false);
  const [elderName, setElderName] = useState(parentName || "");
  const [primaryName, setPrimaryName] = useState(primaryFamilyName(familyMembers));
  const [backupName, setBackupName] = useState(
    familyMembers.find((member) => member.role === "backup")?.name || ""
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setElderName(parentName || "");
    setPrimaryName(primaryFamilyName(familyMembers));
    setBackupName(familyMembers.find((member) => member.role === "backup")?.name || "");
  }, [parentName, familyMembers]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    await updateHouseholdNames({
      elderName,
      primaryName,
      backupName,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="grid gap-2">
      <section className="flux-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Settings className="size-5 text-teal" aria-hidden="true" />
          Household
        </h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-slate-500">Elder</span>
            <input
              value={elderName}
              onChange={(event) => setElderName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-500">Family member on payments</span>
            <input
              value={primaryName}
              onChange={(event) => setPrimaryName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-500">Backup family member</span>
            <input
              value={backupName}
              onChange={(event) => setBackupName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold"
            />
          </label>
          {elderCity ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">City</dt>
              <dd className="font-semibold">{elderCity}</dd>
            </div>
          ) : null}
          {elderAge ? (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Age</span>
              <span className="font-semibold">{elderAge}</span>
            </div>
          ) : null}
          {authEmail ? (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Signed in</span>
              <span className="font-semibold wrap-break-word">{authEmail}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Sync</span>
            <span className="font-semibold">
              {syncMode === "firebase" ? "Internet" : "Same-browser demo"}
            </span>
          </div>
          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center rounded-xl bg-teal px-4 py-2 font-semibold text-cream"
          >
            {saved ? "Names saved" : "Save names"}
          </button>
        </form>
      </section>

      <section className="flux-card p-5">
        <h2 className="text-lg font-semibold">Elder pairing code</h2>
        <p className="mt-2 text-sm text-slate-600">
          Type these 6 numbers on {parentName || "the parent"}’s phone the first time.
        </p>
        <p className="mt-4 text-center text-3xl font-bold tracking-[0.3em] text-teal">
          {roomCode || "------"}
        </p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
        >
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy code"}
        </button>
      </section>

      <section className="flux-card p-5">
        <h2 className="text-lg font-semibold">Safe payees</h2>
        <ul className="mt-2 space-y-2">
          {safePayees.map((payee) => (
            <li key={payee} className="rounded-lg bg-green-50 px-3 py-2 text-green-800">
              {payee}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => signOutUser()}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        aria-label="Sign out of the family dashboard"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
