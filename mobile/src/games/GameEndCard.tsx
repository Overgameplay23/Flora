import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { createPlayTask, findPlayTask, recordPlaySession, type GameId } from "./playStats";
import { completeTaskWithResilience } from "../services/taskCompletion";

type GameEndCardProps = {
  game: GameId;
  userId: string | null | undefined;
  petName: string;
  score: number;
  summary: string;
  onPlayAgain: () => void;
  onDone: () => void;
};

type Outcome = { bestBeaten: boolean; best: number; taskCompleted: boolean; pointsAwarded: number; hasTask: boolean };

/**
 * The end of a round: records the session once, shows the score against the best, and offers to make
 * playtime a daily task (points for the garden through complete_task) when the person has none.
 */
export default function GameEndCard({ game, userId, petName, score, summary, onPlayAgain, onDone }: GameEndCardProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await recordPlaySession({ userId, game, score });
      let hasTask = result.taskCompleted;
      if (!hasTask && userId) {
        try {
          hasTask = !!(await findPlayTask(userId));
        } catch {}
      }
      if (alive) {
        setOutcome({
          bestBeaten: result.bestBeaten,
          best: result.stats.best[game] ?? score,
          taskCompleted: result.taskCompleted,
          pointsAwarded: result.pointsAwarded,
          hasTask,
        });
      }
    })();
    return () => {
      alive = false;
    };
    // record exactly once per mounted end card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPlayTask = async () => {
    if (!userId || addingTask) return;
    setAddingTask(true);
    try {
      const task = await createPlayTask(userId, petName);
      const mutation = await completeTaskWithResilience({ taskId: task.id, eventMeta: { category: "play", points: null } });
      const points = mutation.state === "success" ? mutation.result.points_awarded : 0;
      setTaskMessage(points > 0 ? `Added. Today's playtime earned +${points} pts for the garden.` : "Added. It will count from tomorrow.");
      setOutcome((prev) => (prev ? { ...prev, hasTask: true, taskCompleted: true, pointsAwarded: points } : prev));
    } catch (error) {
      console.warn("PLAY_TASK_CREATE_FAILED", (error as any)?.message || String(error));
      setTaskMessage("Couldn't add the task right now.");
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Text style={styles.title}>{outcome?.bestBeaten ? "New best!" : "Good game"}</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.summary}>{summary}</Text>
        {outcome ? (
          <Text style={styles.meta}>
            Best {outcome.best}
            {outcome.taskCompleted && outcome.pointsAwarded > 0 ? ` · +${outcome.pointsAwarded} pts for the garden` : ""}
          </Text>
        ) : (
          <ActivityIndicator color="#35d07f" style={{ marginTop: 8 }} />
        )}

        {outcome && !outcome.hasTask && userId ? (
          <Pressable style={[styles.taskButton, addingTask && styles.disabled]} onPress={addPlayTask} disabled={addingTask} accessibilityRole="button">
            <Feather name="plus-circle" size={16} color="#a7f3d0" />
            <Text style={styles.taskButtonText}>{addingTask ? "Adding…" : `Make "Play with ${petName}" a daily task`}</Text>
          </Pressable>
        ) : null}
        {taskMessage ? <Text style={styles.taskMessage}>{taskMessage}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={onDone} accessibilityRole="button">
            <Text style={styles.secondaryText}>Done</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={onPlayAgain} accessibilityRole="button">
            <Text style={styles.primaryText}>Play again</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,6,23,0.45)",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
  },
  title: { color: "#f8fafc", fontSize: 22, fontWeight: "800" },
  score: { color: "#35d07f", fontSize: 48, fontWeight: "900", marginTop: 4 },
  summary: { marginTop: 6, color: "rgba(226,232,240,0.92)", fontSize: 14, lineHeight: 20, textAlign: "center" },
  meta: { marginTop: 10, color: "rgba(148,163,184,0.95)", fontSize: 12, fontWeight: "700" },
  taskButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.6)",
    backgroundColor: "rgba(16,185,129,0.15)",
  },
  taskButtonText: { marginLeft: 8, color: "#a7f3d0", fontSize: 13, fontWeight: "700" },
  taskMessage: { marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: "600", textAlign: "center" },
  actions: { flexDirection: "row", marginTop: 18, alignSelf: "stretch" },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#35d07f",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  primaryText: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
