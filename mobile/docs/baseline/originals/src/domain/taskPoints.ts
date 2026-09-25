type TaskLike = {
  id?: string | number | null;
  type?: string | null;
  difficulty?: string | null;
  category?: string | null;
  frequency?: string | null;
  title?: string | null;
  points?: number | null;
};

const DEFAULT_TASK_POINTS = 2;
const HARD_TASK_POINTS = 3;
const HARD_KEYWORDS = ["hard", "long", "focus", "session", "outside", "sunlight", "workout", "deep"];

export function getTaskPoints(task: TaskLike): number {
  const explicitPoints = Number(task?.points);
  if (Number.isFinite(explicitPoints)) {
    return Math.max(1, Math.round(explicitPoints));
  }

  const parts = [task?.type, task?.difficulty, task?.category, task?.frequency, task?.title]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value).toLowerCase());
  const summary = parts.join(" ");
  const isHard = HARD_KEYWORDS.some((keyword) => summary.includes(keyword));

  return isHard ? HARD_TASK_POINTS : DEFAULT_TASK_POINTS;
}
