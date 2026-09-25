import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { notify } from "../utils/confirm";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchHabitsWithCompletions,
  fetchTodayCheckIn,
  setHabitCompletion,
  syncStatsAndUnlocks,
  todayKey,
  isDayComplete,
} from "../services/dailyLoop";
import { getHabits, resetHabits, saveHabits } from "../services/habitsService";

export default function HabitsTodayScreen() {
  const { user, userStats, setUserStats } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<string[]>([]);
  const [editorSaving, setEditorSaving] = useState(false);

  const dateKey = useMemo(() => todayKey(), []);
  const completedCount = habits.filter((h) => h.completed).length;

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchHabitsWithCompletions(user.id, dateKey);
        setHabits(data);
      } catch (error) {
        console.error("HABITS_LOAD_ERROR", error);
        setErrorMessage("Could not load habits.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, dateKey]);

  const toggleHabit = async (habitId: number, completed: boolean) => {
    if (!user?.id || saving) return;
    setSaving(true);
    setErrorMessage("");
    try {
      const nextHabits = habits.map((h) => (h.id === habitId ? { ...h, completed } : h));
      setHabits(nextHabits);
      await setHabitCompletion(user.id, habitId, completed, dateKey);

      const checkIn = await fetchTodayCheckIn(user.id, dateKey);
      const nextCompleted = nextHabits.filter((h) => h.completed).length;
      const completionRate = nextHabits.length === 0 ? 0 : nextCompleted / nextHabits.length;
      const dayComplete = isDayComplete(checkIn, nextHabits);
      const stats = await syncStatsAndUnlocks({
        userId: user.id,
        dateKey,
        hasCompletedDay: dayComplete,
        moodScore: checkIn?.mood_score ?? null,
        habitCompletionRate: completionRate,
      });
      setUserStats?.(stats);
    } catch (error) {
      console.error("HABITS_TOGGLE_ERROR", error);
      setErrorMessage("Could not update habit. Please try again.");
      notify("Error", "Could not update that habit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openEditor = () => {
    setEditorDraft(habits.map((habit) => habit.title || ""));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (editorSaving) return;
    setEditorOpen(false);
  };

  const updateDraftTitle = (index: number, value: string) => {
    setEditorDraft((prev) => prev.map((title, itemIndex) => (itemIndex === index ? value : title)));
  };

  const applyLocalHabitTitles = async () => {
    const localHabits = await getHabits();
    setHabits((prev) =>
      prev.map((habit, index) => ({
        ...habit,
        title: localHabits[index] ?? habit.title,
      }))
    );
    if (__DEV__) {
      console.info("HABITS_UPDATED", { count: localHabits.length });
    }
  };

  const handleSaveHabits = async () => {
    if (editorSaving) return;
    setEditorSaving(true);
    setErrorMessage("");
    try {
      await saveHabits(editorDraft);
      await applyLocalHabitTitles();
      setEditorOpen(false);
    } catch (error) {
      console.error("HABITS_SAVE_ERROR", error);
      setErrorMessage("Could not save habit names.");
      notify("Error", "Could not save habit names. Please try again.");
    } finally {
      setEditorSaving(false);
    }
  };

  const handleResetHabits = async () => {
    if (editorSaving) return;
    setEditorSaving(true);
    setErrorMessage("");
    try {
      await resetHabits();
      const localHabits = await getHabits();
      setEditorDraft((prev) => prev.map((_, index) => localHabits[index] ?? ""));
      await applyLocalHabitTitles();
    } catch (error) {
      console.error("HABITS_RESET_ERROR", error);
      setErrorMessage("Could not reset habits.");
      notify("Error", "Could not reset habits. Please try again.");
    } finally {
      setEditorSaving(false);
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Habits today</Text>
        <Pressable style={styles.editButton} onPress={openEditor} disabled={saving || loading}>
          <Text style={styles.editButtonText}>Edit habits</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        {completedCount}/{habits.length} completed - Streak {userStats?.streak ?? 0}
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggleHabit(item.id, !item.completed)}
            style={[styles.habitRow, item.completed && styles.habitRowDone]}
            disabled={saving}
          >
            <View style={[styles.checkbox, item.completed && styles.checkboxDone]} />
            <Text style={[styles.habitTitle, item.completed && styles.habitTitleDone]}>{item.title}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No habits yet.</Text>}
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit habits</Text>
            <Text style={styles.modalSubtitle}>Keep habit names short and clear.</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {editorDraft.map((habitTitle, index) => (
                <View key={`habit-editor-${index}`} style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Habit {index + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={habitTitle}
                    onChangeText={(value) => updateDraftTitle(index, value)}
                    placeholder="Habit name"
                    placeholderTextColor="rgba(148,163,184,0.7)"
                    editable={!editorSaving}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalActionButton, styles.modalCancelButton]} onPress={closeEditor} disabled={editorSaving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalActionButton, styles.modalResetButton]} onPress={handleResetHabits} disabled={editorSaving}>
                <Text style={styles.modalResetText}>Reset</Text>
              </Pressable>
              <Pressable style={[styles.modalActionButton, styles.modalSaveButton]} onPress={handleSaveHabits} disabled={editorSaving}>
                <Text style={styles.modalSaveText}>{editorSaving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#e2e8f0" },
  editButton: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  editButtonText: { color: "rgba(226,232,240,0.9)", fontSize: 12, fontWeight: "600" },
  subtitle: { fontSize: 12, color: "rgba(148,163,184,0.85)", marginTop: 4, marginBottom: 12 },
  error: { color: "#fecdd3", marginBottom: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    marginBottom: 8,
  },
  habitRowDone: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderColor: "rgba(16,185,129,0.45)",
  },
  habitTitle: { color: "#e2e8f0", fontSize: 15 },
  habitTitleDone: { color: "#a7f3d0", textDecorationLine: "line-through" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.6)",
    marginRight: 12,
  },
  checkboxDone: {
    borderColor: "#34d399",
    backgroundColor: "rgba(52,211,153,0.25)",
  },
  empty: { color: "rgba(148,163,184,0.8)", textAlign: "center", marginTop: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "#0f172a",
    padding: 16,
  },
  modalTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "700" },
  modalSubtitle: { color: "rgba(148,163,184,0.9)", fontSize: 12, marginTop: 4, marginBottom: 10 },
  modalScroll: { maxHeight: 320 },
  modalScrollContent: { paddingBottom: 8 },
  inputWrap: { marginBottom: 10 },
  inputLabel: { color: "#cbd5e1", fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#e2e8f0",
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalActionButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 78,
    alignItems: "center",
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    backgroundColor: "rgba(30,41,59,0.7)",
  },
  modalCancelText: { color: "#e2e8f0", fontSize: 12, fontWeight: "600" },
  modalResetButton: {
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.35)",
    backgroundColor: "rgba(13,148,136,0.2)",
  },
  modalResetText: { color: "#99f6e4", fontSize: 12, fontWeight: "600" },
  modalSaveButton: {
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.55)",
    backgroundColor: "rgba(16,185,129,0.25)",
  },
  modalSaveText: { color: "#a7f3d0", fontSize: 12, fontWeight: "700" },
});
