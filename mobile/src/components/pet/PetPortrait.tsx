import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import GroundShadow from "../garden/GroundShadow";
import { PetImageSources, usePetCandidates } from "../garden/usePetCandidates";
import { fitHeight } from "../../domain/gardenScene";
import type { PetLook } from "../../domain/petLook";
import PetRig, { type PetAct } from "./vector/PetRig";

export type PetMood = "happy" | "calm" | "sad" | "excited" | "sleepy" | "neutral";
export type PetReaction = "love" | "cheer" | "wiggle";

type PetPortraitProps = {
  sources?: PetImageSources | null;
  /** the illustrated pet; when present it is drawn instead of any raster image */
  look?: PetLook | null;
  /** an acted-out routine for the rig (drink, stretch…) */
  act?: PetAct | null;
  onActEnd?: () => void;
  /** the pet rests with its eyes closed (memorial mode) */
  resting?: boolean;
  /** height of the pet, in layout units; the box is that tall plus room for the shadow */
  size: number;
  mood?: PetMood;
  /** a one-shot reaction; the parent clears it through onReactionEnd */
  reaction?: PetReaction | null;
  onReactionEnd?: () => void;
  onPress?: () => void;
  allowOriginal?: boolean;
  showShadow?: boolean;
  /** shown in the empty placeholder */
  emptyLabel?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(!!value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReduced(!!value));
    return () => {
      alive = false;
      subscription?.remove?.();
    };
  }, []);
  return reduced;
}

const IDLE_MS: Record<PetMood, number> = {
  excited: 700,
  happy: 1300,
  neutral: 2400,
  calm: 2600,
  sad: 3600,
  sleepy: 4200,
};

const HEARTS = [
  { dx: -0.28, delay: 0, size: 0.16 },
  { dx: 0.05, delay: 140, size: 0.2 },
  { dx: 0.3, delay: 260, size: 0.14 },
];

/**
 * The pet as a character: the processed cutout standing on a soft contact shadow, breathing or
 * bouncing according to its mood, with one-shot reactions (hearts, a cheer, a wiggle). Unprocessed
 * photos show as a round framed portrait; no image at all shows an inviting placeholder.
 */
