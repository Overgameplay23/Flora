// Device and Supabase glue for the Cozy Run. The rules are pure and live in src/domain/cozyRun.ts; this file
// only gathers the care days and remembers the person's choices.
//
// What lives where:
//   * Care days: the server's daily_user_metrics roll-up (a task or a check-in that day; owner SELECT only),
//     merged with battery answers (floura:energy:<uid>:<day>, written by planStore.saveTodayEnergy) and days
//     marked here (markShowedUp). The server days are cached on the device too, so an offline open, or a
//     server hiccup, tells the same story instead of an empty one (R11: a run must never seem to vanish).
//   * Pace (with the day each pace was chosen), Cozy Pauses and the last mend: floura:cozy-run:<uid>.
//   * Covered days are not read here; the caller passes them straight to computeCozyRun, and nothing about
//     why a day was covered is stored or sent anywhere.
// Nothing in this file throws: each source that fails is simply left out.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_PACE,
  MAX_PAUSE_DAYS,
  addCareDays,
  isCareDayKey,
  isPace,
  normalizePace,
  type CozyPace,
  type CozyPaceChange,
  type CozyPauseRange,
  type CozyRunInput,
} from "../domain/cozyRun";

export type CozyRunStoredInput = Omit<CozyRunInput, "covered" | "today">;

type CozyRunState = {
  pace: CozyPace;
  paceHistory: CozyPaceChange[];
  pauses: CozyPauseRange[];
  mendUsedOn: string | null;
};

const stateKey = (userId: string) => `floura:cozy-run:${userId}`;
/** care days known on this device: the last server list seen, plus days marked here */
const daysKey = (userId: string) => `floura:cozy-run-days:${userId}`;
const energyPrefix = (userId: string) => `floura:energy:${userId}:`;

const PAGE_SIZE = 1000;
/** 20 pages is 20,000 days, about 55 years of care */
const MAX_PAGES = 20;
/** pauses and pace changes are kept for good (the history is replayed); this only bounds a runaway list */
const MAX_KEPT = 500;

function warn(tag: string, error: unknown) {
  console.warn(tag, (error as any)?.message || String(error));
}

// Every read-modify-write below runs one at a time. Home loads (and merges the server days) while a care
// action is being marked, and a write that overlapped another would quietly drop the other's day or choice.
let writes: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = writes.then(task, task);
  writes = next.catch(() => undefined);
  return next;
}

function emptyState(): CozyRunState {
  return { pace: DEFAULT_PACE, paceHistory: [], pauses: [], mendUsedOn: null };
}

function cleanPauses(value: unknown): CozyPauseRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((range: any) => isCareDayKey(range?.from) && isCareDayKey(range?.to) && range.to >= range.from)
    .map((range: any) => ({ from: range.from as string, to: range.to as string }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .slice(-MAX_KEPT);
}

function cleanPaceHistory(value: unknown): CozyPaceChange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((change: any) => isCareDayKey(change?.from) && isPace(change?.pace))
    .map((change: any) => ({ from: change.from as string, pace: change.pace as CozyPace }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .slice(-MAX_KEPT);
}

async function readState(userId: string): Promise<CozyRunState> {
  try {
    const raw = await AsyncStorage.getItem(stateKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyState();
    const paceHistory = cleanPaceHistory(parsed.paceHistory);
    return {
      // the latest choice is the current pace; a bare `pace` (no history) is honoured as well
      pace: paceHistory.length > 0 ? paceHistory[paceHistory.length - 1].pace : normalizePace(parsed.pace),
      paceHistory,
      pauses: cleanPauses(parsed.pauses),
      mendUsedOn: isCareDayKey(parsed.mendUsedOn) ? parsed.mendUsedOn : null,
    };
  } catch {
    return emptyState();
  }
}

async function writeState(userId: string, state: CozyRunState): Promise<boolean> {
  try {
    await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state));
    return true;
  } catch (error) {
    warn("COZY_RUN_STATE_SAVE_FAILED", error);
    return false;
  }
}

async function readDeviceDays(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(daysKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(isCareDayKey) : [];
  } catch {
    return [];
  }
}

async function writeDeviceDays(userId: string, days: Iterable<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(daysKey(userId), JSON.stringify([...new Set(days)].filter(isCareDayKey).sort()));
  } catch (error) {
    warn("COZY_RUN_DAYS_SAVE_FAILED", error);
  }
}

