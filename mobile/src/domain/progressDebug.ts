import { getNextUnlockProgress, getRequiredPointsForNextUnlock } from "./gardenProgress";
import { getTaskPoints } from "./taskPoints";

type TaskLike = {
  id?: string | number | null;
  task_id?: string | number | null;
  remoteId?: string | number | null;
  done?: boolean;
  completed?: boolean;
  title?: string | null;
  points?: number | null;
  difficulty?: string | null;
  type?: string | null;
};

type CompletionLike =
  | { task_id?: string | number | null; id?: string | number | null; done?: boolean; completed?: boolean }
  | string
  | number;

type GardenItemLike = {
  id: string | number;
  name?: string | null;
  tier?: number | null;
  required_points?: number | null;
  requiredPoints?: number | null;
};

type GardenUnlockLike = {
  item_id?: string | number | null;
  itemId?: string | number | null;
};

type PointsDebugArgs = {
  tasks: TaskLike[];
  completionsToday: CompletionLike[];
  gardenItems: GardenItemLike[];
  gardenUnlocks: GardenUnlockLike[];
  todayISO?: string;
};

function normalizeId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.floor(value));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("remote-")) return trimmed.slice(7);
    return trimmed;
  }
  return null;
}

function getTaskId(task: TaskLike): string | null {
  return normalizeId(task?.task_id ?? task?.remoteId ?? task?.id);
}

function getCompletionId(value: CompletionLike): string | null {
  if (typeof value === "string" || typeof value === "number") return normalizeId(value);
  return normalizeId(value?.task_id ?? value?.id);
}

export function getPointsDebugSnapshot({
  tasks,
  completionsToday,
  gardenItems,
  gardenUnlocks,
}: PointsDebugArgs) {
  const completedIds = new Set<string>();
  const completionArray = Array.isArray(completionsToday) ? completionsToday : [];

  completionArray.forEach((row) => {
    const done =
      typeof row === "object" && row != null
        ? row.done ?? row.completed ?? true
        : true;
    if (!done) return;
    const id = getCompletionId(row);
    if (id) completedIds.add(id);
  });

  if (completedIds.size === 0) {
    (tasks || []).forEach((task) => {
      if (!task?.done && !task?.completed) return;
      const id = getTaskId(task);
      if (id) completedIds.add(id);
    });
  }

  const earnedPointsToday = (tasks || []).reduce((sum, task) => {
    const id = getTaskId(task);
    if (!id || !completedIds.has(id)) return sum;
    return sum + getTaskPoints(task);
  }, 0);

  const unlockedSet = new Set<string>();
  (gardenUnlocks || []).forEach((row) => {
    const itemId = normalizeId(row?.item_id ?? row?.itemId);
    if (itemId) unlockedSet.add(itemId);
  });

  const sortedItems = [...(gardenItems || [])].sort((a, b) => {
    const tierA = Number.isFinite(Number(a?.tier)) ? Number(a?.tier) : 0;
    const tierB = Number.isFinite(Number(b?.tier)) ? Number(b?.tier) : 0;
    if (tierA !== tierB) return tierA - tierB;
    const idA = Number.isFinite(Number(a?.id)) ? Number(a.id) : 0;
    const idB = Number.isFinite(Number(b?.id)) ? Number(b.id) : 0;
    return idA - idB;
  });

  const nextLockedItemRaw = sortedItems.find((item) => !unlockedSet.has(normalizeId(item.id) || "")) || null;
  const requiredPoints = getRequiredPointsForNextUnlock(unlockedSet.size, nextLockedItemRaw);
  const nextUnlockProgress = getNextUnlockProgress({ earnedPoints: earnedPointsToday, requiredPoints });

  return {
    completedTaskIdsToday: Array.from(completedIds),
    earnedPointsToday: nextUnlockProgress.earnedPoints,
    unlockedCount: unlockedSet.size,
    nextLockedItem: nextLockedItemRaw
      ? {
          id: nextLockedItemRaw.id,
          name: nextLockedItemRaw.name || "Next item",
          requiredPoints,
        }
      : null,
    requiredPoints: nextUnlockProgress.requiredPoints,
    remaining: nextUnlockProgress.remaining,
    isReady: nextUnlockProgress.isReady,
  };
}
