import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { useTheme } from "../../theme/theme";
import { brand, fonts, ink, radius } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "plum" | "danger";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** Ionicons glyph before the label */
  icon?: string;
  variant?: ButtonVariant;
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  /** stretch to the width of its container (default for lg) */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

const HEIGHTS = { lg: 54, md: 44, sm: 36 } as const;
const LABEL_SIZES = { lg: 16, md: 15, sm: 13 } as const;

/**
 * The app's buttons. primary: bloom fill with ink label (5.5:1), one per screen. secondary: a sunken pill.
 * quiet: text only. plum: serious, deliberate actions (memorial). danger: a quiet rose label (sign out).
 */
export default function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  block,
  accessibilityLabel,
  accessibilityHint,
  style,
  containerStyle,
}: ButtonProps) {
  const theme = useTheme();
  const { surface } = theme;
  const off = disabled || loading;
  const looks = {
    primary: { bg: theme.bloom, fg: ink.primary },
    secondary: { bg: surface.sunken, fg: surface.text },
    quiet: { bg: "transparent", fg: surface.textSecondary },
    plum: { bg: theme.night ? brand.bloomNight : brand.plum, fg: theme.night ? ink.primary : brand.cream },
    danger: { bg: "transparent", fg: theme.alert },
  }[variant];
  const stretch = block ?? size === "lg";
  return (
    <PressableScale
      onPress={off ? undefined : onPress}
      disabled={off}
      pressedScale={size === "sm" ? 0.94 : 0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      containerStyle={[stretch ? styles.block : styles.inline, containerStyle]}
      style={[
        styles.button,
        { height: HEIGHTS[size], paddingHorizontal: size === "sm" ? 14 : 20, backgroundColor: looks.bg },
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={looks.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon as any} size={LABEL_SIZES[size] + 2} color={looks.fg} /> : null}
          <Text style={[styles.label, { color: looks.fg, fontSize: LABEL_SIZES[size] }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: "stretch",
  },
  inline: {
    alignSelf: "flex-start",
  },
  button: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: fonts.bodyHeavy,
  },
  disabled: {
    opacity: 0.45,
  },
});
