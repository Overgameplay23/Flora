import type { Exercise, PersonalRecord, ReadinessSignal, SessionExercise, SessionRecap, TrainingSplit, UserProfile, WorkoutSession } from '@/types/models';

const upperCategories = new Set(['chest', 'back', 'shoulders', 'arms']);

export function estimateOneRepMax(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function calculateSessionVolume(session: WorkoutSession) {
  return session.exercises.reduce((sessionTotal, exercise) => {
    return sessionTotal + exercise.setEntries.reduce((exerciseTotal, set) => exerciseTotal + set.weight * set.completedReps, 0);
  }, 0);
}

export function buildPerformanceSnapshot(exerciseId: string, sessions: WorkoutSession[]) {
  const matchingSets = sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => session.exercises.filter((exercise) => exercise.exerciseId === exerciseId))
    .flatMap((exercise) => exercise.setEntries);

  if (matchingSets.length === 0) {
    return {
      lastWeight: null,
      lastReps: null,
      bestWeight: null,
      bestEstimated1RM: null,
      recentSignals: [] as ReadinessSignal[],
    };
  }

  const lastSet = matchingSets[matchingSets.length - 1];
  const bestWeight = Math.max(...matchingSets.map((set) => set.weight));
  const bestEstimated1RM = Math.max(...matchingSets.map((set) => estimateOneRepMax(set.weight, set.completedReps)));

  return {
    lastWeight: lastSet.weight,
    lastReps: lastSet.completedReps,
    bestWeight,
    bestEstimated1RM,
    recentSignals: [] as ReadinessSignal[],
  };
}

export function recommendationIncrement(exercise: Exercise) {
  if (exercise.equipment === 'barbell') {
    return upperCategories.has(exercise.category) ? 5 : 10;
  }
  if (exercise.equipment === 'dumbbell') {
    return 5;
  }
  if (exercise.equipment === 'machine' || exercise.equipment === 'cable') {
    return 5;
  }
  return 0;
}

export function buildNextTarget(exercise: Exercise, sessionExercise: SessionExercise, signal: ReadinessSignal = 'same') {
  const lastSet = sessionExercise.setEntries[sessionExercise.setEntries.length - 1];
  const baseWeight = lastSet?.weight ?? sessionExercise.performance.lastWeight ?? 0;
  const baseReps = lastSet?.completedReps ?? sessionExercise.performance.lastReps ?? sessionExercise.targetRepMin;
  const increment = recommendationIncrement(exercise);
  const cleanTopSet = baseReps >= sessionExercise.targetRepMax;
  const clearMiss = baseReps < sessionExercise.targetRepMin;

  let nextWeight = baseWeight;
  if (signal === 'harder') {
    nextWeight = Math.max(0, baseWeight - Math.max(2.5, increment / 2));
  } else if (signal === 'easier') {
    nextWeight = baseWeight + Math.max(2.5, increment / 2);
  } else if (cleanTopSet) {
    nextWeight = baseWeight + increment;
  } else if (clearMiss) {
    nextWeight = Math.max(0, baseWeight - Math.max(2.5, increment / 2));
  }

  return {
    nextWeight,
    targetReps: `${sessionExercise.targetRepMin}-${sessionExercise.targetRepMax}`,
    cue: cleanTopSet
      ? 'You cleared the target. Add a small jump.'
      : clearMiss
        ? 'Stay patient. Match the range before pushing.'
        : 'Match the last set cleanly, then progress.',
  };
}

