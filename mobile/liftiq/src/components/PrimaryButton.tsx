import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { palette } from '@/theme/palette';
import { radius, spacing } from '@/theme/metrics';

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'ghost';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, disabled, variant = 'solid', style }: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' ? styles.ghost : styles.solid,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'ghost' ? styles.ghostLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: palette.bronze,
  },
  ghost: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  label: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  ghostLabel: {
    color: palette.ink,
  },
});

