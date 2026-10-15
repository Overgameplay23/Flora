import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { buildDailyPlan, catalogById, catalogIdForTitle, renderTitle } from "../domain/plan";
import { DEFAULT_PLAN_SETTINGS } from "../domain/plan/focusAreas";
import type { CatalogTask, Energy, PlanInput, PlanSettings, PlannedTask } from "../domain/plan/types";
import { ensurePlanTaskRows, loadPlanHistory, loadPlanSettings, recordPlanShown, savePlanSettings } from "../services/planStore";
import { completionDateKey } from "../services/taskCompletion";

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
 * path (and the offline queue) and earns Sprouts like any other task.
 */
export function useTodayPlan({ userId, petName, dateKey, energy, returning, memorial, cyclePhase, ready }: Options) {
  const [settings, setSettings] = useState<(PlanSettings & { chosen: boolean }) | null>(null);
  const [items, setItems] = useState<TodayPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  // ticks made on this device today; a reload that started before a tick can never un-tick it
  const localDone = useRef<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const doneKey = `${userId ?? "guest"}:${dateKey}`;
  if (localDone.current.key !== doneKey) localDone.current = { key: doneKey, ids: new Set() };

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const superseded = () => id !== requestId.current;
    if (!ready) return;
    if (memorial) {
      // memorial mode pauses daily care: nothing is built, logged or created
      setItems([]);
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
        setError(null);
        return;
      }

      const stored = await loadPlanSettings(userId);
      if (superseded()) return;
      const [rowsResult, completionsResult, history] = await Promise.all([
        supabase.from("tasks").select("id, title").eq("user_id", userId),
        supabase.from("task_completions").select("task_id").eq("user_id", userId).eq("completed_date", completionDateKey()),
        loadPlanHistory(userId, dateKey, petName),
      ]);
      if (superseded()) return;
      // Offline (or a failing read) is not an error screen: the plan is still built (from today's cache when
      // there is one), rows come from planStore's last-known ids, and ticks go to the offline queue.
      const offline = !!(rowsResult.error || completionsResult.error);
      if (offline) console.warn("TODAY_PLAN_READ_FAILED", rowsResult.error?.message || completionsResult.error?.message);
      const rows = (rowsResult.error ? [] : rowsResult.data || []) as Array<{ id: number; title: string }>;
      const doneTaskIds = new Set(((completionsResult.error ? [] : completionsResult.data) || []).map((row: any) => String(row.task_id)));
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

      const taskIds = await ensurePlanTaskRows(userId, planned.map((p) => p.task), petName);
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
  }, [cyclePhase, dateKey, energy, memorial, petName, ready, returning, userId]);

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

  /** Makes sure one task has a row (the batch call may have missed it on a flaky network); returns its id. */
  const ensureRow = useCallback(
    async (task: CatalogTask): Promise<number | null> => {
      if (!userId) return null;
      const ids = await ensurePlanTaskRows(userId, [task], petName);
      const taskId = ids[task.id] ?? null;
      if (taskId != null) setItems((prev) => prev.map((item) => (item.planned.task.id === task.id ? { ...item, taskId } : item)));
      return taskId;
    },
    [petName, userId]
  );

  return { settings, items, loading, error, reload, saveSettings, markDone, ensureRow };
}
