import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { radius, surfaces, type } from "../../theme/tokens";

type SpeechBubbleProps = {
  text: string;
  /** which corner the tail points from, toward the speaker */
  tail?: "bottom-left" | "bottom-right" | "left" | "none";
  night?: boolean;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Paper speech bubble for the pet's lines. Fades and lifts in whenever the text changes, so a new line
 * reads as the pet speaking rather than a label updating.
 */
export default function SpeechBubble({ text, tail = "bottom-left", night = false, maxWidth = 240, style }: SpeechBubbleProps) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    appear.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        Animated.timing(appear, {
          toValue: 1,
          duration: reduced ? 1 : 360,
          delay: reduced ? 0 : 120,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      alive = false;
    };
  }, [appear, text]);

  const surface = night ? surfaces.night : surfaces.light;
  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { maxWidth, opacity: appear, transform: [{ translateY }, { scale }] }, style]}
    >
      <View style={[styles.bubble, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
        <Text style={[type.petVoice, { color: surface.text }]}>{text}</Text>
      </View>
      {tail === "none" ? null : (
        <View
          style={[
            styles.tail,
            { backgroundColor: surface.paper },
            tail === "bottom-left" && styles.tailBottomLeft,
            tail === "bottom-right" && styles.tailBottomRight,
            tail === "left" && styles.tailLeft,
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.chip + 6,
    borderCurve: "continuous",
  },
  tail: {
    position: "absolute",
    width: 14,
    height: 14,
    transform: [{ rotate: "45deg" }],
    borderRadius: 3,
  },
  tailBottomLeft: {
    left: 18,
    bottom: -5,
  },
  tailBottomRight: {
    right: 18,
    bottom: -5,
  },
  tailLeft: {
    left: -5,
    top: 16,
  },
});