export default function PetPortrait({
  sources,
  look = null,
  act = null,
  onActEnd,
  resting = false,
  size,
  mood = "calm",
  reaction = null,
  onReactionEnd,
  onPress,
  allowOriginal = false,
  showShadow = true,
  emptyLabel = "Add your pet",
  accessibilityLabel,
  style,
}: PetPortraitProps) {
  const reducedMotion = useReducedMotion();
  const { choice, onError, framed: framedImage } = usePetCandidates(sources, allowOriginal);
  const hasRig = !!look;
  const isPlaceholder = !hasRig && choice.type === "placeholder";
  const framed = !hasRig && framedImage;

  // ---- sprite box -----------------------------------------------------------------------------------
  const [aspect, setAspect] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let alive = true;
    setAspect(null);
    if (choice.uri && !framed) {
      Image.getSize(
        choice.uri,
        (w, h) => {
          if (alive && w > 0 && h > 0) setAspect({ w, h });
        },
        () => {}
      );
    }
    return () => {
      alive = false;
    };
  }, [choice.uri, framed]);
  const box = hasRig ? { width: size, height: size } : fitHeight(size, aspect?.w ?? 1, aspect?.h ?? 1);
  const shadowPad = Math.round(size * 0.12);
  const boxWidth = Math.max(box.width, size * 0.9);
  const totalHeight = size + shadowPad;

  // ---- idle motion by mood ----------------------------------------------------------------------------
  const idle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion || isPlaceholder) {
      idle.setValue(0);
      return undefined;
    }
    const duration = IDLE_MS[mood] ?? IDLE_MS.calm;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idle, mood, reducedMotion, isPlaceholder]);

  // ---- one-shot reactions -----------------------------------------------------------------------------
  const react = useRef(new Animated.Value(0)).current;
  const [activeReaction, setActiveReaction] = useState<PetReaction | null>(null);
  useEffect(() => {
    if (!reaction) return undefined;
    setActiveReaction(reaction);
    react.setValue(0);
    const duration = reducedMotion ? 700 : reaction === "love" ? 1300 : 650;
    const animation = reducedMotion
      ? Animated.timing(react, { toValue: 1, duration, useNativeDriver: true })
      : Animated.timing(react, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true });
    let finished = false;
    animation.start(({ finished: done }) => {
      finished = true;
      if (done) {
        setActiveReaction(null);
        onReactionEnd?.();
      }
    });
    return () => {
      if (!finished) animation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction]);

  const transform = useMemo(() => {
    const list: any[] = [];
    const still = reducedMotion || isPlaceholder;
    if (!still && !hasRig && !resting) {
      switch (mood) {
        case "excited":
          list.push({ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.07] }) });
          list.push({ rotate: idle.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) });
          break;
        case "happy":
          list.push({ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.035] }) });
          list.push({ scaleY: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) });
          break;
        case "sad":
          list.push({ rotate: idle.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-1.5deg"] }) });
          list.push({ scaleY: idle.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) });
          break;
        case "sleepy":
          list.push({ scaleY: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) });
          list.push({ scaleX: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) });
          break;
        default:
          list.push({ scaleY: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.028] }) });
          list.push({ scaleX: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.992] }) });
      }
    }
    if (activeReaction === "wiggle" && !reducedMotion) {
      list.push({
        rotate: react.interpolate({
          inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
          outputRange: ["0deg", "-7deg", "6deg", "-4deg", "3deg", "0deg"],
        }),
      });
    }
    if (activeReaction === "cheer" && !reducedMotion) {
      list.push({
        translateY: react.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, -size * 0.2, 0] }),
      });
      list.push({
        scaleX: react.interpolate({ inputRange: [0, 0.1, 0.45, 0.9, 1], outputRange: [1, 1.08, 0.94, 1.04, 1] }),
      });
    }
    return list;
  }, [activeReaction, hasRig, idle, isPlaceholder, mood, react, reducedMotion, resting, size]);

  const heartsVisible = activeReaction === "love";
  const label =
    accessibilityLabel ??
    (isPlaceholder ? emptyLabel : `Your pet, looking ${mood === "neutral" ? "calm" : mood}`);

  const body = (
    <View style={[styles.wrap, { width: boxWidth, height: totalHeight }, style]} accessible accessibilityLabel={label} accessibilityRole={onPress ? "button" : "image"}>
      {showShadow && !isPlaceholder ? (
        <GroundShadow x={boxWidth / 2} y={hasRig ? size * 0.94 : size} width={(framed ? size * 0.8 : hasRig ? size * 0.66 : box.width) * 0.86} strength={framed ? 0.7 : 1} />
      ) : null}

      {hasRig ? (
        <Animated.View style={[styles.sprite, { width: size, height: size, left: (boxWidth - size) / 2, top: 0, transform, transformOrigin: "50% 100%" }]}>
          <PetRig look={look!} size={size} mood={mood} reaction={activeReaction} act={act} onActEnd={onActEnd} reducedMotion={reducedMotion} resting={resting} />
        </Animated.View>
      ) : isPlaceholder ? (
        <View style={[styles.placeholder, { width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, top: size * 0.09, left: (boxWidth - size * 0.82) / 2 }]}>
          <Feather name="camera" size={Math.max(16, size * 0.22)} color="rgba(255,255,255,0.85)" />
          <Text style={[styles.placeholderText, { fontSize: Math.max(10, size * 0.09) }]}>{emptyLabel}</Text>
        </View>
      ) : framed ? (
        <Animated.View
          style={[
            styles.frame,
            { width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4, top: size * 0.1, left: (boxWidth - size * 0.8) / 2, transform, transformOrigin: "50% 100%" },
          ]}
        >
          <Image source={choice.source!} onError={onError} style={styles.fill} resizeMode="cover" />
        </Animated.View>
      ) : (
        <Animated.Image
          source={choice.source!}
          onError={onError}
          resizeMode="contain"
          style={[
            styles.sprite,
            { width: box.width, height: box.height, left: (boxWidth - box.width) / 2, top: 0, transform, transformOrigin: "50% 100%" },
          ]}
        />
      )}

      {heartsVisible
        ? HEARTS.map((heart, index) => {
            const progress = react.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });
            const opacity = react.interpolate({
              inputRange: [0, 0.15, 0.7, 1],
              outputRange: [0, 1, 1, 0],
            });
            const translateY = reducedMotion
              ? 0
              : progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.55] });
            return (
              <Animated.Text
                key={index}
                pointerEvents="none"
                style={[
                  styles.heart,
                  {
                    fontSize: size * heart.size,
                    left: boxWidth / 2 + heart.dx * size,
                    top: size * 0.25 - index * size * 0.05,
                    opacity,
                    transform: [{ translateY }],
                  },
                ]}
              >
                {"♥"}
              </Animated.Text>
            );
          })
        : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "center",
  },
  sprite: {
    position: "absolute",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  frame: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  placeholder: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(15,23,42,0.3)",
  },
  placeholderText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
  },
  heart: {
    position: "absolute",
    color: "#f472b6",
    fontWeight: "700",
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
