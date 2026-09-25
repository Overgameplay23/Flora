import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ImageBackground, Image, StyleSheet, Text } from "react-native";
import { isRecord } from "../utils/guards";

const background = require("../../assets/garden.png");
const flowerSeed = require("../../assets/garden/flower_seeded.png");
const flowerSprout = require("../../assets/garden/flower_sprout.png");
const flowerBloom = require("../../assets/garden/flower_bloomed.png");

function shortenUrl(value) {
  if (!value) return "missing";
  if (value.length <= 64) return value;
  return `${value.slice(0, 32)}...${value.slice(-18)}`;
}

export default function GardenScene({
  petImageSources,
  petImageUrl,
  compact = false,
  stage = "sprout",
  debugLabel,
  allowOriginal = false,
}) {
  const height = compact ? 180 : 320;
  const petSize = compact ? 120 : 180;
  const flowerSize = petSize * 0.42;
  const flowerSource = stage === "bloomed" ? flowerBloom : stage === "seeded" ? flowerSeed : flowerSprout;
  const petStyle = { width: petSize, height: petSize };
  const flowerStyle = { width: flowerSize, height: flowerSize, borderRadius: flowerSize / 2 };
  const candidates = useMemo(() => {
    const sources = [];
    const allowStylized = petImageSources?.stylized && petImageSources?.alphaStylized !== false;
    const allowCutout = petImageSources?.cutout && petImageSources?.alphaCutout !== false;
    const photoUrl = petImageSources?.photo || null;
    const allowOriginalSource = allowOriginal || petImageSources?.allowOriginal === true;
    if (allowStylized) {
      sources.push({ type: "stylized", source: { uri: petImageSources.stylized } });
    }
    if (allowCutout) {
      sources.push({ type: "cutout", source: { uri: petImageSources.cutout } });
    }
    if (photoUrl) {
      sources.push({ type: "photo", source: { uri: photoUrl } });
    }
    if (allowOriginalSource && petImageSources?.original && petImageSources.original !== photoUrl) {
      sources.push({ type: "original", source: { uri: petImageSources.original } });
    }
    if (allowOriginalSource && !petImageSources && petImageUrl) {
      sources.push({ type: "original", source: { uri: petImageUrl } });
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
    petImageUrl,
    allowOriginal,
  ]);
  const [petIndex, setPetIndex] = useState(0);
  const petChoice = candidates.length > 0 ? candidates[Math.min(petIndex, candidates.length - 1)] : null;
  const hasProcessed = Boolean(petImageSources?.stylized || petImageSources?.cutout || petImageSources?.photo);
  const renderSource = !petChoice
    ? "placeholder"
    : petChoice.type === "original"
      ? hasProcessed
        ? "original"
        : "originalMasked"
      : petChoice.type;
  const showMask = petChoice?.type === "original" && !hasProcessed;
  const isPlaceholder = petChoice?.type === "placeholder";
  const resolvedDebugLabel = debugLabel || `RENDER_SOURCE=${renderSource}`;

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
    petImageUrl,
    allowOriginal,
  ]);

  useEffect(() => {
    if (__DEV__) {
      const source = petChoice?.source;
      const hasUri = isRecord(source) && Object.prototype.hasOwnProperty.call(source, "uri");
      const uri = hasUri ? source.uri : null;
      const sourceSummary = isRecord(source) ? { keys: Object.keys(source) } : source;
      console.log("GARDEN_RENDER_SOURCE", {
        renderSource,
        url: uri || "local",
        originalUrl: petImageSources?.original ?? petImageUrl ?? null,
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
    petImageSources?.allowOriginal,
    petImageSources?.photo,
    petImageSources?.mask,
    petImageSources?.cutout,
    petImageSources?.stylized,
    petImageUrl,
    allowOriginal,
  ]);

  const handlePetError = useCallback(() => {
    setPetIndex((prev) => Math.min(prev + 1, Math.max(candidates.length - 1, 0)));
  }, [candidates.length]);

  return (
    <View style={[styles.container, { height }]}>
      <ImageBackground source={background} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />
        <View style={styles.layers}>
          {petChoice ? (
            isPlaceholder ? (
              <View style={[styles.petPlaceholder, petStyle, { borderRadius: petSize / 2 }]}>
                <Text style={styles.petPlaceholderText}>Add pet</Text>
              </View>
            ) : showMask ? (
              <View style={[styles.petMask, petStyle, { borderRadius: petSize / 2 }]}>
                <Image source={petChoice.source} onError={handlePetError} style={[styles.petMasked, petStyle]} />
              </View>
            ) : (
              <Image source={petChoice.source} onError={handlePetError} style={[styles.pet, petStyle]} />
            )
          ) : null}
          <View style={[styles.flowerMask, flowerStyle]}>
            <Image source={flowerSource} style={styles.flowerImage} resizeMode="cover" />
          </View>
          {__DEV__ && resolvedDebugLabel ? (
            <View style={styles.debugBadge}>
              <Text style={styles.debugText}>{resolvedDebugLabel}</Text>
              <Text style={styles.debugText}>ORIGINAL={shortenUrl(petImageSources?.original || petImageUrl)}</Text>
              <Text style={styles.debugText}>PHOTO={shortenUrl(petImageSources?.photo)}</Text>
              <Text style={styles.debugText}>MASK={shortenUrl(petImageSources?.mask)}</Text>
              <Text style={styles.debugText}>CUTOUT={shortenUrl(petImageSources?.cutout)}</Text>
              <Text style={styles.debugText}>STYLIZED={shortenUrl(petImageSources?.stylized)}</Text>
            </View>
          ) : null}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
  },
  layers: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  pet: {
    resizeMode: "contain",
  },
  petMask: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  petPlaceholder: {
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
    resizeMode: "cover",
  },
  flowerMask: {
    position: "absolute",
    bottom: 12,
    left: "22%",
    opacity: 0.9,
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
  flowerImage: {
    width: "100%",
    height: "100%",
  },
  debugBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    maxWidth: "88%",
  },
  debugText: { color: "#e2e8f0", fontSize: 10, fontWeight: "600" },
});
