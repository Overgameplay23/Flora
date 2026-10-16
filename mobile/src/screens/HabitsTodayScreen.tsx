import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { notify } from "../utils/confirm";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import type { PetReaction } from "../components/pet/PetPortrait";
import PetMascot from "../components/pet/PetMascot";
import SpeechBubble from "../components/pet/SpeechBubble";
import { PetEmptyState, PetLoading, useHasPet } from "../components/pet/PetMoments";
import Screen from "../components/common/Screen";
import Button from "../components/common/Button";
import Sheet from "../components/common/Sheet";
import TextField from "../components/common/TextField";
import PressableScale from "../components/common/PressableScale";
import { useTheme } from "../theme/theme";
import { brand, ink, radius, springs, type } from "../theme/tokens";
import { success, tapSoft, warning } from "../utils/haptics";
import {
  fetchHabitsWithCompletions,
  fetchTodayCheckIn,
  setHabitCompletion,
  syncStatsAndUnlocks,
  todayKey,
  isDayComplete,
} from "../services/dailyLoop";
import { getHabits, resetHabits, saveHabits } from "../services/habitsService";

/** Habits are body care (docs/design-system.md: colour has meaning). */
const HABIT_CATEGORY = "body";

type HabitRowProps = {
  title: string;
  done: boolean;
  disabled: boolean;
  onToggle: () => void;
};

/** One habit on its sage card: a round check that pops when ticked, quieter once done. */
function HabitRow({ title, done, disabled, onToggle }: HabitRowProps) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(HABIT_CATEGORY);
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      pop.setValue(0.4);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...springs.bouncy }).start();
    } else if (!done) {
      pop.setValue(0);
    }
    wasDone.current = done;
  }, [done, pop]);
  const checkScale = pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.8, 1] });

  return (
    <PressableScale
      onPress={onToggle}
      disabled={disabled}
      pressedScale={0.98}
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked: done, disabled }}
      containerStyle={styles.rowSlot}
      style={[styles.habitRow, { backgroundColor: tone.fill, boxShadow: surface.shadow, opacity: done ? 0.62 : 1 }]}
    >
      <Animated.View
        style={[
          styles.check,
          {
            borderColor: tone.accent,
            backgroundColor: done ? tone.accent : theme.night ? "transparent" : tone.tileOnFill,
            transform: [{ scale: checkScale }],
          },
        ]}
      >
        {done ? <Ionicons name="checkmark" size={20} color={theme.night ? ink.primary : brand.cream} /> : null}
      </Animated.View>
      <Text style={[type.bodyStrong, styles.habitTitle, { color: surface.text }, done && styles.habitTitleDone]}>{title}</Text>
    </PressableScale>
  );
}

/** What the pet says over the list; first person, never counting what is left. */
function habitsLine(done: number, total: number) {
  if (total > 0 && done >= total) return "All done for today. I'm proud of you.";
  if (done === 0) return "Any one of these is plenty. I'll be right here.";
  return "That counts. The rest can wait if it needs to.";
}

export default function HabitsTodayScreen() {
  const { user, userStats, setUserStats } = useAuth();
  const { memorial } = usePet();
  const hasPet = useHasPet();
  const theme = useTheme();
  const { surface } = theme;
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<string[]>([]);
  const [editorSaving, setEditorSaving] = useState(false);
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);
  const tickedThisVisit = useRef(false);
  const celebratedAllDone = useRef(false);

  const dateKey = useMemo(() => todayKey(), []);
  const completedCount = habits.filter((h) => h.completed).length;
  const allDone = habits.length > 0 && completedCount === habits.length;

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

  // every habit ticked in this visit: one bigger moment, once
  useEffect(() => {
    if (!allDone || celebratedAllDone.current || !tickedThisVisit.current) return;
    celebratedAllDone.current = true;
    success();
    if (!memorial) setPetReaction("love");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const toggleHabit = async (habitId: number, completed: boolean) => {
    if (!user?.id || saving) return;
    setSaving(true);
    setErrorMessage("");
    const previousHabits = habits;
    try {
      const nextHabits = habits.map((h) => (h.id === habitId ? { ...h, completed } : h));
      setHabits(nextHabits);
      const willBeAllDone = nextHabits.length > 0 && nextHabits.every((h) => h.completed);
      if (completed) {
        tickedThisVisit.current = true;
        // the last tick gets the success pulse instead (effect above)
        if (!willBeAllDone) {
          tapSoft();
          if (!memorial) setPetReaction("cheer");
        }
      }
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
      // never leave a tick showing that was not saved
      setHabits(previousHabits);
      warning();
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
      warning();
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
      warning();
      setErrorMessage("Could not reset habits.");
      notify("Error", "Could not reset habits. Please try again.");
    } finally {
      setEditorSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false} centered>
        <PetLoading />
      </Screen>
    );
  }

  return (
    <Screen bottomPad={48}>
      {hasPet && habits.length > 0 ? (
        <View style={styles.petRow}>
          <PetMascot
            size={72}
            mood={allDone ? "happy" : "calm"}
            reaction={petReaction}
            onReactionEnd={() => setPetReaction(null)}
            showShadow={false}
          />
          {memorial ? null : (
            <SpeechBubble text={habitsLine(completedCount, habits.length)} tail="left" night={theme.night} style={styles.petBubble} />
          )}
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <Text style={[type.callout, styles.summary, { color: surface.textSecondary }]}>
          {completedCount} of {habits.length} done today
        </Text>
        <Button label="Edit habits" icon="create-outline" variant="secondary" size="sm" onPress={openEditor} disabled={saving || loading} />
      </View>

      {errorMessage ? <Text style={[type.meta, styles.error, { color: theme.alert }]}>{errorMessage}</Text> : null}

      {habits.length === 0 ? (
        <PetEmptyState title="No habits yet." mood="calm" style={styles.empty} />
      ) : (
        habits.map((item) => (
          <HabitRow
            key={String(item.id)}
            title={item.title}
            done={!!item.completed}
            disabled={saving}
            onToggle={() => toggleHabit(item.id, !item.completed)}
          />
        ))
      )}

      <Sheet
        visible={editorOpen}
        onClose={closeEditor}
        title="Edit habits"
        subtitle="Keep habit names short and clear."
        pet={{ mood: "calm", size: 64 }}
        locked={editorSaving}
        footer={
          <>
            <Button label="Save" onPress={handleSaveHabits} loading={editorSaving} />
            <View style={styles.sheetRow}>
              <Button label="Reset" variant="secondary" size="md" block onPress={handleResetHabits} disabled={editorSaving} containerStyle={styles.sheetButton} />
              <Button label="Cancel" variant="quiet" size="md" block onPress={closeEditor} disabled={editorSaving} containerStyle={styles.sheetButton} />
            </View>
          </>
        }
      >
        {editorDraft.map((habitTitle, index) => (
          <TextField
            key={`habit-editor-${index}`}
            label={`Habit ${index + 1}`}
            value={habitTitle}
            onChangeText={(value) => updateDraftTitle(index, value)}
            placeholder="Habit name"
            editable={!editorSaving}
            containerStyle={styles.field}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  petRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  petBubble: { flexShrink: 1, marginLeft: 12 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  summary: { flex: 1, marginLeft: 4 },
  error: { marginBottom: 10, marginLeft: 4 },
  empty: { marginTop: 12 },
  rowSlot: { marginBottom: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.row,
    borderCurve: "continuous",
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  habitTitle: { flex: 1 },
  habitTitleDone: { textDecorationLine: "line-through" },
  sheetRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  sheetButton: { flex: 1 },
  field: { marginBottom: 12 },
});
