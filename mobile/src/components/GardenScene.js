import React from "react";
import { StyleSheet, View } from "react-native";
import GardenStage from "./garden/GardenStage";

/**
 * Garden tab scene. The layout itself lives in GardenStage so the Home header and the Garden tab show
 * the same garden: plants rooted in the painted soil patch, the pet sitting on the grass beside it.
 *
 * `plants` is the list of owned plants ({ id, level, maxLevel, purchasedAt }).
 * `petImageUrl` is the legacy single-URL prop; it is used only when no source set is given.
 */
export default function GardenScene({
  petImageSources,
  petImageUrl,
  plants,
  compact = false,
  allowOriginal = false,
  petName,
}) {
  const sources = petImageSources || (petImageUrl ? { original: petImageUrl, allowOriginal: true } : null);
  const plantCount = (plants || []).filter((plant) => plant && plant.level > 0).length;
  const label = `${petName || "Your pet"} in the garden. ${
    plantCount === 0 ? "Nothing is planted yet." : `${plantCount} ${plantCount === 1 ? "plant is" : "plants are"} growing in the soil patch.`
  }`;
  return (
    <View style={styles.frame}>
      <GardenStage
        height={compact ? 190 : 320}
        variant="garden"
        petImageSources={sources}
        plants={plants}
        allowOriginal={allowOriginal || (!petImageSources && !!petImageUrl)}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "#0f172a",
  },
});
