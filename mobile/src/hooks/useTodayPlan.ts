import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { buildDailyPlan, catalogById, catalogIdForTitle, renderTitle } from "../domain/plan";
import { DEFAULT_PLAN_SETTINGS } from "../domain/plan/focusAreas";
import type { CatalogTask, Energy, PlanInput, PlanSettings, PlannedTask } from "../domain/plan/types";
import {
  addPendingPlanTick,
  ensurePlanTaskRows,
  flushPendingPlanTicks,
  loadPendingPlanTicks,
  loadPlanHistory,
  loadPlanSettings,
  pendingPlanTickIds,
  recordPlanShown,
  savePlanSettings,
  tasksSafeToCreate,
} from "../services/planStore";
import { enqueuePendingCompletion } from "../services/taskCompletion";
import { loadCustomTaskMeta } from "../services/customTasks";
import { iconForCategory, inferCategory, isCustomTaskTitle } from "../domain/customTasks";

/** One of the person's own tasks (a tasks row that is not a catalog title), shown under today's plan. */
export type TodayCustomItem = {
  id: number;
  title: string;
  category: string;
  icon: string;
  minutes: number;
  done: boolean;
};

export type TodayPlanItem = {
  planned: PlannedTask;
  /** the catalog title with the pet's name filled in */
  title: string;
  /** the tasks row it completes through (null while no row could be matched or created) */
  taskId: number | null;
  done: boolean;
};

type Options = {
  userId: string | null;
  petName: string;
  /**
   * true once the pet's real name is known. Until then no row whose title carries the name is written
   * ("Play with Your pet" would be stored for good); the plan still shows those tasks.
   */
  petKnown: boolean;
  dateKey: string;
  energy: Energy | null;
  returning: boolean;
  memorial: boolean;
  cyclePhase: PlanInput["cyclePhase"];
  /**
   * false while the inputs above are still settling (energy read from the device, the pet's name, the cycle
   * store, the welcome-back check). No plan is built before then: a plan built from half-known inputs would be
   * logged as "shown" and create task rows for tasks nobody saw.
   */
  ready: boolean;
  /** ticks kept on this device got their rows and are in the offline queue now: time to sync it */
  onPendingQueued?: () => void;
};

type CachedPlan = { signature: string; planned: Array<{ id: string; slot: PlannedTask["slot"]; reason: string }> };

const CACHE_PREFIX = "floura:plan-today:";

function cacheKey(userId: string, dateKey: string) {
  return `${CACHE_PREFIX}${userId}:${dateKey}`;
}

function dayPartOf(hour: number) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Drops cached plans from other days; one small key per day otherwise piles up. */
async function pruneOldPlans(userId: string, dateKey: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter((key) => key.startsWith(`${CACHE_PREFIX}${userId}:`) && key !== cacheKey(userId, dateKey));
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch (_error) {}
}

function revive(cached: CachedPlan): PlannedTask[] {
  return cached.planned
    .map((row) => {
      const task = catalogById(row.id);
      return task ? { task, slot: row.slot, reason: row.reason } : null;
    })
    .filter(Boolean) as PlannedTask[];
}

/**
 * Today's care list from the plan engine (src/domain/plan). The list is built once per day and situation
 * and then held still (cached per day), so it does not reshuffle while the person is using it; changing
 * the battery check, the focus areas or the part of the day rebuilds it, always keeping what is already
 * done. Each item is backed by a row in `tasks`, so completing it goes through the existing complete_task
 * path (and the offline queue) and earns Sprouts like any other task. A tick made before a row exists is
 * kept on the device (tickPending) and queued as soon as the row can be made.
 */
