import { supabase } from "../lib/supabase";
import { addDaysToDateKey, getISOWeekKey, getLocalDateKey } from "../utils/dateKeys";
import { DEFAULT_HABITS, getHabits } from "./habitsService";
import { logTaskCreated } from "./retention";

export type PetMoodState = "sad" | "neutral" | "happy";

export type Habit = {
  id: number;
  title: string;
  active: boolean;
  completed?: boolean;
};

export type CheckIn = {
  id?: number;
  date: string;
  mood_score: number;
  win_text?: string | null;
};

export type UserStats = {
  streak: number;
  last_completed_date: string | null;
  pet_mood_state: PetMoodState;
};

export type ProfileStreakState = {
  current_streak: number;
  best_streak: number;
  last_checkin_date: string | null;
};

export type WeeklyReflectionSummary = {
  startDateKey: string;
  endDateKey: string;
  averageMood: number | null;
  wins: Array<{ date: string; text: string }>;
  hardDays: Array<{ date: string; mood: number }>;
};

const HABIT_COMPLETION_THRESHOLD = 2;
const STREAK_UNLOCK_INTERVAL = 3;

export function todayKey(d: Date = new Date()) {
  return getLocalDateKey(d);
}

export function yesterdayKey() {
  return addDaysToDateKey(getLocalDateKey(), -1);
}

export function determinePetMood(moodScore: number | null, completionRate: number): PetMoodState {
  if (moodScore == null || Number.isNaN(moodScore)) return "neutral";
  if (moodScore >= 4 || completionRate >= 0.75) return "happy";
  if (moodScore <= 2 && completionRate < 0.35) return "sad";
  return "neutral";
}

function isMissingCreatedAt(error: any) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return message.includes("created_at") && message.includes("does not exist");
}

let hasLoggedProfileSchemaFallback = false;
let hasLoggedGardenRequiredPointsFallback = false;

function isMissingColumn(error: any, columnName: string) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status);
  if (Number.isFinite(status) && status !== 400) return false;
  if (!message.includes(columnName.toLowerCase())) return false;
  return (
    message.includes("does not exist") ||
    (message.includes("could not find") && message.includes("column")) ||
    (message.includes("schema cache") && message.includes("column")) ||
    code === "42703" ||
    code.startsWith("PGRST2")
  );
}

function isMissingProfileSchemaColumns(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status);
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (Number.isFinite(status) && status !== 400) return false;
  if (code === "42703" || code.startsWith("PGRST2")) return true;
  if (message.includes("does not exist")) return true;
  if (message.includes("could not find") && message.includes("column")) return true;
  if (message.includes("schema cache") && message.includes("column")) return true;
  return false;
}

function logGardenUnlocksQueryError(context: string, error: any) {
  const status = Number(error?.status);
  const code = String(error?.code || "").toUpperCase();
  if (!(status === 400 || code.startsWith("PGRST"))) return;
  console.warn("GARDEN_UNLOCKS_QUERY_400", {
    context,
    status: Number.isFinite(status) ? status : null,
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  });
}

function extractMissingProfileColumns(error: any, attemptedPatch: Record<string, any>) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return Object.keys(attemptedPatch).filter((key) => message.includes(key.toLowerCase()));
}

export async function updateStreaks(userId: string, patch: Record<string, any>) {
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (!error) return { appliedPatch: patch, fallbackUsed: false };

  if (!isMissingProfileSchemaColumns(error)) {
    throw error;
  }

  const missing = extractMissingProfileColumns(error, patch);
  if (!hasLoggedProfileSchemaFallback) {
    hasLoggedProfileSchemaFallback = true;
    console.warn("PROFILE_SCHEMA_FALLBACK_USED", { missing: missing.length ? missing : ["unknown"] });
  }

  const fallbackPatch: Record<string, any> = {};
  if (Object.prototype.hasOwnProperty.call(patch, "streak_count")) {
    fallbackPatch.streak_count = patch.streak_count;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "last_checkin_date")) {
    fallbackPatch.last_checkin_date = patch.last_checkin_date;
  }

  if (Object.keys(fallbackPatch).length === 0) {
    return { appliedPatch: {}, fallbackUsed: true };
  }

  const { error: fallbackError } = await supabase
    .from("profiles")
    .update(fallbackPatch)
    .eq("user_id", userId);
  if (fallbackError && !isMissingProfileSchemaColumns(fallbackError)) {
    throw fallbackError;
  }
  return { appliedPatch: fallbackPatch, fallbackUsed: true };
}

