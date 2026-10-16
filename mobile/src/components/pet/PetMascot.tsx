import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import PetPortrait, { type PetMood, type PetReaction } from "./PetPortrait";
import SpeechBubble from "./SpeechBubble";
import { usePet } from "../../hooks/usePet";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetLook } from "../../domain/petLook";

type PetMascotProps = {
  /** pet height in layout units */
  size: number;
  /** a line the pet says, in a bubble above it */
  say?: string | null;
  mood?: PetMood;
  reaction?: PetReaction | null;
  onReactionEnd?: () => void;
  onPress?: () => void;
  showShadow?: boolean;
  /** show the unpainted upload when that is all there is (it counts as "a pet to draw" below) */
  allowOriginal?: boolean;
  night?: boolean;
  /** overrides for previews; normally the signed-in user's pet is used */
  sources?: PetImageSources | null;
  look?: PetLook | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * The user's own pet as the app's mascot: the painted portrait (or the rig while there is none), wherever
 * a screen needs a friendly face (empty states, celebrations, sheets). Reads the pet itself, so a call site
 * is just <PetMascot size={64} />; it rests in memorial mode.
 */
export default function PetMascot({
  size,
  say = null,
  mood = "calm",
  reaction = null,
  onReactionEnd,
  onPress,
  showShadow = true,
  allowOriginal = true,
  night = false,
  sources,
  look,
  style,
}: PetMascotProps) {
  const pet = usePet();
  const resting = !!pet.memorial;
  // a mascot never shows the "add a photo" placeholder: with no pet to draw, it simply isn't there
  const hasSomething = !!(sources ?? null) || !!(look ?? null) || pet.hasAnyImage || !!pet.look;
  if (!hasSomething) return null;
  return (
    <View style={[styles.wrap, style]}>
      {say ? <SpeechBubble text={say} tail="bottom-left" night={night} style={styles.bubble} /> : null}
      <PetPortrait
        sources={sources ?? pet.sources}
        look={look ?? pet.look}
        size={size}
        mood={resting ? "calm" : mood}
        resting={resting}
        reaction={reaction}
        onReactionEnd={onReactionEnd}
        onPress={onPress}
        showShadow={showShadow}
        allowOriginal={allowOriginal}
        emptyLabel=""
        accessibilityLabel={`${pet.displayName}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  bubble: {
    marginBottom: 6,
    alignSelf: "center",
  },
});
