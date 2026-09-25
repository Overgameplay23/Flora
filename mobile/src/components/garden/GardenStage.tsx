import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import PetPortrait, { PetMood, PetReaction } from "../pet/PetPortrait";
import { dayPhase, phaseWash, showStars } from "../../domain/timeOfDay";
import type { PetAct } from "../pet/vector/PetRig";
import type { PetLook } from "../../domain/petLook";
import {
  ScenePlantInput,
  computeSceneFrame,
  layoutGardenPlants,
  sceneToView,
} from "../../domain/gardenScene";
import { PLANT_SPRITES, SCENE, SCENE_BACKGROUND, SCENE_FRAMING, SceneVariant } from "./sceneAssets";
import { PetImageSources, buildPetCandidates } from "./usePetCandidates";

type GardenStageProps = {
  height: number;
  variant: SceneVariant;
  petImageSources?: PetImageSources | null;
  /** the illustrated pet; drawn instead of the raster image when present */
  petLook?: PetLook | null;
  /** plants the user owns; each is rooted in the painted soil patch and shown at its growth stage */
  plants?: ScenePlantInput[] | null;
  allowOriginal?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** overlays (title, sparkles) drawn above the scene's lighting wash */
  children?: React.ReactNode;
  /** how the pet idles (breathing, bouncing, drooping) */
  petMood?: PetMood;
  /** one-shot reaction (hearts, cheer, wiggle); cleared by onPetReactionEnd */
  petReaction?: PetReaction | null;
  onPetReactionEnd?: () => void;
  onPetPress?: () => void;
  /** a routine the illustrated pet acts out (drink, walk…); cleared by onPetActEnd */
  petAct?: PetAct | null;
  onPetActEnd?: () => void;
  /** pet size relative to the scene's default (1 = as painted) */
  petScale?: number;
  /** draw the garden without any pet (onboarding, before a photo exists) */
  hidePet?: boolean;
  /** local hour driving the light; defaults to now, fixed in tests/previews */
  hour?: number;
  /** memorial mode: the pet rests, the light is soft and still */
  petResting?: boolean;
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

/** 0 -> 1 -> 0 forever, or parked at 0 when motion is reduced. */
function useGentleLoop(durationMs: number, enabled: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      value.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: durationMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, enabled, value]);
  return value;
}

/**
 * The garden as one composed scene. The background painting, the plants and the pet share a single
 * coordinate system (the painting's), a single lighting wash and a depth order, so the pet sits ON the
 * grass beside the planting patch and the plants grow IN its soil instead of floating over the picture.
 */