/** Days with a battery answer on this device. */
async function readBatteryDays(userId: string): Promise<string[]> {
  try {
    const prefix = energyPrefix(userId);
    const keys = await AsyncStorage.getAllKeys();
    return (keys || []).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)).filter(isCareDayKey);
  } catch {
    return [];
  }
}

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Every day the server has a task or a check-in for, oldest first. Throws on a server error. */
async function loadServerDays(userId: string): Promise<string[]> {
  const days: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("daily_user_metrics")
      .select("day, tasks_completed, checkins_completed")
      .eq("user_id", userId)
      .or("tasks_completed.gt.0,checkins_completed.gt.0")
      .order("day", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows as any[]) {
      const day = String(row?.day ?? "").slice(0, 10);
      if (isCareDayKey(day) && toCount(row?.tasks_completed) + toCount(row?.checkins_completed) > 0) days.push(day);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return days;
}

/**
 * Everything computeCozyRun needs except `today` and `covered`. Never throws: when the server cannot be read
 * the care days known on this device are used, and every stored choice falls back to its default.
 */
export async function loadCozyRunInput(userId: string, today: string): Promise<CozyRunStoredInput & { complete: boolean }> {
  if (!userId) return { showedUp: [], pace: DEFAULT_PACE, paceHistory: [], pauses: [], mendUsedOn: null, complete: false };
  const [state, batteryDays, serverDays] = await Promise.all([
    readState(userId),
    readBatteryDays(userId),
    loadServerDays(userId).catch((error) => {
      warn("COZY_RUN_SERVER_DAYS_FAILED", error);
      return null;
    }),
  ]);
  // read the device days only once the server has answered, so a day marked meanwhile is kept, not overwritten
  const deviceDays = await serial(async () => {
    const known = await readDeviceDays(userId);
    const knownSet = new Set(known);
    if (serverDays && serverDays.some((day) => !knownSet.has(day))) await writeDeviceDays(userId, [...known, ...serverDays]);
    return known;
  });
  // a time-zone hop can put a day just ahead of today's care day; anything further ahead is a wrong clock
  const latest = isCareDayKey(today) ? addCareDays(today, 1) : null;
  const showedUp = [...new Set([...deviceDays, ...batteryDays, ...(serverDays ?? [])])]
    .filter((day) => latest == null || day <= latest)
    .sort();
  // complete: the server days are in, now or from an earlier load cached on this device (a day merely marked on
  // this phone does not count); without them the run and Days Together would come from a fraction of the history
  const syncedKey = `floura:cozy-run-synced:${userId}`;
  let complete = serverDays != null;
  try {
    if (complete) await AsyncStorage.setItem(syncedKey, "1");
    else complete = (await AsyncStorage.getItem(syncedKey)) === "1";
  } catch (_error) {}
  return { showedUp, pace: state.pace, paceHistory: state.paceHistory, pauses: state.pauses, mendUsedOn: state.mendUsedOn, complete };
}

/**
 * Remembers a care day on this device (a task done offline, the reflection, a one-tap "I'm here"), so it
 * counts at once, before or without the server.
 */
export async function markShowedUp(userId: string, day: string): Promise<void> {
  if (!userId || !isCareDayKey(day)) return;
  await serial(async () => {
    const days = await readDeviceDays(userId);
    if (!days.includes(day)) await writeDeviceDays(userId, [...days, day]);
  });
}

/** Saves the pace from `today` on; weeks already lived keep the pace they had. */
export async function savePace(userId: string, pace: CozyPace, today: string): Promise<void> {
  if (!userId || !isPace(pace) || !isCareDayKey(today)) return;
  await serial(async () => {
    const state = await readState(userId);
    const history = state.paceHistory.filter((change) => change.from < today);
    const before = history.length > 0 ? history[history.length - 1].pace : DEFAULT_PACE;
    // choosing twice in a day keeps the last choice; choosing the pace already in effect adds nothing
    if (pace !== before) history.push({ from: today, pace });
    await writeState(userId, { ...state, pace, paceHistory: history.slice(-MAX_KEPT) });
  });
}

/**
 * Starts a Cozy Pause of 1-30 days from today and returns it; null if it could not be saved. When today already
 * counts (cared for), the pause runs one day longer so it still covers `days` quiet days. A pause already running
 * is replaced rather than stacked.
 */
export async function startPause(
  userId: string,
  today: string,
  days: number,
  options: { todayCounted?: boolean } = {}
): Promise<CozyPauseRange | null> {
  if (!userId || !isCareDayKey(today)) return null;
  const length = Math.min(MAX_PAUSE_DAYS, Math.max(1, Math.round(Number(days) || 1)));
  const range = { from: today, to: addCareDays(today, options.todayCounted ? length : length - 1) };
  return serial(async () => {
    const state = await readState(userId);
    const pauses = [...closeFrom(state.pauses, today), range];
    return (await writeState(userId, { ...state, pauses: cleanPauses(pauses) })) ? range : null;
  });
}

/** "I'm back": the pause running today ends yesterday (or is dropped if it began today). */
export async function endPause(userId: string, today: string): Promise<void> {
  if (!userId || !isCareDayKey(today)) return;
  await serial(async () => {
    const state = await readState(userId);
    await writeState(userId, { ...state, pauses: closeFrom(state.pauses, today) });
  });
}

/** Pauses with nothing left from `today` on: the past part of a running pause stays, the rest goes. */
function closeFrom(pauses: CozyPauseRange[], today: string): CozyPauseRange[] {
  const yesterday = addCareDays(today, -1);
  return pauses.flatMap((range) => {
    if (range.to < today) return [range];
    if (range.from < today) return [{ from: range.from, to: yesterday }];
    return [];
  });
}

/**
 * Remembers the day a mend reconnected a run (result.mend.lastMendedOn), so the once-every-30-days limit
 * holds even if the history the run is replayed from changes later. Only ever moves forward.
 */
export async function rememberMend(userId: string, day: string | null | undefined): Promise<void> {
  if (!userId || !isCareDayKey(day)) return;
  await serial(async () => {
    const state = await readState(userId);
    if (state.mendUsedOn && state.mendUsedOn >= day) return;
    await writeState(userId, { ...state, mendUsedOn: day });
  });
}
