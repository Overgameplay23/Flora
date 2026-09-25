import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { radius, spacing } from '@/theme/metrics';

interface MetricPillProps {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
  onPress?: () => void;
}

export function MetricPill({ label, value, tone = 'default', onPress }: MetricPillProps) {
  const content = (
    <View style={[styles.pill, tone === 'success' ? styles.success : null, tone === 'warning' ? styles.warning : null]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 4,
  },
  success: {
    backgroundColor: '#edf7ea',
    borderColor: '#b4d1a6',
  },
  warning: {
    backgroundColor: '#fff2e6',
    borderColor: '#f0c89f',
  },
  label: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  value: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
});