async function ensureUserStats(userId: string) {
  const { data, error } = await supabase
    .from("user_stats")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .limit(1);
  if (error) throw error;
  return (data && data[0]) as UserStats;
}

export async function fetchUserStats(userId: string) {
  const { data, error } = await supabase.from("user_stats").select("*").eq("user_id", userId).limit(1);
  if (error && error.code !== "PGRST116") {
    throw error;
  }
  if (!data || data.length === 0) {
    return ensureUserStats(userId);
  }
  return data[0] as UserStats;
}

export async function fetchTodayCheckIn(userId: string, dateKey = todayKey()): Promise<CheckIn | null> {
  try {
    const { data, error } = await supabase
      .from("checkins")
      .select("id, date, mood_score, win_text, checkin_date, mood, note, created_at")
      .eq("user_id", userId)
      .eq("date", dateKey)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return {
      id: row.id,
      date: row.date || row.checkin_date || row.created_at?.slice(0, 10) || dateKey,
      mood_score: row.mood_score ?? row.mood ?? null,
      win_text: row.win_text ?? row.note ?? null,
    };
  } catch (error: any) {
    console.warn("CHECKIN_FETCH_FALLBACK", error?.message);
    const fallbackMissingCreatedAt = isMissingCreatedAt(error);
    const fallbackSelect = fallbackMissingCreatedAt
      ? "id, checkin_date, mood, note"
      : "id, checkin_date, mood, note, created_at";
    const fallbackOrder = fallbackMissingCreatedAt ? "id" : "created_at";
    // Keep the date filter: without it the newest check-in of any day was reported as today's (R-30).
    const { data, error: legacyError } = await supabase
      .from("checkins")
      .select(fallbackSelect)
      .eq("user_id", userId)
      .eq("checkin_date", dateKey)
      .order(fallbackOrder, { ascending: false })
      .limit(1);
    if (legacyError) throw legacyError;
    const row = ((data || []) as any[])[0];
    if (!row) return null;
    return {
      id: row.id,
      date: row.checkin_date || row.created_at?.slice(0, 10) || dateKey,
      mood_score: row.mood ?? null,
      win_text: row.note ?? null,
    };
  }
}

export async function saveCheckIn(userId: string, moodScore: number, winText: string, dateKey = todayKey()) {
  const payload = {
    user_id: userId,
    date: dateKey,
    mood_score: Math.max(1, Math.min(5, Math.round(moodScore))),
    win_text: winText?.trim() || null,
    checkin_date: dateKey,
    mood: Math.max(1, Math.min(5, Math.round(moodScore))),
    note: winText?.trim() || null,
  };
  try {
    const { data, error } = await supabase
      .from("checkins")
      .upsert(payload, { onConflict: "user_id,date" })
      .select("id, date, mood_score, win_text")
      .single();
    if (error) throw error;
    return data as CheckIn;
  } catch (error: any) {
    console.warn("CHECKIN_SAVE_FALLBACK", error?.message);
    const { data, error: legacyError } = await supabase
      .from("checkins")
      .insert({
        user_id: userId,
        checkin_date: dateKey,
        mood: Math.max(1, Math.min(5, Math.round(moodScore))),
        note: winText?.trim() || null,
      })
      .select("id, checkin_date, mood, note")
      .single();
    if (legacyError) throw legacyError;
    return {
      id: data?.id,
      date: data?.checkin_date || dateKey,
      mood_score: data?.mood ?? Math.round(moodScore),
      win_text: data?.note ?? winText ?? null,
    };
  }
}

