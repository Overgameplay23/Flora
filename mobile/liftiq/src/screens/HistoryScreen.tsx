import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/Card';
import { ScreenShell } from '@/components/ScreenShell';
import { StatRow } from '@/components/StatRow';
import { useApp } from '@/state/AppProvider';
import { palette } from '@/theme/palette';
import { formatDateTime, formatDuration } from '@/utils/format';
import { calculateSessionVolume } from '@/utils/workouts';

export function HistoryScreen() {
  const { state } = useApp();
  const completedSessions = state.sessions.filter((session) => session.status === 'completed');

  return (
    <ScreenShell eyebrow="History" title="Training memory" subtitle="Every logged set compounds into cleaner context, clearer PRs, and smarter recaps.">
      {completedSessions.length ? completedSessions.map((session) => (
        <Card key={session.id} title={session.title} subtitle={`${formatDateTime(session.endedAt)} • ${formatDuration(session.totalDurationSeconds)}`}>
          <StatRow label="Volume" value={`${Math.round(calculateSessionVolume(session))} total`} />
          <StatRow label="Exercises" value={String(session.exercises.length)} />
          <StatRow label="Outcome" value={session.notes?.outcome ?? 'normal'} />
          {session.recap ? <Text style={styles.recap}>{session.recap.summary}</Text> : null}
        </Card>
      )) : (
        <Card title="No sessions yet" subtitle="Log the first workout and your history becomes the app’s second brain.">
          <Text style={styles.placeholder}>History stays intentionally simple in v1: date, workload, recap, and the notes that explain why a session landed the way it did.</Text>
        </Card>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  recap: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  placeholder: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
