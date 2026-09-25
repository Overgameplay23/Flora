// Every task for today in one list, in the garden's own visual language. The rows are the same
// cards as Home; the copy avoids "improve your mood" bargaining (product strategy report).
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { notify } from "../utils/confirm";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait from "../components/pet/PetPortrait";
import FinchTaskCard from "../components/finchHome/FinchTaskCard";
import { playDing } from "../utils/sfx";
import { completeTaskWithResilience, completionDateKey } from "../services/taskCompletion";
import { getTaskPoints } from "../domain/taskPoints";
import { isPlayTask } from "../games/playStatsLogic";

type Task = {
  id: number | string;
  title: string;
  done: boolean;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
};

const ICONS = ["droplet", "book", "feather", "sun", "wind", "heart"];

export default function DailyTasksScreen() {
  const { user } = useAuth();
  const { sources, look, displayName, memorial } = usePet();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskIds, setCompletingTaskIds] = useState<Record<string, boolean>>({});
  const [completingAll, setCompletingAll] = useState(false);
  const [taskMutationNoticeById, setTaskMutationNoticeById] = useState<Record<string, { type: "error" | "queued"; message: string }>>({});

  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data: rows, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at");
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const { data: completionRows, error: completionError } = await supabase
      .from("task_completions")
      .select("task_id")
      .eq("user_id", user.id)
      .eq("completed_date", completionDateKey());
    if (completionError) {
      console.error(completionError);
    }
    const completedIds = new Set((completionRows || []).map((row) => String(row.task_id)));
    const merged = (rows || []).map((task) => ({
      id: task.id,
      title: task.title,
      done: completedIds.has(String(task.id)),
      category: task.category ?? task.type ?? null,
      difficulty: task.difficulty ?? null,
      points: Number.isFinite(Number(task.points)) ? Number(task.points) : null,
    }));
    setTasks(merged);
    setTaskMutationNoticeById((prev) => {
      const next = { ...prev };
      merged.forEach((task) => {
        if (task.done) delete next[String(task.id)];
      });
      return next;
    });
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const toggleTask = async (id: number | string, options?: { retry?: boolean }) => {
    const retry = !!options?.retry;
    const task = tasks.find((t) => t.id === id);
    if (!task || !user?.id) return;
    if (task.done) {
      notify("Already done today", "That one is already in the garden.");
      return;
    }
    const key = String(id);
    if (completingTaskIds[key] || completingAll) return;

    setCompletingTaskIds((prev) => ({ ...prev, [key]: true }));
    setTaskMutationNoticeById((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const mutation = await completeTaskWithResilience({
        taskId: id,
        retry,
        eventMeta: { category: task.category ?? null, difficulty: task.difficulty ?? null, points: task.points ?? null },
      });
      if (mutation.state === "queued") {
        setTaskMutationNoticeById((prev) => ({ ...prev, [key]: { type: "queued", message: "Queued. Will sync when online." } }));
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
      if (mutation.result.inserted) playDing();
      else notify("Already done today", "That one is already in the garden.");
    } catch (error) {
      setTaskMutationNoticeById((prev) => ({ ...prev, [key]: { type: "error", message: "Couldn't save. Tap to retry." } }));
      console.error("TASK_COMPLETE_ERROR", error);
    } finally {
      setCompletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const completeAll = async () => {
    if (!user?.id || completingAll) return;
    const incomplete = tasks.filter((task) => !task.done);
    if (incomplete.length === 0) return;
    setCompletingAll(true);
    let insertedCount = 0;
    try {
      for (const task of incomplete) {
        const taskKey = String(task.id);
        const mutation = await completeTaskWithResilience({
          taskId: task.id,
          eventMeta: { category: task.category ?? null, difficulty: task.difficulty ?? null, points: task.points ?? null },
        });
        if (mutation.state === "queued") {
          setTaskMutationNoticeById((prev) => ({ ...prev, [taskKey]: { type: "queued", message: "Queued. Will sync when online." } }));
          continue;
        }
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: true } : t)));
        if (mutation.result.inserted) insertedCount += 1;
      }
      if (insertedCount > 0) playDing();
    } catch (error) {
      console.error("TASK_COMPLETE_ALL_ERROR", error);
      setTaskMutationNoticeById((prev) => ({ ...prev, __all__: { type: "error", message: "Couldn't save everything. Tap a task to retry." } }));
    } finally {
      setCompletingAll(false);
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const remaining = tasks.length - doneCount;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <PetPortrait sources={sources} look={look} size={64} mood={allDone ? "happy" : "calm"} resting={!!memorial} allowOriginal emptyLabel="Pet" style={styles.heroPet} />
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>Today with {displayName}</Text>
          <Text style={styles.heroLine}>
            {tasks.length === 0
              ? "Nothing on the list yet."
              : allDone
                ? "All done. Nothing more is expected today."
                : `${doneCount} of ${tasks.length} done. Do what fits, in any order.`}
          </Text>
        </View>
      </View>

      {taskMutationNoticeById.__all__?.type === "error" ? <Text style={styles.errorLine}>{taskMutationNoticeById.__all__.message}</Text> : null}

      {tasks.length === 0 ? (
        <Text style={styles.empty}>No tasks yet. Edit your habits from Home to add some.</Text>
      ) : (
        tasks.map((task, index) => {
          const key = String(task.id);
          const notice = taskMutationNoticeById[key];
          const isSaving = !!completingTaskIds[key];
          return (
            <View key={key} style={styles.row}>
              <FinchTaskCard
                title={task.title}
                reward={`${getTaskPoints({ title: task.title, category: task.category, points: task.points, difficulty: task.difficulty == null ? null : String(task.difficulty) })} pts`}
                icon={isPlayTask(task.title) ? "play" : ICONS[index % ICONS.length]}
                completed={task.done}
                saving={isSaving}
                disabled={task.done || isSaving || completingAll}
                onToggle={() => toggleTask(task.id)}
              />
              {notice?.type === "error" ? (
                <Pressable onPress={() => toggleTask(task.id, { retry: true })}>
                  <Text style={styles.errorLine}>{notice.message}</Text>
                </Pressable>
              ) : null}
              {notice?.type === "queued" ? <Text style={styles.queuedLine}>{notice.message}</Text> : null}
            </View>
          );
        })
      )}

      {remaining > 1 && !memorial ? (
        <Pressable style={[styles.allButton, completingAll && styles.allButtonBusy]} onPress={completeAll} disabled={completingAll} accessibilityRole="button" accessibilityLabel="Mark the rest done">
          <Text style={styles.allButtonText}>{completingAll ? "Saving…" : `Mark the other ${remaining} done`}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(53,208,127,0.10)",
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.28)",
    marginBottom: 14,
  },
  heroPet: { marginRight: 12 },
  heroBody: { flex: 1 },
  heroTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  heroLine: { marginTop: 4, color: "rgba(226,232,240,0.9)", fontSize: 14, lineHeight: 20 },
  row: { marginBottom: 2 },
  errorLine: { color: "#fca5a5", marginTop: 4, marginBottom: 8, fontSize: 12, textDecorationLine: "underline" },
  queuedLine: { color: "#fcd34d", marginTop: 4, marginBottom: 8, fontSize: 12 },
  empty: { color: "rgba(148,163,184,0.85)", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 24 },
  allButton: {
    marginTop: 18,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.6)",
    backgroundColor: "rgba(53,208,127,0.14)",
  },
  allButtonBusy: { opacity: 0.6 },
  allButtonText: { color: "#86efac", fontWeight: "700", fontSize: 14 },
});
