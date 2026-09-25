import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

type HabitOverride = {
  title?: string;
  points?: number;
};

type HabitOverrideMap = Record<string, HabitOverride>;

const HABIT_OVERRIDE_PREFIX = "habit_overrides_v1";
let hasLoggedPointsSchemaFallback = false;

function overrideStorageKey(userId: string) {
  return `${HABIT_OVERRIDE_PREFIX}:${userId || "guest"}`;
}

function isMissingPointsColumn(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (!message.includes("points")) return false;
  return (
    message.includes("does not exist") ||
    (message.includes("could not find") && message.includes("column")) ||
    (message.includes("schema cache") && message.includes("column")) ||
    code === "42703" ||
    code.startsWith("PGRST2")
  );
}

function normalizeOverrideValue(value: HabitOverride) {
  const out: HabitOverride = {};
  if (typeof value?.title === "string") {
    const title = value.title.trim();
    if (title) out.title = title;
  }
  const points = Number(value?.points);
  if (Number.isFinite(points) && (Math.round(points) === 2 || Math.round(points) === 3)) {
    out.points = Math.round(points);
  }
  return out;
}

export async function getHabitOverrides(userId: string): Promise<HabitOverrideMap> {
  try {
    const raw = await AsyncStorage.getItem(overrideStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const normalized: HabitOverrideMap = {};
    Object.entries(parsed as Record<string, HabitOverride>).forEach(([taskId, value]) => {
      const next = normalizeOverrideValue(value || {});
      if (Object.keys(next).length > 0) {
        normalized[taskId] = next;
      }
    });
    return normalized;
  } catch (_error) {
    return {};
  }
}

async function saveOverrideMap(userId: string, map: HabitOverrideMap) {
  await AsyncStorage.setItem(overrideStorageKey(userId), JSON.stringify(map));
}

export async function setHabitOverride(userId: string, taskId: string | number, patch: HabitOverride): Promise<void> {
  const normalizedTaskId = String(taskId);
  const normalizedPatch = normalizeOverrideValue(patch);
  const current = await getHabitOverrides(userId);
  const next = { ...current, [normalizedTaskId]: { ...(current[normalizedTaskId] || {}), ...normalizedPatch } };
  await saveOverrideMap(userId, next);

  const dbPatch: Record<string, any> = {};
  if (normalizedPatch.title) dbPatch.title = normalizedPatch.title;
  if (Number.isFinite(Number(normalizedPatch.points))) dbPatch.points = Number(normalizedPatch.points);
  const numericTaskId = Number(taskId);
  if (!userId || userId === "guest" || !Number.isFinite(numericTaskId) || Object.keys(dbPatch).length === 0) return;

  const { error } = await supabase.from("tasks").update(dbPatch).eq("user_id", userId).eq("id", numericTaskId);
  if (!error) return;

  if (!("points" in dbPatch) || !isMissingPointsColumn(error)) {
    console.warn("HABIT_OVERRIDE_DB_WRITE_FAILED", { message: error?.message });
    return;
  }

  if (!hasLoggedPointsSchemaFallback) {
    hasLoggedPointsSchemaFallback = true;
    console.warn("HABIT_POINTS_SCHEMA_FALLBACK_USED", { reason: "missing points column" });
  }
  if (!("title" in dbPatch)) return;

  const { error: retryError } = await supabase
    .from("tasks")
    .update({ title: dbPatch.title })
    .eq("user_id", userId)
    .eq("id", numericTaskId);
  if (retryError) {
    console.warn("HABIT_OVERRIDE_DB_WRITE_FAILED", { message: retryError?.message });
  }
}

export async function setHabitOverrides(
  userId: string,
  patches: Array<{ taskId: string | number; patch: HabitOverride }>
): Promise<void> {
  for (const entry of patches) {
    await setHabitOverride(userId, entry.taskId, entry.patch);
  }
}

export function applyHabitOverrides<T extends { id?: any; task_id?: any; remoteId?: any }>(
  tasks: T[],
  overrides: HabitOverrideMap
): T[] {
  return (tasks || []).map((task) => {
    const idCandidates = [task?.task_id, task?.remoteId, task?.id].filter((value) => value != null).map((value) => String(value));
    const override = idCandidates.map((id) => overrides[id]).find((value) => !!value);
    if (!override) return task;
    return {
      ...task,
      title: override.title ?? (task as any).title,
      points: Number.isFinite(Number(override.points)) ? Number(override.points) : (task as any).points,
    };
  });
}
