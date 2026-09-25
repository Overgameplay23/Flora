import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type FinchProgressCardProps = {
  current: number;
  total: number;
  remaining?: number;
};

// Painted sprout lifted from the garden background (genuinely transparent; see scripts/build-garden-scene.js).
const SPROUT_ICON = require("../../../assets/garden/scene/patch_sprout.png");

function FinchProgressCard({ current, total, remaining }: FinchProgressCardProps) {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const remainingValue = Number.isFinite(Number(remaining)) ? Math.max(0, Number(remaining)) : Math.max(total - current, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Next Garden Item: {current}/{total}</Text>
      <Text style={styles.subtitle}>{remainingValue > 0 ? `${remainingValue} pts left` : "Ready to unlock"}</Text>
      <View style={styles.barTrack}>
        <LinearGradient colors={["#35d07f", "#a3e635"]} style={[styles.barFill, { width: `${progress * 100}%` }]} />
        <View style={styles.sproutMask}>
          <Image source={SPROUT_ICON} style={styles.sproutImage} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}

export default React.memo(FinchProgressCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 14,
  },
  subtitle: {
    marginTop: 3,
    marginBottom: 10,
    color: "rgba(148,163,184,0.9)",
    fontSize: 12,
  },
  barTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.2)",
    overflow: "hidden",
    justifyContent: "center",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  sproutMask: {
    position: "absolute",
    alignSelf: "center",
    width: 24,
    height: 24,
    top: -7,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.2)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sproutImage: {
    width: "100%",
    height: "100%",
  },
});
