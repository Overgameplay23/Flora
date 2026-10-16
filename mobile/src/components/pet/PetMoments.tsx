import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import PetMascot from "./PetMascot";
import type { PetMood } from "./PetPortrait";
import Button from "../common/Button";
import { usePet } from "../../hooks/usePet";
import { useTheme } from "../../theme/theme";
import { brand, type } from "../../theme/tokens";

/** Whether there is a pet to draw (a painting, a photo or a chosen look). */
export function useHasPet(): boolean {
  const pet = usePet();
  return pet.hasAnyImage || !!pet.look;
}

type PetEmptyStateProps = {
  title: string;
  body?: string | null;
  /** a line in the pet's voice, in a bubble */
  say?: string | null;
  mood?: PetMood;
  size?: number;
  action?: { label: string; onPress: () => void; icon?: string } | null;
  secondary?: { label: string; onPress: () => void } | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * An empty or resting state with the pet in it: nothing here yet, signed out, paused. The pet keeps
 * the screen company instead of a grey line of text.
 */
export function PetEmptyState({ title, body, say, mood = "calm", size = 120, action, secondary, style }: PetEmptyStateProps) {
  const { surface, night } = useTheme();
  return (
    <View style={[styles.empty, style]}>
      <PetMascot size={size} mood={mood} say={say} night={night} />
      <Text style={[type.h2, styles.emptyTitle, { color: surface.text }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[type.callout, styles.emptyBody, { color: surface.textSecondary }]}>{body}</Text> : null}
      {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} size="md" containerStyle={styles.emptyAction} /> : null}
      {secondary ? <Button label={secondary.label} onPress={secondary.onPress} variant="quiet" size="md" containerStyle={styles.emptySecondary} /> : null}
    </View>
  );
}

type PetLoadingProps = {
  label?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading with the pet: it breathes slowly while the screen gets ready. Before there is a pet (sign-in,
 * first launch) a quiet spinner stands in.
 */
export function PetLoading({ label = null, size = 96, style }: PetLoadingProps) {
  const { surface } = useTheme();
  const hasPet = useHasPet();
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive || reduced) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(breath, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(breath, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    return () => {
      alive = false;
      loop?.stop();
    };
  }, [breath]);
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return (
    <View style={[styles.loading, style]} accessibilityRole="progressbar" accessibilityLabel={label ?? "Loading"}>
      {hasPet ? (
        <Animated.View style={{ transform: [{ scale }] }}>
          <PetMascot size={size} mood="calm" />
        </Animated.View>
      ) : (
        <ActivityIndicator color={brand.sprout} />
      )}
      {label ? <Text style={[type.meta, styles.loadingLabel, { color: surface.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  emptyTitle: {
    marginTop: 14,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 6,
    textAlign: "center",
    maxWidth: 340,
  },
  emptyAction: {
    marginTop: 18,
    alignSelf: "center",
  },
  emptySecondary: {
    marginTop: 4,
    alignSelf: "center",
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingLabel: {
    marginTop: 10,
    textAlign: "center",
  },
});
