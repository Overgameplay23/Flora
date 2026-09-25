import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import GardenStage from "../garden/GardenStage";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetMood, PetReaction } from "../pet/PetPortrait";
import type { PetAct } from "../pet/vector/PetRig";
import type { PetLook } from "../../domain/petLook";
import type { ScenePlantInput } from "../../domain/gardenScene";

type FinchGardenHeaderProps = {
  height: number;
  streakText: string;
  moodText: string;
  titleText?: string;
  subtitleText?: string;
  petImageSources?: PetImageSources;
  petLook?: PetLook | null;
  /** plants the user owns; they grow in the garden's soil patch */
  plants?: ScenePlantInput[] | null;
  petName?: string | null;
  petMood?: PetMood;
  petReaction?: PetReaction | null;
  onPetReactionEnd?: () => void;
  onPetPress?: () => void;
  petAct?: PetAct | null;
  onPetActEnd?: () => void;
  /** memorial mode: the pet rests and the sparkles go quiet */
  petResting?: boolean;
  /** a short line shown over the scene for a moment (task done, day complete); new id = new toast */
  celebration?: { id: number; text: string } | null;
};

function CelebrationToast({ celebration, reducedMotion }: { celebration: { id: number; text: string } | null; reducedMotion: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!celebration) return undefined;
    setShown(celebration);
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: reducedMotion ? 10 : 260, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(progress, { toValue: 2, duration: reducedMotion ? 10 : 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setShown(null);
    });
    return () => animation.stop();
  }, [celebration, progress, reducedMotion]);
  if (!shown) return null;
  const opacity = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [12, 0, -8] });
  const scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.9, 1, 0.98] });
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity, transform: [{ translateY }, { scale }] }]} accessibilityLiveRegion="polite">
      <Text style={styles.toastText}>{shown.text}</Text>
    </Animated.View>
  );
}

type SparklePercent = `${number}%`;
type Sparkle = {
  top: SparklePercent;
  left: SparklePercent;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
};
const SPARKLES: readonly Sparkle[] = [
  { top: "18%", left: "12%", size: 5, opacity: 0.28, duration: 4200, delay: 0 },
  { top: "26%", left: "28%", size: 4, opacity: 0.24, duration: 5200, delay: 600 },
  { top: "14%", left: "42%", size: 6, opacity: 0.3, duration: 4800, delay: 1200 },
  { top: "30%", left: "58%", size: 3, opacity: 0.2, duration: 5600, delay: 300 },
  { top: "22%", left: "72%", size: 5, opacity: 0.25, duration: 6000, delay: 900 },
  { top: "10%", left: "82%", size: 4, opacity: 0.22, duration: 5200, delay: 1500 },
  { top: "36%", left: "18%", size: 3, opacity: 0.2, duration: 6100, delay: 2000 },
  { top: "34%", left: "36%", size: 5, opacity: 0.26, duration: 5000, delay: 1100 },
  { top: "40%", left: "50%", size: 4, opacity: 0.22, duration: 5700, delay: 700 },
  { top: "38%", left: "64%", size: 6, opacity: 0.3, duration: 5400, delay: 1400 },
  { top: "32%", left: "84%", size: 3, opacity: 0.2, duration: 5900, delay: 1700 },
  { top: "24%", left: "90%", size: 4, opacity: 0.22, duration: 6200, delay: 2300 },
  { top: "44%", left: "24%", size: 4, opacity: 0.2, duration: 6400, delay: 200 },
  { top: "46%", left: "74%", size: 5, opacity: 0.26, duration: 5600, delay: 1800 },
];

function FinchGardenHeader({
  height,
  streakText,
  moodText,
  titleText,
  subtitleText,
  petImageSources,
  petLook = null,
  plants,
  petName,
  petMood = "calm",
  petReaction = null,
  onPetReactionEnd,
  onPetPress,
  petAct = null,
  onPetActEnd,
  petResting = false,
  celebration = null,
}: FinchGardenHeaderProps) {
  const subtitle = subtitleText ?? `${streakText} · ${moodText}`;
  const title = titleText ?? "Welcome back";
  const sparkleOpacities = useRef(SPARKLES.map(() => new Animated.Value(0.4))).current;

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReducedMotion(!!value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReducedMotion(!!value));
    return () => {
      alive = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      sparkleOpacities.forEach((value) => value.setValue(0.6));
      return undefined;
    }
    const loops = sparkleOpacities.map((value, index) => {
      const sparkle = SPARKLES[index];
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: sparkle.duration, delay: sparkle.delay, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.15, duration: sparkle.duration + 1200, useNativeDriver: true }),
        ])
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reducedMotion, sparkleOpacities]);

  const plantCount = (plants || []).filter((plant) => plant && plant.level > 0).length;
  const sceneLabel = `${petName || "Your pet"} is sitting in the garden beside the planting patch. ${
    plantCount === 0 ? "Nothing is planted yet." : `${plantCount} ${plantCount === 1 ? "plant is" : "plants are"} growing.`
  }`;

  return (
    <GardenStage
      height={height}
      variant="home"
      petImageSources={petImageSources}
      petLook={petLook}
      plants={plants}
      accessibilityLabel={sceneLabel}
      petMood={petMood}
      petReaction={petReaction}
      onPetReactionEnd={onPetReactionEnd}
      onPetPress={onPetPress}
      petAct={petAct}
      onPetActEnd={onPetActEnd}
      petResting={petResting}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(9,12,22,0.82)", "rgba(9,12,22,0.2)", "transparent"]}
        style={styles.vignette}
      />
      <View pointerEvents="none" style={styles.sparkleLayer}>
        {(petResting ? [] : SPARKLES).map((sparkle, index) => {
          const opacity = sparkleOpacities[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.05, sparkle.opacity],
          });
          return (
            <Animated.View
              key={`sparkle-${index}`}
              style={[
                styles.sparkle,
                {
                  top: sparkle.top,
                  left: sparkle.left,
                  width: sparkle.size,
                  height: sparkle.size,
                  borderRadius: sparkle.size / 2,
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.textWrap} pointerEvents="none">
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <CelebrationToast celebration={celebration} reducedMotion={reducedMotion} />
    </GardenStage>
  );
}

export default React.memo(FinchGardenHeader);

const styles = StyleSheet.create({
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "48%",
  },
  sparkleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    position: "absolute",
    backgroundColor: "rgba(255,244,214,0.9)",
  },
  textWrap: {
    marginTop: 16,
    paddingHorizontal: 16,
    maxWidth: "78%",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(15,23,42,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.86)",
    textShadowColor: "rgba(15,23,42,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    alignItems: "center",
  },
  toastText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,244,214,0.96)",
    overflow: "hidden",
  },
});
