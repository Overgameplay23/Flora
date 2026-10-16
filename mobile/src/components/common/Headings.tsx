import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { type } from "../../theme/tokens";

type HeadingProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; center?: boolean };

/** A screen's own title (Fraunces), for screens without a native header or with a hero. */
export function ScreenTitle({ children, style, center }: HeadingProps) {
  const { surface } = useTheme();
  return (
    <Text style={[type.title, { color: surface.text }, center && styles.center, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Section heading inside a page (Fraunces 22, as on Home). */
export function SectionTitle({ children, style, center }: HeadingProps) {
  const { surface } = useTheme();
  return (
    <Text style={[type.h2, styles.section, { color: surface.text }, center && styles.center, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Small label above a group or a field. */
export function Eyebrow({ children, style, center, color }: HeadingProps & { color?: string }) {
  const { surface } = useTheme();
  return <Text style={[type.micro, styles.eyebrow, { color: color ?? surface.textSecondary }, center && styles.center, style]}>{children}</Text>;
}

/** Body copy in the secondary ink. */
export function Lead({ children, style, center }: HeadingProps) {
  const { surface } = useTheme();
  return <Text style={[type.callout, { color: surface.textSecondary }, center && styles.center, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: {
    marginTop: 26,
    marginBottom: 12,
  },
  eyebrow: {
    textTransform: "uppercase",
  },
  center: {
    textAlign: "center",
  },
});
