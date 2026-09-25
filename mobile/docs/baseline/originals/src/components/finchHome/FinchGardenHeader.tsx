import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, ImageBackground, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { isRecord } from "../../utils/guards";

type FinchGardenHeaderProps = {
  height: number;
  streakText: string;
  moodText: string;
  titleText?: string;
  subtitleText?: string;
  petImageSources?: {
    stylized?: string | null;
    cutout?: string | null;
    mask?: string | null;
    photo?: string | null;
    original?: string | null;
    allowOriginal?: boolean | null;
    alphaCutout?: boolean | null;
    alphaStylized?: boolean | null;
    maskReapplied?: boolean | null;
    providerUsed?: string | null;
  };
  backgroundSource?: ImageSourcePropType | null;
};

const DEFAULT_GARDEN_ART = require("../../../assets/garden.png");
const SPROUT_SPRITE = require("../../../assets/garden/flower_sprout.png");
const FLOWER_SPRITE = require("../../../assets/garden/flower_bloomed.png");
const SPARKLES = [
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

function shortenUrl(value?: string | null) {
  if (!value) return "missing";
  if (value.length <= 64) return value;
  return `${value.slice(0, 32)}...${value.slice(-18)}`;
}

function FinchGardenHeader({
  height,
  streakText,
  moodText,
  titleText,
  subtitleText,
  petImageSources,
  backgroundSource = DEFAULT_GARDEN_ART,
}: FinchGardenHeaderProps) {
  const subtitle = subtitleText ?? `${streakText} \u00b7 ${moodText}`;
  const title = titleText ?? "Welcome back";
  const petCandidates = useMemo(() => {
    const sources: Array<{ type: string; source: ImageSourcePropType | null }> = [];
    const allowStylized = petImageSources?.stylized && petImageSources?.alphaStylized !== false;
    const allowCutout = petImageSources?.cutout && petImageSources?.alphaCutout !== false;
    const photoUrl = petImageSources?.photo || null;
    const allowOriginal = petImageSources?.allowOriginal === true;
    if (allowStylized) {
      sources.push({ type: "stylized", source: { uri: petImageSources.stylized } });
    }
    if (allowCutout) {
      sources.push({ type: "cutout", source: { uri: petImageSources.cutout } });
    }
    if (photoUrl) {
      sources.push({ type: "photo", source: { uri: photoUrl } });
    }
    if (allowOriginal && petImageSources?.original && petImageSources.original !== photoUrl) {
      sources.push({ type: "original", source: { uri: petImageSources.original } });
    }
    sources.push({ type: "placeholder", source: null });
    return sources;
  }, [
    petImageSources?.stylized,
    petImageSources?.cutout,
    petImageSources?.photo,
    petImageSources?.original,
    petImageSources?.allowOriginal,
    petImageSources?.alphaStylized,
    petImageSources?.alphaCutout,
  ]);
  const [petIndex, setPetIndex] = useState(0);
  const sparkleOpacities = useRef(SPARKLES.map(() => new Animated.Value(0))).current;
  const petSize = useMemo(() => {
    const target = Math.round(height * 0.46);
    return Math.max(120, Math.min(180, target));
  }, [height]);

  useEffect(() => {
    setPetIndex(0);
  }, [
    petImageSources?.stylized,
    petImageSources?.cutout,
    petImageSources?.photo,
    petImageSources?.original,
    petImageSources?.allowOriginal,
    petImageSources?.alphaStylized,
    petImageSources?.alphaCutout,
  ]);

  useEffect(() => {
    const loops = sparkleOpacities.map((value, index) => {
      const sparkle = SPARKLES[index];
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: sparkle.duration,
            delay: sparkle.delay,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.15,
            duration: sparkle.duration + 1200,
            useNativeDriver: true,
          }),
        ])
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [sparkleOpacities]);

  const handlePetError = useCallback(() => {
    setPetIndex((prev) => Math.min(prev + 1, petCandidates.length - 1));
  }, [petCandidates.length]);

  const petChoice = petCandidates[Math.min(petIndex, petCandidates.length - 1)];
  const hasProcessed = Boolean(petImageSources?.stylized || petImageSources?.cutout || petImageSources?.photo);
  const renderSource = !petChoice
    ? "placeholder"
    : petChoice.type === "original"
      ? hasProcessed
        ? "original"
        : "originalMasked"
      : petChoice.type;
  const maskPet = petChoice?.type === "original" && !hasProcessed;
  const isPlaceholder = petChoice?.type === "placeholder";

  useEffect(() => {
    if (__DEV__) {
      const source = petChoice?.source as unknown;
      const hasUri = isRecord(source) && Object.prototype.hasOwnProperty.call(source, "uri");
      const uri = hasUri ? (source as { uri?: string }).uri : null;
      const sourceSummary = isRecord(source) ? { keys: Object.keys(source) } : source;
      console.log("FINCH_HEADER_RENDER_SOURCE", {
        renderSource,
        url: uri || "local",
        originalUrl: petImageSources?.original ?? null,
        photoUrl: petImageSources?.photo ?? null,
        maskUrl: petImageSources?.mask ?? null,
        cutoutUrl: petImageSources?.cutout ?? null,
        stylizedUrl: petImageSources?.stylized ?? null,
        alphaCutout: petImageSources?.alphaCutout ?? null,
        alphaStylized: petImageSources?.alphaStylized ?? null,
        maskReapplied: petImageSources?.maskReapplied ?? null,
        sourceType: typeof source,
        sourceIsArray: Array.isArray(source),
        sourceIsRecord: isRecord(source),
        sourceSummary,
      });
    }
  }, [
    renderSource,
    petChoice,
    petImageSources?.original,
    petImageSources?.photo,
    petImageSources?.allowOriginal,
    petImageSources?.mask,
    petImageSources?.cutout,
    petImageSources?.stylized,
  ]);

  const content = (
    <>
      <View style={styles.backgroundWash} />
      <LinearGradient
        colors={["rgba(9,12,22,0.85)", "rgba(9,12,22,0.2)", "transparent"]}
        style={styles.vignette}
      />
      <View pointerEvents="none" style={styles.sparkleLayer}>
        {SPARKLES.map((sparkle, index) => {
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
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {__DEV__ ? (
        <View style={styles.debugPill}>
          <Text style={styles.debugText}>RENDER_SOURCE={renderSource}</Text>
          <Text style={styles.debugText}>ORIGINAL={shortenUrl(petImageSources?.original)}</Text>
          <Text style={styles.debugText}>PHOTO={shortenUrl(petImageSources?.photo)}</Text>
          <Text style={styles.debugText}>MASK={shortenUrl(petImageSources?.mask)}</Text>
          <Text style={styles.debugText}>CUTOUT={shortenUrl(petImageSources?.cutout)}</Text>
          <Text style={styles.debugText}>STYLIZED={shortenUrl(petImageSources?.stylized)}</Text>
        </View>
      ) : null}
      <View style={styles.sproutMask}>
        <Image source={SPROUT_SPRITE} style={styles.spriteImage} resizeMode="cover" />
      </View>
      <View style={styles.flowerMask}>
        <Image source={FLOWER_SPRITE} style={styles.spriteImage} resizeMode="cover" />
      </View>
      <View style={[styles.petShadow, { width: petSize * 0.62 }]} />
      {isPlaceholder ? (
        <View style={[styles.petPlaceholder, { width: petSize, height: petSize, borderRadius: petSize / 2 }]}>
          <Text style={styles.petPlaceholderText}>Add pet</Text>
        </View>
      ) : maskPet ? (
        <View style={[styles.petMask, { width: petSize, height: petSize, borderRadius: petSize / 2 }]}>
          <Image
            source={petChoice?.source as ImageSourcePropType}
            onError={handlePetError}
            style={styles.petMasked}
            resizeMode="cover"
          />
        </View>
      ) : (
        <Image
          source={petChoice?.source as ImageSourcePropType}
          onError={handlePetError}
          style={[styles.pet, { width: petSize, height: petSize }]}
          resizeMode="contain"
        />
      )}
    </>
  );

  if (!backgroundSource) {
    return (
      <LinearGradient colors={["#0f172a", "#111827"]} style={[styles.container, { height }]}>
        {content}
      </LinearGradient>
    );
  }

  return (
    <ImageBackground
      source={backgroundSource}
      style={[styles.container, { height }]}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      {content}
    </ImageBackground>
  );
}

export default React.memo(FinchGardenHeader);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "flex-start",
  },
  backgroundImage: {
    opacity: 0.95,
  },
  backgroundWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(23,42,30,0.25)",
  },
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "55%",
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
    maxWidth: "68%",
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
    color: "rgba(255,255,255,0.8)",
    textShadowColor: "rgba(15,23,42,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  debugPill: {
    position: "absolute",
    top: 14,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    maxWidth: "70%",
    alignItems: "flex-end",
  },
  debugText: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 10,
    fontWeight: "600",
  },
  pet: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 20,
  },
  petMask: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  petPlaceholder: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  petPlaceholderText: {
    color: "rgba(226,232,240,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  petMasked: {
    width: "100%",
    height: "100%",
  },
  petShadow: {
    position: "absolute",
    right: 24,
    bottom: 10,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(9,12,18,0.45)",
    transform: [{ scaleY: 0.6 }],
  },
  sproutMask: {
    position: "absolute",
    left: 24,
    bottom: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.2)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  flowerMask: {
    position: "absolute",
    left: 90,
    bottom: 8,
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.2)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  spriteImage: {
    width: "100%",
    height: "100%",
  },
});
