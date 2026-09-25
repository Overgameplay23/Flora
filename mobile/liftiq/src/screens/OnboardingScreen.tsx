import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceCard } from '@/components/ChoiceCard';
import { MetricPill } from '@/components/MetricPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useApp } from '@/state/AppProvider';
import { palette } from '@/theme/palette';
import { spacing } from '@/theme/metrics';
import type { EquipmentType, GoalPhase, TrainingAge, TrainingSplit, UnitSystem } from '@/types/models';

const goalOptions: Array<{ title: string; subtitle: string; value: GoalPhase }> = [
  { title: 'Build strength', subtitle: 'Bias the first templates toward heavy compounds and simple progression.', value: 'strength' },
  { title: 'Build muscle', subtitle: 'Favor higher-volume templates and hypertrophy phrasing.', value: 'hypertrophy' },
  { title: 'Get back into it', subtitle: 'Use conservative jumps and calmer coaching language.', value: 'comeback' },
  { title: 'Stay consistent', subtitle: 'Prioritize repeatability, session speed, and habit momentum.', value: 'consistency' },
];

const ageOptions: Array<{ title: string; subtitle: string; value: TrainingAge }> = [
  { title: 'Less than 1 year', subtitle: 'Beginner-friendly cues and conservative progression.', value: 'beginner' },
  { title: '1 to 3 years', subtitle: 'Balanced progression and standard coaching language.', value: 'intermediate' },
  { title: '3+ years', subtitle: 'Advanced context and tighter pattern analysis later.', value: 'advanced' },
];

const splitOptions: Array<{ title: string; subtitle: string; value: TrainingSplit }> = [
  { title: 'Push / Pull / Legs', subtitle: 'A classic 3-day rotation built for repeatability.', value: 'push-pull-legs' },
  { title: 'Upper / Lower', subtitle: 'A practical split for 4-day training and fast decisions.', value: 'upper-lower' },
  { title: 'Full Body', subtitle: 'One template repeated cleanly with minimal overhead.', value: 'full-body' },
  { title: 'Bro Split', subtitle: 'Separate muscle-group days with familiar gym rhythm.', value: 'bro-split' },
  { title: 'Custom / No fixed split', subtitle: 'Start flexible and refine the structure later.', value: 'custom' },
];

const equipmentOptions: EquipmentType[] = ['barbell', 'dumbbell', 'machine', 'cable'];

export function OnboardingScreen() {
  const { actions } = useApp();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalPhase>('strength');
  const [trainingAge, setTrainingAge] = useState<TrainingAge>('intermediate');
  const [split, setSplit] = useState<TrainingSplit>('upper-lower');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('lb');
  const [preferredEquipment, setPreferredEquipment] = useState<EquipmentType[]>(['barbell', 'dumbbell', 'machine']);
  const totalSteps = 5;

  const footer = useMemo(() => {
    if (step === 0) {
      return <PrimaryButton label="Let’s get started" onPress={() => setStep(1)} />;
    }

    const atEnd = step === totalSteps - 1;
    return (
      <View style={styles.footerRow}>
        <PrimaryButton label="Back" variant="ghost" style={styles.footerButton} onPress={() => setStep((current) => Math.max(0, current - 1))} />
        <PrimaryButton
          label={atEnd ? 'Start your first workout' : 'Next'}
          style={styles.footerButton}
          onPress={async () => {
            if (atEnd) {
              await actions.completeOnboarding({
                goalPhase: goal,
                trainingAge,
                trainingSplit: split,
                unitSystem,
                preferredEquipment,
              });
              return;
            }
            setStep((current) => Math.min(totalSteps - 1, current + 1));
          }}
        />
      </View>
    );
  }, [actions, goal, preferredEquipment, split, step, totalSteps, trainingAge, unitSystem]);

  if (step === 0) {
    return (
      <ScreenShell
        eyebrow="LIFTIQ"
        title="The gym app that gets smarter every session."
        subtitle="Fast logging first. Useful coaching second. The more you train here, the more unfairly personalized it becomes."
        footer={footer}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Log the set. Start the timer. See the next target.</Text>
          <Text style={styles.heroCopy}>LIFTIQ turns workout dead space into a clear next action. Finish a session and it hands back a grounded recap instead of vague motivation.</Text>
        </View>
      </ScreenShell>
    );
  }

  if (step === 1) {
    return (
      <ScreenShell eyebrow="Step 1 of 4" title="What’s your main goal right now?" subtitle="This shapes your first templates and how aggressive progression feels." footer={footer}>
        {goalOptions.map((option) => (
          <ChoiceCard key={option.value} title={option.title} subtitle={option.subtitle} selected={goal === option.value} onPress={() => setGoal(option.value)} />
        ))}
      </ScreenShell>
    );
  }

  if (step === 2) {
    return (
      <ScreenShell eyebrow="Step 2 of 4" title="How long have you been lifting?" subtitle="Training age calibrates the coaching language and default jumps." footer={footer}>
        {ageOptions.map((option) => (
          <ChoiceCard key={option.value} title={option.title} subtitle={option.subtitle} selected={trainingAge === option.value} onPress={() => setTrainingAge(option.value)} />
        ))}
      </ScreenShell>
    );
  }

  if (step === 3) {
    return (
      <ScreenShell eyebrow="Step 3 of 4" title="What’s your typical split?" subtitle="This determines which session shows up first and how Home predicts the next training day." footer={footer}>
        {splitOptions.map((option) => (
          <ChoiceCard key={option.value} title={option.title} subtitle={option.subtitle} selected={split === option.value} onPress={() => setSplit(option.value)} />
        ))}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="Step 4 of 4" title="Your training profile" subtitle="Start fresh now. If you want imports later, raise your hand in Profile and we’ll treat it as a waitlist signal." footer={footer}>
      <View style={styles.summaryRow}>
        <MetricPill label="Goal" value={goal.replace('-', ' ')} />
        <MetricPill label="Experience" value={trainingAge} />
      </View>
      <View style={styles.summaryRow}>
        <MetricPill label="Split" value={split.replace(/-/g, ' ')} />
        <MetricPill label="Units" value={unitSystem.toUpperCase()} />
      </View>
      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Unit system</Text>
        <SegmentedControl value={unitSystem} options={[{ label: 'Pounds', value: 'lb' }, { label: 'Kilograms', value: 'kg' }]} onChange={setUnitSystem} />
      </View>
      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Preferred equipment</Text>
        <View style={styles.equipmentWrap}>
          {equipmentOptions.map((equipment) => {
            const selected = preferredEquipment.includes(equipment);
            return (
              <MetricPill
                key={equipment}
                label="Equipment"
                value={equipment}
                tone={selected ? 'success' : 'default'}
                onPress={() => {
                  setPreferredEquipment((current) =>
                    current.includes(equipment)
                      ? current.filter((item) => item !== equipment)
                      : [...current, equipment]
                  );
                }}
              />
            );
          })}
        </View>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>You’re starting as a {trainingAge} lifter focused on {goal.replace('-', ' ')}, running {split.replace(/-/g, ' ')}.</Text>
        <Text style={styles.summaryCopy}>Your first workout will prioritize speed, recent context, and one clear next target after every set.</Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: spacing.xl,
    borderRadius: 28,
    backgroundColor: palette.ink,
    gap: spacing.md,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: '#f4dfca',
    fontSize: 16,
    lineHeight: 24,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  block: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  equipmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    backgroundColor: '#fff4e7',
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#e8c89f',
  },
  summaryTitle: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  summaryCopy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
