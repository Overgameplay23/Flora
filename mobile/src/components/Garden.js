import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Garden({ level = 0 }) {
  const label =
    level >= 4 ? "Lush Garden" :
    level >= 3 ? "Blooming" :
    level >= 2 ? "Sprouting" :
    level >= 1 ? "Seedling" :
    "Empty Plot";

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e7f6ef",
    alignItems: "center",
    marginBottom: 8,
  },
  text: { color: "#2d6a4f", fontWeight: "600" },
});
