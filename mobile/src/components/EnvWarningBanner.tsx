import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { isSupabaseUrlConfigured } from "../utils/env";
import { brand, fonts } from "../theme/tokens";

/** Dev only: the public Supabase URL is missing from the profile the app was started with. */
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: brand.ember,
    alignItems: "center",
  },
  text: {
    color: brand.cream,
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
