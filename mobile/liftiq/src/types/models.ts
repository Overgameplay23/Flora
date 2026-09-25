export type GoalPhase = 'strength' | 'hypertrophy' | 'comeback' | 'consistency';
export type TrainingAge = 'beginner' | 'intermediate' | 'advanced';
export type TrainingSplit = 'push-pull-legs' | 'upper-lower' | 'full-body' | 'bro-split' | 'custom';
export type UnitSystem = 'lb' | 'kg';
export type SorenessLevel = 'low' | 'medium' | 'high';
export type SessionOutcome = 'better' | 'normal' | 'worse';
export type SessionStatus = 'draft' | 'active' | 'completed';
export type ExerciseCategory = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'conditioning' | 'other';
export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'ez-bar' | 'smith' | 'other';
export type ReadinessSignal = 'same' | 'harder' | 'easier';

export interface UserProfile {
  id: string;
  onboardingComplete: boolean;
  goalPhase: GoalPhase;
  trainingAge: TrainingAge;
  trainingSplit: TrainingSplit;
  unitSystem: UnitSystem;
  preferredEquipment: EquipmentType[];
  importInterest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  equipment: EquipmentType;
  primaryMuscles: string[];
  isCompound: boolean;
  source: 'seed' | 'custom';
  externalSource?: string | null;
  externalId?: string | null;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  split: TrainingSplit;
  dayLabel: string;
  exerciseIds: string[];
  source: 'seed' | 'custom';
}

export interface SetEntry {
  id: string;
  completedReps: number;
  weight: number;
  restSeconds: number;
  plannedRepMin?: number | null;
  plannedRepMax?: number | null;
  rpe?: number | null;
  completedAt: string;
}

export interface ExercisePerformanceSnapshot {
  lastWeight: number | null;
  lastReps: number | null;
  bestWeight: number | null;
  bestEstimated1RM: number | null;
  recentSignals: ReadinessSignal[];
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  targetRepMin: number;
  targetRepMax: number;
  restSeconds: number;
  notes?: string;
  setEntries: SetEntry[];
  performance: ExercisePerformanceSnapshot;
  source: 'template' | 'manual';
  externalSource?: string | null;
  externalId?: string | null;
}

export interface ReadinessSnapshot {
  sleep: number;
  energy: number;
  soreness: SorenessLevel;
  painArea?: string;
}

export interface SessionNotes {
  effort: number;
  outcome: SessionOutcome;
  cueThatWorked?: string;
  freeText?: string;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  label: string;
  value: number;
  achievedAt: string;
  sessionId: string;
}

export interface SessionRecap {
  id: string;
  sessionId: string;
  summary: string;
  actionableTakeaway: string;
  prFlags: string[];
  stalledLiftFlags: string[];
  evidence: string[];
  generatedAt: string;
  provider: 'device-fallback' | 'supabase-edge';
}

export interface WorkoutSession {
  id: string;
  templateId?: string | null;
  title: string;
  dayLabel: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string | null;
  totalDurationSeconds: number;
  syncStatus: 'local-only' | 'pending' | 'synced';
  readiness?: ReadinessSnapshot;
  notes?: SessionNotes;
  recap?: SessionRecap;
  exercises: SessionExercise[];
  source: 'manual' | 'template';
  externalSource?: string | null;
  externalId?: string | null;
}

export interface AppState {
  hydrated: boolean;
  profile: UserProfile | null;
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  recentPrs: PersonalRecord[];
  authMode: 'apple' | 'magic-link' | 'anonymous';
}

