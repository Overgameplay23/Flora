import { getDefaultCategoriesForSplit } from "../data/exercises";
import type {
  SplitDayDefinition,
  TrainingSplit,
  UserProfile,
  WorkoutDayCategory,
  WorkoutSession,
} from "./types";

const definitionsByCategory: Record<WorkoutDayCategory, SplitDayDefinition> = {
  push: { key: "push", label: "Push", category: "push" },
  pull: { key: "pull", label: "Pull", category: "pull" },
  legs: { key: "legs", label: "Legs", category: "legs" },
  upper: { key: "upper", label: "Upper", category: "upper" },
  lower: { key: "lower", label: "Lower", category: "lower" },
  full_body: { key: "full_body", label: "Full Body", category: "full_body" },
  chest: { key: "chest", label: "Chest", category: "chest" },
  back: { key: "back", label: "Back", category: "back" },
  shoulders: { key: "shoulders", label: "Shoulders", category: "shoulders" },
  arms: { key: "arms", label: "Arms", category: "arms" },
  custom: { key: "custom", label: "Custom", category: "custom" },
};

export function getSplitDayDefinitions(split: TrainingSplit): SplitDayDefinition[] {
  return getDefaultCategoriesForSplit(split).map((category) => definitionsByCategory[category]);
}

export function suggestNextSplitDay(
  split: TrainingSplit,
  recentSessions: Array<Pick<WorkoutSession, "completedAt" | "splitDayKey" | "status">>
) {
  const cycle = getSplitDayDefinitions(split);
  const completed = recentSessions
    .filter((session) => session.status === "completed")
    .sort((left, right) => String(right.completedAt ?? "").localeCompare(String(left.completedAt ?? "")));

  const latest = completed.find((session) => session.splitDayKey);
  if (!latest || !latest.splitDayKey) {
    return cycle[0];
  }

  const currentIndex = cycle.findIndex((day) => day.key === latest.splitDayKey);
  if (currentIndex === -1) return cycle[0];
  return cycle[(currentIndex + 1) % cycle.length];
}

export function buildHomeTrainingSuggestion(
  profile: UserProfile,
  recentSessions: Array<Pick<WorkoutSession, "completedAt" | "splitDayKey" | "status">>
) {
  const nextDay = suggestNextSplitDay(profile.split, recentSessions);
  const lastCompleted = recentSessions
    .filter((session) => session.status === "completed" && session.completedAt)
    .sort((left, right) => String(right.completedAt ?? "").localeCompare(String(left.completedAt ?? "")))[0];

  if (!lastCompleted?.completedAt) {
    return {
      nextDay,
      summary: `Start with ${nextDay.label} to build your baseline training memory.`,
    };
  }

  const lastDate = new Date(lastCompleted.completedAt);
  const daysSince = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000)));

  if (daysSince >= 4) {
    return {
      nextDay,
      summary: `${daysSince} days since your last workout. Resume with ${nextDay.label} and keep the first session clean.`,
    };
  }

  return {
    nextDay,
    summary: `Next up: ${nextDay.label}. Keep the cycle moving while the last session is still fresh.`,
  };
}
