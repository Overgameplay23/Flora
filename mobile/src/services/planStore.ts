// Device and Supabase glue for Plan Engine v1. The rules are pure and live in src/domain/plan; this file
// only stores what the person picked, remembers what was shown, and makes sure every planned task has a
// real tasks row so complete_task works unchanged (points, streak, offline queue).
//
// What lives where (tasks map, section 5e):
//   * Focus areas, today's battery and the "shown" log stay on the device for now. user_plans
//     (local-backend/sql/plan_engine_v1.sql) is written but not applied; nothing here needs it.
//   * Done comes from task_completions, the existing source of truth, mapped back to catalog ids by title.
//   * Rows are matched and created, never deleted (completions cascade and the garden balance would drop)
//     and never deactivated (other screens still list every active task).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKeys";
import { DEFAULT_PLAN_SETTINGS, isFocusArea, normalizePlanSettings } from "../domain/plan/focusAreas";
import { catalogById, catalogIdForTitle, renderTitle } from "../domain/plan/catalog";
import type { CatalogTask, Energy, PlanSettings, TaskHistory } from "../domain/plan/types";

/** History window: the 28 days before today. Today is left out so the plan holds still all day. */
const HISTORY_DAYS = 28;
const PLAN_ROW_SORT_BASE = 100;
const ENERGIES: Energy[] = ["exhausted", "anxious", "calm", "energized"];

const settingsKey = (userId: string) => `floura:plan-settings:${userId}`;
const energyKey = (userId: string, dateKey: string) => `floura:energy:${userId}:${dateKey}`;
const shownKey = (userId: string) => `floura:plan-shown:${userId}`;
/** last known catalog id -> tasks.id, so a plan built offline can still queue completions */
const rowsKey = (userId: string) => `floura:plan-rows:${userId}`;

function warn(tag: string, error: unknown) {
  console.warn(tag, (error as any)?.message || String(error));
}

// ---------- settings ----------

