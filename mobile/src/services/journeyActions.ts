// Completing a journey step: the day's task goes through the same tasks row and complete_task as any
// other care task (Sprouts, history and the offline queue unchanged); only the arc itself is kept on the
// device (journeyStore). Shared by Home and the Journey screen.
import { catalogById } from "../domain/plan/catalog";
import { ensurePlanTaskRows } from "./planStore";
import { completeTaskWithResilience } from "./taskCompletion";

export type JourneyStepOutcome =
  | { state: "success"; points: number; inserted: boolean }
  | { state: "queued" }
  | { state: "no_row" };

/**
 * Makes sure the task has a row and completes it. "no_row" means the row could not be made (offline before
 * the task ever had one, or the pet's name is still unknown for a {pet} title); the caller decides whether
 * to mark the step anyway.
 */
export async function completeJourneyTask(userId: string, taskId: string, petName: string, petKnown: boolean): Promise<JourneyStepOutcome> {
  const task = catalogById(taskId);
  if (!task) return { state: "no_row" };
  if (!petKnown && task.title.includes("{pet}")) return { state: "no_row" };
  const ids = await ensurePlanTaskRows(userId, [task], petName);
  const rowId = ids[task.id];
  if (rowId == null) return { state: "no_row" };
  const mutation = await completeTaskWithResilience({
    taskId: rowId,
    eventMeta: { category: task.category === "cycle" ? null : task.category, difficulty: task.effort, points: null },
  });
  if (mutation.state === "queued") return { state: "queued" };
  return { state: "success", points: mutation.result.points_awarded, inserted: mutation.result.inserted };
}
