import { supabase } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { diagLog } from "../utils/diagLog";
import { getLocalDateKey } from "../utils/dateKeys";
import { isMissingRpcSignature, logTaskCompleted } from "./retention";

type CompleteTaskRpcRow = {
  inserted?: boolean | null;
  points_awarded?: number | null;
  earned_points_today?: number | null;
};

type CompleteTaskEventMeta = {
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
};

export type CompleteTaskRpcResult = {
  inserted: boolean;
  points_awarded: number;
  earned_points_today: number;
};

type PendingCompletion = {
  taskId: string;
  dateKey: string;
  createdAt: string;
  attempts: number;
  nextRetryAt?: number | null;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
};

export type CompleteTaskMutationResult =
  | { state: "success"; result: CompleteTaskRpcResult }
  | { state: "queued" };

export type PendingSyncResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  remaining: number;
  earned_points_today: number | null;
};

const PENDING_COMPLETIONS_KEY = "pending_completions";
const RETRYABLE_STATUSES = new Set([502, 503, 504, 521]);
const RETRY_BACKOFF_MS = [500, 1_000, 2_000, 5_000, 10_000];
let syncInFlight: Promise<PendingSyncResult> | null = null;

/** @deprecated the product day is the local calendar day; kept for older callers */
export function utcDateKey(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** The day a completion belongs to: the person's local calendar day at that instant. */
export function completionDateKey(d: Date = new Date()) {
  return getLocalDateKey(d);
}

function toSafeInt(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeRpcResult(row: CompleteTaskRpcRow | null | undefined): CompleteTaskRpcResult {
  return {
    inserted: Boolean(row?.inserted),
    points_awarded: toSafeInt(row?.points_awarded),
    earned_points_today: toSafeInt(row?.earned_points_today),
  };
}

function pendingKey(taskId: string, dateKey: string) {
  return `${taskId}:${dateKey}`;
}

function isOfflineState(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null } | null) {
  if (!state) return false;
  return state.isConnected === false || state.isInternetReachable === false;
}

function extractStatus(error: any): number | null {
  const status = Number(error?.status);
  if (Number.isFinite(status)) return status;
  return null;
}

function isRetryableFailure(error: any) {
  const status = extractStatus(error);
  if (status != null && RETRYABLE_STATUSES.has(status)) return true;
  const code = String(error?.errorCode || error?.code || "").toUpperCase();
  if (code === "NETWORK_FAIL" || code === "AUTH_SERVICE_UNAVAILABLE") return true;
  return false;
}

async function readPendingCompletions(): Promise<PendingCompletion[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_COMPLETIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        taskId: String(item?.taskId || ""),
        dateKey: String(item?.dateKey || ""),
        createdAt: String(item?.createdAt || ""),
        attempts: Math.max(0, Number(item?.attempts) || 0),
        nextRetryAt: Number.isFinite(Number(item?.nextRetryAt)) ? Number(item.nextRetryAt) : null,
        category: item?.category != null ? String(item.category) : null,
        difficulty: item?.difficulty ?? null,
        points: Number.isFinite(Number(item?.points)) ? Math.max(0, Math.floor(Number(item.points))) : null,
      }))
      .filter((item) => item.taskId && item.dateKey);
  } catch {
    return [];
  }
}

async function writePendingCompletions(items: PendingCompletion[]) {
  await AsyncStorage.setItem(PENDING_COMPLETIONS_KEY, JSON.stringify(items));
}

export async function enqueuePendingCompletion(
  taskId: string | number,
  dateKey = completionDateKey(),
  eventMeta?: CompleteTaskEventMeta | null
) {
  const normalizedTaskId = String(taskId);
  const queue = await readPendingCompletions();
  const key = pendingKey(normalizedTaskId, dateKey);
  const exists = queue.some((item) => pendingKey(item.taskId, item.dateKey) === key);
  if (exists) {
    return { queued: false, queueSize: queue.length };
  }

  const nextQueue = [
    ...queue,
    {
      taskId: normalizedTaskId,
      dateKey,
      createdAt: new Date().toISOString(),
      attempts: 0,
      nextRetryAt: null,
      category: eventMeta?.category ?? null,
      difficulty: eventMeta?.difficulty ?? null,
      points:
        Number.isFinite(Number(eventMeta?.points)) && eventMeta?.points != null
          ? Math.max(0, Math.floor(Number(eventMeta?.points)))
          : null,
    },
  ];
  await writePendingCompletions(nextQueue);
  diagLog("TASK_COMPLETE_QUEUED", { taskId: normalizedTaskId, dateKey, queueSize: nextQueue.length });
  return { queued: true, queueSize: nextQueue.length };
}