function toNonNegativeInt(value: any, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num));
}

function normalizeProfileStreakState(row: any): ProfileStreakState {
  const current = toNonNegativeInt(row?.current_streak ?? row?.streak_count ?? 0, 0);
  const best = toNonNegativeInt(row?.best_streak ?? current, current);
  return {
    current_streak: current,
    best_streak: Math.max(best, current),
    last_checkin_date: row?.last_checkin_date ?? null,
  };
}

export async function fetchProfileStreakState(userId: string): Promise<ProfileStreakState> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("last_checkin_date, current_streak, best_streak, streak_count")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return normalizeProfileStreakState(data);
  } catch (error: any) {
    if (!isMissingColumn(error, "current_streak") && !isMissingColumn(error, "best_streak")) {
      throw error;
    }
    const { data, error: legacyError } = await supabase
      .from("profiles")
      .select("last_checkin_date, streak_count")
      .eq("user_id", userId)
      .single();
    if (legacyError) throw legacyError;
    return normalizeProfileStreakState(data);
  }
}

export async function applyGentleStreakUpdate(userId: string, dateKey = todayKey()): Promise<ProfileStreakState> {
  const currentProfile = await fetchProfileStreakState(userId);
  const previousDate = currentProfile.last_checkin_date;
  const previousCurrent = currentProfile.current_streak;
  const previousBest = currentProfile.best_streak;

  if (previousDate === dateKey || (previousDate && previousDate > dateKey)) {
    return currentProfile;
  }

  const yesterdayForDate = addDaysToDateKey(dateKey, -1);
  const nextCurrent = previousDate === yesterdayForDate ? previousCurrent + 1 : 1;
  const nextBest = Math.max(previousBest, nextCurrent);

  await updateStreaks(userId, {
    last_checkin_date: dateKey,
    streak_count: nextCurrent,
    current_streak: nextCurrent,
    best_streak: nextBest,
  });

  return {
    current_streak: nextCurrent,
    best_streak: nextBest,
    last_checkin_date: dateKey,
  };
}

export type ReflectionRow = {
  date: string;
  mood: number | null;
  win: string | null;
};

function normalizeReflectionRow(row: any, fallbackDateKey: string): ReflectionRow {
  const moodRaw = row?.mood_score ?? row?.mood ?? null;
  const normalizedMood =
    moodRaw == null || Number.isNaN(Number(moodRaw)) ? null : Math.max(1, Math.min(5, Math.round(Number(moodRaw))));
  const date = row?.date || row?.checkin_date || row?.created_at?.slice(0, 10) || fallbackDateKey;
  const winValue = row?.win_text ?? row?.note ?? null;
  return {
    date,
    mood: normalizedMood,
    win: typeof winValue === "string" ? winValue.trim() : null,
  };
}

function inDateRange(dateKey: string, startDateKey: string, endDateKey: string) {
  return dateKey >= startDateKey && dateKey <= endDateKey;
}

