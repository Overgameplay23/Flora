import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { requestSessionRecap } from '@/services/sessionRecap';
import { countPendingMutations, enqueueMutation, loadSnapshot, saveSnapshot } from '@/storage/localDatabase';
import { seedExercises, seedTemplates } from '@/state/seed';
import type {
  AppState,
  Exercise,
  PersonalRecord,
  ReadinessSignal,
  ReadinessSnapshot,
  SessionNotes,
  UserProfile,
  WorkoutSession,
} from '@/types/models';
import { generateId } from '@/utils/ids';
import {
  buildNextTarget,
  buildPerformanceSnapshot,
  buildFallbackRecap,
  detectSessionPrs,
} from '@/utils/workouts';

interface AppContextValue {
  state: AppState;
  activeSession: WorkoutSession | null;
  latestRecap: WorkoutSession['recap'] | null;
  pendingMutationCount: number;
  actions: {
    completeOnboarding: (input: Pick<UserProfile, 'goalPhase' | 'trainingAge' | 'trainingSplit' | 'unitSystem' | 'preferredEquipment'>) => Promise<void>;
    toggleImportInterest: () => Promise<void>;
    setAuthMode: (mode: AppState['authMode']) => Promise<void>;
    startWorkout: (templateId?: string) => Promise<void>;
    addExerciseToActiveSession: (exerciseId: string) => Promise<void>;
    createCustomExercise: (name: string) => Promise<Exercise | null>;
    moveExercise: (sessionExerciseId: string, direction: 'up' | 'down') => Promise<void>;
    saveSet: (sessionExerciseId: string, payload: { weight: number; reps: number; readinessSignal: ReadinessSignal }) => Promise<void>;
    setSessionReadiness: (readiness: ReadinessSnapshot) => Promise<void>;
    finishActiveSession: (notes: SessionNotes) => Promise<void>;
  };
}

type Action =
  | { type: 'hydrate'; payload: AppState }
  | { type: 'upsert-profile'; payload: UserProfile }
  | { type: 'toggle-import-interest' }
  | { type: 'set-auth-mode'; payload: AppState['authMode'] }
  | { type: 'start-session'; payload: WorkoutSession }
  | { type: 'upsert-exercise'; payload: Exercise }
  | { type: 'replace-session'; payload: WorkoutSession }
  | { type: 'set-recent-prs'; payload: PersonalRecord[] };

const AppContext = createContext<AppContextValue | null>(null);

function initialState(): AppState {
  return {
    hydrated: false,
    profile: null,
    exercises: seedExercises,
    templates: seedTemplates,
    sessions: [],
    activeSessionId: null,
    recentPrs: [],
    authMode: 'anonymous',
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.payload;
    case 'upsert-profile':
      return { ...state, profile: action.payload };
    case 'toggle-import-interest':
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          importInterest: !state.profile.importInterest,
          updatedAt: new Date().toISOString(),
        },
      };
    case 'set-auth-mode':
      return { ...state, authMode: action.payload };
    case 'start-session':
      return {
        ...state,
        activeSessionId: action.payload.id,
        sessions: [action.payload, ...state.sessions.filter((session) => session.id !== action.payload.id)],
      };
    case 'upsert-exercise':
      return {
        ...state,
        exercises: [...state.exercises.filter((exercise) => exercise.id !== action.payload.id), action.payload].sort((a, b) => a.name.localeCompare(b.name)),
      };
    case 'replace-session':
      return {
        ...state,
        activeSessionId: action.payload.status === 'completed' ? null : action.payload.id,
        sessions: [action.payload, ...state.sessions.filter((session) => session.id !== action.payload.id)],
      };
    case 'set-recent-prs':
      return { ...state, recentPrs: action.payload };
    default:
      return state;
  }
}

function normalizeHydratedState(snapshot: AppState | null): AppState {
  const base = initialState();
  if (!snapshot) return { ...base, hydrated: true };
  return {
    ...base,
    ...snapshot,
    hydrated: true,
    exercises: snapshot.exercises?.length ? snapshot.exercises : base.exercises,
    templates: snapshot.templates?.length ? snapshot.templates : base.templates,
    sessions: snapshot.sessions ?? [],
    recentPrs: snapshot.recentPrs ?? [],
  };
}

function exercisePrescription(exercise: Exercise) {
  if (exercise.isCompound) {
    return {
      targetRepMin: exercise.category === 'legs' ? 5 : 6,
      targetRepMax: exercise.category === 'legs' ? 8 : 8,
      restSeconds: exercise.category === 'legs' ? 150 : 120,
    };
  }
  return {
    targetRepMin: 8,
    targetRepMax: 12,
    restSeconds: 75,
  };
}