export async function loadPlanSettings(userId: string): Promise<PlanSettings & { chosen: boolean }> {
  const defaults = { focusAreas: [...DEFAULT_PLAN_SETTINGS.focusAreas], dailyCount: DEFAULT_PLAN_SETTINGS.dailyCount, chosen: false };
  if (!userId) return defaults;
  try {
    const raw = await AsyncStorage.getItem(settingsKey(userId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    // "chosen" means the person actually picked something; the defaults alone do not count
    const chosen = Array.isArray(parsed?.focusAreas) && parsed.focusAreas.some(isFocusArea);
    return { ...normalizePlanSettings(parsed), chosen };
  } catch {
    return defaults;
  }
}

export async function savePlanSettings(userId: string, settings: PlanSettings): Promise<void> {
  if (!userId) return;
  try {
    const { focusAreas, dailyCount } = normalizePlanSettings(settings);
    await AsyncStorage.setItem(settingsKey(userId), JSON.stringify({ focusAreas, dailyCount }));
  } catch (error) {
    warn("PLAN_SETTINGS_SAVE_FAILED", error);
  }
}

// ---------- today's battery ----------

export async function loadTodayEnergy(userId: string, dateKey: string): Promise<Energy | null> {
  if (!userId || !dateKey) return null;
  try {
    const raw = await AsyncStorage.getItem(energyKey(userId, dateKey));
    return ENERGIES.includes(raw as Energy) ? (raw as Energy) : null;
  } catch {
    return null;
  }
}

export async function saveTodayEnergy(userId: string, dateKey: string, energy: Energy): Promise<void> {
  if (!userId || !dateKey || !ENERGIES.includes(energy)) return;
  try {
    await AsyncStorage.setItem(energyKey(userId, dateKey), energy);
  } catch (error) {
    warn("PLAN_ENERGY_SAVE_FAILED", error);
  }
}

// ---------- what was shown ----------

type ShownLog = Record<string, string[]>;

async function readShownLog(userId: string): Promise<ShownLog> {
  try {
    const raw = await AsyncStorage.getItem(shownKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: ShownLog = {};
    for (const [day, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (!parseDateKey(day) || !Array.isArray(ids)) continue;
      log[day] = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
    return log;
  } catch {
    return {};
  }
}

/**
 * Records today's plan in the log and drops days past the window. A day that re-plans (the battery answer,
 * a focus change, the evening) keeps only its latest list: a task the evening plan replaced was not passed
 * over, so it must not collect a skip penalty (done tasks stay pinned, so they are always in the list).
 */
export async function recordPlanShown(userId: string, dateKey: string, catalogIds: string[]): Promise<void> {
  if (!userId || !parseDateKey(dateKey)) return;
  try {
    const log = await readShownLog(userId);
    const today = new Set<string>();
    for (const id of Array.isArray(catalogIds) ? catalogIds : []) if (typeof id === "string" && id) today.add(id);

    const oldest = addDaysToDateKey(dateKey, -HISTORY_DAYS);
    const newest = addDaysToDateKey(dateKey, 1); // a timezone hop can make "today" a day behind the log
    const next: ShownLog = {};
    for (const [day, ids] of Object.entries(log)) if (day >= oldest && day <= newest) next[day] = ids;
    next[dateKey] = [...today];
    await AsyncStorage.setItem(shownKey(userId), JSON.stringify(next));
  } catch (error) {
    warn("PLAN_SHOWN_SAVE_FAILED", error);
  }
}

// ---------- ticks made before a row existed ----------
// Offline on a task's first day, or before the pet's name is known, there is no tasks row to queue a
// completion against. The tick is kept here by catalog id and day (and shown as done) until a row exists;
// flushPendingPlanTicks then turns it into a queued completion stamped with the time of the tap.

type PendingTick = { id: string; at: string };
type PendingTicks = Record<string, PendingTick[]>;
const pendingTicksKey = (userId: string) => `floura:plan-pending-ticks:${userId}`;

async function readPendingTicks(userId: string): Promise<PendingTicks> {
  try {
    const raw = await AsyncStorage.getItem(pendingTicksKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ticks: PendingTicks = {};
    for (const [day, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!parseDateKey(day) || !Array.isArray(list)) continue;
      const clean = list
        .map((tick: any) => (tick && typeof tick === "object" ? { id: String(tick.id || ""), at: String(tick.at || "") } : null))
        .filter((tick): tick is PendingTick => !!tick && !!catalogById(tick.id));
      if (clean.length > 0) ticks[day] = clean;
    }
    return ticks;
  } catch {
    return {};
  }
}

async function writePendingTicks(userId: string, ticks: PendingTicks) {
  try {
    if (Object.keys(ticks).length === 0) await AsyncStorage.removeItem(pendingTicksKey(userId));
    else await AsyncStorage.setItem(pendingTicksKey(userId), JSON.stringify(ticks));
  } catch (error) {
    warn("PLAN_PENDING_TICKS_SAVE_FAILED", error);
  }
}

/** Catalog ids ticked on `dateKey` that still wait for a row (shown as done meanwhile). */
export async function loadPendingPlanTicks(userId: string, dateKey: string): Promise<string[]> {
  if (!userId) return [];
  const ticks = await readPendingTicks(userId);
  return (ticks[dateKey] || []).map((tick) => tick.id);
}

/** Every catalog id waiting for a row, over all days, so rows can be made for them once online. */
export async function pendingPlanTickIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const ticks = await readPendingTicks(userId);
  const ids = new Set<string>();
  for (const list of Object.values(ticks)) for (const tick of list) ids.add(tick.id);
  return [...ids];
}

export async function addPendingPlanTick(userId: string, dateKey: string, catalogId: string, at: Date = new Date()): Promise<void> {
  if (!userId || !parseDateKey(dateKey) || !catalogById(catalogId)) return;
  const ticks = await readPendingTicks(userId);
  const day = ticks[dateKey] || [];
  if (!day.some((tick) => tick.id === catalogId)) ticks[dateKey] = [...day, { id: catalogId, at: at.toISOString() }];
  await writePendingTicks(userId, ticks);
}

export type EnqueueCompletion = (
  taskId: number,
  dateKey: string,
  eventMeta: { category: string | null; difficulty: number; points: null },
  createdAt: string
) => Promise<unknown>;

/**
 * Queues a completion for every pending tick whose catalog id now has a row (`rowIds`: catalog id ->
 * tasks.id), dated by the tap, and forgets ticks older than the history window. Ticks still without a row
 * stay. Returns how many were queued. The cycle category is never written (the cycle stays on the device).
 */
export async function flushPendingPlanTicks(userId: string, rowIds: Record<string, number>, enqueue: EnqueueCompletion, todayDateKey: string): Promise<number> {
  if (!userId || !parseDateKey(todayDateKey)) return 0;
  const ticks = await readPendingTicks(userId);
  const oldest = addDaysToDateKey(todayDateKey, -HISTORY_DAYS);
  const next: PendingTicks = {};
  let queued = 0;
  let changed = false;
  for (const [day, list] of Object.entries(ticks)) {
    if (day < oldest) {
      changed = true;
      continue;
    }
    const left: PendingTick[] = [];
    for (const tick of list) {
      const rowId = rowIds[tick.id];
      const task = catalogById(tick.id);
      if (rowId == null || !task) {
        left.push(tick);
        continue;
      }
      try {
        const at = tick.at && !Number.isNaN(new Date(tick.at).getTime()) ? tick.at : new Date().toISOString();
        await enqueue(rowId, day, { category: task.category === "cycle" ? null : task.category, difficulty: task.effort, points: null }, at);
        queued += 1;
        changed = true;
      } catch (error) {
        warn("PLAN_PENDING_TICK_QUEUE_FAILED", error);
        left.push(tick);
      }
    }
    if (left.length > 0) next[day] = left;
  }
  if (changed) await writePendingTicks(userId, next);
  return queued;
}

// ---------- history ----------

function isMissingColumn(error: any, column: string) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" || (message.includes(column) && (message.includes("does not exist") || message.includes("could not find")));
}

/** Completion days per task row in [from, to). Older databases only have the legacy completion_date. */
async function loadCompletionDays(userId: string, from: string, to: string): Promise<Array<{ taskId: string; day: string }>> {
  for (const column of ["completed_date", "completion_date"]) {
    const { data, error } = await supabase
      .from("task_completions")
      .select(`task_id, ${column}`)
      .eq("user_id", userId)
      .gte(column, from)
      .lt(column, to);
    if (error) {
      if (column === "completed_date" && isMissingColumn(error, column)) continue;
      throw error;
    }
    return (data || [])
      .map((row: any) => ({ taskId: String(row?.task_id ?? ""), day: String(row?.[column] ?? "").slice(0, 10) }))
      .filter((row) => row.taskId && parseDateKey(row.day));
  }
  return [];
}

/**
 * Shown counts come from the device log, done counts from task_completions joined to tasks.title. Both
 * cover the 28 days before today. consecutiveSkips is the trailing run of days a task was on the plan and
 * not done; a completion on any day resets it. Never throws: if the server half fails it returns {} (a
 * neutral history) rather than a shown-only one that would read as nothing ever done.
 */
export async function loadPlanHistory(userId: string, todayDateKey: string, petName: string): Promise<TaskHistory> {
  if (!userId || !parseDateKey(todayDateKey)) return {};
  try {
    const from = addDaysToDateKey(todayDateKey, -HISTORY_DAYS);
    const [shownLog, rowsResult, completions] = await Promise.all([
      readShownLog(userId),
      supabase.from("tasks").select("id,title").eq("user_id", userId),
      loadCompletionDays(userId, from, todayDateKey),
    ]);
    if (rowsResult.error) throw rowsResult.error;

    const catalogIdByRow = new Map<string, string>();
    for (const row of (rowsResult.data || []) as Array<{ id: unknown; title: unknown }>) {
      const id = catalogIdForTitle(String(row?.title ?? ""), petName);
      if (id) catalogIdByRow.set(String(row.id), id);
    }
    const doneByDay = new Map<string, Set<string>>();
    for (const { taskId, day } of completions) {
      const id = catalogIdByRow.get(taskId);
      if (!id) continue;
      if (!doneByDay.has(day)) doneByDay.set(day, new Set());
      doneByDay.get(day)!.add(id);
    }

    const history: TaskHistory = {};
    const entry = (id: string) => {
      if (!history[id]) history[id] = { shown: 0, done: 0, consecutiveSkips: 0 };
      return history[id];
    };
    for (let back = HISTORY_DAYS; back >= 1; back--) {
      const day = addDaysToDateKey(todayDateKey, -back);
      const shown = new Set((shownLog[day] || []).filter((id) => catalogById(id)));
      const done = doneByDay.get(day) || new Set<string>();
      for (const id of shown) {
        const item = entry(id);
        item.shown += 1;
        item.lastShown = day;
        item.consecutiveSkips = done.has(id) ? 0 : item.consecutiveSkips + 1;
      }
      for (const id of done) {
        const item = entry(id);
        item.done += 1;
        item.consecutiveSkips = 0;
      }
    }
    return history;
  } catch (error) {
    warn("PLAN_HISTORY_LOAD_FAILED", error);
    return {};
  }
}

// ---------- task rows ----------

type TaskRow = { id: number; title: string; active: boolean | null };

function normalizeTitle(title: unknown) {
  return String(title ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function selectTaskRows(userId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase.from("tasks").select("id,title,active").eq("user_id", userId).order("id");
  if (error) throw error;
  return ((data || []) as any[])
    .map((row) => ({ id: Number(row?.id), title: String(row?.title ?? ""), active: row?.active ?? null }))
    .filter((row) => Number.isFinite(row.id));
}

/**
 * The row each catalog task maps to: its rendered title first (then a legacy title such as a play row
 * named for an earlier pet name), active before inactive, oldest first. Two callers that raced and both
 * inserted therefore still agree on the same row.
 */
function matchRows(rows: TaskRow[], wanted: CatalogTask[], petName: string): Map<string, TaskRow> {
  const byCatalogId = new Map<string, TaskRow>();
  for (const task of wanted) {
    const expected = normalizeTitle(renderTitle(task, petName));
    const ranked = rows
      .map((row) => {
        const exact = normalizeTitle(row.title) === expected;
        const legacy = !exact && catalogIdForTitle(row.title, petName) === task.id;
        return { row, rank: exact ? 0 : legacy ? 1 : -1 };
      })
      .filter((candidate) => candidate.rank >= 0)
      .sort((a, b) => a.rank - b.rank || Number(b.row.active !== false) - Number(a.row.active !== false) || a.row.id - b.row.id);
    if (ranked.length > 0) byCatalogId.set(task.id, ranked[0].row);
  }
  return byCatalogId;
}

async function readRowCache(userId: string): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(rowsKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const cache: Record<string, number> = {};
    for (const [id, rowId] of Object.entries(parsed as Record<string, unknown>)) {
      if (catalogById(id) && Number.isFinite(Number(rowId))) cache[id] = Number(rowId);
    }
    return cache;
  } catch {
    return {};
  }
}

async function writeRowCache(userId: string, ids: Record<string, number>) {
  try {
    const cache = await readRowCache(userId);
    await AsyncStorage.setItem(rowsKey(userId), JSON.stringify({ ...cache, ...ids }));
  } catch {}
}

async function insertRows(payload: Array<{ user_id: string; title: string; active: boolean; sort_order: number }>) {
  const { error } = await supabase.from("tasks").insert(payload);
  if (!error) return;
  // one bad row (or a duplicate a concurrent call just wrote) fails the whole batch; try them one by one
  warn("PLAN_TASK_ROWS_BATCH_INSERT_FAILED", error);
  for (const row of payload) {
    const { error: rowError } = await supabase.from("tasks").insert(row);
    if (rowError) warn("PLAN_TASK_ROW_INSERT_FAILED", rowError);
  }
}

/**
 * The catalog tasks whose rows may be written now. A title with {pet} in it is written with the pet's
 * name, so until the name is known ("Your pet" would be stored for good) those wait; the plan still shows
 * them and a tick is kept on the device meanwhile (addPendingPlanTick).
 */
export function tasksSafeToCreate(tasks: CatalogTask[], petKnown: boolean): CatalogTask[] {
  const list = Array.isArray(tasks) ? tasks : [];
  return petKnown ? list : list.filter((task) => !String(task?.title || "").includes("{pet}"));
}

export type EnsureRowsOptions = {
  /**
   * Deactivate the person's other plan rows (catalog titles not in `tasks`, never their own tasks and never
   * the play row the games complete), so "All tasks" shows today's plan rather than every plan ever built.
   * A deactivated row comes back the day its task is picked again (matched rows are reactivated).
   */
  deactivateStale?: boolean;
};

async function ensureRowsNow(userId: string, tasks: CatalogTask[], petName: string, options: EnsureRowsOptions = {}): Promise<Record<string, number>> {
  const wanted: CatalogTask[] = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.id && catalogById(task.id) && !wanted.some((other) => other.id === task.id)) wanted.push(task);
  }
  if (wanted.length === 0) return {};

  try {
    let rows = await selectTaskRows(userId);
    let matched = matchRows(rows, wanted, petName);

    const inactiveIds = [...new Set([...matched.values()].filter((row) => row.active === false).map((row) => row.id))];
    if (inactiveIds.length > 0) {
      const { error } = await supabase.from("tasks").update({ active: true }).eq("user_id", userId).in("id", inactiveIds);
      if (error) warn("PLAN_TASK_ROWS_REACTIVATE_FAILED", error);
    }

    const missing = wanted.filter((task) => !matched.has(task.id));
    if (missing.length > 0) {
      // tasks has id, user_id, title, active, sort_order and timestamps only; no points or category on the hosted DB
      await insertRows(
        missing.map((task) => ({
          user_id: userId,
          title: renderTitle(task, petName),
          active: true,
          sort_order: PLAN_ROW_SORT_BASE + wanted.indexOf(task),
        }))
      );
      // re-select rather than trusting the insert's echo: it also picks up rows a concurrent call wrote
      rows = await selectTaskRows(userId);
      matched = matchRows(rows, wanted, petName);
    }

    const ids: Record<string, number> = {};
    for (const task of wanted) {
      const row = matched.get(task.id);
      if (row) ids[task.id] = row.id;
    }

    if (options.deactivateStale) {
      const keep = new Set(Object.values(ids));
      const stale = rows
        .filter((row) => {
          if (row.active === false || keep.has(row.id)) return false;
          const catalogId = catalogIdForTitle(row.title, petName);
          if (!catalogId) return false; // the person's own task
          const task = catalogById(catalogId);
          return !!task && task.kind !== "play"; // the play row is what the games complete
        })
        .map((row) => row.id);
      if (stale.length > 0) {
        const { error } = await supabase.from("tasks").update({ active: false }).eq("user_id", userId).in("id", stale);
        if (error) warn("PLAN_TASK_ROWS_DEACTIVATE_FAILED", error);
      }
    }

    await writeRowCache(userId, ids);
    return ids;
  } catch (error) {
    // offline or the server said no: fall back to the ids this device last saw, so completions can still queue
    warn("PLAN_TASK_ROWS_FAILED", error);
    const cache = await readRowCache(userId);
    const ids: Record<string, number> = {};
    for (const task of wanted) if (cache[task.id] != null) ids[task.id] = cache[task.id];
    return ids;
  }
}

const ensureQueue = new Map<string, Promise<unknown>>();

/**
 * Makes sure each catalog task has an active tasks row and returns catalog id -> tasks.id. Matches by
 * rendered title (the seed titles are catalog titles, so seeded rows are reused), reactivates matched
 * inactive rows, inserts the rest. Idempotent; calls for the same user run one after another. Never
 * throws: a task missing from the result has no row yet.
 */
export async function ensurePlanTaskRows(userId: string, tasks: CatalogTask[], petName: string, options: EnsureRowsOptions = {}): Promise<Record<string, number>> {
  if (!userId) return {};
  const previous = ensureQueue.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => ensureRowsNow(userId, tasks, petName, options));
  ensureQueue.set(userId, run);
  try {
    return await run;
  } finally {
    if (ensureQueue.get(userId) === run) ensureQueue.delete(userId);
  }
}
