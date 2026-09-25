import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { radius, spacing } from '@/theme/metrics';

interface StepperControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export function StepperControl({ label, value, min = 0, max = 999, step = 1, suffix = '', onChange }: StepperControlProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.button}>
          <Text style={styles.buttonLabel}>-</Text>
        </Pressable>
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{`${value}${suffix}`}</Text>
        </View>
        <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.button}>
          <Text style={styles.buttonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  valueWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: '#fff2df',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#edc892',
  },
  value: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
});
