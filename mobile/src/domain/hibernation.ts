// Graceful Hibernation (product strategy report): when someone has been away, the app never scolds.
// The pet simply wakes up and welcomes them back; nothing is owed and nothing was lost.
import { addDaysToDateKey, getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export const HIBERNATION_DAYS = 5;

export type ReturnStatus =
  | { kind: "first" }
  | { kind: "same-day" }
  | { kind: "back"; daysAway: number }
  | { kind: "hibernation"; daysAway: number };

function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return 0;
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86_400_000);
}

/** How today relates to the last day the app was opened. */
export function returnStatus(lastSeenDay: string | null | undefined, today: string = getLocalDateKey()): ReturnStatus {
  if (!lastSeenDay || !parseDateKey(lastSeenDay)) return { kind: "first" };
  const daysAway = daysBetween(lastSeenDay, today);
  if (daysAway <= 0) return { kind: "same-day" };
  if (daysAway >= HIBERNATION_DAYS) return { kind: "hibernation", daysAway };
  return { kind: "back", daysAway };
}

/** Header copy for the return; only hibernation changes the tone, and never with guilt. */
export function returnGreeting(status: ReturnStatus, petName: string): { title: string; subtitle: string } | null {
  const name = petName || "Your pet";
  if (status.kind === "hibernation") {
    return { title: "You're back!", subtitle: `${name} missed you. Let's just take today easy.` };
  }
  if (status.kind === "back" && status.daysAway >= 2) {
    return { title: "Welcome back", subtitle: `${name} kept the garden warm. Pick up wherever you like.` };
  }
  return null;
}

/** The day to remember as "last seen" after this visit (today, unless the given day is later). */
export function nextLastSeen(previous: string | null | undefined, today: string = getLocalDateKey()): string {
  if (previous && parseDateKey(previous) && previous > today) return previous;
  return today;
}

/** For tests and previews: the day N days before another day. */
export function daysBefore(day: string, n: number): string {
  return addDaysToDateKey(day, -n);
}
