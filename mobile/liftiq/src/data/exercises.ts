import type {
  ExerciseCatalogEntry,
  TrainingSplit,
  WorkoutDayCategory,
} from "../domain/types";

const catalog = [
  {
    id: "barbell-bench-press",
    name: "Barbell Bench Press",
    aliases: ["bench", "bb bench", "flat bench", "bench press"],
    equipment: "barbell",
    progressionTier: "barbell_upper",
    priority: "compound",
    movementPattern: "push",
    primaryMuscles: ["chest", "triceps", "front_delts"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 5, max: 8 },
    restSeconds: { strength: 180, hypertrophy: 120, comeback: 90, consistency: 105 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    aliases: ["incline db press", "incline dumbbell bench", "idbp"],
    equipment: "dumbbell",
    progressionTier: "dumbbell",
    priority: "secondary",
    movementPattern: "push",
    primaryMuscles: ["chest", "front_delts", "triceps"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 120, hypertrophy: 90, comeback: 75, consistency: 90 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "standing-overhead-press",
    name: "Standing Overhead Press",
    aliases: ["ohp", "military press", "barbell shoulder press"],
    equipment: "barbell",
    progressionTier: "barbell_upper",
    priority: "compound",
    movementPattern: "push",
    primaryMuscles: ["shoulders", "triceps", "front_delts"],
    secondaryMuscles: ["core"],
    defaultRepRange: { min: 5, max: 8 },
    restSeconds: { strength: 180, hypertrophy: 120, comeback: 90, consistency: 105 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "machine-chest-press",
    name: "Machine Chest Press",
    aliases: ["chest press machine", "plate chest press"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "secondary",
    movementPattern: "push",
    primaryMuscles: ["chest", "triceps", "front_delts"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 120, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "dumbbell-lateral-raise",
    name: "Dumbbell Lateral Raise",
    aliases: ["lat raise", "db lateral", "side raise"],
    equipment: "dumbbell",
    progressionTier: "accessory",
    priority: "isolation",
    movementPattern: "shoulders",
    primaryMuscles: ["side_delts"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 12, max: 18 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable-triceps-pushdown",
    name: "Cable Triceps Pushdown",
    aliases: ["pushdown", "rope pushdown", "tricep pushdown"],
    equipment: "cable",
    progressionTier: "cable",
    priority: "isolation",
    movementPattern: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "weighted-dip",
    name: "Weighted Dip",
    aliases: ["dips", "dip", "bodyweight dip"],
    equipment: "bodyweight_loadable",
    progressionTier: "bodyweight_loadable",
    priority: "compound",
    movementPattern: "push",
    primaryMuscles: ["chest", "triceps", "front_delts"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 6, max: 10 },
    restSeconds: { strength: 150, hypertrophy: 105, comeback: 90, consistency: 105 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    aliases: ["squat", "bb squat", "high bar squat", "low bar squat"],
    equipment: "barbell",
    progressionTier: "barbell_lower",
    priority: "compound",
    movementPattern: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "core", "adductors"],
    defaultRepRange: { min: 4, max: 8 },
    restSeconds: { strength: 210, hypertrophy: 150, comeback: 120, consistency: 135 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    aliases: ["rdl", "bb rdl", "romanian dl"],
    equipment: "barbell",
    progressionTier: "barbell_lower",
    priority: "compound",
    movementPattern: "legs",
    primaryMuscles: ["hamstrings", "glutes", "lower_back"],
    secondaryMuscles: ["core"],
    defaultRepRange: { min: 6, max: 10 },
    restSeconds: { strength: 180, hypertrophy: 120, comeback: 105, consistency: 120 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "leg-press",
    name: "Leg Press",
    aliases: ["sled press", "45 leg press"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "secondary",
    movementPattern: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 150, hypertrophy: 90, comeback: 75, consistency: 90 },
    defaultIncrementLb: 20,
    defaultIncrementKg: 10,
  },
  {
    id: "walking-lunge",
    name: "Walking Lunge",
    aliases: ["lunges", "db lunge", "walking db lunge"],
    equipment: "dumbbell",
    progressionTier: "dumbbell",
    priority: "secondary",
    movementPattern: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    defaultRepRange: { min: 10, max: 16 },
    restSeconds: { strength: 120, hypertrophy: 90, comeback: 75, consistency: 90 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    aliases: ["extensions", "quad extension"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "isolation",
    movementPattern: "legs",
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
    defaultRepRange: { min: 12, max: 18 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "seated-leg-curl",
    name: "Seated Leg Curl",
    aliases: ["leg curl", "ham curl", "seated ham curl"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "isolation",
    movementPattern: "legs",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["calves"],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "conventional-deadlift",
    name: "Conventional Deadlift",
    aliases: ["deadlift", "dl", "barbell deadlift"],
    equipment: "barbell",
    progressionTier: "barbell_lower",
    priority: "compound",
    movementPattern: "pull",
    primaryMuscles: ["hamstrings", "glutes", "lower_back", "traps"],
    secondaryMuscles: ["lats", "core"],
    defaultRepRange: { min: 3, max: 6 },
    restSeconds: { strength: 210, hypertrophy: 150, comeback: 120, consistency: 135 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "barbell-row",
    name: "Barbell Row",
    aliases: ["bb row", "bent row", "bent over row"],
    equipment: "barbell",
    progressionTier: "barbell_upper",
    priority: "compound",
    movementPattern: "pull",
    primaryMuscles: ["back", "lats", "rear_delts"],
    secondaryMuscles: ["biceps", "traps"],
    defaultRepRange: { min: 6, max: 10 },
    restSeconds: { strength: 150, hypertrophy: 105, comeback: 90, consistency: 105 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    aliases: ["pulldown", "wide pulldown", "lat pull"],
    equipment: "cable",
    progressionTier: "cable",
    priority: "secondary",
    movementPattern: "pull",
    primaryMuscles: ["lats", "back"],
    secondaryMuscles: ["biceps", "rear_delts"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 105, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "weighted-pull-up",
    name: "Weighted Pull-Up",
    aliases: ["pullup", "pull up", "bodyweight pullup"],
    equipment: "bodyweight_loadable",
    progressionTier: "bodyweight_loadable",
    priority: "compound",
    movementPattern: "pull",
    primaryMuscles: ["lats", "back", "biceps"],
    secondaryMuscles: ["core", "rear_delts"],
    defaultRepRange: { min: 5, max: 8 },
    restSeconds: { strength: 150, hypertrophy: 105, comeback: 90, consistency: 105 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    aliases: ["cable row", "close grip row", "seated row"],
    equipment: "cable",
    progressionTier: "cable",
    priority: "secondary",
    movementPattern: "pull",
    primaryMuscles: ["back", "lats"],
    secondaryMuscles: ["biceps", "rear_delts"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 105, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "face-pull",
    name: "Face Pull",
    aliases: ["rope face pull", "rear delt cable fly"],
    equipment: "cable",
    progressionTier: "cable",
    priority: "isolation",
    movementPattern: "shoulders",
    primaryMuscles: ["rear_delts", "traps"],
    secondaryMuscles: ["back"],
    defaultRepRange: { min: 12, max: 18 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "ez-bar-curl",
    name: "EZ-Bar Curl",
    aliases: ["ez curl", "curl", "bar curl"],
    equipment: "ez_bar",
    progressionTier: "accessory",
    priority: "isolation",
    movementPattern: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "incline-dumbbell-curl",
    name: "Incline Dumbbell Curl",
    aliases: ["incline curl", "db incline curl"],
    equipment: "dumbbell",
    progressionTier: "accessory",
    priority: "isolation",
    movementPattern: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 75, hypertrophy: 60, comeback: 45, consistency: 60 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "hack-squat",
    name: "Hack Squat",
    aliases: ["plate hack squat", "hack machine"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "secondary",
    movementPattern: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 150, hypertrophy: 90, comeback: 75, consistency: 90 },
    defaultIncrementLb: 20,
    defaultIncrementKg: 10,
  },
  {
    id: "hip-thrust",
    name: "Barbell Hip Thrust",
    aliases: ["hip thrust", "bb hip thrust", "glute thrust"],
    equipment: "barbell",
    progressionTier: "barbell_lower",
    priority: "secondary",
    movementPattern: "legs",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    defaultRepRange: { min: 6, max: 10 },
    restSeconds: { strength: 150, hypertrophy: 105, comeback: 90, consistency: 105 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    aliases: ["db goblet squat", "goblet"],
    equipment: "dumbbell",
    progressionTier: "dumbbell",
    priority: "secondary",
    movementPattern: "legs",
    primaryMuscles: ["quads", "glutes", "core"],
    secondaryMuscles: ["adductors"],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 90, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "plank",
    name: "Plank",
    aliases: ["front plank", "body plank"],
    equipment: "bodyweight",
    progressionTier: "bodyweight",
    priority: "isolation",
    movementPattern: "full_body",
    primaryMuscles: ["core"],
    secondaryMuscles: ["shoulders"],
    defaultRepRange: { min: 1, max: 1 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 0,
    defaultIncrementKg: 0,
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    aliases: ["leg raise", "hanging abs", "toes to bar"],
    equipment: "bodyweight",
    progressionTier: "bodyweight",
    priority: "isolation",
    movementPattern: "full_body",
    primaryMuscles: ["core"],
    secondaryMuscles: ["hip_flexors"],
    defaultRepRange: { min: 8, max: 15 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 0,
    defaultIncrementKg: 0,
  },
  {
    id: "chest-supported-row",
    name: "Chest-Supported Row",
    aliases: ["supported row", "seal row", "machine supported row"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "secondary",
    movementPattern: "pull",
    primaryMuscles: ["back", "lats"],
    secondaryMuscles: ["rear_delts", "biceps"],
    defaultRepRange: { min: 8, max: 12 },
    restSeconds: { strength: 105, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "pec-deck-fly",
    name: "Pec Deck Fly",
    aliases: ["machine fly", "pec deck", "chest fly machine"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "isolation",
    movementPattern: "push",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts"],
    defaultRepRange: { min: 12, max: 18 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "rear-delt-fly",
    name: "Rear Delt Fly",
    aliases: ["reverse pec deck", "rear delt machine", "reverse fly"],
    equipment: "machine",
    progressionTier: "machine",
    priority: "isolation",
    movementPattern: "shoulders",
    primaryMuscles: ["rear_delts"],
    secondaryMuscles: ["traps"],
    defaultRepRange: { min: 12, max: 18 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 10,
    defaultIncrementKg: 5,
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl",
    aliases: ["db hammer curl", "hammer curls"],
    equipment: "dumbbell",
    progressionTier: "accessory",
    priority: "isolation",
    movementPattern: "arms",
    primaryMuscles: ["biceps", "forearms"],
    secondaryMuscles: [],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "overhead-triceps-extension",
    name: "Overhead Triceps Extension",
    aliases: ["overhead tricep extension", "db overhead tri ext", "cable overhead triceps"],
    equipment: "cable",
    progressionTier: "cable",
    priority: "isolation",
    movementPattern: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    defaultRepRange: { min: 10, max: 15 },
    restSeconds: { strength: 60, hypertrophy: 45, comeback: 45, consistency: 45 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
  {
    id: "farmers-carry",
    name: "Farmer's Carry",
    aliases: ["farmers walk", "loaded carry"],
    equipment: "dumbbell",
    progressionTier: "dumbbell",
    priority: "secondary",
    movementPattern: "full_body",
    primaryMuscles: ["traps", "core", "forearms"],
    secondaryMuscles: ["glutes"],
    defaultRepRange: { min: 1, max: 1 },
    restSeconds: { strength: 90, hypertrophy: 75, comeback: 60, consistency: 75 },
    defaultIncrementLb: 5,
    defaultIncrementKg: 2.5,
  },
] satisfies ExerciseCatalogEntry[];

export const exerciseCatalog = catalog;

export const exerciseCatalogById = Object.fromEntries(
  exerciseCatalog.map((exercise) => [exercise.id, exercise])
) as Record<string, ExerciseCatalogEntry>;

const aliasEntries = exerciseCatalog.flatMap((exercise) => {
  const keys = [exercise.name, ...exercise.aliases].map((value) => value.trim().toLowerCase());
  return keys.map((key) => [key, exercise.id] as const);
});

export const exerciseAliasIndex = new Map<string, string>(aliasEntries);

const splitDefaults: Record<TrainingSplit, WorkoutDayCategory[]> = {
  push_pull_legs: ["push", "pull", "legs"],
  upper_lower: ["upper", "lower"],
  full_body: ["full_body"],
  bro_split: ["chest", "back", "legs", "shoulders", "arms"],
  custom: ["custom"],
};

export function getDefaultCategoriesForSplit(split: TrainingSplit) {
  return splitDefaults[split];
}

function scoreExercise(
  exercise: ExerciseCatalogEntry,
  query: string,
  recentExerciseIds: string[],
  frequentExerciseIds: string[]
) {
  const normalized = query.trim().toLowerCase();
  let score = 0;

  if (!normalized) score += 1;

  const exactAlias = [exercise.name, ...exercise.aliases].some(
    (entry) => entry.toLowerCase() === normalized
  );
  if (exactAlias) score += 100;

  if (exercise.name.toLowerCase().startsWith(normalized)) score += 40;
  if (exercise.name.toLowerCase().includes(normalized)) score += 20;

  for (const alias of exercise.aliases) {
    const normalizedAlias = alias.toLowerCase();
    if (normalizedAlias.startsWith(normalized)) score += 25;
    else if (normalizedAlias.includes(normalized)) score += 12;
  }

  if (recentExerciseIds.includes(exercise.id)) score += 10;
  if (frequentExerciseIds.includes(exercise.id)) score += 6;

  return score;
}

export function searchExerciseCatalog(
  query: string,
  options?: {
    recentExerciseIds?: string[];
    frequentExerciseIds?: string[];
    limit?: number;
  }
) {
  const recentExerciseIds = options?.recentExerciseIds ?? [];
  const frequentExerciseIds = options?.frequentExerciseIds ?? [];
  const limit = options?.limit ?? 20;
  const normalized = query.trim().toLowerCase();

  const ranked = exerciseCatalog
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, normalized, recentExerciseIds, frequentExerciseIds),
    }))
    .filter(({ exercise, score }) => {
      return (
        score > 0 ||
        normalized.length === 0 ||
        exercise.movementPattern.includes(normalized)
      );
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.exercise.name.localeCompare(right.exercise.name);
    });

  return ranked.slice(0, limit).map(({ exercise }) => exercise);
}

export function lookupExerciseByAlias(query: string) {
  const key = query.trim().toLowerCase();
  const id = exerciseAliasIndex.get(key);
  return id ? exerciseCatalogById[id] ?? null : null;
}