export function useTodayPlan({ userId, petName, petKnown, dateKey, energy, returning, memorial, cyclePhase, ready, onPendingQueued }: Options) {
  const [settings, setSettings] = useState<(PlanSettings & { chosen: boolean }) | null>(null);
  const [items, setItems] = useState<TodayPlanItem[]>([]);
  const [custom, setCustom] = useState<TodayCustomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const onPendingQueuedRef = useRef(onPendingQueued);
  onPendingQueuedRef.current = onPendingQueued;
  // ticks made on this device today; a reload that started before a tick can never un-tick it
  const localDone = useRef<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const localCustomDone = useRef<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const doneKey = `${userId ?? "guest"}:${dateKey}`;
  if (localDone.current.key !== doneKey) localDone.current = { key: doneKey, ids: new Set() };
  if (localCustomDone.current.key !== doneKey) localCustomDone.current = { key: doneKey, ids: new Set() };

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const superseded = () => id !== requestId.current;
    if (!ready) return;
    if (memorial) {
      // memorial mode pauses daily care: nothing is built, logged or created
      setItems([]);
      setCustom([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!userId) {
        // signed out (or a preview): a plan from the defaults, nothing to complete against
        const planned = buildDailyPlan({ settings: DEFAULT_PLAN_SETTINGS, dateKey, hour: new Date().getHours(), energy, returning, memorial, cyclePhase, history: {}, seed: "guest" });
        setSettings({ ...DEFAULT_PLAN_SETTINGS, chosen: false });
        setItems(planned.map((p) => ({ planned: p, title: renderTitle(p.task, petName), taskId: null, done: localDone.current.ids.has(p.task.id) })));
        setCustom([]);
        setError(null);
        return;
      }

      const stored = await loadPlanSettings(userId);
      if (superseded()) return;
      const [rowsResult, completionsResult, history, pendingToday, customMeta] = await Promise.all([
        supabase.from("tasks").select("id, title, active").eq("user_id", userId).order("id"),
        // the same day the plan is for (not "now"): past midnight with Home still open they can differ
        supabase.from("task_completions").select("task_id").eq("user_id", userId).eq("completed_date", dateKey),
        loadPlanHistory(userId, dateKey, petName),
        loadPendingPlanTicks(userId, dateKey),
        loadCustomTaskMeta(userId),
      ]);
      if (superseded()) return;
      // Offline (or a failing read) is not an error screen: the plan is still built (from today's cache when
      // there is one), rows come from planStore's last-known ids, and ticks go to the offline queue.
      const offline = !!(rowsResult.error || completionsResult.error);
      if (offline) console.warn("TODAY_PLAN_READ_FAILED", rowsResult.error?.message || completionsResult.error?.message);
      const rows = (rowsResult.error ? [] : rowsResult.data || []) as Array<{ id: number; title: string; active?: boolean | null }>;
      const doneTaskIds = new Set(((completionsResult.error ? [] : completionsResult.data) || []).map((row: any) => String(row.task_id)));
      // the person's own rows (not catalog titles, not the play row) sit under the plan every day
      if (!offline) {
        setCustom(
          rows
            .filter((row) => row.active !== false && isCustomTaskTitle(row.title, petName))
            .map((row) => {
              const meta = customMeta[String(row.id)];
              const category = meta?.category ?? inferCategory(row.title);
              return {
                id: Number(row.id),
                title: String(row.title),
                category,
                icon: iconForCategory(category),
                minutes: meta?.minutes ?? 0,
                done: doneTaskIds.has(String(row.id)) || localCustomDone.current.ids.has(String(row.id)),
              };
            })
        );
      }
      // ticks kept on this device (no row yet when they were made) count as done today
      pendingToday.forEach((catalogId) => localDone.current.ids.add(catalogId));
      // whatever is already done today stays on the list, whichever list it came from
      const pinned = new Set<string>(localDone.current.ids);
      rows.forEach((row) => {
        if (!doneTaskIds.has(String(row.id))) return;
        const catalogId = catalogIdForTitle(String(row.title || ""), petName);
        if (catalogId) pinned.add(catalogId);
      });

      const hour = new Date().getHours();
      // the part of the day is in the signature: evening brings wind-down tasks, while done ones stay pinned
      const signature = JSON.stringify({ f: stored.focusAreas, c: stored.dailyCount, e: energy, r: returning, p: cyclePhase, d: dayPartOf(hour) });
      let planned: PlannedTask[] | null = null;
      try {
        const raw = await AsyncStorage.getItem(cacheKey(userId, dateKey));
        const cached = raw ? (JSON.parse(raw) as CachedPlan) : null;
        if (cached && cached.signature === signature && Array.isArray(cached.planned)) {
          const revived = revive(cached);
          if (revived.length > 0) planned = revived;
        }
      } catch (_error) {}
      if (superseded()) return;

      if (!planned) {
        planned = buildDailyPlan({ settings: stored, dateKey, hour, energy, returning, memorial, cyclePhase, history, seed: userId, pinned: Array.from(pinned) });
        try {
          const toCache: CachedPlan = { signature, planned: planned.map((p) => ({ id: p.task.id, slot: p.slot, reason: p.reason })) };
          await AsyncStorage.setItem(cacheKey(userId, dateKey), JSON.stringify(toCache));
        } catch (_error) {}
        if (superseded()) return;
        void recordPlanShown(userId, dateKey, planned.map((p) => p.task.id));
        void pruneOldPlans(userId, dateKey);
      }

      // today's rows (made or matched); other plan rows go quiet so "All tasks" shows today's plan
      const taskIds = await ensurePlanTaskRows(userId, tasksSafeToCreate(planned.map((p) => p.task), petKnown), petName, { deactivateStale: true });
      if (superseded()) return;

      // ticks made before a row existed: make their rows now that we may be online, then queue them
      try {
        const waiting = await pendingPlanTickIds(userId);
        if (waiting.length > 0) {
          const missing = waiting.filter((catalogId) => taskIds[catalogId] == null).map((catalogId) => catalogById(catalogId)).filter(Boolean) as CatalogTask[];
          const extra = missing.length > 0 ? await ensurePlanTaskRows(userId, tasksSafeToCreate(missing, petKnown), petName) : {};
          const queued = await flushPendingPlanTicks(userId, { ...taskIds, ...extra }, enqueuePendingCompletion, dateKey);
          if (queued > 0) onPendingQueuedRef.current?.();
        }
      } catch (flushError: any) {
        console.warn("TODAY_PLAN_PENDING_FLUSH_FAILED", flushError?.message || String(flushError));
      }
      if (superseded()) return;

      const finalPlan = planned;
      setSettings(stored);
      setItems((prev) => {
        // offline, keep what this session already knew was done
        const knownDone = offline ? new Set(prev.filter((item) => item.done).map((item) => item.planned.task.id)) : new Set<string>();
        return finalPlan.map((p) => {
          const taskId = taskIds[p.task.id] ?? null;
          const done = localDone.current.ids.has(p.task.id) || knownDone.has(p.task.id) || (taskId != null && doneTaskIds.has(String(taskId)));
          return { planned: p, title: renderTitle(p.task, petName), taskId, done };
        });
      });
      setError(null);
    } catch (err: any) {
      console.warn("TODAY_PLAN_LOAD_ERROR", err?.message || String(err));
      if (!superseded()) setError("Couldn't load today's care.");
    } finally {
      if (!superseded()) setLoading(false);
    }
  }, [cyclePhase, dateKey, energy, memorial, petKnown, petName, ready, returning, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveSettings = useCallback(
    async (next: PlanSettings) => {
      if (userId) await savePlanSettings(userId, next);
      setSettings({ ...next, chosen: true });
      await reload();
    },
    [reload, userId]
  );

  /** Tick after a successful (or queued) completion; survives any reload that is already in flight. */
  const markDone = useCallback((catalogId: string) => {
    localDone.current.ids.add(catalogId);
    setItems((prev) => prev.map((item) => (item.planned.task.id === catalogId ? { ...item, done: true } : item)));
  }, []);

  /** The same, for one of the person's own rows. */
  const markCustomDone = useCallback((rowId: number | string) => {
    localCustomDone.current.ids.add(String(rowId));
    setCustom((prev) => prev.map((item) => (String(item.id) === String(rowId) ? { ...item, done: true } : item)));
  }, []);

  /**
   * Tick a task that has no row yet (offline before it ever had one, or the pet unnamed): kept on this device
   * and queued for the server as soon as the row can be made.
   */
  const tickPending = useCallback(
    async (catalogId: string) => {
      if (userId) await addPendingPlanTick(userId, dateKey, catalogId);
      markDone(catalogId);
    },
    [dateKey, markDone, userId]
  );

  /** Makes sure one task has a row (the batch call may have missed it on a flaky network); returns its id. */
  const ensureRow = useCallback(
    async (task: CatalogTask): Promise<number | null> => {
      if (!userId) return null;
      if (tasksSafeToCreate([task], petKnown).length === 0) return null;
      const ids = await ensurePlanTaskRows(userId, [task], petName);
      const taskId = ids[task.id] ?? null;
      if (taskId != null) setItems((prev) => prev.map((item) => (item.planned.task.id === task.id ? { ...item, taskId } : item)));
      return taskId;
    },
    [petKnown, petName, userId]
  );

  return { settings, items, custom, loading, error, reload, saveSettings, markDone, markCustomDone, tickPending, ensureRow };
}
