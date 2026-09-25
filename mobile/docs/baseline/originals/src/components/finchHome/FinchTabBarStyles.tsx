import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

export const finchTabBarStyle = {
  backgroundColor: "#0f1420",
  borderTopColor: "rgba(148,163,184,0.2)",
  borderTopWidth: 1,
  height: 72,
  paddingTop: 8,
  paddingBottom: 8,
};

export const finchTabBarLabelStyle = {
  fontSize: 11,
  fontWeight: "600",
  paddingBottom: 6,
};

export const finchTabBarItemStyle = {
  paddingVertical: 6,
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
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
    marginTop: 4,
  },
  indicatorActive: {
    backgroundColor: "#35d07f",
  },
});
