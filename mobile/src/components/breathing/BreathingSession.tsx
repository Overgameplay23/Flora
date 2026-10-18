import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PetMascot from "../pet/PetMascot";
import SpeechBubble from "../pet/SpeechBubble";
import { useHasPet } from "../pet/PetMoments";
import Button from "../common/Button";
import PressableScale from "../common/PressableScale";
import { usePet } from "../../hooks/usePet";
import { DEFAULT_BREATHS, PATTERN_4_2_6, fullnessAfter, positionAt, sessionLengthMs, sessionSteps } from "../../domain/breathing";
import { useTheme } from "../../theme/theme";
import { radius, type } from "../../theme/tokens";
import { breathCue, tapSoft } from "../../utils/haptics";
import { announce } from "../../utils/a11y";

type Stage = "ready" | "running" | "paused" | "done";

type BreathingSessionProps = {
  onClose: () => void;
  /** called once when the minute is finished */
  onComplete?: () => void;
};

const TICK_MS = 100;

/**
 * One slow minute with the pet: 4-2-6 breathing (in 4, hold 2, out 6; five breaths). A soft halo and the
 * pet swell and settle with each breath, the phase is named in large type, and each phase begins with its
 * own haptic so it can be followed with eyes closed. Reduced Motion keeps the words and haptics and drops
 * the swelling. The pet rests (and stays quiet) in memorial mode.
 */
