import { supabase } from "../lib/supabase";

/**
 * Days Together: every day the person showed up (a task or a check-in), counted over all time. It only
 * ever goes up, which is the point: the headline number on Home never resets (docs/streaks, "Days
 * Together"). Reads the owner-only daily_user_metrics rollup; null when it cannot be read.
 */
export async function fetchDaysTogether(userId: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("daily_user_metrics")
      .select("day", { count: "exact", head: true })
      .eq("user_id", userId)
      .or("tasks_completed.gt.0,checkins_completed.gt.0");
    if (error) throw error;
    return typeof count === "number" ? count : null;
  } catch (error: any) {
    console.warn("DAYS_TOGETHER_LOAD_ERROR", error?.message || String(error));
    return null;
  }
}
