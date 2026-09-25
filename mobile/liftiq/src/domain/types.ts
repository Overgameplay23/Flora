export type GoalPhase = "strength" | "hypertrophy" | "comeback" | "consistency";

export type TrainingAge = "beginner" | "intermediate" | "advanced";

export type TrainingSplit =
  | "push_pull_legs"
  | "upper_lower"
  | "full_body"
  | "bro_split"
  | "custom";

export type UnitSystem = "lb" | "kg";

export type WorkoutSessionStatus = "active" | "completed" | "discarded";

export type SorenessLevel = "low" | "medium" | "high";

export type ReadinessAdjustment = "same" | "harder" | "easier";

export type SessionOutcome = "better" | "normal" | "worse";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "bodyweight_loadable"
  | "smith_machine"
  | "ez_bar"
  | "kettlebell"
  | "band"
  | "other";

export type MuscleGroup =
  | "chest"
  | "back"
  | "lats"
  | "shoulders"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "traps"
  | "adductors"
  | "lower_back"
  | "upper_back"
  | "hip_flexors";

export type ProgressionTier =
  | "barbell_upper"
  | "barbell_lower"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "bodyweight_loadable"
  | "accessory";

export type ExercisePriority = "compound" | "secondary" | "isolation";

export type WorkoutDayCategory =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "custom";

export type PersonalRecordType =
  | "heaviest_weight"
  | "rep_max"
  | "estimated_1rm"
  | "session_volume";

export type RecommendationAction = "increase" | "hold" | "decrease" | "repeat" | "discover";

export interface RepRange {
  min: number;
  max: number;
}

export interface RestProfile {
  strength: number;
  hypertrophy: number;
  comeback: number;
  consistency: number;
}

export interface ExerciseCatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  equipment: EquipmentType;
  progressionTier: ProgressionTier;
  priority: ExercisePriority;
  movementPattern: WorkoutDayCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  defaultRepRange: RepRange;
  restSeconds: RestProfile;
  defaultIncrementLb: number;
  defaultIncrementKg: number;
}

export interface UserProfile {
  id?: string;
  goalPhase: GoalPhase;
  trainingAge: TrainingAge;
  split: TrainingSplit;
  unitSystem: UnitSystem;
  preferredEquipment: EquipmentType[];
}

export interface ReadinessSnapshot {
  sleep: number;
  energy: number;
  soreness: SorenessLevel;
  painArea?: string | null;
}

export interface SetEntry {
  id?: string;
  setNumber: number;
  weight: number;
  reps: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  restSeconds?: number;
  completed?: boolean;
  rpe?: number | null;
}

export interface WorkoutExercise {
  exerciseId?: string;
  customExerciseName?: string;
  orderIndex: number;
  setType?: "working" | "warmup";
  readinessAdjustment?: ReadinessAdjustment;
  sets: SetEntry[];
}

export interface SessionNotePayload {
  effort: number;
  outcome: SessionOutcome;
  cueThatWorked?: string;
  freeText?: string;
}

export interface WorkoutSession {
  id: string;
  userId?: string;
  title?: string;
  templateId?: string | null;
  splitDayKey?: string | null;
  startedAt: string;
  completedAt?: string | null;
  status: WorkoutSessionStatus;
  readiness?: ReadinessSnapshot | null;
  exercises: WorkoutExercise[];
  postSession?: SessionNotePayload | null;
}

export interface ExercisePerformanceSnapshot {
  exerciseId: string;
  exerciseName: string;
  performedAt: string;
  setCount: number;
  completedSets: number;
  missedTargetSets: number;
  topWeight: number;
  topRepsAtTopWeight: number;
  bestEstimatedOneRepMax: number;
  totalVolume: number;
  targetRepRange: RepRange | null;
}

export interface PersonalRecordFlag {
  type: PersonalRecordType;
  exerciseId: string;
  exerciseName: string;
  currentValue: number;
  previousBest: number;
  unitLabel: string;
  detail: string;
}

export interface StalledLiftFlag {
  exerciseId: string;
  exerciseName: string;
  reason: "repeat_miss" | "readiness_drag" | "performance_drop";
  detail: string;
}

export interface RecapEvidence {
  totalSets: number;
  totalVolume: number;
  readiness?: ReadinessSnapshot | null;
  comparableSessionCount: number;
  comparableExerciseDates: string[];
}

export interface SessionRecap {
  summary: string;
  actionableTakeaway: string;
  prFlags: PersonalRecordFlag[];
  stalledLiftFlags: StalledLiftFlag[];
  evidence: RecapEvidence;
}

export interface ProgressionRecommendation {
  action: RecommendationAction;
  suggestedWeight: number | null;
  repTarget: RepRange;
  restSeconds: number;
  rationale: string;
  confidence: "low" | "medium" | "high";
}

export interface SplitDayDefinition {
  key: string;
  label: string;
  category: WorkoutDayCategory;
}
