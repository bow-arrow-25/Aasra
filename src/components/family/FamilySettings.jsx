import { Copy, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { useGlobalState } from "../../context/GlobalState";

export default function FamilySettings() {
  const {
    parentName,
    elderAge,
    elderCity,
    roomCode,
    authEmail,
    safePayees,
    signOutUser,
    syncMode,
  } = useGlobalState();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Settings className="size-5 text-teal" aria-hidden="true" />
          Household
        </h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Elder</dt>
            <dd className="font-semibold">
              {parentName}
              {elderAge ? ` · ${elderAge}` : ""}
            </dd>
          </div>
          {elderCity ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">City</dt>
              <dd className="font-semibold">{elderCity}</dd>
            </div>
          ) : null}
          {authEmail ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Signed in</dt>
              <dd className="font-semibold wrap-break-word">{authEmail}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Sync</dt>
            <dd className="font-semibold">
              {syncMode === "firebase" ? "Internet" : "Same-browser demo"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Elder pairing code</h2>
        <p className="mt-2 text-sm text-slate-600">
          Type these 6 numbers on Amma’s phone the first time.
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

      <section className="rounded-2xl bg-white p-4 shadow-sm">
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
