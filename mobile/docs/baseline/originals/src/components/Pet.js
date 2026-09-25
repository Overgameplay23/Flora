import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { isRecord } from "../utils/guards";

const PHOTO_SIZE = 72;

function shortenUrl(value) {
  if (!value) return "missing";
  if (value.length <= 64) return value;
  return `${value.slice(0, 32)}...${value.slice(-18)}`;
}

export default function Pet({
  state = "idle",
  imageSources = null,
  photoUrl = null,
  allowOriginal = false,
  processingStatus = null,
}) {
  const faceByState = {
    eating: "(=^.^=)",
    happy: ":)",
    excited: ":D",
    calm: ":]",
    sad: ":(",
    tired: ":'(",
    idle: ":|",
  };
  const face = faceByState[state] || ":|";
  const candidates = useMemo(() => {
    const sources = [];
    const allowStylized = imageSources?.stylized && imageSources?.alphaStylized !== false;
    const allowCutout = imageSources?.cutout && imageSources?.alphaCutout !== false;
    const photoCandidateUrl = imageSources?.photo || photoUrl || null;
    const allowOriginalSource = allowOriginal || imageSources?.allowOriginal === true;
    if (allowStylized) {
      sources.push({ type: "stylized", source: { uri: imageSources.stylized } });
    }
    if (allowCutout) {
      sources.push({ type: "cutout", source: { uri: imageSources.cutout } });
    }
    if (photoCandidateUrl) {
      sources.push({ type: "photo", source: { uri: photoCandidateUrl } });
    }
    const originalUrl = allowOriginalSource ? imageSources?.original || null : null;
    if (originalUrl && originalUrl !== photoCandidateUrl) {
      sources.push({ type: "original", source: { uri: originalUrl } });
    }
    sources.push({ type: "placeholder", source: null });
    return sources;
  }, [
    imageSources?.stylized,
    imageSources?.cutout,
    imageSources?.photo,
    imageSources?.original,
    imageSources?.allowOriginal,
    imageSources?.alphaStylized,
    imageSources?.alphaCutout,
    photoUrl,
    allowOriginal,
  ]);

  const [petIndex, setPetIndex] = useState(0);
  const petChoice = candidates.length > 0 ? candidates[Math.min(petIndex, candidates.length - 1)] : null;
  const hasProcessed = Boolean(imageSources?.stylized || imageSources?.cutout || imageSources?.photo);
  const renderSource = !petChoice
    ? "placeholder"
    : petChoice.type === "original"
      ? hasProcessed
        ? "original"
        : "originalMasked"
      : petChoice.type;
  const showMask = petChoice?.type === "original" && !hasProcessed;
  const petStyle = { width: PHOTO_SIZE, height: PHOTO_SIZE };

  useEffect(() => {
    setPetIndex(0);
  }, [
    imageSources?.stylized,
    imageSources?.cutout,
    imageSources?.photo,
    imageSources?.original,
    imageSources?.allowOriginal,
    imageSources?.alphaStylized,
    imageSources?.alphaCutout,
    photoUrl,
    allowOriginal,
  ]);

  useEffect(() => {
    if (__DEV__) {
      const source = petChoice?.source;
      const hasUri = isRecord(source) && Object.prototype.hasOwnProperty.call(source, "uri");
      const url = hasUri ? source.uri : null;
      const sourceSummary = isRecord(source) ? { keys: Object.keys(source) } : source;
      console.log("PET_RENDER_SOURCE", {
        renderSource,
        url: url || "local",
        processingStatus,
        originalUrl: imageSources?.original ?? photoUrl ?? null,
        photoUrl: imageSources?.photo ?? null,
        maskUrl: imageSources?.mask ?? null,
        cutoutUrl: imageSources?.cutout ?? null,
        stylizedUrl: imageSources?.stylized ?? null,
        alphaCutout: imageSources?.alphaCutout ?? null,
        alphaStylized: imageSources?.alphaStylized ?? null,
        maskReapplied: imageSources?.maskReapplied ?? null,
        sourceType: typeof source,
        sourceIsArray: Array.isArray(source),
        sourceIsRecord: isRecord(source),
        sourceSummary,
      });
    }
  }, [
    renderSource,
    petChoice,
    processingStatus,
    imageSources?.original,
    imageSources?.allowOriginal,
    imageSources?.photo,
    imageSources?.mask,
    imageSources?.cutout,
    imageSources?.stylized,
    photoUrl,
    allowOriginal,
  ]);

  const handlePetError = useCallback(() => {
    setPetIndex((prev) => Math.min(prev + 1, Math.max(candidates.length - 1, 0)));
  }, [candidates.length]);

  return (
    <View style={styles.wrap}>
      {petChoice?.type === "placeholder" || !petChoice ? (
        <Text style={styles.emoji}>{face}</Text>
      ) : showMask ? (
        <View style={[styles.photoMask, petStyle, { borderRadius: PHOTO_SIZE / 2 }]}>
          <Image source={petChoice.source} onError={handlePetError} style={styles.photoMasked} resizeMode="cover" />
        </View>
      ) : (
        <Image source={petChoice.source} onError={handlePetError} style={[styles.photo, petStyle]} resizeMode="contain" />
      )}
      <Text style={styles.caption}>Pet is {state}</Text>
      {__DEV__ ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugText}>RENDER_SOURCE={renderSource}</Text>
          <Text style={styles.debugText}>STATUS={processingStatus || "unknown"}</Text>
          <Text style={styles.debugText}>ORIGINAL={shortenUrl(imageSources?.original || photoUrl)}</Text>
          <Text style={styles.debugText}>PHOTO={shortenUrl(imageSources?.photo)}</Text>
          <Text style={styles.debugText}>MASK={shortenUrl(imageSources?.mask)}</Text>
          <Text style={styles.debugText}>CUTOUT={shortenUrl(imageSources?.cutout)}</Text>
          <Text style={styles.debugText}>STYLIZED={shortenUrl(imageSources?.stylized)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 8 },
  emoji: { fontSize: 48 },
  photo: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  photoMask: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#cbd5f5",
    backgroundColor: "#e2e8f0",
  },
  photoMasked: {
    width: "100%",
    height: "100%",
  },
  caption: { marginTop: 4, color: "#666" },
  debugPanel: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(226,232,240,0.45)",
  },
  debugText: {
    fontSize: 9,
    color: "#1f2937",
  },
});
