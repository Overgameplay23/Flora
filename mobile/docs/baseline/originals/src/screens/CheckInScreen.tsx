import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import Pet from "../components/Pet";
import BreathingModal from "../components/checkin/BreathingModal";
import PetExpressionOverlay, { type PetExpression } from "../components/pet/PetExpressionOverlay";
import {
  applyGentleStreakUpdate,
  fetchHabitsWithCompletions,
  fetchTodayCheckIn,
  isDayComplete,
  saveCheckIn,
  syncStatsAndUnlocks,
  todayKey,
} from "../services/dailyLoop";
import { logCheckinSubmitted } from "../services/retention";
import { derivePetState } from "../utils/petState";
import { isProtectedMood } from "../domain/protectedMode";

type CheckinCopyOptions = {
  isProtectedMode: boolean;
  hasExistingCheckin: boolean;
};

function getCheckinCopy({ isProtectedMode, hasExistingCheckin }: CheckinCopyOptions) {
  if (isProtectedMode) {
    return {
      title: "Daily check-in",
      subtitle: "No pressure. Keep it simple today.",
      promptLabel: "Something that helped (optional)",
      promptPlaceholder: "A small thing that helped...",
      submitLabel: "That's enough for today",
      breathingLabel: "1-minute breathing",
    };
  }

  return {
    title: "Daily check-in",
    subtitle: "How are you feeling today?",
    promptLabel: "One win today (optional)",
    promptPlaceholder: "I took a short walk...",
    submitLabel: hasExistingCheckin ? "Update today" : "Save check-in",
    breathingLabel: "",
  };
}

