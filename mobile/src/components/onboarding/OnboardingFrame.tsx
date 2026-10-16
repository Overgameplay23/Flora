import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/theme";
import { radius, space, type } from "../../theme/tokens";

type OnboardingFrameProps = {
  /** where the person is in the flow; null hides the bar */
  progress: { index: number; total: number } | null;
  onBack?: (() => void) | null;
  children: React.ReactNode;
  /** the step's buttons, pinned under the content */
  footer?: React.ReactNode;
  /** lift the page above the keyboard (the name step) */
  keyboard?: boolean;
};

/**
 * The page every onboarding step sits on: the paper of the hour, a back chevron and a thin progress bar at
 * the top, the step's content scrolling in the middle, and its buttons pinned at the bottom.
 */
export default function OnboardingFrame({ progress, onBack, children, footer, keyboard = false }: OnboardingFrameProps) {
  const theme = useTheme();
  const { surface } = theme;
  const insets = useSafeAreaInsets();
  const percent = progress ? Math.max(4, Math.round((progress.index / progress.total) * 100)) : 0;
  const page = (
    <View style={[styles.fill, { backgroundColor: surface.canvas }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={surface.text} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        {progress ? (
          <View
            style={[styles.track, { backgroundColor: surface.track }]}
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${progress.index} of ${progress.total}`}
            accessibilityValue={{ min: 0, max: progress.total, now: progress.index }}
          >
            <View style={[styles.bar, { backgroundColor: theme.bloom, width: `${percent}%` }]} />
          </View>
        ) : (
          <View style={styles.track} />
        )}
        <View style={styles.back} />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 14, borderTopColor: surface.hairline }]}>{footer}</View> : null}
    </View>
  );
  if (!keyboard) return page;
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {page}
    </KeyboardAvoidingView>
  );
}

/** A step's title (storybook serif) and its one-line lead. */
export function StepHeading({ title, lead, center = false }: { title: string; lead?: string | null; center?: boolean }) {
  const { surface } = useTheme();
  return (
    <View style={[styles.heading, center && styles.headingCenter]}>
      <Text style={[type.title, { color: surface.text }, center && styles.textCenter]} accessibilityRole="header">
        {title}
      </Text>
      {lead ? <Text style={[type.callout, styles.lead, { color: surface.textSecondary }, center && styles.textCenter]}>{lead}</Text> : null}
    </View>
  );
}

/** A rounded frame for a painted scene at the top of a step. */
export function SceneCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { surface } = useTheme();
  return <View style={[styles.scene, { boxShadow: surface.shadow }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  scroll: {
    paddingHorizontal: space.gutter,
    paddingTop: 8,
    paddingBottom: 28,
  },
  footer: {
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  heading: {
    marginTop: 14,
    marginBottom: 16,
  },
  headingCenter: {
    alignItems: "center",
  },
  lead: {
    marginTop: 8,
  },
  textCenter: {
    textAlign: "center",
  },
  scene: {
    borderRadius: radius.hero,
    borderCurve: "continuous",
    overflow: "hidden",
    marginTop: 4,
  },
});
