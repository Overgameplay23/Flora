import React, { forwardRef, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import PetRig from "../pet/vector/PetRig";
import type { PetLook } from "../../domain/petLook";
import { CARD_RATIO, type ShareCardCopy } from "../../domain/shareCard";
import { brand, categories, fonts, ink, skies } from "../../theme/tokens";

type PetShareCardProps = {
  width: number;
  /** signed URL of the real photo */
  realUri: string | null;
  /** signed URL of the painted portrait; null draws the illustrated pet */
  paintingUri: string | null;
  look: PetLook | null;
  copy: ShareCardCopy;
  /** true once every picture on the card has loaded, so a capture is never half-drawn */
  onReady?: (ready: boolean) => void;
};

/**
 * The card someone posts: the real pet and its painting as two tilted polaroids on the dusk sky of the app icon,
 * the pet's name, and a quiet "Made with Luna". 9:16, every size relative to the width so it captures cleanly at
 * any resolution (src/screens/ShareCardScreen.tsx). Fixed colours: it looks the same at noon and at night.
 */
const PetShareCard = forwardRef<View, PetShareCardProps>(function PetShareCard({ width, realUri, paintingUri, look, copy, onReady }, ref) {
  const height = Math.round(width * CARD_RATIO);
  const u = width / 100; // one unit = 1% of the width
  // which address finished loading: a new (re-signed) address is "not loaded" until its own onLoad, with no reset
  // step that could race a cached image's immediate onLoad
  const [realLoaded, setRealLoaded] = useState<string | null>(null);
  const [artLoaded, setArtLoaded] = useState<string | null>(null);
  const ready = !!realUri && realLoaded === realUri && (!paintingUri || artLoaded === paintingUri);
  useEffect(() => {
    onReady?.(ready);
  }, [onReady, ready]);

  const frame = (rotate: string, top: number, left: number) => ({
    position: "absolute" as const,
    top,
    left,
    width: 56 * u,
    padding: 3 * u,
    paddingBottom: 2 * u,
    borderRadius: 3 * u,
    backgroundColor: brand.cream,
    transform: [{ rotate }],
    boxShadow: `0px ${1.5 * u}px ${4 * u}px rgba(20, 16, 40, 0.35)`,
  });
  // two frames of ~62% of the width in height each, stacked with room for the title above and the footer below
  const picture = { width: 50 * u, height: 50 * u, borderRadius: 2 * u };
  const caption = { fontFamily: fonts.bodyBold, fontSize: 4.2 * u, color: ink.secondary, textAlign: "center" as const, marginTop: 1.8 * u };

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width, height, overflow: "hidden", backgroundColor: skies.dusk.top }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={copy.description}
    >
      <LinearGradient colors={[skies.dusk.top, skies.dusk.mid, skies.dusk.horizon]} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
      {/* the moon of the app icon, low in the sky behind the frames */}
      <View style={{ position: "absolute", width: 70 * u, height: 70 * u, borderRadius: 35 * u, left: 15 * u, top: 52 * u, backgroundColor: "rgba(246,241,233,0.14)" }} />

      <View style={{ position: "absolute", top: 7 * u, left: 7 * u, right: 7 * u }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 5 * u, height: 5 * u, borderRadius: 2.5 * u, backgroundColor: ink.night, marginRight: 2 * u }} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 4.2 * u, color: ink.nightSecondary, letterSpacing: 0.4 * u }} allowFontScaling={false}>
            LUNA
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 10 * u, lineHeight: 12 * u, color: ink.night, marginTop: 2 * u }} numberOfLines={2} allowFontScaling={false}>
          {copy.title}
        </Text>
      </View>

      <View style={frame("-4deg", 31 * u, 7 * u)}>
        {realUri ? (
          <Image source={{ uri: realUri }} style={picture} resizeMode="cover" onLoad={() => setRealLoaded(realUri)} onError={() => setRealLoaded(null)} />
        ) : (
          <View style={[picture, { backgroundColor: categories.connection.tint }]} />
        )}
        <Text style={caption} allowFontScaling={false}>
          {copy.realLabel}
        </Text>
      </View>

      <View style={frame("3.5deg", 97 * u, 37 * u)}>
        <View style={[picture, { backgroundColor: categories.calm.tint, alignItems: "center", justifyContent: "center", overflow: "hidden" }]}>
          {paintingUri ? (
            <Image source={{ uri: paintingUri }} style={{ width: 46 * u, height: 46 * u }} resizeMode="contain" onLoad={() => setArtLoaded(paintingUri)} onError={() => setArtLoaded(null)} />
          ) : look ? (
            <PetRig look={look} size={44 * u} mood="happy" reducedMotion />
          ) : null}
        </View>
        <Text style={caption} allowFontScaling={false}>
          {copy.artLabel}
        </Text>
      </View>

      <Text
        style={{ position: "absolute", left: 7 * u, right: 7 * u, bottom: 6 * u, fontFamily: fonts.bodySemibold, fontSize: 3.6 * u, color: ink.night, opacity: 0.85, textAlign: "center" }}
        allowFontScaling={false}
      >
        {copy.footer}
      </Text>
    </View>
  );
});

export default PetShareCard;
