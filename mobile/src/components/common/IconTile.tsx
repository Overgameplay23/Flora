import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/theme";
import { radius } from "../../theme/tokens";

type IconTileProps = {
  /** Ionicons glyph (outline set) */
  icon: string;
  /** care category that colours it */
  category?: string | null;
  size?: number;
  /** `fill` when the tile sits on a card already in the category's tint */
  on?: "paper" | "fill";
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** An outline icon in a soft tinted tile, coloured by its care category (docs/design-system.md, Icons). */
export default function IconTile({ icon, category = "body", size = 40, on = "paper", round = false, style }: IconTileProps) {
  const theme = useTheme();
  const tone = theme.tone(category);
  const background = on === "fill" ? tone.tileOnFill : theme.night ? "rgba(255,255,255,0.08)" : tone.tint;
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: round ? size / 2 : Math.min(radius.tile, size * 0.36), backgroundColor: background },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon as any} size={Math.round(size * 0.5)} color={tone.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
});
