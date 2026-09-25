import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card } from '@/components/Card';
import { MetricPill } from '@/components/MetricPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { StatRow } from '@/components/StatRow';
import { useApp } from '@/state/AppProvider';
import { spacing } from '@/theme/metrics';
import { palette } from '@/theme/palette';
import { formatShortDate } from '@/utils/format';
import { inferNextTrainingDay } from '@/utils/workouts';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { state, activeSession, latestRecap } = useApp();
  const completedSessions = state.sessions.filter((session) => session.status === 'completed');
  const nextDay = inferNextTrainingDay(state.profile, completedSessions);

  return (
    <ScreenShell eyebrow="Home" title="Train with less friction." subtitle="Start the next session fast, keep the logger moving, and let the recap capture what mattered.">
      <Card title={activeSession ? 'Resume your workout' : 'Start your next workout'} subtitle={nextDay}>
        <View style={styles.heroActions}>
          <PrimaryButton label={activeSession ? 'Resume active session' : 'Start workout'} onPress={() => navigation.navigate('Workout')} style={styles.heroButton} />
          <PrimaryButton label="View history" variant="ghost" onPress={() => navigation.navigate('History')} style={styles.heroButton} />
        </View>
        <View style={styles.metricRow}>
          <MetricPill label="Completed sessions" value={String(completedSessions.length)} />
          <MetricPill label="Tracked PRs" value={String(state.recentPrs.length)} tone="success" />
        </View>
      </Card>

      {latestRecap ? (
        <Card title="Latest recap" subtitle={formatShortDate(latestRecap.generatedAt)}>
          <Text style={styles.recap}>{latestRecap.summary}</Text>
          <StatRow label="Focus next time" value={latestRecap.actionableTakeaway} />
          {latestRecap.evidence.map((entry) => (
            <Text key={entry} style={styles.evidence}>• {entry}</Text>
          ))}
        </Card>
      ) : (
        <Card title="What shows up here" subtitle="Finish one session and Home starts feeling personal.">
          <Text style={styles.placeholder}>Your latest recap, recent PRs, and the next suggested day all appear here once you log the first workout.</Text>
        </Card>
      )}

      <Card title="Recent PRs" subtitle="Fresh markers pulled from your best sets.">
        {state.recentPrs.length ? state.recentPrs.slice(0, 4).map((pr) => (
          <StatRow key={pr.id} label={pr.label} value={`${Math.round(pr.value)} est. 1RM`} />
        )) : <Text style={styles.placeholder}>No PRs yet. The first one should come from actually training, not from setup.</Text>}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heroButton: {
    flex: 1,
    minWidth: 150,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recap: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  evidence: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  placeholder: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
