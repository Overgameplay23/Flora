import { exerciseCatalogById } from "../data/exercises";
import { summarizeExercisePerformance } from "./prs";
import type {
  ExerciseCatalogEntry,
  ExercisePerformanceSnapshot,
  GoalPhase,
  ProgressionRecommendation,
  ReadinessAdjustment,
  RepRange,
  SetEntry,
  UnitSystem,
  WorkoutExercise,
} from "./types";

interface RecommendationInput {
  exerciseId: string;
  unitSystem: UnitSystem;
  goalPhase: GoalPhase;
  currentSet?: SetEntry | null;
  currentWorkoutExercise?: WorkoutExercise | null;
  readinessAdjustment?: ReadinessAdjustment;
  priorSnapshots?: ExercisePerformanceSnapshot[];
}

function roundToSupportedIncrement(value: number, increment: number) {
  if (increment <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / increment) * increment;
}

function defaultRestSeconds(exercise: ExerciseCatalogEntry, goalPhase: GoalPhase) {
  return exercise.restSeconds[goalPhase];
}

function defaultRepRange(exercise: ExerciseCatalogEntry) {
  return exercise.defaultRepRange;
}

function getIncrement(exercise: ExerciseCatalogEntry, unitSystem: UnitSystem) {
  return unitSystem === "kg" ? exercise.defaultIncrementKg : exercise.defaultIncrementLb;
}

function pickTargetRepRange(
  exercise: ExerciseCatalogEntry,
  latestSnapshot?: ExercisePerformanceSnapshot | null
): RepRange {
  if (latestSnapshot?.targetRepRange) {
    return latestSnapshot.targetRepRange;
  }
  return defaultRepRange(exercise);
}

function getComparableSnapshots(history: ExercisePerformanceSnapshot[]) {
  return [...history]
    .filter((snapshot) => snapshot.setCount > 0)
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt))
    .slice(0, 3);
}

function didLatestSessionClearTarget(snapshot: ExercisePerformanceSnapshot | null) {
  if (!snapshot) return false;
  if (!snapshot.targetRepRange) return snapshot.missedTargetSets === 0;
  return snapshot.missedTargetSets === 0 && snapshot.topRepsAtTopWeight >= snapshot.targetRepRange.max;
}

function countConsecutiveMisses(history: ExercisePerformanceSnapshot[]) {
  let streak = 0;
  for (const snapshot of getComparableSnapshots(history)) {
    if (snapshot.missedTargetSets > 0) streak += 1;
    else break;
  }
  return streak;
}

function deriveBaselineWeight(
  currentSet: SetEntry | null | undefined,
  currentWorkoutExercise: WorkoutExercise | null | undefined,
  latestSnapshot: ExercisePerformanceSnapshot | null
) {
  if (currentSet?.weight != null && currentSet.weight > 0) return currentSet.weight;
  if (currentWorkoutExercise) {
    const workingSets = currentWorkoutExercise.sets.filter((set) => set.completed !== false);
    if (workingSets.length > 0) {
      return workingSets[workingSets.length - 1].weight;
    }
  }
  return latestSnapshot?.topWeight ?? 0;
}

export function recommendNextSetTarget({
  exerciseId,
  unitSystem,
  goalPhase,
  currentSet,
  currentWorkoutExercise,
  readinessAdjustment = "same",
  priorSnapshots = [],
}: RecommendationInput): ProgressionRecommendation {
  const exercise = exerciseCatalogById[exerciseId];
  if (!exercise) {
    return {
      action: "discover",
      suggestedWeight: currentSet?.weight ?? null,
      repTarget: {
        min: currentSet?.targetRepsMin ?? 8,
        max: currentSet?.targetRepsMax ?? 12,
      },
      restSeconds: 90,
      rationale: "Use the first session to find a repeatable starting point for this custom movement.",
      confidence: "low",
    };
  }

  const comparable = getComparableSnapshots(priorSnapshots);
  const latest = comparable[0] ?? null;
  const baselineWeight = deriveBaselineWeight(currentSet, currentWorkoutExercise, latest);
  const increment = getIncrement(exercise, unitSystem);
  const repTarget = pickTargetRepRange(exercise, latest);
  const consecutiveMisses = countConsecutiveMisses(priorSnapshots);
  const clearedTarget = didLatestSessionClearTarget(latest);
  const restSeconds = defaultRestSeconds(exercise, goalPhase);

  if (baselineWeight <= 0) {
    return {
      action: "discover",
      suggestedWeight: null,
      repTarget,
      restSeconds,
      rationale: "No prior load is stored yet. Start with a conservative working weight and use this session as the baseline.",
      confidence: "low",
    };
  }

  if (consecutiveMisses >= 2) {
    const suggestedWeight = Math.max(0, roundToSupportedIncrement(baselineWeight - increment, increment));
    return {
      action: "decrease",
      suggestedWeight,
      repTarget,
      restSeconds,
      rationale: "Two straight misses means the current load is too sticky. Back off one increment and rebuild clean reps.",
      confidence: "high",
    };
  }

  if (readinessAdjustment === "harder") {
    const action = latest?.missedTargetSets ? "decrease" : "hold";
    const suggestedWeight =
      action === "decrease"
        ? Math.max(0, roundToSupportedIncrement(baselineWeight - increment, increment))
        : baselineWeight;
    return {
      action,
      suggestedWeight,
      repTarget,
      restSeconds: Math.round(restSeconds * 1.1),
      rationale: "Today reads harder than normal. Protect the session quality, keep the reps honest, and buy a little more rest.",
      confidence: latest ? "medium" : "low",
    };
  }

  if (clearedTarget) {
    const suggestedWeight = roundToSupportedIncrement(baselineWeight + increment, increment);
    return {
      action: "increase",
      suggestedWeight,
      repTarget,
      restSeconds,
      rationale:
        readinessAdjustment === "easier"
          ? "You cleared the range and the set felt easier than usual. Add one clean increment."
          : "You cleared the top of the range last time. Move up one increment and keep the rep target steady.",
      confidence: comparable.length >= 2 ? "high" : "medium",
    };
  }

  return {
    action: latest?.missedTargetSets ? "repeat" : "hold",
    suggestedWeight: baselineWeight,
    repTarget,
    restSeconds,
    rationale:
      latest?.missedTargetSets
        ? "Repeat the load and own the rep target before progressing."
        : "Stay at the current load until the top of the range is clearly repeatable.",
    confidence: comparable.length >= 2 ? "medium" : "low",
  };
}

export function buildExerciseHistoryFromSessions(
  exerciseId: string,
  exercises: Array<{ performedAt: string; exercise: WorkoutExercise }>
) {
  return exercises
    .map(({ performedAt, exercise }) => summarizeExercisePerformance(exercise, performedAt))
    .filter((snapshot): snapshot is ExercisePerformanceSnapshot => {
      return snapshot != null && snapshot.exerciseId === exerciseId;
    })
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt));
}