/** The check-ins of the seven days ending on endDateKey (newest first), tolerant of older schemas. */
export async function fetchWeeklyCheckins(userId: string, endDateKey = getLocalDateKey()): Promise<ReflectionRow[]> {
  const startDateKey = addDaysToDateKey(endDateKey, -6);
  let normalizedRows: ReflectionRow[] = [];

  try {
    const { data, error } = await supabase
      .from("checkins")
      .select("date, mood_score, win_text, checkin_date, mood, note, created_at")
      .eq("user_id", userId)
      .gte("date", startDateKey)
      .lte("date", endDateKey)
      .order("date", { ascending: false });
    if (error) throw error;
    normalizedRows = (data || [])
      .map((row) => normalizeReflectionRow(row, endDateKey))
      .filter((row) => inDateRange(row.date, startDateKey, endDateKey));
  } catch (error: any) {
    const fallbackMissingCreatedAt = isMissingCreatedAt(error);
    const fallbackSelect = fallbackMissingCreatedAt
      ? "checkin_date, mood, note"
      : "checkin_date, mood, note, created_at";
    const fallbackOrder = fallbackMissingCreatedAt ? "checkin_date" : "created_at";

    const { data, error: legacyError } = await supabase
      .from("checkins")
      .select(fallbackSelect)
      .eq("user_id", userId)
      .order(fallbackOrder, { ascending: false })
      .limit(200);
    if (legacyError) throw legacyError;

    normalizedRows = (data || [])
      .map((row) => normalizeReflectionRow(row, endDateKey))
      .filter((row) => inDateRange(row.date, startDateKey, endDateKey));
  }

  return normalizedRows;
}

export async function fetchWeeklyReflectionSummary(
  userId: string,
  endDateKey = getLocalDateKey()
): Promise<WeeklyReflectionSummary> {
  const startDateKey = addDaysToDateKey(endDateKey, -6);
  const normalizedRows = await fetchWeeklyCheckins(userId, endDateKey);

  const moodRows = normalizedRows.filter((row) => row.mood != null) as Array<{ date: string; mood: number; win: string | null }>;
  const moodAverage =
    moodRows.length > 0
      ? Number((moodRows.reduce((total, row) => total + row.mood, 0) / moodRows.length).toFixed(1))
      : null;

  const wins = normalizedRows
    .filter((row) => !!row.win)
    .map((row) => ({ date: row.date, text: row.win as string }));

  const hardDays = moodRows.filter((row) => row.mood <= 2).map((row) => ({ date: row.date, mood: row.mood }));

  return {
    startDateKey,
    endDateKey,
    averageMood: moodAverage,
    wins,
    hardDays,
  };
}

export async function markWeeklyReflectionViewed(userId: string, weekKey = getISOWeekKey(new Date())) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ last_reflection_viewed_week: weekKey })
      .eq("user_id", userId);
    if (error) throw error;
    return weekKey;
  } catch (error: any) {
    if (isMissingColumn(error, "last_reflection_viewed_week")) {
      return null;
    }
    throw error;
  }
}

export async function ensureDefaultHabits(userId: string) {
  const { data, error } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) return;

  const inserts = DEFAULT_HABITS.map((title, idx) => ({
    user_id: userId,
    title,
    active: true,
    sort_order: idx,
  }));
  const { data: insertedRows, error: insertError } = await supabase
    .from("habits")
    .insert(inserts)
    .select("id, title");
  if (insertError) throw insertError;

  if (Array.isArray(insertedRows) && insertedRows.length > 0) {
    await Promise.allSettled(
      insertedRows.map((row: any) =>
        logTaskCreated({
          category: "habit",
          meta: {
            source: "default_habits_seed",
            habit_id: row?.id ?? null,
            title: row?.title ?? null,
          },
        })
      )
    );
  }
}

export async function fetchHabitsWithCompletions(userId: string, dateKey = todayKey()) {
  await ensureDefaultHabits(userId);
  let habits: any[] | null = null;
  try {
    const { data, error: habitError } = await supabase
      .from("habits")
      .select("id, title, active, sort_order")
      .eq("user_id", userId)
      .eq("active", true)
      .order("sort_order")
      .order("created_at");
    if (habitError) throw habitError;
    habits = data;
  } catch (error: any) {
    if (!isMissingCreatedAt(error)) throw error;
    const { data, error: fallbackError } = await supabase
      .from("habits")
      .select("id, title, active, sort_order")
      .eq("user_id", userId)
      .eq("active", true)
      .order("sort_order")
      .order("id");
    if (fallbackError) throw fallbackError;
    habits = data;
  }

  const { data: completions, error: completionError } = await supabase
    .from("habit_completions")
    .select("habit_id, completed")
    .eq("user_id", userId)
    .eq("date", dateKey);
  if (completionError) throw completionError;

  const completedMap = new Map<number, boolean>();
  (completions || []).forEach((row) => completedMap.set(row.habit_id, !!row.completed));
  const localHabitTitles = await getHabits();

  return (habits || []).map((habit, index) => ({
    ...habit,
    title: localHabitTitles[index] ?? habit.title,
    completed: completedMap.get(habit.id) || false,
  })) as Habit[];
}

