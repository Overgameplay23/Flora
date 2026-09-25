import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PointsDebugSnapshot = {
  completedTaskIdsToday: string[];
  earnedPointsToday: number;
  unlockedCount: number;
  nextLockedItem: { id: string | number; name: string; requiredPoints: number } | null;
  requiredPoints: number;
  remaining: number;
  isReady: boolean;
};

type PointsDebugPanelProps = {
  snapshot: PointsDebugSnapshot;
};

export default function PointsDebugPanel({ snapshot }: PointsDebugPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    console.info("POINTS_DEBUG", {
      earnedPointsToday: snapshot.earnedPointsToday,
      requiredPoints: snapshot.requiredPoints,
      remaining: snapshot.remaining,
      unlockedCount: snapshot.unlockedCount,
      isReady: snapshot.isReady,
    });
  }, [
    snapshot.earnedPointsToday,
    snapshot.requiredPoints,
    snapshot.remaining,
    snapshot.unlockedCount,
    snapshot.isReady,
  ]);

  if (!__DEV__) return null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.headerText}>Debug</Text>
        <Text style={styles.headerHint}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.row}>earned: {snapshot.earnedPointsToday}</Text>
          <Text style={styles.row}>required: {snapshot.requiredPoints}</Text>
          <Text style={styles.row}>remaining: {snapshot.remaining}</Text>
          <Text style={styles.row}>ready: {snapshot.isReady ? "yes" : "no"}</Text>
          <Text style={styles.row}>unlocked: {snapshot.unlockedCount}</Text>
          <Text style={styles.row}>
            next: {snapshot.nextLockedItem ? `${snapshot.nextLockedItem.name} (#${snapshot.nextLockedItem.id})` : "none"}
          </Text>
          <Text style={styles.row}>completed IDs: {snapshot.completedTaskIdsToday.join(", ") || "-"}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.55)",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  headerHint: {
    color: "rgba(148,163,184,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  body: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  row: {
    color: "rgba(203,213,225,0.95)",
    fontSize: 11,
    marginTop: 4,
  },
});
