import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { getGardenProgress } from "../services/dailyLoop";
import { supabase } from "../lib/supabase";

type GardenItem = {
  id: number;
  name: string;
  tier: number;
};

export default function GardenProgressScreen() {
  const { user, userStats } = useAuth();
  const [items, setItems] = useState<GardenItem[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data: baseItems, error: itemsError } = await supabase
          .from("garden_items")
          .select("id, name, tier")
          .order("tier")
          .order("id");
        if (itemsError) throw itemsError;
        setItems(baseItems || []);

        const progress = await getGardenProgress(user.id);
        const unlockedSet = new Set<number>();
        progress.rows.forEach((row: any) => unlockedSet.add(row.item_id));
        setUnlockedIds(unlockedSet);
        setFallbackWarning(progress.fallback ? progress.warning || "Using fallback garden progress." : null);
      } catch (error) {
        console.error("GARDEN_PROGRESS_ERROR", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Garden progress</Text>
      <Text style={styles.subtitle}>Streak {userStats?.streak ?? 0} - Earn task points in Home to unlock your next item.</Text>
      {fallbackWarning ? <Text style={styles.warning}>{fallbackWarning}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const unlocked = unlockedIds.has(item.id);
          return (
            <View style={[styles.itemRow, unlocked ? styles.itemUnlocked : styles.itemLocked]}>
              <Text style={[styles.itemName, unlocked ? styles.unlockedText : styles.lockedText]}>{item.name}</Text>
              <Text style={styles.itemTier}>Tier {item.tier}</Text>
              <Text style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                {unlocked ? "Unlocked" : "Locked"}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No garden items configured.</Text>}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#e2e8f0" },
  subtitle: { fontSize: 12, color: "rgba(148,163,184,0.85)", marginTop: 4, marginBottom: 12 },
  itemRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemUnlocked: {
    borderColor: "rgba(16,185,129,0.5)",
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  itemLocked: {
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  itemName: { fontSize: 16, fontWeight: "600" },
  unlockedText: { color: "#a7f3d0" },
  lockedText: { color: "#e2e8f0" },
  itemTier: { color: "rgba(148,163,184,0.8)", fontSize: 12, marginTop: 4 },
  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeUnlocked: {
    backgroundColor: "rgba(16,185,129,0.2)",
    color: "#a7f3d0",
  },
  badgeLocked: {
    backgroundColor: "rgba(148,163,184,0.15)",
    color: "rgba(148,163,184,0.9)",
  },
  warning: { color: "#fbbf24", fontSize: 12, marginBottom: 8 },
  empty: { color: "rgba(148,163,184,0.8)", textAlign: "center", marginTop: 20 },
});
