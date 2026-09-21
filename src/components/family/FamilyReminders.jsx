import { useEffect, useMemo, useState } from "react";
import { Bell, Pencil, PhoneCall, Trash2 } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import {
  formatCountdown,
  formatDueStamp,
  fromLocalInput,
  QUICK_CHIPS,
  REMINDER_STATUS,
  REMINDER_TYPES,
  toLocalInput,
  typeLabel,
} from "../../lib/reminders";

const EMPTY_FORM = {
  title: "",
  type: "medicine",
  dueLocal: "",
  repeat: "none",
  note: "",
};

export default function FamilyReminders() {
  const {
    reminders,
    addReminder,
    updateReminder,
    deleteReminder,
    callAmmaNow,
    parentName,
  } = useGlobalState();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const list = reminders || [];
    return {
      upcoming: list
        .filter((item) => item.status === REMINDER_STATUS.SCHEDULED)
        .sort((a, b) => a.dueAt - b.dueAt),
      due: list
        .filter((item) => item.status === REMINDER_STATUS.DUE)
        .sort((a, b) => a.dueAt - b.dueAt),
      missed: list
        .filter((item) => item.status === REMINDER_STATUS.MISSED)
        .sort((a, b) => b.dueAt - a.dueAt),
      done: list
        .filter((item) => item.status === REMINDER_STATUS.DONE)
        .sort((a, b) => (b.doneAt || b.dueAt) - (a.doneAt || a.dueAt)),
    };
  }, [reminders]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyChip(ms) {
    setField("dueLocal", toLocalInput(Date.now() + ms));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      type: item.type,
      dueLocal: toLocalInput(item.dueAt),
      repeat: item.repeat === "daily" ? "daily" : "none",
      note: item.note || "",
    });
  }

  function resetForm() {
    setEditingId("");
    setForm(EMPTY_FORM);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const dueAt = fromLocalInput(form.dueLocal);
    const title = form.title.trim();
    if (!title || !dueAt) return;
    const payload = {
      title,
      type: form.type,
      dueAt,
      repeat: form.repeat,
      note: form.note,
    };
    if (editingId) {
      updateReminder(editingId, payload);
    } else {
      addReminder(payload);
    }
    resetForm();
  }

  return (
    <div className="grid gap-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bell className="size-5 text-teal" aria-hidden="true" />
          {editingId ? "Edit reminder" : "New reminder"}
        </h2>
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-600">Title</span>
            <input
              required
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Night medicine"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-600">Type</span>
            <select
              value={form.type}
              onChange={(event) => setField("type", event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2"
            >
              {REMINDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-600">Date and time</span>
            <input
              required
              type="datetime-local"
              value={form.dueLocal}
              onChange={(event) => setField("dueLocal", event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <div>
            <p className="text-sm font-semibold text-slate-600">Quick countdown</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => applyChip(chip.ms)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.repeat === "daily"}
              onChange={(event) =>
                setField("repeat", event.target.checked ? "daily" : "none")
              }
            />
            Repeat daily
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-600">Note</span>
            <textarea
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              className="min-h-20 rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Take with water"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-cream"
            >
              {editingId ? "Save reminder" : "Add reminder"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <ReminderGroup
        title="Due"
        empty="Nothing is due."
        items={groups.due}
        now={now}
        onEdit={startEdit}
        onDelete={deleteReminder}
        onCall={() => callAmmaNow({ analyzerMode: "live" })}
      />
      <ReminderGroup
        title="Upcoming"
        empty="No upcoming reminders."
        items={groups.upcoming}
        now={now}
        onEdit={startEdit}
        onDelete={deleteReminder}
      />
      <ReminderGroup
        title="Missed"
        empty="No missed reminders."
        items={groups.missed}
        now={now}
        onEdit={startEdit}
        onDelete={deleteReminder}
        onCall={() => callAmmaNow({ analyzerMode: "live" })}
        showCall
      />
      <ReminderGroup
        title="Done"
        empty="No finished reminders yet."
        items={groups.done}
        now={now}
        onEdit={startEdit}
        onDelete={deleteReminder}
      />
    </div>
  );
}

function ReminderGroup({
  title,
  empty,
  items,
  now,
  onEdit,
  onDelete,
  onCall,
  showCall = false,
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold">
        {title}
        {items.length ? ` · ${items.length}` : ""}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold wrap-break-word">{item.title}</p>
                  <p className="mt-1 text-sm capitalize text-slate-500">
                    {typeLabel(item.type)}
                    {item.repeat === "daily" ? " · daily" : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDueStamp(item.dueAt)}
                  </p>
                  {item.status === REMINDER_STATUS.SCHEDULED ||
                  item.status === REMINDER_STATUS.DUE ? (
                    <p className="mt-1 text-sm font-semibold tabular-nums text-teal">
                      {formatCountdown(item.dueAt, now)}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 text-sm wrap-break-word text-slate-600">
                      {item.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {showCall ? (
                    <button
                      type="button"
                      onClick={onCall}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-cream"
                      aria-label={`Call ${parentName} about ${item.title}`}
                    >
                      <PhoneCall className="size-4" aria-hidden="true" />
                      Call {parentName}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
