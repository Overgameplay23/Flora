import { useState, useEffect } from "react";
import { View, Text, Pressable, SafeAreaView, FlatList, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { playDing } from "../utils/sfx";
import { completeTaskWithResilience, utcDateKey } from "../services/taskCompletion";

type Task = {
  id: number | string;
  title: string;
  done: boolean;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
};

export default function DailyTasksScreen({ navigation }: any) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskIds, setCompletingTaskIds] = useState<Record<string, boolean>>({});
  const [completingAll, setCompletingAll] = useState(false);
  const [taskMutationNoticeById, setTaskMutationNoticeById] = useState<Record<string, { type: "error" | "queued"; message: string }>>({});

  useEffect(() => {
    const fetchTasks = async () => {
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
        .eq("completed_date", utcDateKey());
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
          if (task.done) {
            delete next[String(task.id)];
          }
        });
        return next;
      });
      setLoading(false);
    };
    fetchTasks();
  }, [user?.id]);

  const toggleTask = async (id: number | string, options?: { retry?: boolean }) => {
    const retry = !!options?.retry;
    const task = tasks.find((t) => t.id === id);
    if (!task || !user?.id) return;
    if (task.done) {
      Alert.alert("Already completed today", "This task was already completed today.");
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
        eventMeta: {
          category: task.category ?? null,
          difficulty: task.difficulty ?? null,
          points: task.points ?? null,
        },
      });
      if (mutation.state === "queued") {
        setTaskMutationNoticeById((prev) => ({
          ...prev,
          [key]: { type: "queued", message: "Queued. Will sync when online." },
        }));
        return;
      }

      const result = mutation.result;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
      if (result.inserted) {
        playDing();
      } else {
        Alert.alert("Already completed today", "This task was already completed today.");
      }
    } catch (error) {
      setTaskMutationNoticeById((prev) => ({
        ...prev,
        [key]: { type: "error", message: "Couldn't save. Tap to retry." },
      }));
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
    let alreadyCompletedCount = 0;
    try {
      for (const task of incomplete) {
        const taskKey = String(task.id);
        const mutation = await completeTaskWithResilience({
          taskId: task.id,
          eventMeta: {
            category: task.category ?? null,
            difficulty: task.difficulty ?? null,
            points: task.points ?? null,
          },
        });
        if (mutation.state === "queued") {
          setTaskMutationNoticeById((prev) => ({
            ...prev,
            [taskKey]: { type: "queued", message: "Queued. Will sync when online." },
          }));
          continue;
        }
        const result = mutation.result;
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: true } : t)));
        if (result.inserted) insertedCount += 1;
        else alreadyCompletedCount += 1;
      }
      if (insertedCount > 0) {
        playDing();
      }
      if (alreadyCompletedCount > 0) {
        Alert.alert("Already completed today", "Some tasks were already completed today.");
      }
    } catch (error) {
      console.error("TASK_COMPLETE_ALL_ERROR", error);
      setTaskMutationNoticeById((prev) => ({
        ...prev,
        __all__: { type: "error", message: "Couldn't save. Tap a task to retry." },
      }));
    } finally {
      setCompletingAll(false);
    }
  };

  const allTasksCompleted = tasks.length > 0 && tasks.every((task) => task.done);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a", padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#e2e8f0" />
        </Pressable>
        <Text style={{ color: "#e2e8f0", fontSize: 18, fontWeight: "600" }}>Daily Tasks</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={() => (
          <View>
            <Text style={{ color: "rgba(148,163,184,0.9)", marginTop: 6 }}>Complete these tasks to improve your mood.</Text>
            {taskMutationNoticeById.__all__?.type === "error" ? (
              <Text style={{ color: "#fca5a5", marginTop: 6, fontSize: 12 }}>{taskMutationNoticeById.__all__.message}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: "rgba(148,163,184,0.8)" }}>No tasks yet.</Text>}
        renderItem={({ item }) => {
          const taskKey = String(item.id);
          const isSaving = !!completingTaskIds[taskKey];
          const notice = taskMutationNoticeById[taskKey];
          return (
            <View style={{ marginVertical: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "rgba(15,23,42,0.7)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.25)" }}>
                <Pressable
                  onPress={() => toggleTask(item.id)}
                  disabled={item.done || completingAll || isSaving}
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 2,
                    borderColor: item.done ? "#34d399" : "rgba(148,163,184,0.6)",
                    backgroundColor: item.done ? "rgba(52,211,153,0.25)" : "transparent",
                    borderRadius: 6,
                    marginRight: 12,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: item.done ? "#a7f3d0" : "#e2e8f0", textDecorationLine: item.done ? "line-through" : "none" }}>
                    {item.title}
                  </Text>
                  {isSaving ? <Text style={{ color: "#fcd34d", marginTop: 4, fontSize: 12 }}>Saving...</Text> : null}
                </View>
              </View>
              {notice?.type === "error" ? (
                <Pressable onPress={() => toggleTask(item.id, { retry: true })}>
                  <Text style={{ color: "#fca5a5", marginTop: 6, fontSize: 12, textDecorationLine: "underline" }}>{notice.message}</Text>
                </Pressable>
              ) : null}
              {notice?.type === "queued" ? (
                <Text style={{ color: "#fcd34d", marginTop: 6, fontSize: 12 }}>{notice.message}</Text>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={() => (
          <Pressable
            onPress={completeAll}
            disabled={allTasksCompleted || completingAll}
            style={{
              marginTop: 16,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: allTasksCompleted || completingAll ? "rgba(148,163,184,0.2)" : "#3b82f6",
            }}
          >
            <Text style={{ color: "#e2e8f0", fontWeight: "700" }}>
              {completingAll ? "Completing..." : "Complete All"}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