export default function CheckInScreen() {
  const { user, profile, setProfile, setUserStats, setPetEmotionState } = useAuth();
  const nav = useNavigation();
  const [mood, setMood] = useState<number>(3);
  const [win, setWin] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [breathingOpen, setBreathingOpen] = useState(false);

  const dateKey = useMemo(() => todayKey(), []);
  const livePetState = useMemo(() => derivePetState(mood), [mood]);
  const isProtectedMode = isProtectedMood(mood);
  const petExpression: PetExpression = isProtectedMode ? "sad" : mood === 3 ? "neutral" : "happy";
  const checkinCopy = useMemo(
    () => getCheckinCopy({ isProtectedMode, hasExistingCheckin: Boolean(checkinId) }),
    [isProtectedMode, checkinId],
  );
  const prevPetStateRef = useRef<string | null>(null);
  const prevBreathingOpenRef = useRef(false);

  useEffect(() => {
    if (!isProtectedMode && breathingOpen) setBreathingOpen(false);
  }, [isProtectedMode, breathingOpen]);

  useEffect(() => {
    if (__DEV__) {
      console.info("PET_EXPRESSION", { mood, petExpression });
    }
  }, [mood, petExpression]);

  useEffect(() => {
    const prevOpen = prevBreathingOpenRef.current;
    if (__DEV__) {
      if (!prevOpen && breathingOpen) {
        console.info("BREATHING_MODAL", { action: "open" });
      } else if (prevOpen && !breathingOpen) {
        console.info("BREATHING_MODAL", { action: "close" });
      }
    }
    prevBreathingOpenRef.current = breathingOpen;
  }, [breathingOpen]);

  useEffect(() => {
    const loadCheckIn = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const row = await fetchTodayCheckIn(user.id, dateKey);
        if (row) {
          setMood(row.mood_score ?? 3);
          setWin(row.win_text ?? "");
          setCheckinId(row.id ?? null);
          setStatus("You already checked in today. You can edit it once today.");
        }
      } catch (error) {
        console.error("CHECKIN_LOAD_ERROR", error);
        setErrorMessage("We couldn't load today's check-in. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadCheckIn();
  }, [user?.id, dateKey]);

  useEffect(() => {
    if (prevPetStateRef.current === livePetState) return;
    prevPetStateRef.current = livePetState;
    setPetEmotionState?.(livePetState);
    console.info("PET_EMOTION_MIRROR_LIVE", { mood, state: livePetState });
  }, [livePetState, mood, setPetEmotionState]);

  async function handleSubmit() {
    if (!user?.id || saving) return;
    setStatus("");
    setErrorMessage("");
    try {
      setSaving(true);
      const saved = await saveCheckIn(user.id, mood, win, dateKey);
      try {
        await logCheckinSubmitted({
          occurredAt: new Date().toISOString(),
          mood: saved.mood_score ?? mood,
          winText: saved.win_text ?? win,
        });
      } catch (retentionError: any) {
        console.warn("RETENTION_CHECKIN_LOG_FAILED", retentionError?.message || String(retentionError));
      }
      setCheckinId(saved?.id ?? null);
      setStatus("Saved for today.");
      const gentleStreak = await applyGentleStreakUpdate(user.id, dateKey);
      setProfile?.((prev: any) => ({
        ...(prev || profile || {}),
        user_id: user.id,
        current_streak: gentleStreak.current_streak,
        best_streak: gentleStreak.best_streak,
        streak_count: gentleStreak.current_streak,
        last_checkin_date: gentleStreak.last_checkin_date,
      }));
      const mirroredState = derivePetState(saved.mood_score ?? mood);
      setPetEmotionState?.(mirroredState);
      console.info("PET_EMOTION_MIRROR", { mood: saved.mood_score ?? mood, state: mirroredState });

      const habits = await fetchHabitsWithCompletions(user.id, dateKey);
      const completed = habits.filter((h) => h.completed).length;
      const completionRate = habits.length === 0 ? 0 : completed / habits.length;
      const hasCompletedDay = isDayComplete(saved, habits);
      const stats = await syncStatsAndUnlocks({
        userId: user.id,
        dateKey,
        hasCompletedDay,
        moodScore: saved.mood_score,
        habitCompletionRate: completionRate,
      });
      setUserStats?.(stats);
      setStatus(hasCompletedDay ? "Check-in saved and your day is complete." : "Check-in saved. Add habits when you're ready.");
      Alert.alert("Saved", hasCompletedDay ? "Day completed! Your pet is happier." : "Check-in saved.");
      nav.goBack();
    } catch (error: any) {
      console.error("CHECKIN_SAVE_ERROR", error);
      setErrorMessage("Failed to save. Please try again.");
      Alert.alert("Error", "Failed to save your check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{checkinCopy.title}</Text>
      <Text style={styles.subtitle}>{checkinCopy.subtitle}</Text>

      <View style={styles.petPreview}>
        <View style={styles.petVisual}>
          <Pet state={livePetState} />
          <View pointerEvents="none" style={styles.expressionOverlaySlot}>
            <PetExpressionOverlay expression={petExpression} />
          </View>
        </View>
        <Text style={styles.petMirrorText}>Pet reaction: {livePetState}</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={5}
        step={1}
        value={mood}
        minimumTrackTintColor="#34d399"
        maximumTrackTintColor="#e2e8f0"
        thumbTintColor="#10b981"
        onValueChange={(value) => setMood(Math.round(value))}
      />
      <Text style={styles.moodLabel}>Mood: {mood}/5</Text>

      <Text style={styles.fieldLabel}>{checkinCopy.promptLabel}</Text>
      <TextInput
        style={styles.input}
        placeholder={checkinCopy.promptPlaceholder}
        value={win}
        onChangeText={setWin}
        multiline
      />

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{checkinCopy.submitLabel}</Text>
      </Pressable>

      {isProtectedMode ? (
        <Pressable style={styles.breathingButton} onPress={() => setBreathingOpen(true)}>
          <Text style={styles.breathingButtonText}>{checkinCopy.breathingLabel}</Text>
        </Pressable>
      ) : null}

      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 22, fontWeight: "700", color: "#e2e8f0", textAlign: "center" },
  subtitle: { marginTop: 6, fontSize: 13, color: "rgba(148,163,184,0.9)", textAlign: "center" },
  petPreview: { alignItems: "center", marginTop: 10 },
  petVisual: { position: "relative", alignItems: "center", justifyContent: "flex-start" },
  expressionOverlaySlot: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 72,
    height: 72,
    marginLeft: -36,
  },
  petMirrorText: { color: "#cbd5e1", fontSize: 12, marginTop: 4 },
  slider: { width: "100%", height: 40, marginVertical: 20 },
  moodLabel: { fontSize: 16, color: "#e2e8f0", textAlign: "center", marginBottom: 12 },
  fieldLabel: { color: "#cbd5e1", fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    marginBottom: 14,
    color: "#e2e8f0",
  },
  status: { color: "#a7f3d0", fontSize: 12, marginBottom: 8 },
  error: { color: "#fecdd3", fontSize: 12, marginBottom: 8 },
  button: {
    backgroundColor: "#34d399",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  breathingButton: {
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.6)",
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 10,
  },
  breathingButtonText: { color: "#a7f3d0", fontWeight: "700", fontSize: 15 },
});
