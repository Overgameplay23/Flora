import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

// Heights add up: icon 26 + indicator 9 + label 14 + paddings = 78, so the label is no longer clipped (R-61).
export const finchTabBarStyle = {
  backgroundColor: "#0f1420",
  borderTopColor: "rgba(148,163,184,0.2)",
  borderTopWidth: 1,
  height: 78,
  paddingTop: 8,
  paddingBottom: 6,
};

export const finchTabBarLabelStyle = {
  fontSize: 11,
  lineHeight: 14,
  fontWeight: "600",
  paddingBottom: 0,
};

export const finchTabBarItemStyle = {
  paddingVertical: 2,
};

export function renderFinchTabIcon(iconName: string, focused: boolean) {
  return (
    <View style={styles.iconWrap}>
      <Feather name={iconName as any} size={20} color={focused ? "#35d07f" : "rgba(148,163,184,0.8)"} />
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
    backgroundColor: "#35d07f",
  },
});