function buildSessionExercise(exercise: Exercise, index: number, previousSessions: WorkoutSession[]) {
  const prescription = exercisePrescription(exercise);
  return {
    id: generateId('session-exercise'),
    exerciseId: exercise.id,
    orderIndex: index,
    targetRepMin: prescription.targetRepMin,
    targetRepMax: prescription.targetRepMax,
    restSeconds: prescription.restSeconds,
    setEntries: [],
    performance: buildPerformanceSnapshot(exercise.id, previousSessions),
    source: 'template' as const,
  };
}

function mergePersonalRecords(existing: PersonalRecord[], incoming: PersonalRecord[]) {
  return [...incoming, ...existing]
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
    .filter((record, index, arr) => arr.findIndex((candidate) => candidate.label === record.label && candidate.value === record.value) === index)
    .slice(0, 12);
}

export function AppProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snapshot = await loadSnapshot(db);
      if (cancelled) return;
      dispatch({ type: 'hydrate', payload: normalizeHydratedState(snapshot) });
      setPendingMutationCount(await countPendingMutations(db));
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!state.hydrated) return;
    void saveSnapshot(db, state);
  }, [db, state]);

  const activeSession = useMemo(
    () => state.sessions.find((session) => session.id === state.activeSessionId) ?? null,
    [state.activeSessionId, state.sessions],
  );

  const latestRecap = useMemo(() => state.sessions.find((session) => session.recap)?.recap ?? null, [state.sessions]);

  const actions = useMemo<AppContextValue['actions']>(() => ({
    async completeOnboarding(input) {
      const nextProfile: UserProfile = {
        id: generateId('profile'),
        onboardingComplete: true,
        goalPhase: input.goalPhase,
        trainingAge: input.trainingAge,
        trainingSplit: input.trainingSplit,
        unitSystem: input.unitSystem,
        preferredEquipment: input.preferredEquipment,
        importInterest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'upsert-profile', payload: nextProfile });
      await enqueueMutation(db, 'profile_upsert', nextProfile);
      setPendingMutationCount(await countPendingMutations(db));
    },

    async toggleImportInterest() {
      dispatch({ type: 'toggle-import-interest' });
      const current = stateRef.current.profile;
      if (current) {
        await enqueueMutation(db, 'profile_import_interest', { importInterest: !current.importInterest });
        setPendingMutationCount(await countPendingMutations(db));
      }
    },

    async setAuthMode(mode) {
      dispatch({ type: 'set-auth-mode', payload: mode });
    },

    async startWorkout(templateId) {
      const current = stateRef.current;
      const profile = current.profile;
      const template = current.templates.find((item) => item.id === templateId)
        ?? current.templates.find((item) => item.split === profile?.trainingSplit)
        ?? current.templates[0];
      if (!template) return;

      const exercises = template.exerciseIds
        .map((exerciseId) => current.exercises.find((exercise) => exercise.id === exerciseId))
        .filter(Boolean)
        .map((exercise, index) => buildSessionExercise(exercise as Exercise, index, current.sessions));

      const session: WorkoutSession = {
        id: generateId('session'),
        templateId: template.id,
        title: template.name,
        dayLabel: template.dayLabel,
        status: 'active',
        startedAt: new Date().toISOString(),
        totalDurationSeconds: 0,
        syncStatus: 'pending',
        exercises,
        source: 'template',
      };
      dispatch({ type: 'start-session', payload: session });
      await enqueueMutation(db, 'session_started', { sessionId: session.id, templateId: template.id });
      setPendingMutationCount(await countPendingMutations(db));
    },

    async addExerciseToActiveSession(exerciseId) {
      const current = stateRef.current;
      const active = current.sessions.find((session) => session.id === current.activeSessionId);
      const exercise = current.exercises.find((item) => item.id === exerciseId);
      if (!active || !exercise) return;
      const nextSession: WorkoutSession = {
        ...active,
        exercises: [
          ...active.exercises,
          buildSessionExercise(exercise, active.exercises.length, current.sessions.filter((session) => session.id !== active.id)),
        ],
      };
      dispatch({ type: 'replace-session', payload: nextSession });
    },

    async createCustomExercise(name) {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const exercise: Exercise = {
        id: generateId('custom-exercise'),
        name: trimmed,
        aliases: [trimmed.toLowerCase()],
        category: 'other',
        equipment: 'other',
        primaryMuscles: [],
        isCompound: false,
        source: 'custom',
      };
      dispatch({ type: 'upsert-exercise', payload: exercise });
      await enqueueMutation(db, 'exercise_upsert', exercise);
      setPendingMutationCount(await countPendingMutations(db));
      return exercise;
    },

    async moveExercise(sessionExerciseId, direction) {
      const current = stateRef.current;
      const active = current.sessions.find((session) => session.id === current.activeSessionId);
      if (!active) return;
      const index = active.exercises.findIndex((exercise) => exercise.id === sessionExerciseId);
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= active.exercises.length) return;
      const exercises = [...active.exercises];
      const [moved] = exercises.splice(index, 1);
      exercises.splice(targetIndex, 0, moved);
      const nextSession: WorkoutSession = {
        ...active,
        exercises: exercises.map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
      };
      dispatch({ type: 'replace-session', payload: nextSession });
    },

    async saveSet(sessionExerciseId, payload) {
      const current = stateRef.current;
      const active = current.sessions.find((session) => session.id === current.activeSessionId);
      if (!active) return;

      const nextSession: WorkoutSession = {
        ...active,
        exercises: active.exercises.map((exercise) => {
          if (exercise.id !== sessionExerciseId) return exercise;
          const nextSet = {
            id: generateId('set'),
            completedReps: payload.reps,
            weight: payload.weight,
            restSeconds: exercise.restSeconds,
            plannedRepMin: exercise.targetRepMin,
            plannedRepMax: exercise.targetRepMax,
            completedAt: new Date().toISOString(),
          };
          return {
            ...exercise,
            setEntries: [...exercise.setEntries, nextSet],
            performance: {
              ...exercise.performance,
              lastWeight: nextSet.weight,
              lastReps: nextSet.completedReps,
              bestWeight: Math.max(exercise.performance.bestWeight ?? 0, nextSet.weight),
              bestEstimated1RM: Math.max(exercise.performance.bestEstimated1RM ?? 0, nextSet.weight * (1 + nextSet.completedReps / 30)),
              recentSignals: [...exercise.performance.recentSignals, payload.readinessSignal].slice(-3),
            },
          };
        }),
      };

      dispatch({ type: 'replace-session', payload: nextSession });
      await enqueueMutation(db, 'set_logged', { sessionId: active.id, sessionExerciseId, payload });
      setPendingMutationCount(await countPendingMutations(db));
    },

    async setSessionReadiness(readiness) {
      const current = stateRef.current;
      const active = current.sessions.find((session) => session.id === current.activeSessionId);
      if (!active) return;
      dispatch({ type: 'replace-session', payload: { ...active, readiness } });
    },

    async finishActiveSession(notes) {
      const current = stateRef.current;
      const active = current.sessions.find((session) => session.id === current.activeSessionId);
      if (!active) return;

      const endedAt = new Date().toISOString();
      const durationSeconds = Math.max(60, Math.round((new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 1000));
      const provisional: WorkoutSession = {
        ...active,
        status: 'completed',
        endedAt,
        totalDurationSeconds: durationSeconds,
        notes,
        syncStatus: 'pending',
      };

      const comparableSessions = current.sessions.filter((session) => session.id !== active.id && session.dayLabel === active.dayLabel).slice(0, 5);
      const recap = await requestSessionRecap(provisional, current.exercises, comparableSessions);
      const completedSession = { ...provisional, recap };
      const prs = mergePersonalRecords(current.recentPrs, detectSessionPrs(completedSession, current.exercises));

      dispatch({ type: 'replace-session', payload: completedSession });
      dispatch({ type: 'set-recent-prs', payload: prs });
      await enqueueMutation(db, 'session_completed', { sessionId: completedSession.id, recapProvider: recap.provider });
      setPendingMutationCount(await countPendingMutations(db));
    },
  }), [db]);

  const value = useMemo<AppContextValue>(() => ({
    state,
    activeSession,
    latestRecap,
    pendingMutationCount,
    actions,
  }), [actions, activeSession, latestRecap, pendingMutationCount, state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}

export function useExerciseById(exerciseId: string) {
  const { state } = useApp();
  return state.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

export function useNextTarget(sessionExerciseId: string) {
  const { state, activeSession } = useApp();
  const sessionExercise = activeSession?.exercises.find((exercise) => exercise.id === sessionExerciseId);
  const exercise = state.exercises.find((item) => item.id === sessionExercise?.exerciseId);
  if (!sessionExercise || !exercise) {
    return { nextWeight: 0, targetReps: '0-0', cue: 'Pick an exercise to get started.' };
  }
  const latestSignal = sessionExercise.performance.recentSignals[sessionExercise.performance.recentSignals.length - 1] ?? 'same';
  return buildNextTarget(exercise, sessionExercise, latestSignal);
}

