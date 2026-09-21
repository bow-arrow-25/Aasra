export const DEFAULT_CHECKUP_TYPES = [
  { id: "food", label: "Food" },
  { id: "medicine", label: "Medicine" },
  { id: "walk", label: "Walk" },
];

export function todayKey(now = Date.now()) {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isOrgHousehold(value) {
  return value === "org" || value?.householdKind === "org" || value?.profile?.kind === "org";
}

export function emptyCareBoard() {
  return {
    householdKind: "family",
    orgName: "",
    residents: [],
    checkupTypes: [],
    dailyChecks: [],
    reviews: [],
    currentResidentId: "",
  };
}

export function normalizeCheckupTypes(list) {
  const types = (list || [])
    .map((item) => ({
      id: String(item.id || "").trim() || crypto.randomUUID(),
      label: String(item.label || "").trim(),
    }))
    .filter((item) => item.label);
  return types.length ? types : DEFAULT_CHECKUP_TYPES.map((item) => ({ ...item }));
}

export function upsertResident(list, resident) {
  const residents = list || [];
  if (residents.some((item) => item.id === resident.id)) {
    return residents.map((item) => (item.id === resident.id ? { ...item, ...resident } : item));
  }
  return [...residents, resident];
}

export function findCheck(dailyChecks, { residentId, typeId, date }) {
  return (dailyChecks || []).find(
    (item) =>
      item.residentId === residentId && item.typeId === typeId && item.date === date
  );
}

export function upsertDailyCheck(dailyChecks, next) {
  const list = dailyChecks || [];
  const match = findCheck(list, next);
  if (match) {
    return list.map((item) => (item.id === match.id ? { ...item, ...next, id: match.id } : item));
  }
  return [{ ...next }, ...list];
}

export function checksForResident(dailyChecks, residentId, date) {
  return (dailyChecks || []).filter(
    (item) => item.residentId === residentId && item.date === date
  );
}

export function residentDayTone({ lastCheckIn, doneCount, total }, now = Date.now()) {
  if (total > 0 && doneCount === total && lastCheckIn) return "INFO";
  if (lastCheckIn && now - lastCheckIn < 4 * 60 * 60 * 1000) return "INFO";
  if (doneCount > 0 || lastCheckIn) return "WARN";
  return "CRITICAL";
}

export function latestReview(reviews, residentId) {
  return (reviews || []).find((item) => item.residentId === residentId) || null;
}