export async function setHabitCompletion(userId: string, habitId: number, completed: boolean, dateKey = todayKey()) {
  const payload = {
    user_id: userId,
    habit_id: habitId,
    date: dateKey,
    completed,
  };
  const { error } = await supabase
    .from("habit_completions")
    .upsert(payload, { onConflict: "user_id,habit_id,date" });
  if (error) throw error;
}

function isConsecutiveDay(previousDate: string | null, dateKey: string) {
  if (!previousDate) return false;
  return previousDate === yesterdayKey() && dateKey === todayKey();
}

function hasMissedDay(previousDate: string | null) {
  if (!previousDate) return false;
  const prev = new Date(previousDate);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return prev < new Date(todayKey(yesterday));
}

export async function syncStatsAndUnlocks(options: {
  userId: string;
  dateKey: string;
  hasCompletedDay: boolean;
  moodScore: number | null;
  habitCompletionRate: number;
}) {
  const { userId, dateKey, hasCompletedDay, moodScore, habitCompletionRate } = options;
  const currentStats = await ensureUserStats(userId);
  let nextStreak = currentStats.streak ?? 0;
  let nextLastCompleted = currentStats.last_completed_date;

  if (hasCompletedDay) {
    if (currentStats.last_completed_date === dateKey) {
      // Today already counted; a re-save (editing the check-in, toggling a habit) must not reset it (R-25).
      nextStreak = Math.max(1, nextStreak);
    } else if (isConsecutiveDay(currentStats.last_completed_date, dateKey)) {
      nextStreak = nextStreak + 1;
    } else {
      nextStreak = 1;
    }
    nextLastCompleted = dateKey;
  } else if (hasMissedDay(currentStats.last_completed_date)) {
    nextStreak = 0;
  }

  const pet_mood_state = determinePetMood(moodScore, habitCompletionRate);

  const { error: updateError } = await supabase
    .from("user_stats")
    .update({
      streak: nextStreak,
      last_completed_date: nextLastCompleted,
      pet_mood_state,
    })
    .eq("user_id", userId);
  if (updateError) throw updateError;

  return { streak: nextStreak, last_completed_date: nextLastCompleted, pet_mood_state, unlock: null };
}

async function maybeUnlockGardenItem(userId: string, streak: number) {
  if (streak < STREAK_UNLOCK_INTERVAL) return null;
  const expectedUnlocks = Math.floor(streak / STREAK_UNLOCK_INTERVAL);

  const { data: existingUnlocks, error: unlockError } = await supabase
    .from("garden_unlocks")
    .select("item_id")
    .eq("user_id", userId);
  if (unlockError) {
    logGardenUnlocksQueryError("maybeUnlockGardenItem.select_existing", unlockError);
    throw unlockError;
  }
  const unlockedIds = new Set((existingUnlocks || []).map((row) => row.item_id));
  if (unlockedIds.size >= expectedUnlocks) return null;

  const { data: items, error: itemsError } = await supabase
    .from("garden_items")
    .select("*")
    .order("tier")
    .order("id");
  if (itemsError) throw itemsError;

  const nextItem = (items || []).find((item) => !unlockedIds.has(item.id));
  if (!nextItem) return null;

  const { error: insertError, data } = await supabase
    .from("garden_unlocks")
    .insert({
      user_id: userId,
      item_id: nextItem.id,
      streak_at_unlock: streak,
    })
    .select("*")
    .single();
  if (insertError) {
    logGardenUnlocksQueryError("maybeUnlockGardenItem.insert_unlock", insertError);
    throw insertError;
  }

  return { ...data, item: nextItem };
}

