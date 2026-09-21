import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  checksForResident,
  latestReview,
  residentDayTone,
  todayKey,
} from "../../lib/careHome";
import { formatTime } from "../family/helpers";
import { BADGE } from "../family/helpers";

export default function CareHomePage() {
  const {
    orgName,
    roomCode,
    residents,
    checkupTypes,
    dailyChecks,
    reviews,
    toggleCheckup,
    addCheckupType,
    addResidentReview,
  } = useGlobalState();
  const [newCheck, setNewCheck] = useState("");
  const [notes, setNotes] = useState({});
  const date = todayKey();
  const types = checkupTypes || [];
  const people = [...(residents || [])].sort((a, b) =>
    String(a.room || "").localeCompare(String(b.room || ""), undefined, { numeric: true })
  );

  function saveReview(residentId) {
    const text = String(notes[residentId] || "").trim();
    if (!text) return;
    addResidentReview({ residentId, text });
    setNotes((current) => ({ ...current, [residentId]: "" }));
  }

  return (
    <div className="grid gap-4">
      <section className="flux-card p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex rounded-2xl bg-teal/10 p-2 text-teal">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{orgName || "Care home"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Residents open Parent phone, type home code{" "}
              <span className="font-bold tracking-[0.18em] text-teal">{roomCode || "------"}</span>
              , then room number and name.
            </p>
          </div>
        </div>
      </section>

      <section className="flux-card p-5">
        <h2 className="text-lg font-semibold">Daily checks</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tick food, medicine and the rest for today. Add a new check if the home needs it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {types.map((type) => (
            <span
              key={type.id}
              className="rounded-full bg-teal/10 px-3 py-1 text-sm font-semibold text-teal"
            >
              {type.label}
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newCheck.trim()) return;
            addCheckupType(newCheck.trim());
            setNewCheck("");
          }}
        >
          <input
            value={newCheck}
            onChange={(event) => setNewCheck(event.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="BP reading, tea…"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-teal px-3 text-sm font-semibold text-white"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
        </form>
      </section>

      {people.length === 0 ? (
        <section className="flux-card p-8 text-center text-slate-600">
          No residents yet. On a tablet, open Parent phone and join with the home code.
        </section>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((resident) => {
            const today = checksForResident(dailyChecks, resident.id, date);
            const doneCount = today.filter((item) => item.done).length;
            const tone = residentDayTone({
              lastCheckIn: resident.lastCheckIn,
              doneCount,
              total: types.length,
            });
            const review = latestReview(reviews, resident.id);
            return (
              <article key={resident.id} className="flux-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold tracking-wide text-slate-500">
                      Room {resident.room || "—"}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">{resident.name}</h3>
                    <p className="text-xs text-slate-500">
                      Check-in {formatTime(resident.lastCheckIn)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[tone]}`}>
                    {doneCount}/{types.length || 0}
                  </span>
                </div>
                <ul className="mt-3 grid gap-2">
                  {types.map((type) => {
                    const row = today.find((item) => item.typeId === type.id);
                    const done = Boolean(row?.done);
                    return (
                      <li key={type.id}>
                        <button
                          type="button"
                          onClick={() =>
                            toggleCheckup({
                              residentId: resident.id,
                              typeId: type.id,
                              done: !done,
                            })
                          }
                          className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold ${
                            done
                              ? "border-green-600 bg-green-50 text-green-800"
                              : "border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          <span>{type.label}</span>
                          <span>{done ? "Done" : "Not yet"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {review ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Last note: {review.text}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <input
                    value={notes[resident.id] || ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [resident.id]: event.target.value,
                      }))
                    }
                    className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
                    placeholder="Write a review…"
                  />
                  <button
                    type="button"
                    onClick={() => saveReview(resident.id)}
                    className="rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
