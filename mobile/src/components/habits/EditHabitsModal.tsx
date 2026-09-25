import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type TaskRow = {
  id?: string | number;
  remoteId?: string | number;
  title?: string;
  points?: number;
};

type HabitDraft = {
  taskId: string;
  title: string;
  points: 2 | 3;
};

type EditHabitsModalProps = {
  visible: boolean;
  tasks: TaskRow[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (drafts: HabitDraft[]) => void;
};

function toDrafts(tasks: TaskRow[]): HabitDraft[] {
  return (tasks || []).map((task, index) => {
    const taskId = String(task?.remoteId ?? task?.id ?? `local-${index}`);
    const title = typeof task?.title === "string" ? task.title : "";
    const points = Number(task?.points) === 3 ? 3 : 2;
    return { taskId, title, points };
  });
}

export default function EditHabitsModal({ visible, tasks, saving = false, onCancel, onSave }: EditHabitsModalProps) {
  const [drafts, setDrafts] = useState<HabitDraft[]>([]);

  useEffect(() => {
    if (!visible) return;
    setDrafts(toDrafts(tasks));
  }, [tasks, visible]);

  const hasRows = useMemo(() => drafts.length > 0, [drafts.length]);

  const updateTitle = (taskId: string, value: string) => {
    setDrafts((prev) => prev.map((row) => (row.taskId === taskId ? { ...row, title: value } : row)));
  };

  const updatePoints = (taskId: string, points: 2 | 3) => {
    setDrafts((prev) => prev.map((row) => (row.taskId === taskId ? { ...row, points } : row)));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit habits</Text>
          <Text style={styles.subtitle}>Rename habits and set each one to 2 or 3 points.</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {hasRows ? (
              drafts.map((row, index) => (
                <View key={`habit-edit-${row.taskId}`} style={styles.rowCard}>
                  <Text style={styles.rowLabel}>Habit {index + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={row.title}
                    onChangeText={(value) => updateTitle(row.taskId, value)}
                    placeholder="Habit name"
                    placeholderTextColor="rgba(148,163,184,0.75)"
                    editable={!saving}
                  />
                  <View style={styles.pointsWrap}>
                    <Pressable
                      style={[styles.pointsButton, row.points === 2 && styles.pointsButtonActive]}
                      onPress={() => updatePoints(row.taskId, 2)}
                      disabled={saving}
                    >
                      <Text style={[styles.pointsText, row.points === 2 && styles.pointsTextActive]}>2 pts</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.pointsButton, row.points === 3 && styles.pointsButtonActive]}
                      onPress={() => updatePoints(row.taskId, 3)}
                      disabled={saving}
                    >
                      <Text style={[styles.pointsText, row.points === 3 && styles.pointsTextActive]}>3 pts</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No active habits available.</Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.saveButton, (!hasRows || saving) && styles.saveButtonDisabled]}
              onPress={() => onSave(drafts)}
              disabled={!hasRows || saving}
            >
              <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "82%",
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    padding: 16,
  },
  title: { color: "#e2e8f0", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "rgba(148,163,184,0.88)", fontSize: 12, marginTop: 4 },
  scroll: { marginTop: 12, maxHeight: 360 },
  scrollContent: { paddingBottom: 4 },
  rowCard: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "rgba(15,23,42,0.65)",
  },
  rowLabel: { color: "rgba(148,163,184,0.9)", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.85)",
    color: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  pointsWrap: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pointsButton: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: "rgba(30,41,59,0.7)",
  },
  pointsButtonActive: {
    borderColor: "rgba(52,211,153,0.7)",
    backgroundColor: "rgba(16,185,129,0.22)",
  },
  pointsText: { color: "#e2e8f0", fontSize: 12, fontWeight: "600" },
  pointsTextActive: { color: "#a7f3d0" },
  empty: { color: "rgba(148,163,184,0.8)", textAlign: "center", marginVertical: 18 },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    minWidth: 90,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: "rgba(148,163,184,0.4)",
    backgroundColor: "rgba(30,41,59,0.7)",
  },
  cancelText: { color: "#e2e8f0", fontSize: 12, fontWeight: "600" },
  saveButton: {
    borderColor: "rgba(52,211,153,0.65)",
    backgroundColor: "rgba(16,185,129,0.25)",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: { color: "#a7f3d0", fontSize: 12, fontWeight: "700" },
});