export async function completeTaskAtomic(options: {
  taskId: string | number;
  completedAt?: string | null;
  eventMeta?: CompleteTaskEventMeta | null;
}) {
  const { taskId, completedAt, eventMeta } = options;
  const payload: Record<string, unknown> = {
    task_id: String(taskId),
  };
  if (completedAt) {
    payload.completed_at = completedAt;
  }
  // The server buckets the completion by the person's local day (R-28). A database without the
  // local-day migration rejects the extra argument; fall back to the old signature in that case.
  const completedInstant = completedAt ? new Date(completedAt) : new Date();
  payload.local_date = completionDateKey(Number.isNaN(completedInstant.getTime()) ? new Date() : completedInstant);

  let { data, error } = await supabase.rpc("complete_task", payload);
  if (error && isMissingRpcSignature(error)) {
    delete payload.local_date;
    ({ data, error } = await supabase.rpc("complete_task", payload));
  }
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const result = normalizeRpcResult(row as CompleteTaskRpcRow | null | undefined);

  diagLog("TASK_COMPLETE_RPC", {
    taskId: String(taskId),
    inserted: result.inserted,
    points_awarded: result.points_awarded,
    earned_points_today: result.earned_points_today,
  });

  console.log("TASK_COMPLETE_RPC", {
    taskId: String(taskId),
    inserted: result.inserted,
    points_awarded: result.points_awarded,
    earned_points_today: result.earned_points_today,
  });

  if (result.inserted) {
    try {
      await logTaskCompleted({
        taskId: String(taskId),
        occurredAt: completedAt || new Date().toISOString(),
        category: eventMeta?.category ?? null,
        difficulty: eventMeta?.difficulty ?? null,
        points:
          result.points_awarded > 0
            ? result.points_awarded
            : eventMeta?.points != null
              ? Number(eventMeta.points)
              : 0,
        meta: {
          task_id_raw: String(taskId),
          source: completedAt ? "queued_sync" : "direct_completion",
        },
      });
    } catch (retentionError: any) {
      console.warn("RETENTION_TASK_LOG_FAILED", {
        taskId: String(taskId),
        message: retentionError?.message || String(retentionError),
      });
    }
  }

  return result;
}

export async function completeTaskWithResilience(options: {
  taskId: string | number;
  retry?: boolean;
  eventMeta?: CompleteTaskEventMeta | null;
}): Promise<CompleteTaskMutationResult> {
  const { taskId, retry = false, eventMeta = null } = options;
  const normalizedTaskId = String(taskId);
  diagLog("TASK_COMPLETE_TAP", { taskId: normalizedTaskId });
  if (retry) {
    diagLog("TASK_COMPLETE_RETRY", { taskId: normalizedTaskId, source: "inline_retry" });
  }

  const netState = await NetInfo.fetch();
  if (isOfflineState(netState)) {
    await enqueuePendingCompletion(normalizedTaskId, completionDateKey(), eventMeta);
    return { state: "queued" };
  }

  try {
    const result = await completeTaskAtomic({ taskId: normalizedTaskId, eventMeta });
    diagLog("TASK_COMPLETE_SUCCESS", {
      taskId: normalizedTaskId,
      inserted: result.inserted,
      points_awarded: result.points_awarded,
      earned_points_today: result.earned_points_today,
    });
    return { state: "success", result };
  } catch (error: any) {
    const latestState = await NetInfo.fetch();
    if (isOfflineState(latestState)) {
      await enqueuePendingCompletion(normalizedTaskId, completionDateKey(), eventMeta);
      return { state: "queued" };
    }

    diagLog("TASK_COMPLETE_FAIL", {
      taskId: normalizedTaskId,
      status: extractStatus(error),
      message: error?.message || "Task completion failed",
    });
    throw error;
  }
}

export async function syncPendingCompletions(options?: { source?: string }): Promise<PendingSyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const source = options?.source || "background";
    const netState = await NetInfo.fetch();
    const queue = await readPendingCompletions();
    if (queue.length === 0 || isOfflineState(netState)) {
      return { attempted: 0, succeeded: 0, failed: 0, remaining: queue.length, earned_points_today: null };
    }

    const now = Date.now();
    const pending: PendingCompletion[] = [];
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let latestEarnedPointsToday: number | null = null;

    for (const item of queue) {
      if (item.nextRetryAt && item.nextRetryAt > now) {
        pending.push(item);
        continue;
      }

      attempted += 1;
      diagLog("TASK_COMPLETE_RETRY", {
        taskId: item.taskId,
        source,
        attempt: item.attempts + 1,
      });

      try {
        const rpcResult = await completeTaskAtomic({
          taskId: item.taskId,
          completedAt: item.createdAt,
          eventMeta: {
            category: item.category ?? null,
            difficulty: item.difficulty ?? null,
            points: item.points ?? null,
          },
        });
        latestEarnedPointsToday = rpcResult.earned_points_today;
        succeeded += 1;
        diagLog("TASK_COMPLETE_SUCCESS", {
          taskId: item.taskId,
          inserted: rpcResult.inserted,
          points_awarded: rpcResult.points_awarded,
          earned_points_today: rpcResult.earned_points_today,
          source,
        });
      } catch (error: any) {
        failed += 1;
        const nextAttempt = item.attempts + 1;
        const backoff = RETRY_BACKOFF_MS[Math.min(nextAttempt - 1, RETRY_BACKOFF_MS.length - 1)];

        diagLog("TASK_COMPLETE_FAIL", {
          taskId: item.taskId,
          status: extractStatus(error),
          message: error?.message || "Queued task sync failed",
          source,
        });

        if (isRetryableFailure(error) || extractStatus(error) == null) {
          pending.push({
            ...item,
            attempts: nextAttempt,
            nextRetryAt: Date.now() + backoff,
          });
        } else {
          pending.push({
            ...item,
            attempts: nextAttempt,
            nextRetryAt: Date.now() + backoff,
          });
        }
      }
    }

    await writePendingCompletions(pending);
    return {
      attempted,
      succeeded,
      failed,
      remaining: pending.length,
      earned_points_today: latestEarnedPointsToday,
    };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
