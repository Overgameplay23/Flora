// What the Cozy Run is computed from (src/domain/cozyRun.ts):
//   - the days of care: the times of the person's care events in user_events (a task or journey step done, a
//     check-in, a game), read back and bucketed into cozy days (the day ends at 3 a.m.) on the phone;
//   - Cozy Pauses and the chapters kept so far, on the device (floura:cozy-pauses:<uid>, floura:cozy-chapters:<uid>);
//   - the last good list of days, so a failed fetch never makes a run look like it is resting.
// It never reads the cycle tracker: period days are passed in by the hook (src/hooks/useCozyRun.ts).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { cozyDayKey, mergeChapters, normalizeChapters, normalizePauses, type CozyChapter, type CozyPause, type DayKey } from "../domain/cozyRun";

export const CARE_EVENTS = ["task_completed", "checkin_submitted", "pet_played"] as const;
/** how far back the run is replayed; older runs live on as kept chapters */
export const HISTORY_DAYS = 200;
const PAGE = 1000;
const MAX_PAGES = 10;

const daysKey = (userId: string) => `floura:cozy-days:${userId}`;
const pausesKey = (userId: string) => `floura:cozy-pauses:${userId}`;
const chaptersKey = (userId: string) => `floura:cozy-chapters:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((listener) => listener());
}

/** Screens showing the run refresh when care happens anywhere in the app or a pause changes. */
export function subscribeCozyRun(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// the signed-in person's days, kept in memory between screens
let memory: { userId: string; days: Set<DayKey>; fetchedAt: number } | null = null;

/**
 * Called after a care event is logged (services/retention.ts): the run updates at once, without waiting for the
 * next fetch. Harmless before the first fetch (that fetch will include the event).
 */
export function noteCare(occurredAt?: string | null) {
  if (!memory) return;
  memory.days.add(cozyDayKey(occurredAt ? new Date(occurredAt) : new Date()));
  notify();
}

async function fetchCareTimes(userId: string, since: Date): Promise<string[]> {
  const times: string[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("user_events")
      .select("occurred_at")
      .eq("user_id", userId)
      .in("event_type", CARE_EVENTS as unknown as string[])
      .gte("occurred_at", since.toISOString())
      .order("occurred_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { occurred_at: string }[];
    rows.forEach((row) => row.occurred_at && times.push(row.occurred_at));
    if (rows.length < PAGE) break;
  }
  return times;
}

export type CareDaysResult = { days: Set<DayKey>; stale: boolean };

/**
 * The cozy days with care in the last HISTORY_DAYS. Uses the copy in memory when it is younger than `maxAgeMs`;
 * on a failed fetch, the last list kept on the phone (stale: true), never an empty one.
 */
export async function loadCareDays(userId: string, { maxAgeMs = 15_000 }: { maxAgeMs?: number } = {}): Promise<CareDaysResult> {
  if (memory && memory.userId === userId && Date.now() - memory.fetchedAt < maxAgeMs) return { days: memory.days, stale: false };
  try {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
    const times = await fetchCareTimes(userId, since);
    const days = new Set(times.map((t) => cozyDayKey(new Date(t))));
    // a care event logged a moment ago may not be readable yet; keep what this phone already knows of today
    if (memory?.userId === userId) memory.days.forEach((d) => d >= cozyDayKey(new Date(Date.now() - 2 * 86_400_000)) && days.add(d));
    memory = { userId, days, fetchedAt: Date.now() };
    AsyncStorage.setItem(daysKey(userId), JSON.stringify([...days].sort())).catch(() => {});
    return { days, stale: false };
  } catch (error: any) {
    console.warn("COZY_RUN_LOAD_ERROR", error?.message || String(error));
    try {
      const raw = await AsyncStorage.getItem(daysKey(userId));
      const list = raw ? JSON.parse(raw) : [];
      const days = new Set<DayKey>(Array.isArray(list) ? list.filter((d: unknown): d is string => typeof d === "string") : []);
      if (memory?.userId === userId) memory.days.forEach((d) => days.add(d));
      return { days, stale: true };
    } catch {
      return { days: memory?.userId === userId ? memory.days : new Set(), stale: true };
    }
  }
}

export async function loadPauses(userId: string | null | undefined): Promise<CozyPause[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(pausesKey(userId));
    return normalizePauses(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function savePauses(userId: string, pauses: CozyPause[]): Promise<CozyPause[]> {
  const clean = normalizePauses(pauses);
  try {
    await AsyncStorage.setItem(pausesKey(userId), JSON.stringify(clean));
  } catch {}
  notify();
  return clean;
}

export async function loadKeptChapters(userId: string | null | undefined): Promise<CozyChapter[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(chaptersKey(userId));
    return normalizeChapters(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/** Adds newly finished runs to the chapters kept on the phone; returns everything kept, newest first. */
export async function keepChapters(userId: string, fresh: CozyChapter[]): Promise<CozyChapter[]> {
  const kept = await loadKeptChapters(userId);
  const merged = mergeChapters(kept, fresh);
  if (merged.length !== kept.length || merged.some((c, i) => c.end !== kept[i]?.end || c.days !== kept[i]?.days)) {
    try {
      await AsyncStorage.setItem(chaptersKey(userId), JSON.stringify(merged));
    } catch {}
  }
  return merged;
}

/** For tests and sign-out: forget the days held in memory. */
export function resetCozyRunMemory() {
  memory = null;
}
