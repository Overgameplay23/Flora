import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { fetchGardenItems, getGardenProgress, unlockGardenItem } from "../../src/services/dailyLoop";
import { getPointsDebugSnapshot } from "../../src/domain/progressDebug";
import { applyHabitOverrides, getHabitOverrides } from "../../src/services/habitOverrides";
import PointsDebugPanel from "../../src/components/dev/PointsDebugPanel";
import { utcDateKey } from "../../src/services/taskCompletion";
import { diagLog } from "../../src/utils/diagLog";

const ICON_ROTATION = ["leaf", "sun", "wind", "droplet", "star", "cloud"];

export default function PlantStoreScreen({ navigation }) {
  const { user, userStats } = useAuth();
  const [gardenItems, setGardenItems] = useState([]);
  const [gardenUnlockRows, setGardenUnlockRows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskCompletionsToday, setTaskCompletionsToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlockingItemId, setUnlockingItemId] = useState(null);
  const todayISO = useMemo(() => utcDateKey(), []);

  const loadStoreData = useCallback(async () => {
    if (!user?.id) {
      setGardenItems([]);
      setGardenUnlockRows([]);
      setTasks([]);
      setTaskCompletionsToday([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const completionDateKey = utcDateKey();
      const [itemsResult, progress, tasksResult, completionsResult] = await Promise.all([
        fetchGardenItems(),
        getGardenProgress(user.id),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("active", true)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("task_completions")
          .select("task_id")
          .eq("user_id", user.id)
          .eq("completed_date", completionDateKey),
      ]);

      const { data: taskRows, error: tasksError } = tasksResult;
      if (tasksError) throw tasksError;
      const { data: completionRows, error: completionError } = completionsResult;
      if (completionError) {
        console.warn("PLANT_STORE_TASK_COMPLETIONS_LOAD_ERROR", completionError?.message);
      }

      const overrides = await getHabitOverrides(user.id);
      setGardenItems(itemsResult.rows || []);
      setGardenUnlockRows(progress.rows || []);
      setTasks(applyHabitOverrides(taskRows || [], overrides));
      setTaskCompletionsToday((completionRows || []).map((row) => ({ task_id: row.task_id, completed: true })));
    } catch (error) {
      console.error("PLANT_STORE_LOAD_ERROR", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadStoreData();
    }, [loadStoreData])
  );

  const pointsSnapshot = useMemo(
    () =>
      getPointsDebugSnapshot({
        tasks,
        completionsToday: taskCompletionsToday,
        gardenItems,
        gardenUnlocks: gardenUnlockRows,
        todayISO,
      }),
    [tasks, taskCompletionsToday, gardenItems, gardenUnlockRows, todayISO]
  );

  useEffect(() => {
    diagLog("GARDEN_PROGRESS", {
      earnedPointsToday: pointsSnapshot.earnedPointsToday,
      nextUnlock: pointsSnapshot.nextLockedItem?.id ?? null,
      remaining: pointsSnapshot.remaining,
    });
  }, [pointsSnapshot.earnedPointsToday, pointsSnapshot.nextLockedItem?.id, pointsSnapshot.remaining]);

  const unlockedIds = useMemo(() => {
    const nextSet = new Set();
    gardenUnlockRows.forEach((row) => {
      if (row?.item_id == null) return;
      nextSet.add(String(row.item_id));
    });
    return nextSet;
  }, [gardenUnlockRows]);

  const nextLockedItemId = pointsSnapshot.nextLockedItem ? String(pointsSnapshot.nextLockedItem.id) : null;
  const nextItem = useMemo(
    () => (nextLockedItemId ? gardenItems.find((item) => String(item.id) === nextLockedItemId) || null : null),
    [gardenItems, nextLockedItemId]
  );

  const handleUnlock = async () => {
    if (!user?.id || !nextItem || !pointsSnapshot.isReady || unlockingItemId) return;
    setUnlockingItemId(nextItem.id);
    try {
      await unlockGardenItem({
        userId: user.id,
        itemId: nextItem.id,
        streakAtUnlock: userStats?.streak ?? null,
      });
      await loadStoreData();
    } catch (error) {
      console.error("PLANT_STORE_UNLOCK_ERROR", error);
      Alert.alert("Error", "Could not unlock that item. Please try again.");
    } finally {
      setUnlockingItemId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#e2e8f0" />
        </Pressable>
        <View>
          <Text style={styles.title}>Plant Store</Text>
          <Text style={styles.subtitle}>Add to your garden</Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>
          Next unlock: {pointsSnapshot.earnedPointsToday}/{pointsSnapshot.requiredPoints} pts
        </Text>
        <Text style={styles.progressSubtitle}>
          {pointsSnapshot.remaining > 0 ? `${pointsSnapshot.remaining} pts left` : "Ready to unlock"}
        </Text>
      </View>
      <PointsDebugPanel snapshot={pointsSnapshot} />

      <FlatList
        data={gardenItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const itemId = String(item.id);
          const unlocked = unlockedIds.has(itemId);
          const isNextLocked = !unlocked && nextLockedItemId === itemId;
          const iconIndex = Math.abs(Number(item.id) || 0) % ICON_ROTATION.length;
          const explicitRequired = Number(item?.required_points);
          const hasExplicitRequired = Number.isFinite(explicitRequired);
          return (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Feather name={ICON_ROTATION[iconIndex]} size={20} color="#34d399" />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.plantName}>{item.name}</Text>
                <Text style={styles.price}>Tier {item.tier}</Text>
                {hasExplicitRequired ? (
                  <Text style={styles.requirement}>Requires {Math.max(1, Math.floor(explicitRequired))} pts</Text>
                ) : null}
              </View>
              <Pressable
                style={[
                  styles.addButton,
                  unlocked
                    ? styles.addButtonDone
                    : isNextLocked && pointsSnapshot.isReady
                      ? styles.addButtonReady
                      : styles.addButtonLocked,
                ]}
                disabled={unlocked || !isNextLocked || !pointsSnapshot.isReady || !!unlockingItemId}
                onPress={handleUnlock}
              >
                <Text style={styles.addButtonText}>
                  {unlocked
                    ? "Unlocked"
                    : !isNextLocked
                      ? "Locked"
                      : pointsSnapshot.isReady
                        ? unlockingItemId === item.id
                          ? "Unlocking..."
                          : "Unlock"
                        : `${pointsSnapshot.remaining} left`}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No garden items configured.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.12)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  title: { color: "#e2e8f0", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "rgba(148,163,184,0.8)", fontSize: 12, marginTop: 2 },
  progressCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.6)",
    padding: 12,
    marginBottom: 12,
  },
  progressTitle: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  progressSubtitle: { color: "rgba(148,163,184,0.8)", fontSize: 12, marginTop: 2 },
  list: { paddingBottom: 24, paddingTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.6)",
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,211,153,0.12)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.3)",
  },
  cardBody: { flex: 1, marginLeft: 12 },
  plantName: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  price: { color: "rgba(148,163,184,0.8)", fontSize: 12, marginTop: 2 },
  requirement: { color: "rgba(167,243,208,0.85)", fontSize: 11, marginTop: 2 },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  addButtonDone: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderColor: "rgba(16,185,129,0.45)",
  },
  addButtonReady: {
    backgroundColor: "rgba(52,211,153,0.24)",
    borderColor: "rgba(52,211,153,0.7)",
  },
  addButtonLocked: {
    backgroundColor: "rgba(148,163,184,0.2)",
    borderColor: "rgba(148,163,184,0.25)",
  },
  addButtonText: { color: "rgba(226,232,240,0.85)", fontSize: 12, fontWeight: "600" },
  empty: { color: "rgba(148,163,184,0.8)", textAlign: "center", marginTop: 18 },
});
