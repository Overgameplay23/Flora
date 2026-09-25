import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait from "../components/pet/PetPortrait";
import { createPlayTask, findPlayTask, loadPlayStats, type PlayStats } from "../games/playStats";

const GAMES = [
  { id: "fetch" as const, route: "PlayFetch", title: "Fetch", blurb: "Flick the ball across the lawn. Eight throws, sixty seconds.", icon: "wind" as const },
  { id: "bubbles" as const, route: "PlayBubbles", title: "Bubbles", blurb: "Tap them before they float away. Thirty seconds.", icon: "circle" as const },
];

/** The play hub: two games, best scores, and the option to make playtime a daily task. */
export default function PlayScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, displayName } = usePet();
  const [stats, setStats] = useState<PlayStats | null>(null);
  const [hasTask, setHasTask] = useState<boolean | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadPlayStats(user?.id).then((value) => alive && setStats(value));
      if (user?.id) {
        findPlayTask(user.id)
          .then((task) => alive && setHasTask(!!task))
          .catch(() => alive && setHasTask(null));
      }
      return () => {
        alive = false;
      };
    }, [user?.id])
  );

  const addTask = async () => {
    if (!user?.id || addingTask) return;
    setAddingTask(true);
    try {
      await createPlayTask(user.id, displayName);
      setHasTask(true);
    } catch (error) {
      console.warn("PLAY_TASK_CREATE_FAILED", (error as any)?.message || String(error));
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <PetPortrait sources={sources} size={110} mood="excited" allowOriginal />
        <Text style={styles.title}>Play with {displayName}</Text>
        <Text style={styles.subtitle}>
          {stats?.sessionsToday
            ? `${stats.sessionsToday} ${stats.sessionsToday === 1 ? "game" : "games"} today. ${displayName} is thrilled.`
            : `A few minutes of play is good for both of you.`}
        </Text>
      </View>

      {GAMES.map((game) => (
        <Pressable key={game.id} style={styles.card} onPress={() => navigation.navigate(game.route)} accessibilityRole="button" accessibilityLabel={`Play ${game.title}`}>
          <View style={styles.cardIcon}>
            <Feather name={game.icon} size={20} color="#0f172a" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{game.title}</Text>
            <Text style={styles.cardBlurb}>{game.blurb}</Text>
            <Text style={styles.cardBest}>{stats?.best[game.id] ? `Best ${stats.best[game.id]}` : "Not played yet"}</Text>
          </View>
          <Feather name="play" size={20} color="#35d07f" />
        </Pressable>
      ))}

      <View style={styles.taskCard}>
        <Text style={styles.taskTitle}>Playtime and the garden</Text>
        {hasTask === null && user?.id ? (
          <ActivityIndicator color="#35d07f" style={{ alignSelf: "flex-start", marginTop: 8 }} />
        ) : hasTask ? (
          <Text style={styles.taskText}>"Play with {displayName}" is one of your daily tasks. Finishing a game completes it and earns points for the garden.</Text>
        ) : (
          <View>
            <Text style={styles.taskText}>Make playtime one of your daily tasks and every game earns points for the garden.</Text>
            <Pressable style={[styles.taskButton, addingTask && styles.disabled]} onPress={addTask} disabled={addingTask} accessibilityRole="button">
              <Text style={styles.taskButtonText}>{addingTask ? "Adding…" : `Add "Play with ${displayName}"`}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 60 },
  hero: { alignItems: "center", paddingVertical: 12 },
  title: { marginTop: 8, color: "#f8fafc", fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 6, color: "rgba(203,213,225,0.9)", fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#35d07f", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  cardBlurb: { marginTop: 2, color: "rgba(203,213,225,0.9)", fontSize: 13, lineHeight: 18 },
  cardBest: { marginTop: 6, color: "#a7f3d0", fontSize: 12, fontWeight: "700" },
  taskCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  taskTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "800" },
  taskText: { marginTop: 6, color: "rgba(203,213,225,0.9)", fontSize: 13, lineHeight: 19 },
  taskButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.6)",
    backgroundColor: "rgba(16,185,129,0.15)",
  },
  taskButtonText: { color: "#a7f3d0", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
