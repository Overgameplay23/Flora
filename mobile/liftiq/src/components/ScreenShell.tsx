import React, { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '@/theme/palette';
import { spacing } from '@/theme/metrics';

interface ScreenShellProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export function ScreenShell({ eyebrow, title, subtitle, footer, children }: ScreenShellProps) {
  return (
    <LinearGradient colors={[palette.bg, '#f9f5ee', '#f4eee6']} style={styles.bg}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  eyebrow: {
    color: palette.bronzeDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 560,
  },
  body: {
    gap: spacing.lg,
  },
  footer: {
    paddingTop: spacing.sm,
  },
});