export function detectSessionPrs(session: WorkoutSession, exercises: Exercise[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  session.exercises.forEach((exercise) => {
    const topSet = [...exercise.setEntries].sort((a, b) => estimateOneRepMax(b.weight, b.completedReps) - estimateOneRepMax(a.weight, a.completedReps))[0];
    if (!topSet) return;
    const catalogExercise = exercises.find((item) => item.id === exercise.exerciseId);
    if (!catalogExercise) return;
    records.push({
      id: `${session.id}-${exercise.id}`,
      exerciseId: exercise.exerciseId,
      label: `${catalogExercise.name} est. 1RM`,
      value: estimateOneRepMax(topSet.weight, topSet.completedReps),
      achievedAt: topSet.completedAt,
      sessionId: session.id,
    });
  });
  return records;
}

export function buildFallbackRecap(session: WorkoutSession, exercises: Exercise[], previousSessions: WorkoutSession[]): SessionRecap {
  const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.setEntries.length, 0);
  const totalVolume = calculateSessionVolume(session);
  const prs = detectSessionPrs(session, exercises);
  const previousVolume = previousSessions[0] ? calculateSessionVolume(previousSessions[0]) : 0;
  const delta = totalVolume - previousVolume;
  const recapSummary = prs.length > 0
    ? `You stacked ${totalSets} sets and set ${prs.length} fresh performance marker${prs.length === 1 ? '' : 's'}.`
    : `You logged ${totalSets} clean working sets and kept the session moving.`;

  const evidence = [
    `${Math.round(totalVolume)} total lb-reps of volume logged.`,
    delta === 0 ? 'Volume matched your last comparable session.' : `${delta > 0 ? '+' : ''}${Math.round(delta)} lb-reps versus your latest session.`,
  ];

  const takeaway = session.notes?.outcome === 'worse'
    ? 'Keep the same loads next time and chase cleaner reps.'
    : session.notes?.outcome === 'better'
      ? 'Take the next small jump on your first compound lift.'
      : 'Repeat the same flow once more before adding volume.';

  return {
    id: `${session.id}-recap`,
    sessionId: session.id,
    summary: recapSummary,
    actionableTakeaway: takeaway,
    prFlags: prs.map((pr) => pr.label),
    stalledLiftFlags: [],
    evidence,
    generatedAt: new Date().toISOString(),
    provider: 'device-fallback',
  };
}

export function searchExercises(query: string, exercises: Exercise[], recentExerciseIds: string[]) {
  const normalized = query.trim().toLowerCase();
  return [...exercises].sort((a, b) => {
    const aRecent = recentExerciseIds.indexOf(a.id);
    const bRecent = recentExerciseIds.indexOf(b.id);
    const aScore = scoreExercise(a, normalized, aRecent);
    const bScore = scoreExercise(b, normalized, bRecent);
    return bScore - aScore || a.name.localeCompare(b.name);
  });
}

function scoreExercise(exercise: Exercise, query: string, recentIndex: number) {
  let score = recentIndex >= 0 ? Math.max(0, 100 - recentIndex * 4) : 0;
  if (!query) return score;
  if (exercise.name.toLowerCase() === query) score += 1000;
  if (exercise.name.toLowerCase().startsWith(query)) score += 300;
  if (exercise.name.toLowerCase().includes(query)) score += 180;
  if (exercise.aliases.some((alias) => alias.toLowerCase() === query)) score += 260;
  if (exercise.aliases.some((alias) => alias.toLowerCase().includes(query))) score += 140;
  return score;
}

export function inferNextTrainingDay(profile: UserProfile | null, sessions: WorkoutSession[]) {
  if (!profile) return 'Finish onboarding to unlock your next session.';
  const completed = sessions.filter((session) => session.status === 'completed');
  const rotations: Record<TrainingSplit, string[]> = {
    'push-pull-legs': ['Push', 'Pull', 'Legs'],
    'upper-lower': ['Upper', 'Lower'],
    'full-body': ['Full Body'],
    'bro-split': ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
    custom: ['Custom Day'],
  };
  const rotation = rotations[profile.trainingSplit];
  const last = completed[0]?.dayLabel;
  if (!last) return `Suggested next session: ${rotation[0]}`;
  const idx = rotation.indexOf(last);
  const next = idx >= 0 ? rotation[(idx + 1) % rotation.length] : rotation[0];
  return `Suggested next session: ${next}`;
}

export function recentExerciseIdsFromSessions(sessions: WorkoutSession[]) {
  return sessions
    .flatMap((session) => session.exercises)
    .map((exercise) => exercise.exerciseId)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 10);
}
