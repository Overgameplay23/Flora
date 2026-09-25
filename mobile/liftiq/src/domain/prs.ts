import { exerciseCatalogById } from "../data/exercises";
import type {
  ExercisePerformanceSnapshot,
  PersonalRecordFlag,
  SetEntry,
  WorkoutExercise,
} from "./types";

const EMPTY_PR_HISTORY = 0;

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function getCompletedSets(sets: SetEntry[]) {
  return sets.filter((set) => set.completed !== false);
}

export function calculateEstimatedOneRepMax(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return roundToTenths(weight);
  return roundToTenths(weight * (1 + Math.min(reps, 12) / 30));
}

export function calculateSetVolume(set: SetEntry) {
  return roundToTenths(Math.max(0, set.weight) * Math.max(0, set.reps));
}

export function summarizeExercisePerformance(
  exercise: WorkoutExercise,
  performedAt: string
): ExercisePerformanceSnapshot | null {
  const completedSets = getCompletedSets(exercise.sets);
  const exerciseId = exercise.exerciseId;
  if (!exerciseId || completedSets.length === 0) return null;

  const entry = exerciseCatalogById[exerciseId];
  const exerciseName = entry?.name ?? exercise.customExerciseName ?? "Custom exercise";

  const topWeight = Math.max(...completedSets.map((set) => set.weight));
  const topWeightSets = completedSets.filter((set) => set.weight === topWeight);
  const topRepsAtTopWeight = Math.max(...topWeightSets.map((set) => set.reps));
  const bestEstimatedOneRepMax = Math.max(
    ...completedSets.map((set) => calculateEstimatedOneRepMax(set.weight, set.reps))
  );
  const missedTargetSets = completedSets.filter((set) => {
    if (set.targetRepsMin == null) return false;
    return set.reps < set.targetRepsMin;
  }).length;

  const targetSource = completedSets.find(
    (set) => set.targetRepsMin != null || set.targetRepsMax != null
  );

  return {
    exerciseId,
    exerciseName,
    performedAt,
    setCount: exercise.sets.length,
    completedSets: completedSets.length,
    missedTargetSets,
    topWeight,
    topRepsAtTopWeight,
    bestEstimatedOneRepMax,
    totalVolume: roundToTenths(completedSets.reduce((sum, set) => sum + calculateSetVolume(set), 0)),
    targetRepRange:
      targetSource && (targetSource.targetRepsMin != null || targetSource.targetRepsMax != null)
        ? {
            min: targetSource.targetRepsMin ?? targetSource.targetRepsMax ?? 0,
            max: targetSource.targetRepsMax ?? targetSource.targetRepsMin ?? 0,
          }
        : null,
  };
}

function getPreviousBest(
  history: ExercisePerformanceSnapshot[],
  selector: (item: ExercisePerformanceSnapshot) => number
) {
  if (history.length === 0) return EMPTY_PR_HISTORY;
  return Math.max(...history.map(selector));
}

export function detectExercisePrs(
  current: ExercisePerformanceSnapshot,
  history: ExercisePerformanceSnapshot[],
  unitLabel: string
): PersonalRecordFlag[] {
  const flags: PersonalRecordFlag[] = [];

  const previousWeight = getPreviousBest(history, (item) => item.topWeight);
  if (current.topWeight > previousWeight) {
    flags.push({
      type: "heaviest_weight",
      exerciseId: current.exerciseId,
      exerciseName: current.exerciseName,
      currentValue: current.topWeight,
      previousBest: previousWeight,
      unitLabel,
      detail:
        previousWeight > 0
          ? `Heaviest set moved from ${previousWeight}${unitLabel} to ${current.topWeight}${unitLabel}.`
          : `First logged top set at ${current.topWeight}${unitLabel}.`,
    });
  }

  const previousRepMax = getPreviousBest(history, (item) => item.topRepsAtTopWeight);
  if (current.topRepsAtTopWeight > previousRepMax) {
    flags.push({
      type: "rep_max",
      exerciseId: current.exerciseId,
      exerciseName: current.exerciseName,
      currentValue: current.topRepsAtTopWeight,
      previousBest: previousRepMax,
      unitLabel: " reps",
      detail:
        previousRepMax > 0
          ? `Top set reps improved from ${previousRepMax} to ${current.topRepsAtTopWeight} at the same or heavier load.`
          : `First rep benchmark logged at ${current.topRepsAtTopWeight} reps.`,
    });
  }

  const previousE1rm = getPreviousBest(history, (item) => item.bestEstimatedOneRepMax);
  if (current.bestEstimatedOneRepMax > previousE1rm) {
    flags.push({
      type: "estimated_1rm",
      exerciseId: current.exerciseId,
      exerciseName: current.exerciseName,
      currentValue: current.bestEstimatedOneRepMax,
      previousBest: previousE1rm,
      unitLabel,
      detail:
        previousE1rm > 0
          ? `Estimated 1RM improved from ${previousE1rm}${unitLabel} to ${current.bestEstimatedOneRepMax}${unitLabel}.`
          : `Estimated 1RM baseline set at ${current.bestEstimatedOneRepMax}${unitLabel}.`,
    });
  }

  const previousVolume = getPreviousBest(history, (item) => item.totalVolume);
  if (current.totalVolume > previousVolume) {
    flags.push({
      type: "session_volume",
      exerciseId: current.exerciseId,
      exerciseName: current.exerciseName,
      currentValue: current.totalVolume,
      previousBest: previousVolume,
      unitLabel,
      detail:
        previousVolume > 0
          ? `Total volume improved from ${previousVolume}${unitLabel} to ${current.totalVolume}${unitLabel}.`
          : `First volume benchmark logged at ${current.totalVolume}${unitLabel}.`,
    });
  }

  return flags;
}