export function isDayComplete(checkIn: CheckIn | null, habits: Habit[]) {
  const completed = habits.filter((h) => h.completed).length;
  return !!checkIn && completed >= HABIT_COMPLETION_THRESHOLD;
}

export async function getGardenProgress(userId: string) {
  try {
    const { data, error } = await supabase
      .from("garden_unlocks")
      .select("item_id, streak_at_unlock, unlocked_at, garden_items!inner(id, name, tier)")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false });
    if (error) throw error;
    return { rows: data || [], fallback: false };
  } catch (error: any) {
    logGardenUnlocksQueryError("getGardenProgress.primary", error);
    console.warn("GARDEN_PROGRESS_FALLBACK", { message: error?.message });
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("garden_unlocks")
      .select("item_id, unlocked_at, garden_items!inner(id, name, tier)")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false });
    if (!fallbackError) {
      return { rows: fallbackRows || [], fallback: true, warning: error?.message };
    }

    logGardenUnlocksQueryError("getGardenProgress.fallback", fallbackError);
    const { data: safeRows, error: safeError } = await supabase
      .from("garden_unlocks")
      .select("item_id, unlocked_at, streak_at_unlock")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false });
    if (safeError) {
      logGardenUnlocksQueryError("getGardenProgress.safe_fallback", safeError);
      throw safeError;
    }
    return { rows: safeRows || [], fallback: true, warning: error?.message || fallbackError?.message };
  }
}

export async function fetchGardenItems() {
  try {
    const { data, error } = await supabase
      .from("garden_items")
      .select("id, name, tier, required_points")
      .order("tier")
      .order("id");
    if (error) throw error;
    return { rows: data || [], fallback: false as const };
  } catch (error: any) {
    if (!isMissingColumn(error, "required_points")) throw error;
    if (!hasLoggedGardenRequiredPointsFallback) {
      hasLoggedGardenRequiredPointsFallback = true;
      console.warn("GARDEN_SCHEMA_FALLBACK_USED", { reason: "missing required_points" });
    }
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("garden_items")
      .select("id, name, tier")
      .order("tier")
      .order("id");
    if (fallbackError) throw fallbackError;
    return { rows: (fallbackRows || []).map((row: any) => ({ ...row, required_points: null })), fallback: true as const };
  }
}

const unlockInFlight = new Map<string, Promise<any>>();

export async function unlockGardenItem(options: { userId: string; itemId: number | string; streakAtUnlock?: number | null }) {
  const { userId, itemId, streakAtUnlock = null } = options;
  const key = `${userId}:${itemId}`;
  const existing = unlockInFlight.get(key);
  if (existing) return existing;

  const runner = (async () => {
    const payload = { user_id: userId, item_id: itemId, streak_at_unlock: streakAtUnlock };
    const { data, error } = await supabase
      .from("garden_unlocks")
      .upsert(payload, { onConflict: "user_id,item_id" })
      .select("id, item_id, unlocked_at, streak_at_unlock")
      .single();
    if (!error) return data;
    if (!isMissingColumn(error, "streak_at_unlock")) throw error;

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("garden_unlocks")
      .upsert({ user_id: userId, item_id: itemId }, { onConflict: "user_id,item_id" })
      .select("id, item_id, unlocked_at")
      .single();
    if (fallbackError) throw fallbackError;
    return fallbackData;
  })();

  unlockInFlight.set(key, runner);
  try {
    return await runner;
  } finally {
    unlockInFlight.delete(key);
  }
}

export const DAILY_LOOP_CONSTANTS = {
  HABIT_COMPLETION_THRESHOLD,
  STREAK_UNLOCK_INTERVAL,
};
