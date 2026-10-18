import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { useTheme } from "../../theme/theme";
import { brand, fonts, ink, radius } from "../../theme/tokens";
import { selection } from "../../utils/haptics";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** care category for the selected colour (default: body sage) */
  category?: string | null;
  icon?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * What VoiceOver calls it: "checkbox" when several can be on (default), "radio" when it is one of a set, "button"
   * when tapping it does something rather than choosing (it then has no checked state).
   */
  role?: "checkbox" | "radio" | "button";
  style?: StyleProp<ViewStyle>;
};

/** A pill to pick an option. Selected chips fill with their category's strong tone; a selection tick on change. */
export default function Chip({ label, selected = false, onPress, category = "body", icon, disabled, accessibilityLabel, role = "checkbox", style }: ChipProps) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(category);
  const background = selected ? (theme.night ? tone.mid : tone.strong) : surface.sunken;
  const color = selected ? (theme.night ? ink.primary : brand.cream) : surface.text;
  const body = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon as any} size={15} color={selected ? color : tone.accent} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
  if (!onPress) {
    return <View style={[styles.chip, { backgroundColor: background }, style]}>{body}</View>;
  }
  return (
    <PressableScale
      onPress={() => {
        selection();
        onPress();
      }}
      disabled={disabled}
      pressedScale={0.94}
      accessibilityRole={role}
      accessibilityState={role === "button" ? { disabled } : role === "radio" ? { selected, checked: selected, disabled } : { checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, { backgroundColor: background }, disabled && styles.disabled, style]}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
});
