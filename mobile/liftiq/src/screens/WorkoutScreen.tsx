import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { MetricPill } from '@/components/MetricPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StepperControl } from '@/components/StepperControl';
import { useApp } from '@/state/AppProvider';
import { spacing } from '@/theme/metrics';
import { palette } from '@/theme/palette';
import type { ReadinessSignal, SessionOutcome, SorenessLevel } from '@/types/models';
import { formatDuration, formatWeight } from '@/utils/format';
import { recentExerciseIdsFromSessions, searchExercises, buildNextTarget } from '@/utils/workouts';

export function WorkoutScreen() {
  const { state, activeSession, actions } = useApp();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [restCountdown, setRestCountdown] = useState(0);
  const [lastLoggedExerciseId, setLastLoggedExerciseId] = useState<string | null>(null);
  const [sleep, setSleep] = useState(activeSession?.readiness?.sleep ?? 3);
  const [energy, setEnergy] = useState(activeSession?.readiness?.energy ?? 3);
  const [soreness, setSoreness] = useState<SorenessLevel>(activeSession?.readiness?.soreness ?? 'medium');
  const [painArea, setPainArea] = useState(activeSession?.readiness?.painArea ?? '');
  const [weight, setWeight] = useState(45);
  const [reps, setReps] = useState(8);
  const [readinessSignal, setReadinessSignal] = useState<ReadinessSignal>('same');
  const [searchQuery, setSearchQuery] = useState('');
  const [effort, setEffort] = useState(7);
  const [outcome, setOutcome] = useState<SessionOutcome>('normal');
  const [cueThatWorked, setCueThatWorked] = useState('');
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    if (!activeSession) {
      setSelectedExerciseId(null);
      return;
    }
    if (!selectedExerciseId || !activeSession.exercises.some((exercise) => exercise.id === selectedExerciseId)) {
      setSelectedExerciseId(activeSession.exercises[0]?.id ?? null);
    }
  }, [activeSession, selectedExerciseId]);

  useEffect(() => {
    if (restCountdown <= 0) return;
    const timer = setInterval(() => {
      setRestCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [restCountdown]);

  const splitTemplates = useMemo(() => {
    if (!state.profile) return state.templates;
    const matching = state.templates.filter((template) => template.split === state.profile?.trainingSplit);
    return matching.length ? matching : state.templates;
  }, [state.profile, state.templates]);

  const selectedSessionExercise = activeSession?.exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null;
  const selectedExercise = state.exercises.find((exercise) => exercise.id === selectedSessionExercise?.exerciseId) ?? null;
  const nextTarget = selectedExercise && selectedSessionExercise
    ? buildNextTarget(selectedExercise, selectedSessionExercise, readinessSignal)
    : { nextWeight: 45, targetReps: '8-10', cue: 'Pick a lift to start logging.' };

  useEffect(() => {
    if (!selectedExercise || !selectedSessionExercise) return;
    setWeight(nextTarget.nextWeight || selectedSessionExercise.performance.lastWeight || 45);
    setReps(selectedSessionExercise.targetRepMax);
  }, [selectedExercise?.id, selectedSessionExercise?.id, selectedSessionExercise?.setEntries.length]);

  const searchResults = useMemo(() => {
    return searchExercises(searchQuery, state.exercises, recentExerciseIdsFromSessions(state.sessions)).slice(0, 6);
  }, [searchQuery, state.exercises, state.sessions]);

  if (!activeSession) {
    return (
      <ScreenShell eyebrow="Workout" title="Start fast." subtitle="Pick the day, accept the template, and get to the first logged set without friction.">
        {splitTemplates.map((template) => (
          <Card key={template.id} title={template.name} subtitle={`${template.exerciseIds.length} lifts • ${template.dayLabel}`}>
            <Text style={styles.templateCopy}>{template.exerciseIds.map((id) => state.exercises.find((exercise) => exercise.id === id)?.name).filter(Boolean).join(' • ')}</Text>
            <PrimaryButton label="Start this workout" onPress={() => actions.startWorkout(template.id)} />
          </Card>
        ))}
        <Card title="Quick start" subtitle="Use the first matching template and edit from there.">
          <PrimaryButton label="Start recommended session" onPress={() => actions.startWorkout()} />
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="Workout" title={activeSession.title} subtitle={`${activeSession.exercises.length} exercises • ${formatDuration(activeSession.totalDurationSeconds || 0)}`}>
      {restCountdown > 0 && lastLoggedExerciseId ? (
        <Card title="Rest timer" subtitle={`${restCountdown}s left`}>
          <Text style={styles.restCopy}>{nextTarget.cue}</Text>
          <View style={styles.metricRow}>
            <MetricPill label="Next target" value={formatWeight(nextTarget.nextWeight, state.profile?.unitSystem ?? 'lb')} tone="warning" />
            <MetricPill label="Rep range" value={nextTarget.targetReps} />
          </View>
          <SegmentedControl
            value={readinessSignal}
            options={[
              { label: 'Same', value: 'same' },
              { label: 'Harder', value: 'harder' },
              { label: 'Easier', value: 'easier' },
            ]}
            onChange={setReadinessSignal}
          />
        </Card>
      ) : null}

      <Card title="Pre-workout readiness" subtitle="Light structure so the recap has context later.">
        <StepperControl label="Sleep" value={sleep} min={1} max={5} onChange={setSleep} />
        <StepperControl label="Energy" value={energy} min={1} max={5} onChange={setEnergy} />
        <SegmentedControl
          value={soreness}
          options={[
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
          ]}
          onChange={setSoreness}
        />
        <TextInput value={painArea} onChangeText={setPainArea} placeholder="Pain area (optional)" placeholderTextColor={palette.muted} style={styles.input} />
        <PrimaryButton label="Save readiness" onPress={() => actions.setSessionReadiness({ sleep, energy, soreness, painArea: painArea || undefined })} />
      </Card>

      <Card title="Session flow" subtitle="Tap an exercise, log the set, let the timer roll.">
        {activeSession.exercises.map((sessionExercise, index) => {
          const exercise = state.exercises.find((item) => item.id === sessionExercise.exerciseId);
          if (!exercise) return null;
          const focused = selectedExerciseId === sessionExercise.id;
          const cardTarget = buildNextTarget(exercise, sessionExercise, readinessSignal);
          return (
            <View key={sessionExercise.id} style={[styles.exerciseRow, focused ? styles.exerciseRowFocused : null]}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseCopy}>
                  <Text style={styles.exerciseName}>{index + 1}. {exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>{sessionExercise.setEntries.length} sets • target {cardTarget.targetReps} • rest {sessionExercise.restSeconds}s</Text>
                </View>
                <PrimaryButton label={focused ? 'Selected' : 'Log'} variant={focused ? 'solid' : 'ghost'} onPress={() => setSelectedExerciseId(sessionExercise.id)} style={styles.smallButton} />
              </View>
              <View style={styles.metricRow}>
                <MetricPill label="Last best" value={sessionExercise.performance.bestWeight ? formatWeight(sessionExercise.performance.bestWeight, state.profile?.unitSystem ?? 'lb') : 'No data'} />
                <MetricPill label="Next" value={formatWeight(cardTarget.nextWeight, state.profile?.unitSystem ?? 'lb')} tone="warning" />
              </View>
              <View style={styles.exerciseButtons}>
                <PrimaryButton label="Up" variant="ghost" onPress={() => actions.moveExercise(sessionExercise.id, 'up')} style={styles.compactAction} />
                <PrimaryButton label="Down" variant="ghost" onPress={() => actions.moveExercise(sessionExercise.id, 'down')} style={styles.compactAction} />
              </View>
            </View>
          );
        })}
      </Card>

      {selectedExercise && selectedSessionExercise ? (
        <Card title={`Log ${selectedExercise.name}`} subtitle={nextTarget.cue}>
          <View style={styles.metricRow}>
            <MetricPill label="Suggested load" value={formatWeight(nextTarget.nextWeight, state.profile?.unitSystem ?? 'lb')} tone="warning" />
            <MetricPill label="Rep target" value={nextTarget.targetReps} />
          </View>
          <StepperControl label={`Weight (${state.profile?.unitSystem ?? 'lb'})`} value={weight} min={0} step={state.profile?.unitSystem === 'kg' ? 2.5 : 5} onChange={setWeight} />
          <StepperControl label="Reps" value={reps} min={1} max={25} onChange={setReps} />
          <SegmentedControl
            value={readinessSignal}
            options={[
              { label: 'Same', value: 'same' },
              { label: 'Harder', value: 'harder' },
              { label: 'Easier', value: 'easier' },
            ]}
            onChange={setReadinessSignal}
          />
          <PrimaryButton
            label="Save set and start timer"
            onPress={async () => {
              await actions.saveSet(selectedSessionExercise.id, { weight, reps, readinessSignal });
              setRestCountdown(selectedSessionExercise.restSeconds);
              setLastLoggedExerciseId(selectedSessionExercise.id);
            }}
          />
        </Card>
      ) : null}

      <Card title="Add an exercise" subtitle="Recent and matching lifts surface first. Create a custom movement if you need one.">
        <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search incline press, pulldown, RDL..." placeholderTextColor={palette.muted} style={styles.input} />
        <View style={styles.searchResults}>
          {searchResults.map((exercise) => (
            <PrimaryButton key={exercise.id} label={`Add ${exercise.name}`} variant="ghost" onPress={() => actions.addExerciseToActiveSession(exercise.id)} />
          ))}
        </View>
        {searchQuery.trim().length > 1 ? (
          <PrimaryButton
            label={`Create custom "${searchQuery.trim()}"`}
            onPress={async () => {
              const created = await actions.createCustomExercise(searchQuery.trim());
              if (created) {
                await actions.addExerciseToActiveSession(created.id);
                setSearchQuery('');
              }
            }}
          />
        ) : null}
      </Card>

      <Card title="Finish session" subtitle="Wrap the workout with just enough context to make the recap useful.">
        <StepperControl label="Overall effort" value={effort} min={1} max={10} onChange={setEffort} />
        <SegmentedControl
          value={outcome}
          options={[
            { label: 'Better', value: 'better' },
            { label: 'Normal', value: 'normal' },
            { label: 'Worse', value: 'worse' },
          ]}
          onChange={setOutcome}
        />
        <TextInput value={cueThatWorked} onChangeText={setCueThatWorked} placeholder="Cue that worked" placeholderTextColor={palette.muted} style={styles.input} />
        <TextInput value={freeText} onChangeText={setFreeText} placeholder="Optional notes" placeholderTextColor={palette.muted} style={[styles.input, styles.textArea]} multiline numberOfLines={4} />
        <PrimaryButton
          label="Finish and generate recap"
          onPress={() => actions.finishActiveSession({
            effort,
            outcome,
            cueThatWorked: cueThatWorked || undefined,
            freeText: freeText || undefined,
          })}
        />
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  templateCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  restCopy: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: palette.ink,
    fontSize: 15,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  exerciseRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  exerciseRowFocused: {
    backgroundColor: '#fff4e3',
    borderRadius: 18,
    padding: spacing.md,
    borderBottomWidth: 0,
  },
  exerciseHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  exerciseCopy: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: palette.muted,
    fontSize: 13,
  },
  smallButton: {
    minWidth: 90,
  },
  exerciseButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  compactAction: {
    flex: 1,
  },
  searchResults: {
    gap: spacing.sm,
  },
});
