import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePet } from "../../hooks/usePet";
import { useSignedPetPhotoUrl } from "../../services/petPhotoUrls";
import { hasPortrait } from "../garden/usePetCandidates";
import PetRig from "./vector/PetRig";
import { brand } from "../../theme/tokens";
import { useTheme } from "../../theme/theme";

/**
 * The Pet tab shows the user's own pet instead of a generic icon: the painted portrait when it exists,
 * the illustrated rig while there is none (or the photo while it is still being painted), and a heart
 * before any pet is set up.
 */
export default function PetTabIcon({ focused }: { focused: boolean }) {
  const { sources, look, hasProcessedImage } = usePet();
  // the pets bucket is private: show a short-lived signed URL for the stored locator
  const uri = useSignedPetPhotoUrl(sources.stylized || sources.cutout || sources.photo || sources.original || null);
  const showRig = !!look && !(hasPortrait(sources) && uri);
  const { surface, bloom } = useTheme();
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.ring, { borderColor: focused ? surface.text : surface.track }]}>
        {showRig ? (
          <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
            <PetRig look={look} size={30} mood="calm" reducedMotion />
          </View>
        ) : uri ? (
          <Image
            source={{ uri }}
            // a painted portrait is the whole sitting pet: draw it larger and from the top so the ring shows its face
            style={hasProcessedImage ? styles.faceCrop : styles.image}
            resizeMode={hasProcessedImage ? "contain" : "cover"}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <Feather name="heart" size={16} color={focused ? surface.text : surface.textTertiary} />
        )}
      </View>
      <View style={[styles.indicator, focused && { backgroundColor: bloom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: brand.goldTint,
    borderWidth: 1.5,
  },
  image: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  faceCrop: {
    position: "absolute",
    top: 0,
    width: 46,
    height: 46,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
    marginTop: 3,
  },
});
