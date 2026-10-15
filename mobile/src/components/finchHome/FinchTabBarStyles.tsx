import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { brand, fonts, ink, surfaces } from "../../theme/tokens";

// Warm paper bar (src/theme/tokens.ts), the ink deepening on the active tab with a small bloom dot under it.
// Heights add up: icon 26 + indicator 9 + label 14 + paddings = 78, so the label is never clipped (R-61).
export const finchTabBarStyle = {
  backgroundColor: surfaces.light.paper,
  borderTopColor: surfaces.light.hairline,
  borderTopWidth: 1,
  height: 78,
  paddingTop: 8,
  paddingBottom: 6,
};

export const finchTabBarLabelStyle = {
  fontSize: 11,
  lineHeight: 14,
  fontFamily: fonts.bodyBold,
  paddingBottom: 0,
};

export const finchTabBarItemStyle = {
  paddingVertical: 2,
};

export const finchTabBarActiveTint = ink.primary;
export const finchTabBarInactiveTint = ink.tertiary;

export function renderFinchTabIcon(iconName: string, focused: boolean) {
  return (
    <View style={styles.iconWrap}>
      <Feather name={iconName as any} size={20} color={focused ? finchTabBarActiveTint : finchTabBarInactiveTint} />
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 26,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
    marginTop: 3,
  },
  indicatorActive: {
    backgroundColor: brand.bloom,
  },
});
