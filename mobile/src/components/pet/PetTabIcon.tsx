import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePet } from "../../hooks/usePet";

/**
 * The Pet tab shows the user's own pet instead of a generic icon: the stylized cutout when it exists,
 * the photo while it is still being painted, and a heart before any pet is set up.
 */
export default function PetTabIcon({ focused }: { focused: boolean }) {
  const { sources, hasProcessedImage } = usePet();
  const uri = sources.stylized || sources.cutout || sources.photo || sources.original || null;
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.ring, focused && styles.ringActive]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode={hasProcessedImage ? "contain" : "cover"}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <Feather name="heart" size={16} color={focused ? "#35d07f" : "rgba(148,163,184,0.8)"} />
        )}
      </View>
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(53,208,127,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.45)",
  },
  ringActive: {
    borderColor: "#35d07f",
    backgroundColor: "rgba(53,208,127,0.24)",
  },
  image: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
    marginTop: 3,
  },
  indicatorActive: {
    backgroundColor: "#35d07f",
  },
});
