import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { isSupabaseUrlConfigured } from "../utils/env";

export default function EnvWarningBanner() {
  if (!__DEV__ || isSupabaseUrlConfigured()) return null;

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>SUPABASE URL not configured</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f87171",
    alignItems: "center",
    zIndex: 20,
  },
  text: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
