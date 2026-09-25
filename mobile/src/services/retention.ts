import { supabase } from "../lib/supabase";
import { addDaysToDateKey, getLocalDateKey } from "../utils/dateKeys";

/** PostgREST could not match the call to a function signature (older database without a newer parameter). */
export function isMissingRpcSignature(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  if (code === "PGRST202" || code === "42883") return true;
  return message.includes("could not find the function") || (message.includes("function") && message.includes("does not exist"));
}

export type RetentionPetState = {
  user_id: string;
  mood: string;
  mood_score: number;
  streak_days: number;
  risk_score: number;
  updated_at: string;
  created_at?: string;
};

export type DailyUserMetric = {
  day: string;
  tasks_completed: number;
  tasks_created: number;
  checkins_completed: number;
  points_earned: number;
  last_activity_at: string | null;
  activity_count: number;
};

type LogEventParams = {
  eventType: string;
  occurredAt?: string | null;
  taskId?: string | null;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
  meta?: Record<string, unknown> | null;
};

type TaskEventParams = {
  taskId?: string | number | null;
  occurredAt?: string | null;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
  meta?: Record<string, unknown> | null;
};

type CheckinEventParams = {
  occurredAt?: string | null;
  mood?: number | null;
  winText?: string | null;
  meta?: Record<string, unknown> | null;
};

function toSafeInt(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeDifficulty(value: number | string | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "easy") return 1;
  if (normalized === "normal" || normalized === "medium") return 2;
  if (normalized === "hard") return 3;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  return null;
}

function toUuidOrNull(taskId: string | number | null | undefined) {
  if (taskId == null) return null;
  const raw = String(taskId).trim();
  if (!raw) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(raw) ? raw : null;
}

async function logEventAndRollup(params: LogEventParams) {
  const occurredAt = params.occurredAt || new Date().toISOString();
  const occurredDate = new Date(occurredAt);
  const payload: Record<string, unknown> = {
    p_event_type: params.eventType,
    p_occurred_at: occurredAt,
    p_task_id: toUuidOrNull(params.taskId || null),
    p_category: params.category ?? null,
    p_difficulty: normalizeDifficulty(params.difficulty),
    p_points: params.points == null ? null : Math.max(0, Math.floor(Number(params.points) || 0)),
    p_meta: params.meta ?? {},
    // the person's local day for the daily roll-up (R-28); older databases ignore it via the fallback below
    p_local_day: getLocalDateKey(Number.isNaN(occurredDate.getTime()) ? new Date() : occurredDate),
  };

  let { error } = await supabase.rpc("log_event_and_rollup", payload);
  if (error && isMissingRpcSignature(error)) {
    delete payload.p_local_day;
    ({ error } = await supabase.rpc("log_event_and_rollup", payload));
  }
  if (error) throw error;
}

export async function logTaskCompleted(params: TaskEventParams) {
  await logEventAndRollup({
    eventType: "task_completed",
    occurredAt: params.occurredAt || null,
    taskId: params.taskId == null ? null : String(params.taskId),
    category: params.category ?? null,
    difficulty: params.difficulty ?? null,
    points: params.points ?? 0,
    meta: params.meta ?? {},
  });
}

export async function logTaskCreated(params: TaskEventParams) {
  await logEventAndRollup({
    eventType: "task_created",
    occurredAt: params.occurredAt || null,
    taskId: params.taskId == null ? null : String(params.taskId),
    category: params.category ?? null,
    difficulty: params.difficulty ?? null,
    points: params.points ?? null,
    meta: params.meta ?? {},
  });
}

export async function logCheckinSubmitted(params: CheckinEventParams = {}) {
  await logEventAndRollup({
    eventType: "checkin_submitted",
    occurredAt: params.occurredAt || null,
    points: null,
    meta: {
      mood: params.mood ?? null,
      win_text: params.winText ?? null,
      ...(params.meta || {}),
    },
  });
}

export async function recomputePetState(): Promise<RetentionPetState | null> {
  let { data, error } = await supabase.rpc("recompute_pet_state", { p_today: getLocalDateKey() });
  if (error && isMissingRpcSignature(error)) {
    ({ data, error } = await supabase.rpc("recompute_pet_state"));
  }
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as RetentionPetState;
}

export async function fetchLast7DaysMetrics(): Promise<DailyUserMetric[]> {
  const endDay = getLocalDateKey();
  const startDay = addDaysToDateKey(endDay, -6);

  const { data, error } = await supabase
    .from("daily_user_metrics")
    .select("day, tasks_completed, tasks_created, checkins_completed, points_earned, last_activity_at")
    .gte("day", startDay)
    .lte("day", endDay)
    .order("day", { ascending: true });

  if (error) throw error;

  const byDay = new Map<string, DailyUserMetric>();
  for (const raw of data || []) {
    const day = String(raw.day);
    const tasksCompleted = toSafeInt(raw.tasks_completed);
    const tasksCreated = toSafeInt(raw.tasks_created);
    const checkinsCompleted = toSafeInt(raw.checkins_completed);
    const pointsEarned = toSafeInt(raw.points_earned);
    byDay.set(day, {
      day,
      tasks_completed: tasksCompleted,
      tasks_created: tasksCreated,
      checkins_completed: checkinsCompleted,
      points_earned: pointsEarned,
      last_activity_at: raw.last_activity_at || null,
      activity_count: tasksCompleted + checkinsCompleted,
    });
  }

  const rows: DailyUserMetric[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const dayKey = addDaysToDateKey(endDay, offset);
    const existing = byDay.get(dayKey);
    if (existing) {
      rows.push(existing);
      continue;
    }
    rows.push({
      day: dayKey,
      tasks_completed: 0,
      tasks_created: 0,
      checkins_completed: 0,
      points_earned: 0,
      last_activity_at: null,
      activity_count: 0,
    });
  }
  return rows;
}
