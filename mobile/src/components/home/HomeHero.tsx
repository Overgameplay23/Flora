import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import GardenStage from "../garden/GardenStage";
import SpeechBubble from "../pet/SpeechBubble";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetMood, PetReaction } from "../pet/PetPortrait";
import type { PetAct } from "../pet/vector/PetRig";
import type { PetLook } from "../../domain/petLook";
import type { ScenePlantInput } from "../../domain/gardenScene";
import type { DayPhase } from "../../domain/timeOfDay";
import type { SanctuaryTheme } from "../../domain/sanctuary";
import { brand, categories, fonts, radius, skyFor, surfaces, type } from "../../theme/tokens";
import { TIGHT_TEXT_SCALE } from "../../utils/a11y";

export type HomeHeroProps = {
  height: number;
  /** safe-area top inset; the header sits below it */
  topInset: number;
  phase: DayPhase;
  /** fixed hour for previews; defaults to now inside the scene */
  hour?: number;
  greeting: string;
  /** small line under the greeting, e.g. the date */
  subline?: string | null;
  petLine: string | null;
  daysTogether: number | null;
  sprouts: number | null;
  /** the Cozy Run under Days Together (src/domain/cozyRun.ts); null hides it (memorial, no run yet) */
  cozyRun?: { days: number; resting: boolean } | null;
  onOpenCozyRun?: () => void;
  theme: SanctuaryTheme;
  petName: string;
  petSources?: PetImageSources | null;
  petLook?: PetLook | null;
  plants?: ScenePlantInput[] | null;
  petMood?: PetMood;
  petReaction?: PetReaction | null;
  onPetReactionEnd?: () => void;
  onPetPress?: () => void;
  petAct?: PetAct | null;
  onPetActEnd?: () => void;
  petResting?: boolean;
};

type StatChipProps = {
  icon: string;
  iconColor: string;
  iconTint: string;
  value: string;
  label: string;
  /** what VoiceOver says, when the two short words on the chip are not enough */
  spoken?: string;
  hint?: string;
  night: boolean;
  onPress?: () => void;
};

function StatChip({ icon, iconColor, iconTint, value, label, spoken, hint, night, onPress }: StatChipProps) {
  const surface = night ? surfaces.night : surfaces.light;
  const body = (
    <>
      <View style={[styles.chipIcon, { backgroundColor: iconTint }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      {/* the chips sit on the painting: they grow with Larger Text, but only so far */}
      <Text style={[styles.chipValue, { color: surface.text }]} maxFontSizeMultiplier={TIGHT_TEXT_SCALE}>
        {value}
      </Text>
      <Text style={[styles.chipLabel, { color: surface.textSecondary }]} maxFontSizeMultiplier={TIGHT_TEXT_SCALE}>
        {label}
      </Text>
    </>
  );
  const look = [styles.chip, { backgroundColor: surface.paperOverScene, boxShadow: surface.shadow }];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [look, pressed && styles.chipPressed]}
        accessibilityRole="button"
        accessibilityLabel={spoken ?? `${value} ${label}`}
        accessibilityHint={hint}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={look} accessible accessibilityLabel={spoken ?? `${value} ${label}`}>
      {body}
    </View>
  );
}

/**
 * The top of Home: the pet's sanctuary as a full-bleed painting with the pet large in the lower third,
 * a time-of-day sky veil so the greeting stays readable, quiet chips (Days Together, Sprouts, and the Cozy Run,
 * which opens its screen) and the pet's line for today in a bubble beside its head.
 */
