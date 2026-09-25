import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { palette } from '@/theme/palette';
import { radius, spacing } from '@/theme/metrics';

interface ChoiceCardProps {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

export function ChoiceCard({ title, subtitle, selected, onPress }: ChoiceCardProps) {
  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.card, selected ? styles.selected : null]}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={[styles.dot, selected ? styles.dotSelected : null]} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  selected: {
    borderColor: palette.bronze,
    backgroundColor: '#fff1df',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.line,
    backgroundColor: palette.white,
  },
  dotSelected: {
    borderColor: palette.bronze,
    backgroundColor: palette.bronze,
  },
});