export default function GardenStage({
  height,
  variant,
  petImageSources,
  petLook = null,
  plants,
  allowOriginal = false,
  accessibilityLabel,
  style,
  children,
  petMood = "calm",
  petReaction = null,
  onPetReactionEnd,
  onPetPress,
  petAct = null,
  onPetActEnd,
  petScale = 1,
  hidePet = false,
  hour,
  petResting = false,
}: GardenStageProps) {
  // The garden follows the clock: a wash for the time of day over background and sprites alike, and a
  // few stars once it is dark. Re-evaluated when the component re-renders (focus, data changes).
  const phase = dayPhase(hour ?? new Date().getHours());
  const wash = petResting ? "rgba(120,100,150,0.26)" : phaseWash(phase);
  const stars = petResting || showStars(phase);
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 0.5) setWidth(next);
  };

  const framing = SCENE_FRAMING[variant];
  const frame = useMemo(
    () => computeSceneFrame(width, height, SCENE.image.width, SCENE.image.height, framing.focus, framing.zoom),
    [width, height, framing]
  );

  const reducedMotion = useReducedMotion();
  const sway = useGentleLoop(3400, !reducedMotion);

  // ---- plants, rooted at the painted planting spots -------------------------------------------------
  const placedPlants = useMemo(() => {
    return layoutGardenPlants(plants || [], SCENE.spots.length).map((placed) => {
      const spot = SCENE.spots[placed.spotIndex];
      const sprite = SCENE.sprites[placed.stage];
      const size = frame.scale * (spot.scale ?? 1);
      const w = sprite.width * size;
      const h = sprite.height * size;
      const ground = sceneToView(frame, spot);
      return {
        ...placed,
        groundY: ground.y,
        anchorX: sprite.anchorX,
        anchorY: sprite.anchorY,
        box: { left: ground.x - sprite.anchorX * w, top: ground.y - sprite.anchorY * h, width: w, height: h },
      };
    });
  }, [plants, frame]);

  // ---- pet, standing on the grass beside the patch --------------------------------------------------
  // PetPortrait handles the image ladder, the contact shadow, the framed-photo fallback, the placeholder
  // and the idle motion; the stage only decides where on the painting it stands and how large it is.
  const petGround = sceneToView(frame, SCENE.pet);
  const petHeight = SCENE.pet.heightRatio * frame.width * Math.max(0.3, petScale);
  const isPlaceholder = !petLook && buildPetCandidates(petImageSources, allowOriginal)[0]?.type === "placeholder";
  // The portrait centres itself inside a full-width row; padding shifts that row's centre to the pet's
  // ground point, which keeps the portrait's own width (from the image aspect) out of this layout.
  const petRowPadding =
    petGround.x >= width / 2 ? { paddingLeft: 2 * petGround.x - width } : { paddingRight: width - 2 * petGround.x };
  const renderSource = petLook ? "rig" : isPlaceholder ? "placeholder" : petImageSources?.stylized ? "stylized" : petImageSources?.cutout ? "cutout" : petImageSources?.photo ? "photo" : "originalMasked";

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { height }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={SCENE_BACKGROUND}
        style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
        resizeMode="stretch"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      {placedPlants.map((plant, index) => (
        <Animated.Image
          key={plant.id}
          source={PLANT_SPRITES[plant.stage]}
          resizeMode="stretch"
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            styles.sprite,
            plant.box,
            {
              zIndex: 10 + Math.round(plant.groundY),
              transformOrigin: `${plant.anchorX * 100}% ${plant.anchorY * 100}%`,
              transform: [
                {
                  rotate: sway.interpolate({
                    inputRange: [0, 1],
                    outputRange: index % 2 === 0 ? ["-1.4deg", "1.4deg"] : ["1.1deg", "-1.1deg"],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      {hidePet ? null : (
      <View
        pointerEvents="box-none"
        style={[styles.petRow, petRowPadding, { top: petGround.y - petHeight, zIndex: 10 + Math.round(petGround.y) }]}
      >
        <PetPortrait
          sources={petImageSources}
          look={petLook}
          size={petHeight}
          mood={petMood}
          reaction={petReaction}
          onReactionEnd={onPetReactionEnd}
          onPress={onPetPress}
          act={petAct}
          onActEnd={onPetActEnd}
          resting={petResting}
          allowOriginal={allowOriginal}
          emptyLabel="Add pet"
        />
      </View>
      )}

      {/* One lighting wash over background AND sprites, so they read as the same picture. */}
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: wash }]} />
      {stars ? (
        <View pointerEvents="none" style={styles.stars}>
          {STARS.map((star, index) => (
            <View key={index} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size, borderRadius: star.size / 2, opacity: star.opacity }]} />
          ))}
        </View>
      ) : null}

      {children ? <View style={styles.overlay} pointerEvents="box-none">{children}</View> : null}

      {__DEV__ ? (
        <View pointerEvents="none" style={styles.debugPill}>
          <Text style={styles.debugText}>RENDER_SOURCE={renderSource}</Text>
        </View>
      ) : null}
    </View>
  );
}

const STARS: Array<{ left: `${number}%`; top: `${number}%`; size: number; opacity: number }> = [
  { left: "8%", top: "6%", size: 3, opacity: 0.9 },
  { left: "21%", top: "12%", size: 2, opacity: 0.7 },
  { left: "34%", top: "4%", size: 2.5, opacity: 0.8 },
  { left: "47%", top: "10%", size: 2, opacity: 0.6 },
  { left: "58%", top: "3%", size: 3, opacity: 0.85 },
  { left: "69%", top: "9%", size: 2, opacity: 0.7 },
  { left: "81%", top: "5%", size: 2.5, opacity: 0.8 },
  { left: "92%", top: "11%", size: 2, opacity: 0.65 },
  { left: "15%", top: "18%", size: 2, opacity: 0.5 },
  { left: "75%", top: "16%", size: 2, opacity: 0.55 },
];

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#1d2a1c",
  },
  stars: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5001,
  },
  star: {
    position: "absolute",
    backgroundColor: "#fff7d6",
  },
  sprite: {
    position: "absolute",
  },
  petRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5000,
    backgroundColor: "rgba(23,42,30,0.16)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6000,
  },
  debugPill: {
    position: "absolute",
    zIndex: 7000,
    right: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  debugText: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 9,
    fontWeight: "600",
  },
});