export default function BreathingSession({ onClose, onComplete }: BreathingSessionProps) {
  const theme = useTheme();
  const { surface } = theme;
  const calm = theme.tone("calm");
  const insets = useSafeAreaInsets();
  const { displayName, memorial } = usePet();
  const hasPet = useHasPet();
  const steps = useMemo(() => sessionSteps(PATTERN_4_2_6, DEFAULT_BREATHS), []);
  const totalMs = sessionLengthMs(steps);

  const [stage, setStage] = useState<Stage>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);
  const fullness = useRef(new Animated.Value(0)).current;
  // elapsed time survives pauses: `banked` is breathing done before the current run started
  const banked = useRef(0);
  const runStartedAt = useRef(0);
  const lastIndex = useRef(-1);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((value) => alive && setReduced(!!value));
    return () => {
      alive = false;
    };
  }, []);

  const position = positionAt(steps, elapsed);

  // the clock: while running, read real time (setInterval drifts) and move the session along
  useEffect(() => {
    if (stage !== "running") return undefined;
    runStartedAt.current = Date.now();
    const id = setInterval(() => {
      const now = banked.current + (Date.now() - runStartedAt.current);
      setElapsed(Math.min(now, totalMs));
    }, TICK_MS);
    return () => {
      clearInterval(id);
      banked.current += Date.now() - runStartedAt.current;
    };
  }, [stage, totalMs]);

  // each new phase: its haptic, and the halo eases toward that phase's fullness over the time left in it
  useEffect(() => {
    if (stage !== "running") return;
    if (position.done) {
      lastIndex.current = -1;
      setStage("done");
      tapSoft();
      Animated.timing(fullness, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
      completeRef.current?.();
      return;
    }
    if (position.index === lastIndex.current || !position.step) return;
    lastIndex.current = position.index;
    breathCue(position.step.phase.key);
    // with eyes closed or VoiceOver on, the phase is also spoken ("Breathe in", "Hold", "Breathe out")
    announce(position.step.phase.label);
    if (!reduced) {
      Animated.timing(fullness, {
        toValue: fullnessAfter(position.step.phase.key),
        duration: Math.max(200, position.remainingMs),
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start();
    }
  }, [fullness, position.done, position.index, position.remainingMs, position.step, reduced, stage]);

  const start = useCallback(() => {
    banked.current = 0;
    lastIndex.current = -1;
    setElapsed(0);
    fullness.setValue(0);
    setStage("running");
  }, [fullness]);

  const pause = useCallback(() => {
    fullness.stopAnimation();
    setStage("paused");
  }, [fullness]);

  const resume = useCallback(() => {
    // pick the current phase up again: the halo continues from where it stopped
    lastIndex.current = -1;
    setStage("running");
  }, []);

  useEffect(() => () => fullness.stopAnimation(), [fullness]);

  const haloScale = fullness.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
  const haloOpacity = fullness.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const ringScale = fullness.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const petScale = fullness.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.07] });
  const petLift = fullness.interpolate({ inputRange: [0, 1], outputRange: [4, -8] });

  const step = position.step;
  const secondsLeft = Math.max(1, Math.ceil(position.remainingMs / 1000));
  const breathNumber = Math.min(DEFAULT_BREATHS, position.breathsDone + 1);
  const resting = !!memorial;

  let headline: string;
  let subline: string;
  if (stage === "ready") {
    headline = resting ? `A quiet minute with ${displayName}` : `Breathe with ${displayName}`;
    subline = "In for 4, hold for 2, out for 6. Five slow breaths.";
  } else if (stage === "done") {
    headline = resting ? "Thank you for sitting with them" : "That's the minute";
    subline = "You showed up. That is enough.";
  } else {
    headline = step?.phase.label ?? "";
    subline = stage === "paused" ? "Paused" : `${secondsLeft} · breath ${breathNumber} of ${DEFAULT_BREATHS}`;
  }
  const petLine = resting ? null : stage === "ready" ? "Breathe with me for a minute?" : stage === "done" ? "That was nice. I feel calmer too." : null;

  return (
    <View style={[styles.root, { backgroundColor: surface.canvas, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <LinearGradient pointerEvents="none" colors={[surface.isNight ? surface.paper : calm.tint, surface.canvas]} style={styles.wash} />

      <View style={styles.topBar}>
        <Text style={[type.micro, styles.eyebrow, { color: calm.accent }]}>One slow minute</Text>
        <PressableScale onPress={onClose} hitSlop={10} pressedScale={0.9} accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
          <Ionicons name="close" size={20} color={surface.text} />
        </PressableScale>
      </View>

      <View style={styles.stage} accessible accessibilityLiveRegion="polite" accessibilityLabel={stage === "running" ? `${headline}. ${subline}` : headline}>
        {/* the bubble keeps its room whether or not the pet is talking, so nothing jumps between steps */}
        <View style={styles.bubbleSlot} pointerEvents="none">
          {petLine && hasPet ? <SpeechBubble text={petLine} tail="bottom-left" night={surface.isNight} style={styles.bubble} /> : null}
        </View>
        <View style={styles.square} pointerEvents="none">
          <Animated.View style={[styles.halo, { backgroundColor: calm.mid, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
          <Animated.View style={[styles.ring, { backgroundColor: surface.isNight ? surface.sunken : calm.tint, borderColor: calm.mid, transform: [{ scale: ringScale }] }]} />
          <Animated.View style={{ transform: [{ translateY: petLift }, { scale: petScale }] }}>
            {hasPet ? (
              <PetMascot size={140} mood={stage === "done" ? "happy" : "calm"} reaction={stage === "done" && !resting ? "love" : null} showShadow={false} />
            ) : (
              <Ionicons name="leaf-outline" size={64} color={calm.accent} />
            )}
          </Animated.View>
        </View>
      </View>

      <View style={styles.words}>
        <Text style={[type.display, styles.headline, { color: surface.text }]} accessibilityRole="header">
          {headline}
        </Text>
        <Text style={[type.callout, styles.subline, { color: surface.textSecondary }]}>{subline}</Text>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: DEFAULT_BREATHS }).map((_, index) => {
            const filled = stage === "done" || index < position.breathsDone;
            const current = (stage === "running" || stage === "paused") && index === position.breathsDone;
            return <View key={index} style={[styles.dot, { backgroundColor: filled ? calm.accent : surface.track }, current && { borderColor: calm.accent, borderWidth: 2, backgroundColor: "transparent" }]} />;
          })}
        </View>
      </View>

      <View style={styles.controls}>
        {stage === "ready" ? (
          <Button label="Start" icon="play" onPress={start} />
        ) : stage === "running" ? (
          <Button label="Pause" icon="pause" variant="secondary" onPress={pause} />
        ) : stage === "paused" ? (
          <>
            <Button label="Keep going" icon="play" onPress={resume} />
            <Button label="End here" variant="quiet" size="md" onPress={onClose} containerStyle={styles.secondary} />
          </>
        ) : (
          <>
            <Button label="Done" onPress={onClose} />
            <Button label="Another minute" variant="quiet" size="md" onPress={start} containerStyle={styles.secondary} />
          </>
        )}
      </View>
    </View>
  );
}

const HALO = 300;
const RING = 236;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  wash: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "65%",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  eyebrow: {
    textTransform: "uppercase",
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleSlot: {
    height: 64,
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: -18,
    zIndex: 1,
  },
  square: {
    width: HALO,
    height: HALO,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },
  ring: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
  },
  bubble: {
    alignSelf: "center",
  },
  words: {
    alignItems: "center",
    minHeight: 120,
  },
  headline: {
    textAlign: "center",
  },
  subline: {
    marginTop: 6,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  controls: {
    marginTop: 12,
  },
  secondary: {
    alignSelf: "center",
    marginTop: 4,
  },
});
