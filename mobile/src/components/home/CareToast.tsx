import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { announce } from "../../utils/a11y";
import PetPortrait from "../pet/PetPortrait";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetLook } from "../../domain/petLook";
import { radius, surfaces, type } from "../../theme/tokens";

type CareToastProps = {
  toast: { id: number; text: string } | null;
  bottom: number;
  petSources?: PetImageSources | null;
  petLook?: PetLook | null;
  night?: boolean;
};

/**
 * The pet pops up with a line when something is done. It floats over the screen (not inside the header),
 * so it is seen wherever the person has scrolled to.
 */
export default function CareToast({ toast, bottom, petSources, petLook, night = false }: CareToastProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return undefined;
    let animation: Animated.CompositeAnimation | null = null;
    let alive = true;
    setShown(toast);
    // VoiceOver does not read a toast that slides in on its own (Android's live region below does); say it
    announce(toast.text);
    progress.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        animation = Animated.sequence([
          Animated.timing(progress, { toValue: 1, duration: reduced ? 1 : 300, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
          Animated.delay(2600),
          Animated.timing(progress, { toValue: 2, duration: reduced ? 1 : 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]);
        animation.start(({ finished }) => {
          if (finished && alive) setShown(null);
        });
      });
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [progress, toast]);

  if (!shown) return null;
  const surface = night ? surfaces.night : surfaces.light;
  const opacity = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [24, 0, 12] });
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom, opacity, transform: [{ translateY }] }]} accessibilityLiveRegion="polite">
      <View style={[styles.toast, { backgroundColor: surface.paper, boxShadow: surface.shadowRaised }]}>
        <View style={styles.pet}>
          <PetPortrait sources={petSources} look={petLook} size={40} showShadow={false} mood="happy" emptyLabel="" />
        </View>
        <Text style={[type.callout, styles.text, { color: surface.text }]} numberOfLines={2}>
          {shown.text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 18,
    paddingVertical: 8,
    borderRadius: radius.pill,
    maxWidth: 420,
  },
  pet: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  text: {
    marginLeft: 8,
    flexShrink: 1,
  },
});
