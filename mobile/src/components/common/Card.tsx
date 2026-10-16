import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import PressableScale from "./PressableScale";
import { useTheme } from "../../theme/theme";
import { radius } from "../../theme/tokens";

type CardProps = {
  children?: React.ReactNode;
  /** a care category: the card takes its tint (night: plain paper, the accent carries the colour) */
  tone?: string | null;
  /** `sunken` for wells and quiet blocks without a shadow */
  variant?: "paper" | "sunken";
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "link" | "summary" | "text" | "none";
  style?: StyleProp<ViewStyle>;
  /** outer layout (width in a grid, margins) for tappable cards; `style` dresses the part that scales */
  containerStyle?: StyleProp<ViewStyle>;
};

/** Warm paper card: squircle corners, warm shadow; tappable cards give under the finger. */
export default function Card({
  children,
  tone = null,
  variant = "paper",
  padded = true,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  style,
  containerStyle,
}: CardProps) {
  const theme = useTheme();
  const { surface } = theme;
  const background = variant === "sunken" ? surface.sunken : tone ? theme.tone(tone).fill : surface.paper;
  const dress: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: background, boxShadow: variant === "sunken" ? "none" : surface.shadow },
    style,
  ];
  if (onPress || onLongPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={450}
        disabled={disabled}
        accessibilityRole={accessibilityRole ?? (onPress ? "button" : undefined)}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        containerStyle={containerStyle}
        style={dress}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={[containerStyle, dress]} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  padded: {
    padding: 16,
  },
});
