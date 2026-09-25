// What playing with the pet leaves behind: local best scores and "played today", plus a task so play
// counts toward the garden through the same atomic RPC as every other daily action.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { getLocalDateKey } from "../utils/dateKeys";
import { completeTaskWithResilience } from "../services/taskCompletion";
import { applySession, isPlayTask, normalizePlayStats, playTaskTitle, type GameId, type PlayStats } from "./playStatsLogic";

export * from "./playStatsLogic";

const key = (userId: string) => `floura:play:${userId}`;
const EMPTY: PlayStats = { best: {}, sessions: 0, lastPlayedDay: null, sessionsToday: 0 };

export async function loadPlayStats(userId: string | null | undefined): Promise<PlayStats> {
  if (!userId) return { ...EMPTY };
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return normalizePlayStats(raw ? JSON.parse(raw) : null, getLocalDateKey());
  } catch {
    return { ...EMPTY };
  }
}

export async function savePlayStats(userId: string, stats: PlayStats) {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(stats));
  } catch {}
}

/** Finds the user's play task, if they made one. */
export async function findPlayTask(userId: string): Promise<{ id: number | string; title: string } | null> {
  const { data, error } = await supabase.from("tasks").select("id,title").eq("user_id", userId).eq("active", true);
  if (error) throw error;
  const row = (data || []).find((task: any) => isPlayTask(task.title));
  return row ? { id: row.id, title: row.title } : null;
}

/** Creates the play task (a normal daily task, 2 pts by default) so playtime shows up on Home. */
export async function createPlayTask(userId: string, petName: string) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, title: playTaskTitle(petName), sort_order: 99 })
    .select("id,title")
    .single();
  if (error) throw error;
  return data as { id: number | string; title: string };
}

/**
 * Records a finished session: local stats, a `pet_played` event for the activity log, and, if the person
 * has a play task, completes it for today through complete_task (points for the garden).
 */
export async function recordPlaySession(options: { userId: string | null | undefined; game: GameId; score: number }) {
  const { userId, game, score } = options;
  const today = getLocalDateKey();
  if (!userId) return { stats: applySession({ ...EMPTY }, game, score, today).stats, bestBeaten: false, taskCompleted: false, pointsAwarded: 0 };
  const current = await loadPlayStats(userId);
  const { stats, bestBeaten } = applySession(current, game, score, today);
  await savePlayStats(userId, stats);

  let taskCompleted = false;
  let pointsAwarded = 0;
  try {
    const task = await findPlayTask(userId);
    if (task) {
      const mutation = await completeTaskWithResilience({ taskId: task.id, eventMeta: { category: "play", points: null } });
      if (mutation.state === "success" && mutation.result.inserted) {
        taskCompleted = true;
        pointsAwarded = mutation.result.points_awarded;
      }
    }
  } catch (error) {
    console.warn("PLAY_TASK_COMPLETE_FAILED", (error as any)?.message || String(error));
  }

  try {
    await supabase.rpc("log_event_and_rollup", {
      p_event_type: "pet_played",
      p_occurred_at: new Date().toISOString(),
      p_task_id: null,
      p_category: game,
      p_difficulty: null,
      p_points: null,
      p_meta: { game, score, best_beaten: bestBeaten },
    });
  } catch (error) {
    console.warn("PLAY_EVENT_LOG_FAILED", (error as any)?.message || String(error));
  }

  return { stats, bestBeaten, taskCompleted, pointsAwarded };
}
