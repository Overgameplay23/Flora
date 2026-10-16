import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/theme";
import { fonts, radius, type } from "../../theme/tokens";

export type StatItem = {
  value: string | number;
  label: string;
  /** Ionicons glyph in the category's colour above the number */
  icon?: string;
  category?: string | null;
};

/** A row of small numbers on paper (days together, plants, check-ins), split by hairlines. */
export default function StatStrip({ items, style }: { items: StatItem[]; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <View style={[styles.strip, { backgroundColor: surface.paper, boxShadow: surface.shadow }, style]}>
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: surface.hairline }]} /> : null}
          <View style={styles.stat} accessible accessibilityLabel={`${item.value} ${item.label}`}>
            {item.icon ? <Ionicons name={item.icon as any} size={16} color={theme.tone(item.category).accent} style={styles.icon} /> : null}
            <Text style={[styles.value, { color: surface.text }]}>{item.value}</Text>
            <Text style={[type.meta, styles.label, { color: surface.textSecondary }]} numberOfLines={2}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    borderCurve: "continuous",
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    marginTop: 2,
    textAlign: "center",
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
  },
});
