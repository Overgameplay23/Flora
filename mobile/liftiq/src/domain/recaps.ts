import { detectExercisePrs, summarizeExercisePerformance } from "./prs";
import type {
  ExercisePerformanceSnapshot,
  PersonalRecordFlag,
  ReadinessSnapshot,
  SessionRecap,
  StalledLiftFlag,
  UnitSystem,
  WorkoutSession,
} from "./types";

function unitLabel(unitSystem: UnitSystem) {
  return unitSystem === "kg" ? "kg" : "lb";
}

function totalSets(session: WorkoutSession) {
  return session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

function totalVolume(session: WorkoutSession) {
  return Math.round(
    session.exercises.reduce(
      (sum, exercise) =>
        sum +
        exercise.sets.reduce(
          (exerciseSum, set) => exerciseSum + Math.max(0, set.weight) * Math.max(0, set.reps),
          0
        ),
      0
    ) * 10
  ) / 10;
}

function detectStalledLifts(
  currentSnapshots: ExercisePerformanceSnapshot[],
  historyByExerciseId: Record<string, ExercisePerformanceSnapshot[]>,
  readiness?: ReadinessSnapshot | null
) {
  const stalled: StalledLiftFlag[] = [];

  for (const snapshot of currentSnapshots) {
    const history = (historyByExerciseId[snapshot.exerciseId] ?? [])
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))
      .slice(0, 2);

    const repeatedMisses = history.length >= 2 && history.every((entry) => entry.missedTargetSets > 0);
    if (repeatedMisses || snapshot.missedTargetSets >= 2) {
      stalled.push({
        exerciseId: snapshot.exerciseId,
        exerciseName: snapshot.exerciseName,
        reason: "repeat_miss",
        detail: `${snapshot.exerciseName} has repeated missed target reps. Hold or reduce load before chasing more weight.`,
      });
      continue;
    }

    const priorBestE1rm = history.length > 0 ? Math.max(...history.map((entry) => entry.bestEstimatedOneRepMax)) : 0;
    if (priorBestE1rm > 0 && snapshot.bestEstimatedOneRepMax < priorBestE1rm * 0.97) {
      stalled.push({
        exerciseId: snapshot.exerciseId,
        exerciseName: snapshot.exerciseName,
        reason: readiness && (readiness.sleep <= 2 || readiness.energy <= 2)
          ? "readiness_drag"
          : "performance_drop",
        detail:
          readiness && (readiness.sleep <= 2 || readiness.energy <= 2)
            ? `${snapshot.exerciseName} dipped while readiness was low. Match volume next time and avoid forcing a PR.`
            : `${snapshot.exerciseName} trended below recent performance. Repeat the load until the reps are consistent again.`,
      });
    }
  }

  return stalled;
}

function buildSummary(
  session: WorkoutSession,
  prs: PersonalRecordFlag[],
  stalledFlags: StalledLiftFlag[],
  volume: number,
  unitSystem: UnitSystem
) {
  const completedExerciseCount = session.exercises.filter((exercise) => exercise.sets.length > 0).length;
  const unit = unitLabel(unitSystem);

  if (prs.length > 0) {
    const lead = prs[0];
    return `You moved through ${completedExerciseCount} exercises for ${volume}${unit} of total volume and hit ${prs.length} PR${prs.length === 1 ? "" : "s"}, led by ${lead.exerciseName}.`;
  }

  if (stalledFlags.length > 0) {
    return `You completed ${completedExerciseCount} exercises and banked ${volume}${unit} of work. The main friction showed up on ${stalledFlags[0].exerciseName}, so the next session should favor repeatable execution over chasing load.`;
  }

  if (session.readiness && (session.readiness.sleep <= 2 || session.readiness.energy <= 2)) {
    return `You still completed ${completedExerciseCount} exercises for ${volume}${unit} despite lower readiness. That is a useful baseline, not a session to judge too harshly.`;
  }

  return `You logged ${completedExerciseCount} exercises and ${volume}${unit} of total work. The session stayed on plan, which is exactly what builds training memory.`;
}

function buildTakeaway(
  session: WorkoutSession,
  prs: PersonalRecordFlag[],
  stalledFlags: StalledLiftFlag[]
) {
  if (prs.length > 0) {
    return "Keep the split the same next time and add only one clean increment on the lifts that cleared the top of the target range.";
  }

  if (stalledFlags.some((flag) => flag.reason === "repeat_miss")) {
    return "Repeat the sticky lift at the same load or one step down until every work set lands inside the target reps.";
  }

  if (session.readiness && (session.readiness.sleep <= 2 || session.readiness.energy <= 2)) {
    return "Treat the next workout as a normal rebound session: match compound volume, extend rest slightly, and do not force a PR.";
  }

  if (session.postSession?.outcome === "worse" || (session.postSession?.effort ?? 0) >= 9) {
    return "Hold the main loads steady next session and earn progression by making the same work feel cleaner, not harder.";
  }

  return "Keep the next workout boring on purpose: same template, same rep targets, and only progress where the last session was clearly repeatable.";
}

export function generateFallbackSessionRecap(options: {
  session: WorkoutSession;
  historyByExerciseId?: Record<string, ExercisePerformanceSnapshot[]>;
  unitSystem?: UnitSystem;
}): SessionRecap {
  const historyByExerciseId = options.historyByExerciseId ?? {};
  const unitSystem = options.unitSystem ?? "lb";
  const unit = unitLabel(unitSystem);

  const currentSnapshots = options.session.exercises
    .map((exercise) =>
      summarizeExercisePerformance(
        exercise,
        options.session.completedAt ?? options.session.startedAt
      )
    )
    .filter((snapshot): snapshot is ExercisePerformanceSnapshot => snapshot != null);

  const prFlags = currentSnapshots.flatMap((snapshot) =>
    detectExercisePrs(snapshot, historyByExerciseId[snapshot.exerciseId] ?? [], unit)
  );
  const stalledLiftFlags = detectStalledLifts(currentSnapshots, historyByExerciseId, options.session.readiness);

  const comparableSessionDates = Array.from(
    new Set(
      Object.values(historyByExerciseId)
        .flat()
        .map((snapshot) => snapshot.performedAt)
    )
  )
    .sort((left, right) => right.localeCompare(left))
    .slice(0, 5);

  const evidence = {
    totalSets: totalSets(options.session),
    totalVolume: totalVolume(options.session),
    readiness: options.session.readiness ?? null,
    comparableSessionCount: comparableSessionDates.length,
    comparableExerciseDates: comparableSessionDates,
  };

  return {
    summary: buildSummary(options.session, prFlags, stalledLiftFlags, evidence.totalVolume, unitSystem),
    actionableTakeaway: buildTakeaway(options.session, prFlags, stalledLiftFlags),
    prFlags,
    stalledLiftFlags,
    evidence,
  };
}

