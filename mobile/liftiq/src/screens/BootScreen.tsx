import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';

export function BootScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={palette.bronze} />
      <Text style={styles.title}>Loading your training memory…</Text>
      <Text style={styles.subtitle}>Restoring local workouts, recaps, and queued sync events from device storage.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4eee6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