export default function HomeHero({
  height,
  topInset,
  phase,
  hour,
  greeting,
  subline,
  petLine,
  daysTogether,
  sprouts,
  cozyRun = null,
  onOpenCozyRun,
  theme,
  petName,
  petSources,
  petLook,
  plants,
  petMood = "calm",
  petReaction = null,
  onPetReactionEnd,
  onPetPress,
  petAct = null,
  onPetActEnd,
  petResting = false,
}: HomeHeroProps) {
  const sky = skyFor(phase);
  const night = sky.surface === "night" || phase === "dusk";
  const { width } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; height: number } | null>(null);
  const onPetAnchor = useCallback((next: { x: number; y: number; height: number }) => setAnchor(next), []);
  // measured so the bubble never climbs into the greeting/chips band
  const [headerBottom, setHeaderBottom] = useState(0);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  // the pet grows with the screen's width; on wide screens (iPad, desktop web) keep it inside the hero
  const baseScale = theme === "nook" ? 1.6 : 1.85;
  const petScale = Math.min(baseScale, (height * 0.46) / (0.24 * Math.max(1, width)));

  // The bubble sits beside the pet's head, on whichever side has more room.
  let bubble: React.ReactNode = null;
  if (petLine && anchor) {
    const headY = anchor.y - anchor.height * 0.86;
    const rightRoom = width - (anchor.x + anchor.height * 0.24) - 16;
    const leftRoom = anchor.x - anchor.height * 0.24 - 16;
    const onRight = rightRoom >= Math.min(200, leftRoom);
    const maxWidth = Math.max(150, Math.min(240, onRight ? rightRoom : leftRoom));
    const lowestTop = headerBottom > 0 ? headerBottom + 8 : 0;
    const bottom = Math.max(0, Math.min(height - headY, height - lowestTop - bubbleHeight));
    bubble = (
      <View
        pointerEvents="none"
        onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
        style={[
          styles.bubbleSlot,
          { bottom, maxWidth },
          onRight ? { left: anchor.x + anchor.height * 0.2 } : { right: width - (anchor.x - anchor.height * 0.2) },
        ]}
      >
        <SpeechBubble text={petLine} tail={onRight ? "bottom-left" : "bottom-right"} night={night} maxWidth={maxWidth} style={onRight ? null : styles.bubbleRightAlign} />
      </View>
    );
  }

  const place = theme === "nook" ? "window nook" : "garden";
  return (
    <GardenStage
      height={height}
      variant="hero"
      theme={theme}
      hour={hour}
      petScale={petScale}
      petImageSources={petSources}
      petLook={petLook}
      plants={plants}
      petMood={petMood}
      petReaction={petReaction}
      onPetReactionEnd={onPetReactionEnd}
      onPetPress={onPetPress}
      petLabel={petResting ? `${petName}, resting` : `Say hello to ${petName}`}
      petAct={petAct}
      onPetActEnd={onPetActEnd}
      petResting={petResting}
      petWander={false}
      onPetAnchor={onPetAnchor}
    >
      <LinearGradient pointerEvents="none" colors={sky.veil} style={[styles.veil, { height: topInset + 150 }]} />
      {/* no label on the stage itself: an accessible container would hide the greeting, chips and bubble from VoiceOver */}
      <View accessible accessibilityLabel={`${petName} in the ${place}.`} style={styles.srOnly} />
      <View
        style={[styles.header, { paddingTop: topInset + 10 }]}
        pointerEvents="box-none"
        onLayout={(event) => setHeaderBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
      >
        <View style={styles.headerText} pointerEvents="none">
          <Text style={[type.title, styles.greeting, { color: sky.text }]} accessibilityRole="header" numberOfLines={2}>
            {greeting}
          </Text>
          {subline ? <Text style={[type.meta, { color: sky.textSecondary }]}>{subline}</Text> : null}
        </View>
        <View style={styles.chips}>
          {daysTogether != null ? (
            <StatChip
              icon="flower"
              iconColor={brand.goldStrong}
              iconTint={brand.goldTint}
              value={String(daysTogether)}
              label={daysTogether === 1 ? "day" : "days"}
              spoken={`${daysTogether} ${daysTogether === 1 ? "day" : "days"} together`}
              night={night}
            />
          ) : null}
          {cozyRun ? (
            <StatChip
              icon="moon"
              iconColor={categories.rest.strong}
              iconTint={categories.rest.tint}
              value={String(cozyRun.days)}
              label={cozyRun.resting ? "resting" : "cozy run"}
              spoken={`Cozy Run${cozyRun.resting ? ", resting" : ""}: ${cozyRun.days} ${cozyRun.days === 1 ? "day" : "days"}`}
              hint="Opens your Cozy Run"
              night={night}
              onPress={onOpenCozyRun}
            />
          ) : null}
          {sprouts != null ? (
            <StatChip icon="leaf" iconColor={brand.sprout} iconTint={brand.sproutTint} value={String(sprouts)} label="Sprouts" spoken={`${sprouts} ${sprouts === 1 ? "Sprout" : "Sprouts"}`} night={night} />
          ) : null}
        </View>
      </View>
      {bubble}
    </GardenStage>
  );
}

const styles = StyleSheet.create({
  veil: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    marginBottom: 2,
  },
  chips: {
    alignItems: "flex-end",
    gap: 6,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    minHeight: 32,
    borderRadius: radius.pill,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  chipValue: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
  },
  bubbleSlot: {
    position: "absolute",
  },
  bubbleRightAlign: {
    alignSelf: "flex-end",
  },
});
